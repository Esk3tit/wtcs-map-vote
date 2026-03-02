---
status: complete
priority: p3
issue_id: "005"
tags: [code-review, security, wide-event]
dependencies: []
---

# Pre-truncate Token in adminVoteOnBehalf

## Problem Statement

In `voting.ts:adminVoteOnBehalf`, the player token is retrieved from the database and passed to `ev.setPlayer(player.token, player)`. While `setPlayer` already truncates to 8 chars, the full token transiently exists in the `token` parameter. As defense-in-depth, the token could be pre-truncated before passing to any logging method.

## Findings

**Agent:** security-sentinel

**Evidence:**
- `convex/voting.ts` `adminVoteOnBehalf` mutation retrieves `player.token` from DB
- `ev.setPlayer()` truncates via `token.slice(0, 8)` — this works correctly
- No actual leak exists, but pre-truncation is a defense-in-depth practice

## Proposed Solutions

### Option A: Pass Pre-truncated Token

```typescript
ev.setPlayer(player.token?.slice(0, 8) ?? null, player);
```

- **Pros:** Defense-in-depth, prevents accidental logging of full token
- **Cons:** Redundant with `setPlayer`'s own truncation
- **Effort:** Trivial
- **Risk:** None

### Option B: No Change

- **Pros:** `setPlayer` already handles truncation correctly
- **Cons:** Relies on `setPlayer` implementation not changing
- **Effort:** None
- **Risk:** None

## Recommended Action

Option A: Add pre-truncation — one-line change, trivial effort, good defense-in-depth practice.

## Acceptance Criteria

- [ ] Decision made on whether to pre-truncate
- [ ] If yes, update the single call site

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review of PR #95 | Current code is safe; this is defense-in-depth only |
| 2026-03-02 | Approved during triage — Option A selected | Trivial one-line fix |

## Resources

- `convex/voting.ts` — `adminVoteOnBehalf` mutation
- `convex/lib/wideEvent.ts:91` — `setPlayer` truncation logic
