---
status: complete
priority: p2
issue_id: "032"
tags: [code-review, quality, testing]
dependencies: []
---

# Trim oversized integration test in voting.test.ts

## Problem Statement

The new integration test "deadlock -> pause -> resume -> second deadlock -> random winner" is 48 lines but carries ~28 extra lines of intermediate assertions (pause status check, redundant round-1 DB reads, type-narrowing boilerplate) that duplicate the adjacent stakeholder test. Can be trimmed to ~20 lines while testing the exact same behavior.

## Findings

- Location: `convex/voting.test.ts:2188-2234`
- The pause assertion block (lines 2203-2213) tests code that was never broken — `pauseSession` never touched `isRevoteRound`
- The round-1 DB read and intermediate assertions duplicate what the adjacent 4-player test already covers
- The `if (status !== "ok") throw` type-narrowing is redundant when the next assertion already fails clearly

## Proposed Solutions

### Option 1: Trim to essential assertions only
- Keep: REVOTE outcome after R1, `isRevoteRound === true` after resume, RANDOM_WINNER after R2, COMPLETE status
- Remove: pause status check, round-1 DB read, type-narrowing guards
- **Pros**: ~20 lines, focuses on the exact behavior being fixed
- **Cons**: Less intermediate state documentation
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Trim the test to focus on the fix: pause/resume preserves `isRevoteRound`, enabling RANDOM_WINNER on second deadlock.

## Technical Details

- **Affected Files**: `convex/voting.test.ts`
- **Related Components**: Voting resolution tests
- **Database Changes**: No

## Acceptance Criteria

- [ ] Test still covers the full deadlock -> pause -> resume -> deadlock -> random winner flow
- [ ] Redundant intermediate assertions removed
- [ ] Test is ~20 lines instead of ~48
- [ ] All tests pass

## Resources

- PR #83: fix: preserve isRevoteRound through pause/resume
- Source: Code review — Simplicity Reviewer

## Work Log

### 2026-02-25 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approve all)
- Status: ready
