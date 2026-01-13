import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import validator from "validator";
import {
  MAX_NAME_LENGTH,
  MAX_URL_LENGTH,
  ACTIVE_SESSION_STATUSES,
} from "./lib/constants";

/**
 * Validates an image URL.
 * Uses validator.js for robust URL validation.
 */
function isValidImageUrl(url: string): boolean {
  if (!url || url.length > MAX_URL_LENGTH) return false;

  return validator.isURL(url, {
    protocols: ["http", "https"],
    require_protocol: true,
    require_valid_protocol: true,
    allow_underscores: true,
  });
}

/**
 * Validates and trims a map name.
 * Throws ConvexError if invalid.
 */
function validateAndTrimName(name: string): string {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    throw new ConvexError("Map name cannot be empty");
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new ConvexError(
      `Map name cannot exceed ${MAX_NAME_LENGTH} characters`
    );
  }
  return trimmedName;
}

/**
 * Validates and trims an image URL.
 * Throws ConvexError if invalid.
 */
function validateAndTrimImageUrl(imageUrl: string): string {
  const trimmedImageUrl = imageUrl.trim();
  if (trimmedImageUrl.length === 0) {
    throw new ConvexError("Image URL cannot be empty");
  }
  if (!isValidImageUrl(trimmedImageUrl)) {
    throw new ConvexError(
      "Invalid image URL. Must be a valid HTTP or HTTPS URL."
    );
  }
  return trimmedImageUrl;
}

// Reusable validator for map objects returned by queries
const mapObjectValidator = v.object({
  _id: v.id("maps"),
  _creationTime: v.number(),
  name: v.string(),
  imageUrl: v.string(),
  isActive: v.boolean(),
  updatedAt: v.number(),
});

/**
 * List all maps, optionally including inactive ones.
 * Returns maps sorted alphabetically by name.
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
    if (args.includeInactive) {
      // Return all maps sorted by name
      return await ctx.db
        .query("maps")
        .withIndex("by_name")
        .order("asc")
        .collect();
    }

    // Return only active maps, sorted by name
    // Uses compound index: filter by isActive=true, results sorted by name
    return await ctx.db
      .query("maps")
      .withIndex("by_isActive_and_name", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

/**
 * Get a single map by ID.
 * Returns null if map doesn't exist.
 */
export const getMap = query({
  args: {
    mapId: v.id("maps"),
  },
  returns: v.union(mapObjectValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mapId);
  },
});

/**
 * Create a new map with validation.
 * Sets isActive=true by default.
 */
export const createMap = mutation({
  args: {
    name: v.string(),
    imageUrl: v.string(),
  },
  returns: v.object({ mapId: v.id("maps") }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    const trimmedName = validateAndTrimName(args.name);
    const trimmedImageUrl = validateAndTrimImageUrl(args.imageUrl);

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
      isActive: true,
      updatedAt: Date.now(),
    });

    return { mapId };
  },
});

/**
 * Update an existing map with validation.
 */
export const updateMap = mutation({
  args: {
    mapId: v.id("maps"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    // Verify map exists
    const existing = await ctx.db.get(args.mapId);
    if (!existing) {
      throw new ConvexError("Map not found");
    }

    // Build updates object
    const updates: {
      name?: string;
      imageUrl?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    // Handle name update
    if (args.name !== undefined) {
      const trimmedName = validateAndTrimName(args.name);

      // Only check for duplicates if name is actually changing
      if (trimmedName !== existing.name) {
        const duplicate = await ctx.db
          .query("maps")
          .withIndex("by_name", (q) => q.eq("name", trimmedName))
          .first();

        if (duplicate) {
          throw new ConvexError("A map with this name already exists");
        }
      }

      updates.name = trimmedName;
    }

    // Handle imageUrl update
    if (args.imageUrl !== undefined) {
      updates.imageUrl = validateAndTrimImageUrl(args.imageUrl);
    }

    // Check for active session usage if name or imageUrl is changing
    const nameChanging = updates.name !== undefined && updates.name !== existing.name;
    const imageChanging = updates.imageUrl !== undefined && updates.imageUrl !== existing.imageUrl;

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

    await ctx.db.patch(args.mapId, updates);
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
 * Client should POST file to this URL, then use ctx.storage.getUrl(storageId)
 * to get a permanent URL for the uploaded file.
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
