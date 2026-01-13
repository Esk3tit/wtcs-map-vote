import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { ACTIVE_SESSION_STATUSES } from "./lib/constants";
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

    const trimmedName = validateTeamName(args.name);
    const trimmedLogoUrl = validateLogoUrl(args.logoUrl);

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
    logoUrl: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)

    const existing = await ctx.db.get(args.teamId);
    if (!existing) {
      throw new ConvexError("Team not found");
    }

    const updates: {
      name?: string;
      logoUrl?: string | undefined;
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

    // Handle logoUrl update (null means unset)
    if (args.logoUrl !== undefined) {
      if (args.logoUrl === null) {
        updates.logoUrl = undefined;
      } else {
        updates.logoUrl = validateLogoUrl(args.logoUrl);
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

    await ctx.db.delete(args.teamId);
    return { success: true };
  },
});
