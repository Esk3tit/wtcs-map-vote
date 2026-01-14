import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every hour to clean up orphaned storage files
// Files uploaded to storage but never associated with a team (due to mutation failures)
// are cleaned up if they're older than 1 hour
crons.interval(
  "cleanup orphaned storage",
  { hours: 1 },
  internal.storage.cleanupOrphanedFiles,
  {}
);

// Run every hour to expire stale sessions
// Sessions in DRAFT or WAITING status that have passed their expiresAt time
// are marked as EXPIRED and their IP addresses are cleared for privacy compliance
// @see docs/SPECIFICATION.md Section 3.5 (Session Expiration)
crons.interval(
  "expire stale sessions",
  { hours: 1 },
  internal.sessionCleanup.expireStaleSessions,
  {}
);

// Run every hour to clear IP addresses from completed sessions
// This catches any sessions that were completed but may still have IP addresses
// due to the completion happening outside the normal flow
// @see docs/SPECIFICATION.md Section 12.4 (Data Protection)
crons.interval(
  "cleanup completed session IPs",
  { hours: 1 },
  internal.sessionCleanup.clearCompletedSessionIps,
  {}
);

export default crons;
