---
status: complete
priority: p2
issue_id: "014"
tags: [code-review, duplication, utility]
dependencies: []
---

# Extract player sort into a shared utility function

## Problem Statement

The deterministic player sort pattern (`sort by _creationTime then _id`) appears in at least 3 locations across the codebase. This sort order is a core game rule — it determines who is Player A vs Player B in ABBA format. Duplicating it inline risks one copy being missed if the sort criteria ever changes.

## Findings

- **Location:** `convex/voting.ts:434-437` (`submitBan`), `convex/voting.ts:762-765` (`handleABBABan`), `convex/sessions.ts:1470-1473` (`getSessionByToken`)
- **Agents:** pattern-recognition-specialist, code-simplicity-reviewer, performance-oracle
- **Context:** All three locations use the identical sort:
  ```typescript
  const sortedPlayers = [...allPlayers].sort(
    (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
  );
  ```

## Proposed Solutions

### Option 1: Add to convex/lib/constants.ts (Recommended)
- Add `sortPlayersByJoinOrder(players: Doc<"sessionPlayers">[])` next to `getActivePlayerIndex`
- Replace all 3 inline sorts with the utility call
- **Pros:** Single source of truth for a game-critical sort rule, pairs naturally with `getActivePlayerIndex`
- **Cons:** Minimal — just a small helper
- **Effort:** Small
- **Risk:** Low

### Option 2: Create new convex/lib/players.ts
- Dedicated module for player-related utilities
- **Pros:** Clean separation
- **Cons:** May be overengineered for a single function
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1: Add `sortPlayersByJoinOrder` to `convex/lib/constants.ts` next to `getActivePlayerIndex`. Replace all inline sorts.

## Acceptance Criteria

- [ ] Single utility function exported for player sort
- [ ] All inline sort instances replaced
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #63 code review | Sort pattern duplicated across voting.ts and sessions.ts |
| 2026-02-13 | Approved during triage | Status: pending → ready. Quick win — small effort, high value. |

## Resources

- PR #63: https://github.com/Esk3tit/wtcs-map-vote/pull/63
- `convex/lib/constants.ts:33` — `getActivePlayerIndex` (natural companion)
