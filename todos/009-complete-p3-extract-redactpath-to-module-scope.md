---
status: complete
priority: p3
issue_id: "009"
tags: [code-review, simplicity, posthog]
dependencies: []
---

# Extract redactPath helper to module scope

## Problem Statement

The `redactPath` function is defined inside the `sanitize_properties` callback, meaning it gets re-created on every PostHog event capture. It's a pure function with no closure dependencies and should live at module scope.

## Findings

- `redactPath` defined inside `sanitize_properties` callback in `src/lib/posthog.ts`
- No closure dependencies — purely transforms a string input
- Found by: code-simplicity-reviewer agent

## Proposed Solutions

### Option 1: Move to module scope
- **Pros**: Single allocation, cleaner separation
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Move `redactPath` above the `initPostHog` function as a module-level helper.

## Technical Details

- **Affected Files**: `src/lib/posthog.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] `redactPath` is at module scope
- [ ] Sanitization still works correctly
- [ ] Typecheck passes

## Work Log

### 2026-03-02 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)

## Notes

Source: Triage session on 2026-03-02
