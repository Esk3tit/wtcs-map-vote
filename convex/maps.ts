/**
 * Maps Module
 *
 * Manages the master map pool for voting sessions.
 * Maps can have images via URL or Convex storage upload, and support soft-delete (deactivation).
 */

import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

import { v, ConvexError } from "convex/values";

import { ACTIVE_SESSION_STATUSES } from "./lib/constants";
import { isSecureUrl } from "./lib/urlValidation";
import { validateName } from "./lib/validation";
import { validateStorageFile } from "./lib/storageValidation";

// ============================================================================
// Private Helpers
// ============================================================================

const validateMapName = (name: string) => validateName(name, "Map");

/**
 * Validates an optional image URL with SSRF protection.
 * Returns trimmed URL or undefined if empty/null.
 * Throws ConvexError if URL is invalid.
 */
function validateImageUrl(
  imageUrl: string | undefined | null
): string | undefined {
  if (!imageUrl) return undefined;
  const trimmed = imageUrl.trim();
  if (!trimmed) return undefined;
  if (!isSecureUrl(trimmed)) {
    throw new ConvexError(
      "Invalid image URL. Must be a valid HTTP/HTTPS URL that doesn't point to internal addresses."
    );
  }
  return trimmed;
}

// ============================================================================
// Validators
// ============================================================================

/**
 * Validator for map objects returned by queries.
 * Matches the maps table schema.
 */
const mapObjectValidator = v.object({
  _id: v.id("maps"),
  _creationTime: v.number(),
  name: v.string(),
  imageUrl: v.optional(v.string()),
  imageStorageId: v.optional(v.id("_storage")),
  isActive: v.boolean(),
  updatedAt: v.number(),
});

// ============================================================================
// Types
// ============================================================================

/**
 * Type for map document from database.
 */
type MapDoc = {
  _id: Id<"maps">;
  _creationTime: number;
  name: string;
  imageUrl?: string;
  imageStorageId?: Id<"_storage">;
  isActive: boolean;
  updatedAt: number;
};

/**
 * Resolves a map's imageStorageId to a URL if present.
 * Prefers storage URL over external URL when both exist.
 * Returns the map with resolved imageUrl.
 */
async function resolveMapImageUrl(
  ctx: QueryCtx,
  map: MapDoc
): Promise<MapDoc> {
  if (map.imageStorageId) {
    const resolvedUrl = await ctx.storage.getUrl(map.imageStorageId);
    return {
      ...map,
      imageUrl: resolvedUrl ?? map.imageUrl,
    };
  }
  return map;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * List all maps, optionally including inactive ones.
 * Returns maps sorted alphabetically by name.
 * Resolves imageStorageId to URL for display - prefers storage over URL when both exist.
 *
 * Uses compound index for efficient filtering + sorting:
 * - Active only: by_isActive_and_name with isActive=true (sorted by name)
 * - All maps: by_name index (sorted by name)
 */
export const listMaps = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(mapObjectValidator),
  handler: async (ctx, args) => {
    const maps = args.includeInactive
      ? await ctx.db.query("maps").withIndex("by_name").order("asc").collect()
      : await ctx.db
          .query("maps")
          .withIndex("by_isActive_and_name", (q) => q.eq("isActive", true))
          .order("asc")
          .collect();

    // Resolve storage IDs to URLs in parallel
    return Promise.all(maps.map((map) => resolveMapImageUrl(ctx, map)));
  },
});

/**
 * Get a single map by ID.
 * Returns null if map doesn't exist.
 * Resolves imageStorageId to URL for display.
 */
