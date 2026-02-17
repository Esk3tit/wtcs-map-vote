---
status: complete
priority: p3
issue_id: "046"
tags: [code-review, data-hygiene]
dependencies: []
---

# Clear readyAt on Session Start for Data Hygiene

## Problem Statement

When a session transitions from WAITING to IN_PROGRESS, `readyAt` is not cleared on player records. While the UI correctly hides ready indicators outside WAITING state, stale `readyAt` values remain in the database.

This is a data hygiene concern — not a bug — since the UI guards prevent any visible issue.

## Findings

- **Security Sentinel**: Flagged as LOW — stale data, UI guards prevent display
- **Architecture Strategist**: Noted as LOW concern

### Evidence

- `convex/sessions.ts` — `startSession` does not clear `readyAt`
- `readyAt` is cleared in `resetSession` but not `startSession`

## Proposed Solutions

### Option A: Clear readyAt in startSession (Recommended)

Add `readyAt: undefined` to the player patch in `startSession`.

**Pros:** Clean data state, consistent with reset behavior
**Cons:** Extra write per player on start
**Effort:** Trivial
**Risk:** Low

### Option B: Accept stale data

UI already guards against showing stale ready status. No change needed.

**Pros:** No code change
**Cons:** Stale data persists
**Effort:** None
**Risk:** Low

## Technical Details

**Affected files:**
- `convex/sessions.ts` — startSession handler

## Acceptance Criteria

- [ ] `readyAt` is cleared when session starts
- [ ] Existing tests still pass
- [ ] Optional: add test verifying readyAt is cleared

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #71 code review | Security sentinel noted stale data |

## Resources

- PR #71: https://github.com/Esk3tit/wtcs-map-vote/pull/71
