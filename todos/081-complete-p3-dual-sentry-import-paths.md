---
status: complete
priority: p3
issue_id: "081"
tags: [code-review, consistency]
dependencies: []
---

# Consolidate dual Sentry import paths in main.tsx

## Problem Statement
`main.tsx` imports from both `@sentry/react` (direct) and `@/lib/sentry` (wrapper). Could consolidate to single import path via `import { Sentry, initSentry } from '@/lib/sentry'`.

## Findings
- Location: `src/main.tsx:6,11`
- Flagged by: kieran-typescript-reviewer, pattern-recognition-specialist

## Proposed Solutions

### Option 1: Import Sentry from @/lib/sentry instead of @sentry/react
- **Effort**: Small
- **Risk**: Low

## Technical Details
- **Affected Files**: `src/main.tsx`

## Acceptance Criteria
- [ ] Single import path for Sentry in main.tsx
- [ ] `bun run typecheck` passes

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System

## Notes
Source: PR #94 code review
