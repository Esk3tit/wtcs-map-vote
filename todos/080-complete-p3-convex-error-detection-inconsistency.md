---
status: complete
priority: p3
issue_id: "080"
tags: [code-review, consistency]
dependencies: []
---

# Align ConvexError detection between sentry.ts and main.tsx

## Problem Statement
ConvexError is detected with different defensive levels:
- `sentry.ts` beforeSend: `typeof + "data" in + .name === "ConvexError"` (3 checks)
- `main.tsx` unhandledrejection: `error?.name === "ConvexError"` (1 check)

## Findings
- Location: `src/lib/sentry.ts:54-58`, `src/main.tsx:32`
- Flagged by: pattern-recognition-specialist

## Proposed Solutions

### Option 1: Use `instanceof Error && error.name === "ConvexError"` in both places
- **Effort**: Small
- **Risk**: Low

## Technical Details
- **Affected Files**: `src/lib/sentry.ts`, `src/main.tsx`

## Acceptance Criteria
- [ ] Consistent ConvexError detection pattern in both locations

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System

## Notes
Source: PR #94 code review
