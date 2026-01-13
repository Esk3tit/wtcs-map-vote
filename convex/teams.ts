import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { ACTIVE_SESSION_STATUSES } from "./lib/constants";
import {
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_CONTENT_TYPES,
} from "./lib/imageConstants";
import type { AllowedImageContentType } from "./lib/imageConstants";
import { isSecureUrl } from "./lib/urlValidation";
import { validateName } from "./lib/validation";

const validateTeamName = (name: string) => validateName(name, "Team");

/**
 * Validates an optional logo URL with SSRF protection.
 * Returns trimmed URL or undefined if empty/null.
 * Throws ConvexError if URL is invalid.
 */
function validateLogoUrl(logoUrl: string | undefined | null): string | undefined {
  if (!logoUrl) return undefined;
  const trimmed = logoUrl.trim();
  if (!trimmed) return undefined;
  if (!isSecureUrl(trimmed)) {
    throw new ConvexError(
      "Invalid logo URL. Must be a valid HTTP/HTTPS URL that doesn't point to internal addresses."
    );
  }
  return trimmed;
}

/**
 * Validates that a storage file exists, is within size limits, and is an allowed image type.
 * Throws ConvexError if validation fails.
 */
async function validateStorageFile(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<void> {
  const metadata = await ctx.storage.getMetadata(storageId);
  if (!metadata) {
    throw new ConvexError("Invalid storage ID: file not found.");
  }
  if (metadata.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (metadata.size / 1024 / 1024).toFixed(1);
    throw new ConvexError(
      `File too large (${sizeMB}MB). Maximum size is 2MB.`
    );
  }
  if (
    !metadata.contentType ||
    !ALLOWED_IMAGE_CONTENT_TYPES.includes(
      metadata.contentType as AllowedImageContentType
    )
  ) {
    throw new ConvexError(
      `Invalid file type "${metadata.contentType ?? "unknown"}". Allowed: PNG, JPG, WebP.`
    );
  }
}

/**
 * List all teams sorted by name (ascending).
 * Resolves logoStorageId to URL for display - prefers storage over URL when both exist.
 */
export const listTeams = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      _creationTime: v.number(),
      name: v.string(),
      logoUrl: v.optional(v.string()),
      logoStorageId: v.optional(v.id("_storage")),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_name")
      .order("asc")
      .collect();

    // Resolve storage IDs to URLs in parallel
    const teamsWithResolvedLogos = await Promise.all(
      teams.map(async (team) => {
        if (team.logoStorageId) {
          const resolvedUrl = await ctx.storage.getUrl(team.logoStorageId);
          return {
            ...team,
            // Prefer storage URL over external URL when available
            logoUrl: resolvedUrl ?? team.logoUrl,
          };
        }
        return team;
      })
    );

    return teamsWithResolvedLogos;
  },
});

/**
 * Create a new team with uniqueness validation.
 * Accepts either logoUrl (external URL) OR logoStorageId (Convex storage), not both.
 */
export const createTeam = mutation({
  args: {
    name: v.string(),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.object({ teamId: v.id("teams") }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)

    const trimmedName = validateTeamName(args.name);

    // Validate mutual exclusivity: can't provide both logoUrl and logoStorageId
    if (args.logoUrl && args.logoStorageId) {
      throw new ConvexError(
        "Cannot provide both logoUrl and logoStorageId. Choose one or neither."
      );
    }

    const trimmedLogoUrl = validateLogoUrl(args.logoUrl);

    // Validate storage file if provided (size and content type)
    if (args.logoStorageId) {
      await validateStorageFile(ctx, args.logoStorageId);
    }

    // Check uniqueness
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_name", (q) => q.eq("name", trimmedName))
      .first();

    if (existing) {
      throw new ConvexError("A team with this name already exists");
    }

    const teamId = await ctx.db.insert("teams", {
      name: trimmedName,
      logoUrl: trimmedLogoUrl,
      logoStorageId: args.logoStorageId,
      updatedAt: Date.now(),
    });

    return { teamId };
  },
});

/**
 * Update an existing team with uniqueness and existence checks.
 * Handles URL↔Storage transitions with mutual exclusivity:
 * - Setting logoUrl clears logoStorageId (and vice versa)
 * - Setting both to null removes logo entirely
 * - Replaces old storage files when updating logoStorageId
 */
