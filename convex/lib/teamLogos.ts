/**
 * Team Logo Resolution
 *
 * Shared utility for resolving team logos by name.
 * Batch-resolves logos for multiple teams efficiently using Promise.all.
 */

import type { QueryCtx } from "../_generated/server";

/**
 * Resolve logo URLs for a set of team names.
 * Uses the by_name index for efficient lookups.
 * Prefers storage URL over external URL.
 *
 * @param ctx - Query context
 * @param teamNames - Team names to resolve (duplicates are deduplicated)
 * @returns Map of teamName -> resolved logoUrl (undefined if no logo)
 */
export async function resolveTeamLogos(
  ctx: QueryCtx,
  teamNames: string[]
): Promise<Map<string, string | undefined>> {
  const unique = [...new Set(teamNames)];
  const results = await Promise.all(
    unique.map(async (name) => {
      const team = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (!team) return [name, undefined] as const;

      let logoUrl = team.logoUrl;
      if (team.logoStorageId) {
        const storageUrl = await ctx.storage.getUrl(team.logoStorageId);
        logoUrl = storageUrl ?? team.logoUrl;
      }
      return [name, logoUrl ?? undefined] as const;
    })
  );
  return new Map(results);
}
