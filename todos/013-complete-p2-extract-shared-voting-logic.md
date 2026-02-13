---
status: complete
priority: p2
issue_id: "013"
tags: [code-review, architecture, duplication]
dependencies: []
---

# Extract shared voting logic to eliminate admin/player duplication

## Problem Statement

The `handleABBABan` helper (lines 743-846) duplicates ~70% of `submitBan` (lines 429-532), and `handleMultiplayerVote` (lines 852-945) duplicates ~75% of `submitVote` (lines 599-678). This creates ~130 lines of duplicated game logic that must be updated in lockstep. If the ban/vote logic changes (new fields, different timer behavior, resolution rules), both paths must be updated or they silently diverge.

## Findings

- **Location:** `convex/voting.ts:743-945` (admin helpers) vs `convex/voting.ts:429-532, 599-678` (player mutations)
- **Agents:** architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer, performance-oracle (maintenance), kieran-typescript-reviewer
- **Context:** The key differences between paths are: (1) auth mechanism (JWT vs token+IP), (2) error format (ConvexError vs error union), (3) `submittedByAdmin` flag, (4) audit `actorType`/`actorId`. The core game logic (ban map, advance turn, check auto-winner, insert vote, check all-voted, resolve round) is identical.

## Proposed Solutions

### Option 1: Extract shared inner functions with actor context (Recommended)
- Create `executeBan(ctx, session, player, targetMap, actor)` and `executeVote(ctx, session, player, targetMap, actor)` that contain the shared game logic
- Both `submitBan`/`submitVote` and the admin handlers become thin wrappers: auth + validation + call shared function + map return type
- Actor context: `{ type: "PLAYER" | "ADMIN", id: string, submittedByAdmin: boolean }`
- **Pros:** Single source of truth for game logic, ~130 LOC reduction, future changes propagate automatically
- **Cons:** Requires careful refactoring of both paths simultaneously
- **Effort:** Medium
- **Risk:** Low (well-tested, refactoring only)

### Option 2: Accept duplication with synchronization comments
- Add `// SYNC: Keep in sync with handleABBABan/submitBan` comments
- Rely on code review to catch drift
- **Pros:** No refactoring risk, ships faster
- **Cons:** Maintenance liability grows with each future change
- **Effort:** Small
- **Risk:** Medium (drift over time)

## Recommended Action

Option 1: Extract shared inner functions with actor context. This is the highest-value refactor in the PR.

## Technical Details

**Affected files:**
- `convex/voting.ts` — extract shared logic, refactor both admin and player paths

**Duplicated blocks:**
- Player sort + ABBA turn validation (7 lines, 2 copies)
- Ban execution + turn advance + timer reset (15 lines, 2 copies)
- Auto-winner check + completeSession call (20 lines, 2 copies)
- Vote insertion + player flag update (10 lines, 2 copies)
- All-voted check + resolveRound call (15 lines, 2 copies)
- Audit logging (10 lines, 2 copies with minor differences)

## Acceptance Criteria

- [ ] Shared inner functions extracted for ABBA ban and MULTIPLAYER vote logic
- [ ] Both player-facing and admin-facing mutations call the shared functions
- [ ] All existing tests pass without modification
- [ ] No behavior changes (same audit logs, same state mutations, same return values)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #63 code review | All 7 review agents flagged duplication as the primary concern |
| 2026-02-13 | Approved during triage | Status: pending → ready. Highest-priority refactor item. |

## Resources

- PR #63: https://github.com/Esk3tit/wtcs-map-vote/pull/63
- `convex/voting.ts:429-532` — `submitBan` (player ABBA path)
- `convex/voting.ts:599-678` — `submitVote` (player MULTIPLAYER path)
- `convex/voting.ts:743-945` — admin helpers (duplicated logic)
