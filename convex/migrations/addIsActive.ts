/**
 * Migration: Add isActive Field
 *
 * Backfills the isActive boolean field on all existing sessions.
 * Run once after deploying the schema change.
 *
 * Usage: npx convex run migrations/addIsActive:backfillIsActive
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { isActiveStatus } from "../lib/sessionHelpers";

/**
 * Backfill isActive field for existing sessions.
 * Sets isActive based on current status using ACTIVE_SESSION_STATUSES.
 */
export const backfillIsActive = internalMutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const sessions = await ctx.db.query("sessions").collect();
    let updated = 0;

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        isActive: isActiveStatus(session.status),
      });
      updated++;
    }

    return { updated };
  },
});
