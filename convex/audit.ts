/**
 * Audit Logging Module
 *
 * Provides centralized audit logging for all session-related actions.
 *
 * Usage:
 * - From mutations: Use `logAction()` helper for same-transaction atomicity
 * - From actions: Use `ctx.runMutation(internal.audit.logActionMutation, {...})`
 * - For reading: Use `getSessionAuditLog()` query with pagination
 */

import { internalMutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { AuditAction, ActorType, AuditDetails } from "./lib/types";
import {
  auditActionValidator,
  actorTypeValidator,
  auditDetailsValidator,
} from "./lib/validators";

// ============================================================================
// Validators
// ============================================================================

/**
 * Validator for audit log entries returned by queries.
 * Matches the auditLogs table schema.
 */
const auditLogValidator = v.object({
  _id: v.id("auditLogs"),
  _creationTime: v.number(),
  sessionId: v.id("sessions"),
  action: v.string(),
  actorType: actorTypeValidator,
  actorId: v.optional(v.string()),
  details: auditDetailsValidator,
  timestamp: v.number(),
});

// ============================================================================
// Types
// ============================================================================

export interface LogActionArgs {
  sessionId: Id<"sessions">;
  action: AuditAction;
  actorType: ActorType;
  actorId?: string;
  details?: AuditDetails;
}

// ============================================================================
// Helper Function (Recommended - Same Transaction)
// ============================================================================

/**
 * Log an audit action within the same transaction as the calling mutation.
 *
 * This is the RECOMMENDED approach for most use cases as it ensures
 * atomicity - the audit log is committed only if the parent mutation succeeds.
 *
 * @example
 * ```typescript
 * import { logAction } from "./audit";
 *
 * export const createSession = mutation({
 *   handler: async (ctx, args) => {
 *     const sessionId = await ctx.db.insert("sessions", {...});
 *     await logAction(ctx, {
 *       sessionId,
 *       action: "SESSION_CREATED",
 *       actorType: "ADMIN",
 *       actorId: args.createdBy,
 *     });
 *     return { sessionId };
 *   },
 * });
 * ```
 */
export async function logAction(
  ctx: MutationCtx,
  args: LogActionArgs
): Promise<Id<"auditLogs">> {
  return await ctx.db.insert("auditLogs", {
    sessionId: args.sessionId,
    action: args.action,
    actorType: args.actorType,
    actorId: args.actorId,
    details: args.details ?? {},
    timestamp: Date.now(),
  });
}

// ============================================================================
// Internal Mutation (For Actions or Cross-Function Calls)
// ============================================================================

/**
 * Internal mutation for logging audit events.
 *
 * Use this when calling from Convex actions (which can't directly access db)
 * or when you need separate transaction semantics.
 *
 * @example
 * ```typescript
 * // From an action:
 * await ctx.runMutation(internal.audit.logActionMutation, {
 *   sessionId,
 *   action: "TIMER_EXPIRED",
 *   actorType: "SYSTEM",
 *   details: { turn: 3, round: 1 },
 * });
 * ```
 */
export const logActionMutation = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    action: auditActionValidator,
    actorType: actorTypeValidator,
    actorId: v.optional(v.string()),
    details: v.optional(auditDetailsValidator),
  },
  returns: v.id("auditLogs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      sessionId: args.sessionId,
      action: args.action,
      actorType: args.actorType,
      actorId: args.actorId,
      details: args.details ?? {},
      timestamp: Date.now(),
    });
  },
});

// ============================================================================
// Queries
// ============================================================================

/**
 * Get audit logs for a session with pagination.
 *
 * Returns entries sorted by timestamp descending (newest first).
 * Uses the `by_sessionId_and_timestamp` index for efficient querying.
 *
 * @example
 * ```typescript
 * // Frontend usage:
 * const { results, status, loadMore } = usePaginatedQuery(
 *   api.audit.getSessionAuditLog,
 *   { sessionId },
 *   { initialNumItems: 50 }
 * );
 * ```
 */
export const getSessionAuditLog = query({
  args: {
    sessionId: v.id("sessions"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(auditLogValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_sessionId_and_timestamp", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get recent audit logs for a session (non-paginated).
 *
 * Useful for displaying a summary or preview in the UI.
 * Capped at 100 entries maximum.
 *
 * @example
 * ```typescript
 * // Get last 20 events
 * const recentLogs = useQuery(api.audit.getRecentLogs, { sessionId, limit: 20 });
 * ```
 */
export const getRecentLogs = query({
  args: {
    sessionId: v.id("sessions"),
    limit: v.optional(v.number()),
  },
  returns: v.array(auditLogValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_sessionId_and_timestamp", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .order("desc")
      .take(limit);
  },
});
