/**
 * Type definitions for schema fields that use v.string() for flexibility
 * but benefit from TypeScript type safety in function code.
 *
 * These types are NOT enforced at the database level - they provide
 * compile-time safety when used in Convex functions.
 */

import type { Id } from "../_generated/dataModel";

/**
 * Player roles for different session formats
 * ABBA format: Player A, Player B
 * Multiplayer format: Player 1, Player 2, Player 3, Player 4
 *
 * These match the Title Case values stored in the database.
 *
 * @see docs/SPECIFICATION.md Section 3.2
 */
export type PlayerRole =
  | "Player A"
  | "Player B"
  | "Player 1"
  | "Player 2"
  | "Player 3"
  | "Player 4";

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
  | "SESSION_DELETED"
  | "SESSION_EXPIRED"
  // Player/Token events
  | "PLAYER_CONNECTED"
  | "PLAYER_DISCONNECTED"
  | "PLAYER_ASSIGNED"
  | "TOKEN_ACTIVATED"
  | "TOKEN_IP_BLOCKED"
  | "TOKEN_REGENERATED"
  // Map events
  | "MAP_BANNED"
  | "MAPS_ASSIGNED"
  // Voting actions
  | "VOTE_SUBMITTED"
  // Round/Timer events
  | "ROUND_RESOLVED"
  | "ROUND_REVOTE_TRIGGERED"
  | "REVOTE_DEADLOCK_RANDOM_SELECTION"
  | "TIMER_EXPIRED"
  | "RANDOM_SELECTION"
  | "WINNER_DECLARED"
  // Session reset/clone
  | "SESSION_RESET"
  | "SESSION_CLONED";

/**
 * Actor types for audit logging
 *
 * ADMIN: Actions performed by authenticated admins
 * PLAYER: Actions performed by players in a session
 * SYSTEM: Automated actions (timers, cleanup, etc.)
 */
export type ActorType = "ADMIN" | "PLAYER" | "SYSTEM";

/**
 * Optional details attached to audit log entries.
 * All fields are optional to allow flexible logging.
 */
export interface AuditDetails {
  mapId?: Id<"sessionMaps">;
  mapName?: string;
  teamName?: string;
  turn?: number;
  round?: number;
  reason?: string;
}

/**
 * Admin audit log action types
 *
 * Used for tracking admin management actions (separate from session audit logs).
 */
export type AdminAuditAction =
  | "ADMIN_LOGIN"
  | "ADMIN_ADDED"
  | "ADMIN_REMOVED"
  | "ADMIN_PROMOTED"
  | "ADMIN_DEMOTED"
  | "ADMIN_SESSIONS_INVALIDATED"
  | "SYSTEM_BOOTSTRAP";
