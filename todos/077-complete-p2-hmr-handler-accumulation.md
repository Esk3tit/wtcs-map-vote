---
status: complete
priority: p2
issue_id: "077"
tags: [code-review, dx, bug]
dependencies: []
---

# Fix unhandledrejection handler accumulating on HMR

## Problem Statement
`window.addEventListener("unhandledrejection", ...)` in `main.tsx` is registered at module scope and never cleaned up. During Vite HMR in development, each hot reload adds another handler, causing duplicate toasts (e.g., 20 identical "App update available" toasts after 20 saves).

## Findings
- Location: `src/main.tsx:27-42`
- Flagged by: julik-frontend-races-reviewer
- Development-only issue, not a production bug
- Degrades developer experience significantly

## Proposed Solutions

### Option 1: Guard with import.meta.hot.dispose()
- **Pros**: Proper HMR cleanup, standard Vite pattern
- **Cons**: Slightly more code
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — use `import.meta.hot?.dispose()` to remove the previous handler before adding a new one.

## Technical Details
- **Affected Files**: `src/main.tsx`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Only one unhandledrejection handler exists after HMR
- [ ] No duplicate toasts during development

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System

## Notes
Source: PR #94 code review
