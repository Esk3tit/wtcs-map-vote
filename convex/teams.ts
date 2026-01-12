import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// Constants for validation
const MAX_NAME_LENGTH = 100;

/**
 * Validates a logo URL to prevent XSS and SSRF attacks.
 * Allows undefined/empty strings, requires http(s) protocol,
 * and blocks internal IP addresses.
 */
function isValidLogoUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block internal/private IPs
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname === "169.254.169.254"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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

    // Validate logoUrl if provided
    if (args.logoUrl && !isValidLogoUrl(args.logoUrl)) {
      throw new ConvexError(
        "Invalid logo URL. Must be a valid HTTP(S) URL and not point to internal addresses."
      );
    }

    // Check uniqueness (indexes don't enforce uniqueness in Convex)
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_name", (q) => q.eq("name", trimmedName))
      .first();

    if (existing) {
      throw new ConvexError("A team with this name already exists");
    }

    const teamId = await ctx.db.insert("teams", {
      name: trimmedName,
      logoUrl: args.logoUrl,
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
    const updates: { name?: string; logoUrl?: string; updatedAt: number } = {
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

      if (trimmedName !== existing.name) {
        const duplicate = await ctx.db
          .query("teams")
          .withIndex("by_name", (q) => q.eq("name", trimmedName))
          .first();

        if (duplicate) {
          throw new ConvexError("A team with this name already exists");
        }
      }
      updates.name = trimmedName;
    }

    // Handle logoUrl update (null means unset)
    if (args.logoUrl !== undefined) {
      if (args.logoUrl === null) {
        // Unset the logoUrl by patching with undefined
        updates.logoUrl = undefined;
      } else {
        // Validate the new URL
        if (!isValidLogoUrl(args.logoUrl)) {
          throw new ConvexError(
            "Invalid logo URL. Must be a valid HTTP(S) URL and not point to internal addresses."
          );
        }
        updates.logoUrl = args.logoUrl;
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
    // This avoids scanning all sessions and prevents N+1 queries.
    // For optimal performance, consider adding an index on `teamName` in sessionPlayers.
    const playersInTeam = await ctx.db
      .query("sessionPlayers")
      .filter((q) => q.eq(q.field("teamName"), team.name))
      .collect();

    if (playersInTeam.length > 0) {
      const sessionIds = [...new Set(playersInTeam.map((p) => p.sessionId))];
      const sessions = await Promise.all(
        sessionIds.map((id) => ctx.db.get(id))
      );

      const activeStatuses = new Set([
        "DRAFT",
        "WAITING",
        "IN_PROGRESS",
        "PAUSED",
      ]);
      const activeSession = sessions.find(
        (session) => session && activeStatuses.has(session.status)
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
