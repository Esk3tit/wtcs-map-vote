/**
 * Admin Audit Logging Module
 *
 * Centralized audit logging for admin management actions.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { AdminAuditAction } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface LogAdminActionArgs {
  action: AdminAuditAction;
  actorId?: Id<"admins">;
  actorEmail?: string;
  targetId?: Id<"admins">;
  targetEmail: string;
  details?: {
    isRootAdmin?: boolean;
    targetName?: string;
    message?: string;
  };
}

// ============================================================================
// Helper Function
// ============================================================================

/**
 * Log an admin management action.
 *
 * @param ctx - Mutation context
 * @param args - Audit log arguments
 */
export async function logAdminAction(
  ctx: MutationCtx,
  args: LogAdminActionArgs
): Promise<Id<"adminAuditLogs">> {
  return await ctx.db.insert("adminAuditLogs", {
    action: args.action,
    actorId: args.actorId,
    actorEmail: args.actorEmail,
    targetId: args.targetId,
    targetEmail: args.targetEmail,
    details: args.details,
    timestamp: Date.now(),
  });
}
