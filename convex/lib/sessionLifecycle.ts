/**
 * Session Lifecycle Helpers
 *
 * Centralized state transition validation, guard functions, and atomic
 * transition helper for session lifecycle mutations. All Phase 5 lifecycle
 * mutations (WAR-38+) should use these helpers instead of ad-hoc status checks.
 */

import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

import { ConvexError } from "convex/values";

import type { AuditAction, ActorType, AuditDetails } from "./types";
import type { SessionStatus } from "./constants";
import { VALID_TRANSITIONS } from "./constants";
import { logAction } from "../audit";

// ============================================================================
// Transition Validation
// ============================================================================

/**
 * Validate that a session state transition is allowed.
 * Throws a descriptive ConvexError if the transition is invalid.
 *
 * @param currentStatus - Current session status
 * @param targetStatus - Desired target status
 */
export function validateTransition(
  currentStatus: SessionStatus,
  targetStatus: SessionStatus
): void {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed.has(targetStatus)) {
    const validTargets = [...allowed];
    if (validTargets.length === 0) {
      throw new ConvexError(
        `Cannot transition from ${currentStatus}. It is a terminal state`
      );
    }
    throw new ConvexError(
      `Cannot transition from ${currentStatus} to ${targetStatus}. ` +
        `Valid transitions: ${validTargets.join(", ")}`
    );
  }
}

// ============================================================================
// Guard Functions
// ============================================================================

/**
 * Guard: DRAFT -> WAITING preconditions.
 * Checks that the correct number of players and maps are assigned.
 *
 * @param ctx - Mutation context
 * @param session - Current session document
 */
export async function guardFinalize(
  ctx: MutationCtx,
  session: Doc<"sessions">
): Promise<void> {
  const [players, maps] = await Promise.all([
    ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect(),
    ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect(),
  ]);

  if (players.length !== session.playerCount) {
    throw new ConvexError(
      `Cannot finalize: ${players.length} of ${session.playerCount} players assigned`
    );
  }
  if (maps.length !== session.mapPoolSize) {
    throw new ConvexError(
      `Cannot finalize: ${maps.length} of ${session.mapPoolSize} maps assigned`
    );
  }
}

/**
 * Guard: WAITING -> IN_PROGRESS preconditions.
 * Checks that all players are assigned and connected (IP-activated).
 *
 * @param ctx - Mutation context
 * @param session - Current session document
 */
export async function guardStart(
  ctx: MutationCtx,
  session: Doc<"sessions">
): Promise<void> {
  const players = await ctx.db
    .query("sessionPlayers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .collect();

  if (players.length !== session.playerCount) {
    throw new ConvexError(
      `Cannot start: ${players.length} of ${session.playerCount} players assigned`
    );
  }

  const disconnected = players.filter((p) => !p.isConnected);
  if (disconnected.length > 0) {
    const teams = disconnected.map((p) => p.teamName).join(", ");
    throw new ConvexError(
      `Cannot start: ${disconnected.length} player(s) not connected (${teams})`
    );
  }
}

/**
 * Assert that a session is in one of the allowed statuses.
 * Throws ConvexError with a descriptive message if not.
 *
 * Use for "allowed state" checks (non-transition guards), e.g. "can only
 * assign players in DRAFT or WAITING". For actual state transitions, use
 * validateTransition() or transitionSession() instead.
 *
 * @param session - Current session document
 * @param allowed - Set of allowed statuses
 * @param action - Human-readable action name for error message
 */
export function requireSessionStatus(
  session: Pick<Doc<"sessions">, "status">,
  allowed: ReadonlySet<SessionStatus>,
  action: string
): void {
  if (!allowed.has(session.status)) {
    const items = [...allowed];
    const allowedList =
      items.length > 2
        ? items.slice(0, -1).join(", ") + ", or " + items.at(-1)
        : items.join(" or ");
    throw new ConvexError(
      `Cannot ${action} in ${session.status} state. Only ${allowedList} state allowed.`
    );
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Allowed session fields for transition patches.
 * Restricts to runtime state fields only — config fields (format, playerCount,
 * mapPoolSize, turnTimerSeconds, createdBy, expiresAt) cannot be patched
 * during transitions.
 */
export type SessionStatePatches = Partial<
  Pick<
    Doc<"sessions">,
    | "currentTurn"
    | "currentRound"
    | "isRevoteRound"
    | "winnerMapId"
    | "completedAt"
    | "startedAt"
    | "timerStartedAt"
    | "timerPausedAt"
  >
>;

/** Options for `transitionSession`. */
export interface TransitionOptions {
  auditAction: AuditAction;
  actorType: ActorType;
  actorId?: string;
  patches?: SessionStatePatches;
  auditDetails?: AuditDetails;
}

// ============================================================================
// Session Completion Helper
// ============================================================================

/**
 * Declare a winner map and complete the session.
 *
 * Patches the winning map to WINNER state, updates the session to COMPLETE,
 * and logs the WINNER_DECLARED audit action. Sets isRevoteRound: false for
 * consistency (harmless for ABBA sessions that lack the field).
 *
 * @param ctx - Mutation context
 * @param session - Current session document
 * @param winnerMap - The session map to declare as winner
 * @param auditDetails - Optional extra fields for the WINNER_DECLARED audit log
 */
export async function completeSession(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  winnerMap: Doc<"sessionMaps">,
  auditDetails?: Record<string, unknown>
): Promise<void> {
  const now = Date.now();
  await ctx.db.patch(winnerMap._id, { state: "WINNER" });
  await ctx.db.patch(session._id, {
    winnerMapId: winnerMap._id,
    status: "COMPLETE",
    completedAt: now,
    updatedAt: now,
    isRevoteRound: false,
    timerStartedAt: undefined,
    timerPausedAt: undefined,
  });

  await logAction(ctx, {
    sessionId: session._id,
    action: "WINNER_DECLARED",
    actorType: "SYSTEM",
    details: {
      mapId: winnerMap._id,
      mapName: winnerMap.name,
      ...auditDetails,
    },
  });
}

// ============================================================================
// Atomic Transition Helper
// ============================================================================

/**
 * Atomically transition a session to a new status.
 * Validates the transition, patches the session, and logs an audit event.
 * Runs in same Convex transaction as caller for atomicity.
 *
 * @param ctx - Mutation context
 * @param session - Current session document (must be fresh read)
 * @param targetStatus - Desired target status
 * @param options - Audit and patch options
 */
export async function transitionSession(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  targetStatus: SessionStatus,
  options: TransitionOptions
): Promise<void> {
  validateTransition(session.status, targetStatus);

  await ctx.db.patch(session._id, {
    ...options.patches,
    status: targetStatus,
    updatedAt: Date.now(),
  });

  await logAction(ctx, {
    sessionId: session._id,
    action: options.auditAction,
    actorType: options.actorType,
    actorId: options.actorId,
    details: options.auditDetails,
  });
}
