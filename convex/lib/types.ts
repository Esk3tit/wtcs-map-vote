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
  | "SESSION_DELETED"
  | "SESSION_EXPIRED"
  // Player events
  | "PLAYER_CONNECTED"
  | "PLAYER_DISCONNECTED"
  | "PLAYER_ASSIGNED"
  // Map events
  | "MAP_BANNED"
  | "MAPS_ASSIGNED"
  // Voting actions
  | "VOTE_SUBMITTED"
  // Round/Timer events
  | "ROUND_RESOLVED"
  | "TIMER_EXPIRED"
  | "RANDOM_SELECTION"
  | "WINNER_DECLARED";

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
  | "ADMIN_ADDED"
  | "ADMIN_REMOVED"
  | "ADMIN_PROMOTED"
  | "ADMIN_DEMOTED"
  | "ADMIN_SESSIONS_INVALIDATED"
  | "SYSTEM_BOOTSTRAP";