export const getMap = query({
  args: {
    mapId: v.id("maps"),
  },
  returns: v.union(mapObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const map = await ctx.db.get(args.mapId);
    if (!map) return null;

    return resolveMapImageUrl(ctx, map);
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new map with validation.
 * Accepts either imageUrl (external URL) OR imageStorageId (Convex storage), not both.
 * Sets isActive=true by default.
 */
export const createMap = mutation({
  args: {
    name: v.string(),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.object({ mapId: v.id("maps") }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)

    const trimmedName = validateMapName(args.name);

    // Normalize imageUrl first (handles whitespace-only strings)
    const trimmedImageUrl = validateImageUrl(args.imageUrl);

    // Validate mutual exclusivity: can't provide both imageUrl and imageStorageId
    if (trimmedImageUrl && args.imageStorageId) {
      throw new ConvexError(
        "Cannot provide both imageUrl and imageStorageId. Choose one."
      );
    }

    // Require at least one image source
    if (!trimmedImageUrl && !args.imageStorageId) {
      throw new ConvexError(
        "An image is required. Provide imageUrl or upload a file."
      );
    }

    // Validate storage file if provided (size and content type)
    if (args.imageStorageId) {
      await validateStorageFile(ctx, args.imageStorageId);
    }

    // Check uniqueness (indexes don't enforce uniqueness in Convex)
    // Note: There's a theoretical race condition where two concurrent requests
    // could both pass this check before either inserts. This is acceptable for
    // this low-traffic admin application (~12 concurrent users max per spec).
    const existingMap = await ctx.db
      .query("maps")
      .withIndex("by_name", (q) => q.eq("name", trimmedName))
      .first();

    if (existingMap) {
      throw new ConvexError("A map with this name already exists");
    }

    const mapId = await ctx.db.insert("maps", {
      name: trimmedName,
      imageUrl: trimmedImageUrl,
      imageStorageId: args.imageStorageId,
      isActive: true,
      updatedAt: Date.now(),
    });

    return { mapId };
  },
});

/**
 * Update an existing map with validation.
 * Handles URL↔Storage transitions with mutual exclusivity:
 * - Setting imageUrl clears imageStorageId (and vice versa)
 * - Setting both to null removes image entirely (error - image required)
 * - Replaces old storage files when updating imageStorageId
 */
export const updateMap = mutation({
  args: {
    mapId: v.id("maps"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)

    // Verify map exists
    const existing = await ctx.db.get(args.mapId);
    if (!existing) {
      throw new ConvexError("Map not found");
    }

    // Validate mutual exclusivity: can't set both in same update call
    const settingImageUrl = args.imageUrl !== undefined && args.imageUrl !== null;
    const settingImageStorageId =
      args.imageStorageId !== undefined && args.imageStorageId !== null;
    if (settingImageUrl && settingImageStorageId) {
      throw new ConvexError(
        "Cannot set both imageUrl and imageStorageId. Choose one."
      );
    }

    // Validate storage file if being set (size and content type)
    if (settingImageStorageId) {
      await validateStorageFile(ctx, args.imageStorageId!);
    }

    // Build updates object
    const updates: {
      name?: string;
      imageUrl?: string | undefined;
      imageStorageId?: typeof existing.imageStorageId;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    // Handle name update
    if (args.name !== undefined) {
      const trimmedName = validateMapName(args.name);

      // Only check for duplicates and update if name is actually changing
      if (trimmedName !== existing.name) {
        const duplicate = await ctx.db
          .query("maps")
          .withIndex("by_name", (q) => q.eq("name", trimmedName))
          .first();

        if (duplicate) {
          throw new ConvexError("A map with this name already exists");
        }

        updates.name = trimmedName;
      }
    }

    // Track if we need to clean up old storage
    let oldStorageIdToDelete: typeof existing.imageStorageId | undefined;

    // Handle imageUrl update (null means unset)
    if (args.imageUrl !== undefined) {
      if (args.imageUrl === null) {
        updates.imageUrl = undefined;
        // If clearing URL and we have a storage file, keep storage (unless explicitly clearing it)
        // But if no storage and clearing URL, that's an error (need at least one image source)
        if (!existing.imageStorageId && args.imageStorageId === undefined) {
          throw new ConvexError(
            "Cannot remove image URL without providing an uploaded image."
          );
        }
      } else {
        const validatedUrl = validateImageUrl(args.imageUrl);
        updates.imageUrl = validatedUrl;
        // Setting URL clears storage ID
        if (validatedUrl && existing.imageStorageId) {
          updates.imageStorageId = undefined;
          oldStorageIdToDelete = existing.imageStorageId;
        }
      }
    }

    // Handle imageStorageId update (null means unset)
    if (args.imageStorageId !== undefined) {
      if (args.imageStorageId === null) {
        updates.imageStorageId = undefined;
        // If clearing storage and we have no URL, that's an error
        if (!existing.imageUrl && args.imageUrl === undefined) {
          throw new ConvexError(
            "Cannot remove uploaded image without providing an image URL."
          );
        }
        // Delete the old storage file if we're unsetting
        if (existing.imageStorageId) {
          oldStorageIdToDelete = existing.imageStorageId;
        }
      } else {
        updates.imageStorageId = args.imageStorageId;
        // Setting storage ID clears URL
        if (existing.imageUrl) {
          updates.imageUrl = undefined;
        }
        // Replace old storage file if different
        if (
          existing.imageStorageId &&
          existing.imageStorageId !== args.imageStorageId
        ) {
          oldStorageIdToDelete = existing.imageStorageId;
        }
      }
    }

    // Final validation: ensure at least one image source will remain after update
    // Use hasOwn to distinguish "set to undefined" from "never set"
    const hasImageUrlUpdate = Object.hasOwn(updates, "imageUrl");
    const hasImageStorageIdUpdate = Object.hasOwn(updates, "imageStorageId");

    // Determine final state of each field after applying updates
    const finalImageUrl = hasImageUrlUpdate
      ? updates.imageUrl
      : existing.imageUrl;
    const finalStorageId = hasImageStorageIdUpdate
      ? updates.imageStorageId
      : existing.imageStorageId;

    if (!finalImageUrl && !finalStorageId) {
      throw new ConvexError(
        "Cannot remove all image sources. A map must have either an image URL or uploaded image."
      );
    }

    // Check for active session usage if name or image is changing
    const nameChanging =
      updates.name !== undefined && updates.name !== existing.name;
    const imageChanging = hasImageUrlUpdate || hasImageStorageIdUpdate;

    if (nameChanging || imageChanging) {
      const sessionMapsWithMap = await ctx.db
        .query("sessionMaps")
        .withIndex("by_mapId", (q) => q.eq("mapId", args.mapId))
        .collect();

      if (sessionMapsWithMap.length > 0) {
        const sessionIds = [
          ...new Set(sessionMapsWithMap.map((sm) => sm.sessionId)),
        ];
        const sessions = await Promise.all(
          sessionIds.map((id) => ctx.db.get(id))
        );
        const activeSession = sessions.find(
          (session) => session && ACTIVE_SESSION_STATUSES.has(session.status)
        );

        if (activeSession) {
          throw new ConvexError(
            `Cannot update map "${existing.name}": it is currently in use in an active session`
          );
        }
      }
    }

    // Patch database first - ensures update succeeds before cleanup
    await ctx.db.patch(args.mapId, updates);

    // Then cleanup old storage (safe to fail - just creates orphan)
    if (oldStorageIdToDelete) {
      await ctx.storage.delete(oldStorageIdToDelete);
    }

    return { success: true };
  },
});

/**
 * Deactivate a map (soft delete).
 * Throws error if map is used in an active session.
 */
export const deactivateMap = mutation({
  args: {
    mapId: v.id("maps"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    const map = await ctx.db.get(args.mapId);
    if (!map) {
      throw new ConvexError("Map not found");
    }

    if (!map.isActive) {
      throw new ConvexError("Map is already inactive");
    }

    // Check if map is used in active sessions
    const sessionMapsWithMap = await ctx.db
      .query("sessionMaps")
      .withIndex("by_mapId", (q) => q.eq("mapId", args.mapId))
      .collect();

    if (sessionMapsWithMap.length > 0) {
      // Batch-fetch sessions in parallel (N+1 fix)
      const sessionIds = [
        ...new Set(sessionMapsWithMap.map((sm) => sm.sessionId)),
      ];
      const sessions = await Promise.all(
        sessionIds.map((id) => ctx.db.get(id))
      );

      const activeSession = sessions.find(
        (session) => session && ACTIVE_SESSION_STATUSES.has(session.status)
      );

      if (activeSession) {
        throw new ConvexError(
          `Cannot deactivate map "${map.name}": it is currently in use in an active session`
        );
      }
    }

    await ctx.db.patch(args.mapId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Reactivate a previously deactivated map.
 */
export const reactivateMap = mutation({
  args: {
    mapId: v.id("maps"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    const map = await ctx.db.get(args.mapId);
    if (!map) {
      throw new ConvexError("Map not found");
    }

    if (map.isActive) {
      throw new ConvexError("Map is already active");
    }

    // Check if another map with the same name now exists
    const duplicate = await ctx.db
      .query("maps")
      .withIndex("by_name", (q) => q.eq("name", map.name))
      .first();

    if (duplicate && duplicate._id !== args.mapId) {
      throw new ConvexError(
        `Cannot reactivate: another map named "${map.name}" already exists`
      );
    }

    await ctx.db.patch(args.mapId, {
      isActive: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Generate a short-lived upload URL for map images.
 *
 * ## Usage Workflow
 * 1. Call this mutation to get an upload URL
 * 2. POST the file to the URL:
 *    ```
 *    fetch(uploadUrl, {
 *      method: "POST",
 *      headers: { "Content-Type": file.type },
 *      body: file
 *    })
 *    ```
 * 3. Extract storageId from response: `const { storageId } = await response.json()`
 * 4. Pass storageId to createMap/updateMap as imageStorageId
 *
 * ## Constraints
 * - Max file size: 2MB
 * - Allowed types: PNG, JPG, WebP
 * - URL expires in ~1 hour
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    return await ctx.storage.generateUploadUrl();
  },
});
