/**
 * Team Logo Resolution
 *
 * Shared utility for resolving team logos by name.
 * Batch-resolves logos for multiple teams efficiently using Promise.all.
 *
 * Unlike sessionMaps (which snapshot map images at assignment time),
 * team logos are resolved live from the teams table. This is intentional:
 * logos are cosmetic identity markers and should reflect current branding,
 * whereas map images are part of the voting domain and must be immutable
 * during a session.
 */

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Resolve the logo URL for a single team document.
 * Prefers storage URL over external URL.
 *
 * @param ctx - Query context
 * @param team - Team document with optional logoUrl and logoStorageId
 * @returns Resolved logo URL, or undefined if no logo
 */
export async function resolveTeamLogoUrl(
  ctx: QueryCtx,
  team: { logoUrl?: string; logoStorageId?: Id<"_storage"> }
): Promise<string | undefined> {
  let logoUrl = team.logoUrl;
  if (team.logoStorageId) {
    const storageUrl = await ctx.storage.getUrl(team.logoStorageId);
    logoUrl = storageUrl ?? team.logoUrl;
  }
  return logoUrl ?? undefined;
}

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

      const logoUrl = await resolveTeamLogoUrl(ctx, team);
      return [name, logoUrl] as const;
    })
  );
  return new Map(results);
}

/**
 * Convert a logo Map (from resolveTeamLogos) to a plain Record,
 * filtering out teams with no logo.
 *
 * @param logoMap - Map of teamName -> logoUrl (possibly undefined)
 * @returns Record with only teams that have a logo URL
 */
export function logoMapToRecord(
  logoMap: Map<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    [...logoMap.entries()].filter(
      (entry): entry is [string, string] => entry[1] != null
    )
  );
}
