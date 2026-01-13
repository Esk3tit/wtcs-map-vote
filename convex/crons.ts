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

export default crons;
