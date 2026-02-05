---
status: ready
priority: p3
issue_id: "015"
tags: [code-review, testing, duplication]
dependencies: []
---

# Extract invalidateAdminSessions Setup Helper

## Problem Statement

Three tests in the `invalidateAdminSessions` success cases block each independently set up an identical scenario: create root admin, create target admin with auth user, create auth sessions. Lines 903-934, 962-986, and 1010-1034 are nearly identical ~30-line setup blocks.

## Findings

- Location: `convex/admins.test.ts:903-1045`
- Three 30-line blocks with identical setup logic
- ~60 lines of pure duplication
- Raised by: Patterns agent

## Proposed Solutions

### Option 1: Extract createTargetAdminWithAuthSessions helper
- Create a helper within the describe block scope
- Returns `{ targetId, targetAuthUserId }`
- Each test calls the helper + its specific assertion
- **Pros**: ~60 lines removed, cleaner tests
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 1.

## Technical Details

- **Affected Files**: `convex/admins.test.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Setup helper extracted
- [ ] Three tests refactored to use it
- [ ] All tests pass

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System

## Notes

Source: PR #50 code review triage session on 2026-02-05
