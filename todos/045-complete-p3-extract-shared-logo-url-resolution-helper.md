---
status: complete
priority: p3
issue_id: "045"
tags: [code-review, dry, convex]
dependencies: []
---

# Extract shared logo URL resolution helper (DRY)

## Problem Statement

The `logoStorageId` -> URL resolution logic is duplicated between `convex/lib/teamLogos.ts` and `convex/teams.ts`. If the resolution strategy changes (e.g., CDN prefix, signed URLs), it needs updating in both places.

## Findings

- **Source**: Architecture strategist (PR #86 review)
- **Location**:
  - `convex/lib/teamLogos.ts` lines 32-36
  - `convex/teams.ts` lines 75-79
- **Evidence**: Near-identical code blocks:
  ```typescript
  // In teamLogos.ts
  let logoUrl = team.logoUrl;
  if (team.logoStorageId) {
    const storageUrl = await ctx.storage.getUrl(team.logoStorageId);
    logoUrl = storageUrl ?? team.logoUrl;
  }

  // In teams.ts
  let logoUrl = team.logoUrl;
  if (team.logoStorageId) {
    const resolvedUrl = await ctx.storage.getUrl(team.logoStorageId);
    logoUrl = resolvedUrl ?? team.logoUrl;
  }
  ```

## Proposed Solutions

### Option A: Extract `resolveTeamLogoUrl()` helper into `convex/lib/teamLogos.ts`

```typescript
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
```

Both `resolveTeamLogos` and `listTeams` call this function.

- **Pros**: Single source of truth, easy to update resolution strategy
- **Cons**: Minor indirection
- **Effort**: Small (30 minutes)
- **Risk**: None

### Option B: Also simplify `resolveTeamLogos` to return `Record<string, string>` directly

Eliminates `logoMapToRecord` entirely. Callers use `record[key]` instead of `map.get(key)`.

- **Pros**: Removes `logoMapToRecord` export, simplifies consumers
- **Cons**: Slight semantic change (Map vs Record), broader refactor
- **Effort**: Small-Medium (1 hour)
- **Risk**: Low

## Recommended Action

Go with Option A only. Extract `resolveTeamLogoUrl()` and have both `resolveTeamLogos` and `listTeams` call it. Skip Option B (Map→Record simplification) for now.

## Technical Details

- **Affected files**: `convex/lib/teamLogos.ts`, `convex/teams.ts`, `convex/sessions.ts`

## Acceptance Criteria

- [ ] Logo URL resolution logic exists in only one place
- [ ] `bun run typecheck` and `bun run test` pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | Identified during PR #86 code review |
| 2026-02-28 | Approved | Approved during triage — ready to work on |

## Resources

- PR #86: https://github.com/Esk3tit/wtcs-map-vote/pull/86
