/**
 * Session Helpers
 *
 * Utility functions for session-related operations.
 */

import { ACTIVE_SESSION_STATUSES, type SessionStatus } from "./constants";

/**
 * Determines if a session status is considered "active".
 * Active statuses: DRAFT, WAITING, IN_PROGRESS, PAUSED
 *
 * @param status - The session status to check
 * @returns true if the status is considered active
 */
export function isActiveStatus(status: SessionStatus): boolean {
  return ACTIVE_SESSION_STATUSES.has(status);
}
