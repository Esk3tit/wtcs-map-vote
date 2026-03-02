---
status: complete
priority: p2
issue_id: "075"
tags: [code-review, security, information-disclosure]
dependencies: []
---

# Gate AdminErrorFallback error.message behind DEV check

## Problem Statement
`AdminErrorFallback` renders `error.message` unconditionally in production. Error messages may contain internal paths, query details, or stack trace fragments. `RootErrorFallback` correctly gates this behind `import.meta.env.DEV`.

## Findings
- Location: `src/components/error-boundary.tsx:42-44`
- Flagged by: security-sentinel, pattern-recognition-specialist
- CWE-209: Generation of Error Message Containing Sensitive Information
- Risk reduced since admin pages are behind auth, but not eliminated

## Proposed Solutions

### Option 1: Add import.meta.env.DEV guard matching RootErrorFallback
- **Pros**: Consistent pattern, no info leak in prod
- **Cons**: Admins lose error detail in production
- **Effort**: Small
- **Risk**: Low

### Option 2: Show truncated/generic message in prod, full in dev
- **Pros**: Some debugging context preserved for admins
- **Cons**: Slightly more complex
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — consistency with RootErrorFallback pattern.

## Technical Details
- **Affected Files**: `src/components/error-boundary.tsx`
- **Database Changes**: No

## Acceptance Criteria
- [ ] `error.message` only shown when `import.meta.env.DEV` is true in AdminErrorFallback
- [ ] Production build does not expose error messages to users

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System

## Notes
Source: PR #94 code review
