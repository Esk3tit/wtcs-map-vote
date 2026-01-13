import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { MAX_NAME_LENGTH, ACTIVE_SESSION_STATUSES } from "./lib/constants";
import { isSecureUrl, validateSecureUrl } from "./lib/urlValidation";

/**
 * Validates a logo URL with SSRF protection.
 * Returns true if URL is valid and safe, or if empty/null (logo is optional).
 */
const isValidLogoUrl = (url: string | undefined | null): boolean =>
  !url || isSecureUrl(url);

/**
 * List all teams sorted by name (ascending)
 */
export const listTeams = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      _creationTime: v.number(),
      name: v.string(),
      logoUrl: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_name")
      .order("asc")
      .collect();
  },
});

/**
 * Create a new team with uniqueness validation
 */
export const createTeam = mutation({
  args: {
    name: v.string(),
    logoUrl: v.optional(v.string()),
  },
  returns: v.object({ teamId: v.id("teams") }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    // Trim and validate name
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new ConvexError("Team name cannot be empty");
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      throw new ConvexError(
        `Team name cannot exceed ${MAX_NAME_LENGTH} characters`
      );
    }

    // Validate and trim logoUrl if provided
    const trimmedLogoUrl = args.logoUrl?.trim() || undefined;
    if (trimmedLogoUrl && !isValidLogoUrl(trimmedLogoUrl)) {
      throw new ConvexError(
        "Invalid logo URL. Must be a valid HTTP/HTTPS URL that doesn't point to internal addresses."
      );
    }

    // Check uniqueness (indexes don't enforce uniqueness in Convex)
    // Note: There's a theoretical race condition where two concurrent requests
    // could both pass this check before either inserts. This is acceptable for
    // this low-traffic admin application (~12 concurrent users max per spec).
    // Convex mutations are serialized per-document, but uniqueness checks across
    // documents require application-level handling.
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
      updatedAt: Date.now(),
    });

    return { teamId };
  },
});

/**
 * Update an existing team with uniqueness and existence checks
 */
export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    // Allow null to unset logoUrl
    logoUrl: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    // Verify team exists
    const existing = await ctx.db.get(args.teamId);
    if (!existing) {
      throw new ConvexError("Team not found");
    }

    // Build updates object
    // Note: logoUrl uses `string | undefined` to allow unsetting via patch
    const updates: {
      name?: string;
      logoUrl?: string | undefined;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    // Handle name update with uniqueness check
    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length === 0) {
        throw new ConvexError("Team name cannot be empty");
      }
      if (trimmedName.length > MAX_NAME_LENGTH) {
        throw new ConvexError(
          `Team name cannot exceed ${MAX_NAME_LENGTH} characters`
        );
      }

      // Only update name if it's actually changing
      if (trimmedName !== existing.name) {
        // Check for duplicate name
        const duplicate = await ctx.db
          .query("teams")
          .withIndex("by_name", (q) => q.eq("name", trimmedName))
          .first();

        if (duplicate) {
          throw new ConvexError("A team with this name already exists");
        }

        // Block rename if team is used in active sessions
        // This prevents orphaned teamName references in sessionPlayers
        const playersInTeam = await ctx.db
          .query("sessionPlayers")
          .withIndex("by_teamName", (q) => q.eq("teamName", existing.name))
          .collect();

        if (playersInTeam.length > 0) {
          // Batch-fetch sessions in parallel (N+1 fix)
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

    // Handle logoUrl update (null means unset)
    if (args.logoUrl !== undefined) {
      if (args.logoUrl === null) {
        // Unset the logoUrl by patching with undefined
        updates.logoUrl = undefined;
      } else {
        // Trim and validate the new URL
        const trimmedLogoUrl = args.logoUrl.trim() || undefined;
        if (trimmedLogoUrl && !isValidLogoUrl(trimmedLogoUrl)) {
          throw new ConvexError(
            "Invalid logo URL. Must be a valid HTTP/HTTPS URL that doesn't point to internal addresses."
          );
        }
        updates.logoUrl = trimmedLogoUrl;
      }
    }

    await ctx.db.patch(args.teamId, updates);
    return { success: true };
  },
});

/**
 * Delete a team with active session check
 */
export const deleteTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
    // Verify caller is admin via admins table lookup

    // Verify team exists
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new ConvexError("Team not found");
    }

    // Efficiently check for active sessions using this team.
    // Uses by_teamName index for O(1) lookup instead of full table scan.
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

    await ctx.db.delete(args.teamId);
    return { success: true };
  },
});
