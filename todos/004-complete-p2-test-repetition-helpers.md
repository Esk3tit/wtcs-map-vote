---
status: complete
priority: p2
issue_id: "004"
tags: [testing, dry, voting]
dependencies: []
---

# Reduce test repetition in voting.test.ts

## Problem Statement

The voting test file has significant code duplication: the full 4-ban ABBA sequence is repeated 6 times (~72 lines), and 4 near-identical "not IN_PROGRESS" tests could use `it.each`. Total ~160 lines of test code could be reduced.

## Findings

- Location: `convex/voting.test.ts`
- Full 4-ban ABBA sequence repeated at 6 call sites (~12 lines each)
- 4 session status rejection tests (DRAFT, WAITING, PAUSED, COMPLETE) with identical structure at lines 195-253
- Overlapping completion tests that duplicate assertions from the main completion test

## Proposed Solutions

### Option 1: Extract helpers and use it.each
- Extract `completeABBAFlow(t, data)` helper for the 4-ban sequence
- Consolidate status rejection tests with `it.each(["DRAFT", "WAITING", "PAUSED", "COMPLETE"])`
- **Pros**: ~100+ lines reduced, easier to maintain
- **Cons**: Slightly less explicit in each test
- **Effort**: Small (30-45 minutes)
- **Risk**: Low

## Recommended Action

Option 1 — extract helpers and consolidate with `it.each`.

## Technical Details

- **Affected Files**: `convex/voting.test.ts`
- **Related Components**: Voting test suite
- **Database Changes**: No

## Resources

- Original finding: PR #52 multi-agent code review (code simplicity reviewer)

## Acceptance Criteria

- [x] `completeABBAFlow` helper extracted and used at all 6 sites
- [x] Session status rejection tests use `it.each`
- [x] No test coverage lost
- [x] All tests pass

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

## Notes

Source: Triage session on 2026-02-08 (PR #52 review)
