---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, dry, architecture, sessions, pr-20]
dependencies: []
---

# DRY Violation: Duplicate Cascade Delete Logic

## Problem Statement

The `deleteSession` mutation in `sessions.ts` implements its own cascade delete logic, but `convex/lib/cascadeDelete.ts` already has `deleteSessionWithCascade` which handles this more comprehensively (includes votes and optionally preserves audit logs). This duplication creates maintenance burden and potential for divergence.

## Findings

### Architecture Strategist Analysis

**Location:** `/Users/khaiphan/Documents/wtcs-map-vote/convex/sessions.ts` lines 401-420

The `deleteSession` mutation duplicates logic from `cascadeDelete.ts`:
```typescript
// From sessions.ts - duplicates cascadeDelete.ts
const [players, maps] = await Promise.all([
  ctx.db.query("sessionPlayers")...
  ctx.db.query("sessionMaps")...
]);
await Promise.all([
  ...players.map((p) => ctx.db.delete(p._id)),
  ...maps.map((m) => ctx.db.delete(m._id)),
]);
```

**Issues:**
1. `sessions.ts` only deletes players and maps, NOT votes
2. `cascadeDelete.ts` handles votes, players, maps, and optionally audit logs
3. Two implementations may diverge over time

### Data Integrity Guardian Analysis

If DRAFT sessions somehow had votes (shouldn't happen, but bugs happen), they would become orphaned when using `deleteSession`.

## Proposed Solutions

### Option A: Import and Use Existing Utility (Recommended)
```typescript
import { deleteSessionWithCascade } from "./lib/cascadeDelete";

// In deleteSession handler:
await deleteSessionWithCascade(ctx, args.sessionId, { preserveAuditLogs: false });
```

**Pros:** Single source of truth, more comprehensive, already tested
**Cons:** None significant
**Effort:** Small
**Risk:** Low

### Option B: Move Comprehensive Logic to sessions.ts
Move the cascade delete logic from `cascadeDelete.ts` to `sessions.ts` and deprecate the old utility.

**Pros:** All session logic in one place
**Cons:** Breaking change for existing callers, larger diff
**Effort:** Medium
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/sessions.ts` - deleteSession mutation (lines 383-432)
- `convex/lib/cascadeDelete.ts` - existing utility

## Acceptance Criteria

- [ ] `deleteSession` uses the same cascade logic as `deleteSessionWithCascade`
- [ ] Votes are deleted during cascade (even though DRAFT shouldn't have votes)
- [ ] No duplicate implementations of cascade delete

## Work Log

| Date | Action | Learning |
|------|--------|----------|
| 2026-01-14 | Created from PR #20 review | Architecture review identified duplication |

## Resources

- PR #20: https://github.com/Esk3tit/wtcs-map-vote/pull/20
