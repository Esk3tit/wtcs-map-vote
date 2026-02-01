---
status: complete
priority: p2
issue_id: "009"
tags: [code-review, quality, typescript]
dependencies: []
---

# Record<string, unknown> Erases Type Safety in Cleanup Patches (3x Duplication)

## Problem Statement

The IP clearing + token invalidation loop is copy-pasted 3 times in `sessionCleanup.ts` (lines 46-57, 119-131, 191-204). Each instance uses `Record<string, unknown>` which bypasses Convex's typed `ctx.db.patch`. A misspelled field name would compile fine but silently fail.

## Findings

- **Source agents:** architecture-strategist, kieran-typescript-reviewer, pattern-recognition-specialist, data-integrity-guardian, code-simplicity-reviewer
- **File:** `convex/sessionCleanup.ts` lines 47, 120, 192
- **Evidence:** `const patch: Record<string, unknown> = {};` appears 3 times with identical logic

## Proposed Solutions

### Solution A: Unconditionally patch both fields (Recommended)
```typescript
await ctx.db.patch(player._id, {
  ipAddress: undefined,
  tokenExpiresAt: Math.min(player.tokenExpiresAt, now),
});
```
- **Effort:** Small | **Risk:** None (no-op patches are safe)

### Solution B: Extract typed helper function
```typescript
function buildPlayerCleanupPatch(player: Doc<"sessionPlayers">, now: number): Partial<Pick<Doc<"sessionPlayers">, "ipAddress" | "tokenExpiresAt">> | null
```
- **Effort:** Small | **Risk:** None

## Technical Details

- **Affected files:** `convex/sessionCleanup.ts`

## Acceptance Criteria

- [ ] No `Record<string, unknown>` in cleanup patches
- [ ] Single source of truth for cleanup logic (either inlined simply or extracted)
- [ ] All cleanup tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 5 agents |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
