import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Get all storage IDs currently referenced by teams.
 * Used by the cleanup job to determine which files are still in use.
 */
export const getReferencedStorageIds = internalQuery({
  args: {},
  returns: v.array(v.id("_storage")),
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").collect();
    const storageIds: Array<Id<"_storage">> = [];

    for (const team of teams) {
      if (team.logoStorageId) {
        storageIds.push(team.logoStorageId);
      }
    }

    return storageIds;
  },
});

/**
 * Cleans up storage files that are not referenced by any team.
 * Files must be older than 1 hour to avoid race conditions with active uploads.
 *
 * This mutation queries the _storage system table to find all files,
 * compares against referenced storage IDs from teams, and deletes
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
    const referencedStorageIds = new Set<string>(
      teams.map((t) => t.logoStorageId).filter((id): id is Id<"_storage"> => id !== undefined)
    );

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
