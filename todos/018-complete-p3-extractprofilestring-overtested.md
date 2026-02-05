---
status: ready
priority: p3
issue_id: "018"
tags: [code-review, testing, simplicity]
dependencies: ["011"]
---

# Reduce extractProfileString Over-Testing

## Problem Statement

`extractProfileString` is a 1-line function with 2 branches but has 8 tests. Tests for `null`, `undefined`, `number`, `object`, `boolean` all exercise the same `typeof !== "string"` branch. 3 tests would suffice: non-empty string, empty string, non-string.

## Findings

- Location: `convex/authCallback.test.ts:23-55`
- 5 of 8 tests exercise the identical `typeof !== "string"` branch
- Raised by: Simplicity agent

## Proposed Solutions

### Option 1: Trim to 3 tests
- Keep: non-empty string returns string, empty string returns undefined, non-string (null) returns undefined
- Remove: number, object, boolean, single-char tests
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 1. Best done alongside #011 (simulated callback cleanup).

## Technical Details

- **Affected Files**: `convex/authCallback.test.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] 3-4 tests remain for extractProfileString
- [ ] Full branch coverage maintained
- [ ] Tests pass

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System

## Notes

Source: PR #50 code review triage session on 2026-02-05
