/**
 * Type definitions for schema fields that use v.string() for flexibility
 * but benefit from TypeScript type safety in function code.
 *
 * These types are NOT enforced at the database level - they provide
 * compile-time safety when used in Convex functions.
 */

/**
 * Player roles for different session formats
 * ABBA format: PLAYER_A, PLAYER_B
 * Multiplayer format: PLAYER_1, PLAYER_2, PLAYER_3, PLAYER_4
 *
 * @see docs/SPECIFICATION.md Section 3.2
 */
export type PlayerRole =
  | "PLAYER_A"
  | "PLAYER_B"
  | "PLAYER_1"
  | "PLAYER_2"
  | "PLAYER_3"
  | "PLAYER_4";

/**
 * Audit log action types
 *
 * @see docs/SPECIFICATION.md Appendix C
 */
export type AuditAction =
  // Session lifecycle
  | "SESSION_CREATED"
  | "SESSION_UPDATED"
  | "SESSION_FINALIZED"
  | "SESSION_STARTED"
  | "SESSION_PAUSED"
  | "SESSION_RESUMED"
  | "SESSION_ENDED"
  // Player events
  | "PLAYER_CONNECTED"
  | "PLAYER_DISCONNECTED"
  // Voting actions
  | "MAP_BANNED"
  | "VOTE_SUBMITTED"
  // Round/Timer events
  | "ROUND_RESOLVED"
  | "TIMER_EXPIRED"
  | "RANDOM_SELECTION"
  | "WINNER_DECLARED";
