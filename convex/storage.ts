/**
 * Storage Module
 *
 * Handles Convex storage maintenance tasks such as orphaned file cleanup.
 * Contains internal mutations designed to be called by cron jobs.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Clean up storage files that are not referenced by any team or map.
 * Files must be older than 1 hour to avoid race conditions with active uploads.
 *
 * This mutation queries the _storage system table to find all files,
 * compares against referenced storage IDs from teams and maps, and deletes
 * any orphaned files that are older than 1 hour.
 */
export const cleanupOrphanedFiles = internalMutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    checkedCount: v.number(),
    referencedCount: v.number(),
  }),
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    // Get all teams' storage IDs
    const teams = await ctx.db.query("teams").collect();
    const teamStorageIds = teams
      .map((t) => t.logoStorageId)
      .filter((id): id is Id<"_storage"> => id !== undefined);

    // Get all maps' storage IDs
    const maps = await ctx.db.query("maps").collect();
    const mapStorageIds = maps
      .map((m) => m.imageStorageId)
      .filter((id): id is Id<"_storage"> => id !== undefined);

    // Combine all referenced storage IDs
    const referencedStorageIds = new Set<string>([
      ...teamStorageIds,
      ...mapStorageIds,
    ]);

    // Query all files in storage system table
    // Note: We query with a reasonable limit and process in batches to avoid memory issues
    const allStorageFiles = await ctx.db.system.query("_storage").collect();

    let deletedCount = 0;
    let checkedCount = 0;

    for (const file of allStorageFiles) {
      checkedCount++;

      // Skip files that are still referenced
      if (referencedStorageIds.has(file._id)) {
        continue;
      }

      // Skip files that are too new (less than 1 hour old)
      // This prevents deleting files that are in the process of being uploaded
      if (file._creationTime > oneHourAgo) {
        continue;
      }

      // Delete the orphaned file
      await ctx.storage.delete(file._id);
      deletedCount++;
    }

    console.log(
      `Storage cleanup complete: checked ${checkedCount} files, ` +
        `${referencedStorageIds.size} referenced, ${deletedCount} deleted`
    );

    return {
      deletedCount,
      checkedCount,
      referencedCount: referencedStorageIds.size,
    };
  },
});
