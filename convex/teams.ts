import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

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
    // Trim and validate name
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new ConvexError("Team name cannot be empty");
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
    logoUrl: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
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

    // Handle logoUrl update
    if (args.logoUrl !== undefined) {
      updates.logoUrl = args.logoUrl;
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
    // Verify team exists
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new ConvexError("Team not found");
    }

    // Check for active sessions using this team name
    // Active = DRAFT, WAITING, IN_PROGRESS, PAUSED
    const allSessions = await ctx.db.query("sessions").collect();
    const activeStatuses = ["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED"];

    for (const session of allSessions) {
      if (!activeStatuses.includes(session.status)) continue;

      // Check if any player in this session uses the team name
      const players = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      if (players.some((p) => p.teamName === team.name)) {
        throw new ConvexError(
          `Cannot delete team "${team.name}": used in active session "${session.matchName}"`
        );
      }
    }

    await ctx.db.delete(args.teamId);
    return { success: true };
  },
});
