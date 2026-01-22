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
export const MAX_SESSION_IDS = 500;

// Type-safe active session statuses (validated against schema)
export type SessionStatus = Doc<"sessions">["status"];
export const ACTIVE_SESSION_STATUSES: Set<SessionStatus> = new Set([
  "DRAFT",
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
]);
