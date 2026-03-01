---
status: complete
priority: p2
issue_id: "057"
tags: [code-review, simplicity]
dependencies: []
---

# Inline DashboardEmptyState wrapper function

## Problem Statement

`DashboardEmptyState` is a wrapper function that exists solely to pass dashboard-specific props to `EmptyState`. It's called exactly once and adds indirection with zero reuse. Teams and maps pages inline their `EmptyState` calls directly — dashboard should do the same for consistency.

## Findings

- `src/routes/admin/dashboard.tsx:254-275` — 22-line wrapper function called once at line 101
- Teams and maps pages inline EmptyState directly without a wrapper
- Agent: code-simplicity-reviewer

## Proposed Solutions

### Option A: Inline the call (Recommended)
- Replace `<DashboardEmptyState />` at line 101 with the `<EmptyState ... />` JSX directly
- Delete the wrapper function (lines 254-275)
- **Pros**: Removes 22 lines, matches teams/maps pattern
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Dashboard uses inline `<EmptyState>` like teams/maps pages
- [ ] `DashboardEmptyState` wrapper function removed
- [ ] No visual change

## Resources

- PR: #89
