/**
 * Rate Limiting
 *
 * Central rate limit definitions using @convex-dev/rate-limiter.
 * All rate limits are transactional — tokens roll back if the mutation fails.
 */

import { components } from "../_generated/api";

import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Player voting/banning: 30/min with burst of 5 (prevents double-click spam)
  // Shared by submitVote and submitBan — both consume the same per-token budget
  submitVote: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 5 },

  // Player heartbeat: 30s interval with burst headroom for retries
  playerHeartbeat: {
    kind: "token bucket",
    rate: 12,
    period: MINUTE,
    capacity: 6,
  },

  // Player ready: lobby ready-up action
  playerReady: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 3 },

  // Token validation: brute force protection
  validateToken: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },

  // Session creation: 50/hour (admins may need many sessions for tournaments)
  createSession: { kind: "fixed window", rate: 50, period: HOUR },

  // General admin mutations
  adminMutation: {
    kind: "token bucket",
    rate: 100,
    period: MINUTE,
    capacity: 20,
  },
});
