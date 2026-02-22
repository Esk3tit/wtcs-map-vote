import type { Doc } from "../_generated/dataModel";

// Validation constants
export const MAX_NAME_LENGTH = 100;
export const MAX_URL_LENGTH = 2048;

// Session lifecycle constants
export const SESSION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_TURN_TIMER_SECONDS = 30;
export const DEFAULT_MAP_POOL_SIZE = 5;
export const MIN_PLAYER_COUNT = 2;
export const MAX_PLAYER_COUNT = 8;
export const MIN_TURN_TIMER_SECONDS = 10;
export const MAX_TURN_TIMER_SECONDS = 300;
export const MIN_MAP_POOL_SIZE = 3;
export const MAX_MAP_POOL_SIZE = 15;
export const MAX_REASON_LENGTH = 500;
export const CLONE_NAME_SUFFIX = " (Copy)";

// ABBA voting pattern
/**
 * ABBA turn pattern: maps turn index to player index.
 * Turn 0 → Player 0 (A), Turn 1 → Player 1 (B),
 * Turn 2 → Player 1 (B), Turn 3 → Player 0 (A).
 */
export const ABBA_TURN_PATTERN = [0, 1, 1, 0] as const;

/**
 * Compute which player index is active for the given ABBA turn.
 *
 * @param currentTurn - 0-indexed turn number
 */
export function getActivePlayerIndex(currentTurn: number): number {
  return ABBA_TURN_PATTERN[currentTurn % ABBA_TURN_PATTERN.length];
}

/**
 * Sort players by join order (creation time, then ID tiebreaker).
 * This determines Player A vs Player B in ABBA format.
 */
export function sortPlayersByJoinOrder<T extends { _creationTime: number; _id: string }>(
  players: T[]
): T[] {
  return [...players].sort(
    (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
  );
}

// Reveal phase duration (client-side reveal between rounds)
export const REVEAL_DURATION_MS = 3_000; // 3 seconds
export const WINNER_REVEAL_DURATION_MS = 5_000; // 5 seconds

// Player ready indicator
export const READY_EXPIRY_MS = 60_000; // 60 seconds
/** Skip redundant ready writes within this window (5 seconds). */
export const READY_SKIP_MS = 5_000;

// Player heartbeat constants
export const HEARTBEAT_INTERVAL_MS = 30_000; // Client heartbeat interval
export const HEARTBEAT_SKIP_MS = 15_000; // Skip DB write if heartbeat is still fresh
// INVARIANT: Must be > HEARTBEAT_INTERVAL_MS.
// Set to 2× the client interval to tolerate one missed heartbeat.
export const HEARTBEAT_TIMEOUT_MS = 60_000; // 60 seconds

// Type-safe active session statuses (validated against schema)
export type SessionStatus = Doc<"sessions">["status"];
export const ACTIVE_SESSION_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "DRAFT",
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
]);

/** Statuses from which a session may be deleted. */
export const DELETABLE_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "DRAFT",
  "WAITING",
  "PAUSED",
  "COMPLETE",
  "EXPIRED",
]);

/** Statuses in which session configuration (name, timer, players, format) can be modified. */
export const EDITABLE_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "DRAFT",
  "WAITING",
]);

/** Statuses in which the map pool can be configured. */
export const MAP_POOL_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "DRAFT",
]);

/** Statuses from which a session can be reset (COMPLETE only). */
export const RESETTABLE_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "COMPLETE",
]);

/**
 * Valid session state transitions.
 * Maps each status to the set of statuses it can transition to.
 * Terminal states (EXPIRED) have no valid transitions.
 * COMPLETE->WAITING is allowed for session reset.
 */
export const VALID_TRANSITIONS: Record<SessionStatus, ReadonlySet<SessionStatus>> = {
  DRAFT: new Set(["WAITING", "COMPLETE"]),
  WAITING: new Set(["IN_PROGRESS", "COMPLETE"]),
  IN_PROGRESS: new Set(["PAUSED", "COMPLETE"]),
  PAUSED: new Set(["IN_PROGRESS", "COMPLETE"]),
  COMPLETE: new Set(["WAITING"]),
  EXPIRED: new Set([]),
};

/** Standard session state reset patches for COMPLETE -> WAITING. */
export const SESSION_RESET_PATCHES = {
  currentTurn: 0,
  currentRound: 1,
  isRevoteRound: false,
  winnerMapId: undefined,
  completedAt: undefined,
  startedAt: undefined,
  timerStartedAt: undefined,
  timerPausedAt: undefined,
} as const;