export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)

    const existing = await ctx.db.get(args.teamId);
    if (!existing) {
      throw new ConvexError("Team not found");
    }

    // Validate mutual exclusivity: can't set both in same update call
    const settingLogoUrl = args.logoUrl !== undefined && args.logoUrl !== null;
    const settingLogoStorageId =
      args.logoStorageId !== undefined && args.logoStorageId !== null;
    if (settingLogoUrl && settingLogoStorageId) {
      throw new ConvexError(
        "Cannot set both logoUrl and logoStorageId. Choose one or neither."
      );
    }

    // Validate storage file if being set (size and content type)
    if (settingLogoStorageId) {
      await validateStorageFile(ctx, args.logoStorageId!);
    }

    const updates: {
      name?: string;
      logoUrl?: string | undefined;
      logoStorageId?: typeof existing.logoStorageId;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    // Handle name update
    if (args.name !== undefined) {
      const trimmedName = validateTeamName(args.name);

      if (trimmedName !== existing.name) {
        const duplicate = await ctx.db
          .query("teams")
          .withIndex("by_name", (q) => q.eq("name", trimmedName))
          .first();

        if (duplicate) {
          throw new ConvexError("A team with this name already exists");
        }

        // Block rename if team is used in active sessions
        const playersInTeam = await ctx.db
          .query("sessionPlayers")
          .withIndex("by_teamName", (q) => q.eq("teamName", existing.name))
          .collect();

        if (playersInTeam.length > 0) {
          const sessionIds = [
            ...new Set(playersInTeam.map((p) => p.sessionId)),
          ];
          const sessions = await Promise.all(
            sessionIds.map((id) => ctx.db.get(id))
          );
          const activeSession = sessions.find(
            (session) => session && ACTIVE_SESSION_STATUSES.has(session.status)
          );
          if (activeSession) {
            throw new ConvexError(
              `Cannot rename team "${existing.name}": used in active session "${activeSession.matchName}"`
            );
          }
        }

        updates.name = trimmedName;
      }
    }

    // Track if we need to clean up old storage
    let oldStorageIdToDelete: typeof existing.logoStorageId | undefined;

    // Handle logoUrl update (null means unset)
    if (args.logoUrl !== undefined) {
      if (args.logoUrl === null) {
        updates.logoUrl = undefined;
        // If clearing URL and we have a storage file, clear that too (unless explicitly setting it)
        if (existing.logoStorageId && args.logoStorageId === undefined) {
          updates.logoStorageId = undefined;
          oldStorageIdToDelete = existing.logoStorageId;
        }
      } else {
        updates.logoUrl = validateLogoUrl(args.logoUrl);
        // Setting URL clears storage ID
        if (existing.logoStorageId) {
          updates.logoStorageId = undefined;
          oldStorageIdToDelete = existing.logoStorageId;
        }
      }
    }

    // Handle logoStorageId update (null means unset)
    if (args.logoStorageId !== undefined) {
      if (args.logoStorageId === null) {
        updates.logoStorageId = undefined;
        // Delete the old storage file if we're unsetting
        if (existing.logoStorageId) {
          oldStorageIdToDelete = existing.logoStorageId;
        }
      } else {
        updates.logoStorageId = args.logoStorageId;
        // Setting storage ID clears URL
        if (existing.logoUrl) {
          updates.logoUrl = undefined;
        }
        // Replace old storage file if different
        if (
          existing.logoStorageId &&
          existing.logoStorageId !== args.logoStorageId
        ) {
          oldStorageIdToDelete = existing.logoStorageId;
        }
      }
    }

    // Patch database first - ensures update succeeds before cleanup
    await ctx.db.patch(args.teamId, updates);

    // Then cleanup old storage (safe to fail - just creates orphan)
    if (oldStorageIdToDelete) {
      await ctx.storage.delete(oldStorageIdToDelete);
    }

    return { success: true };
  },
});

/**
 * Delete a team with active session check.
 * Cleans up storage if team has an uploaded logo.
 */
export const deleteTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new ConvexError("Team not found");
    }

    const playersInTeam = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_teamName", (q) => q.eq("teamName", team.name))
      .collect();

    if (playersInTeam.length > 0) {
      const sessionIds = [...new Set(playersInTeam.map((p) => p.sessionId))];
      const sessions = await Promise.all(
        sessionIds.map((id) => ctx.db.get(id))
      );

      const activeSession = sessions.find(
        (session) => session && ACTIVE_SESSION_STATUSES.has(session.status)
      );

      if (activeSession) {
        throw new ConvexError(
          `Cannot delete team "${team.name}": used in active session "${activeSession.matchName}"`
        );
      }
    }

    // Store reference before deleting team record
    const logoStorageId = team.logoStorageId;

    // Delete database record first - ensures delete succeeds before cleanup
    await ctx.db.delete(args.teamId);

    // Then clean up storage (safe to fail - just creates orphan handled by cron)
    if (logoStorageId) {
      await ctx.storage.delete(logoStorageId);
    }

    return { success: true };
  },
});

/**
 * Generate a short-lived upload URL for team logo images.
 * Client should POST file to this URL, then pass the storageId to createTeam/updateTeam.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    return await ctx.storage.generateUploadUrl();
  },
});
