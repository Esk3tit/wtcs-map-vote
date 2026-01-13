import type { Doc } from "../_generated/dataModel";

// Validation constants
export const MAX_NAME_LENGTH = 100;
export const MAX_URL_LENGTH = 2048;

// Type-safe active session statuses (validated against schema)
export type SessionStatus = Doc<"sessions">["status"];
export const ACTIVE_SESSION_STATUSES: Set<SessionStatus> = new Set([
  "DRAFT",
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
]);
