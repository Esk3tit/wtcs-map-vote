import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";

// Constants for validation
const MAX_NAME_LENGTH = 100;
const MAX_URL_LENGTH = 2048;

// Type-safe active session statuses (validated against schema)
type SessionStatus = Doc<"sessions">["status"];
const ACTIVE_SESSION_STATUSES: Set<SessionStatus> = new Set([
  "DRAFT",
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
]);

/**
 * Validates a logo URL to prevent XSS and SSRF attacks.
 * Allows undefined/empty strings, requires http(s) protocol,
 * and blocks internal IP addresses.
 */
function isValidLogoUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  // Reject excessively long URLs
  if (url.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block internal/private IPs and cloud metadata endpoints
    // Note: This is client-side validation; logos are rendered in <img> tags, not fetched server-side
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      // 172.16.0.0/12 private range (172.16.x.x - 172.31.x.x)
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      // Link-local addresses
      hostname.startsWith("169.254.") ||
      // IPv6 localhost
      hostname === "::1" ||
      hostname === "[::1]" ||
      // Cloud metadata endpoints
      hostname === "metadata.google.internal"
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
          const sessionIds = [
            ...new Set(playersInTeam.map((p) => p.sessionId)),
          ];
          for (const sessionId of sessionIds) {
            const session = await ctx.db.get(sessionId);
            if (session && ACTIVE_SESSION_STATUSES.has(session.status)) {
              throw new ConvexError(
                `Cannot rename team "${existing.name}": used in active session "${session.matchName}"`
              );
            }
          }
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
