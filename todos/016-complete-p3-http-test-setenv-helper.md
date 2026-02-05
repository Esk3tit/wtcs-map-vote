---
status: ready
priority: p3
issue_id: "016"
tags: [code-review, testing, readability]
dependencies: []
---

# Extract setEnv() Helper for http.test.ts

## Problem Statement

`http.test.ts` has 11 `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments for `(globalThis as any).process` manipulation. A small `setEnv()` helper would centralize the `any` cast and eliminate repetitive disable comments.

## Findings

- Location: `convex/http.test.ts:74-168`
- 11 eslint-disable comments, each for the same `(globalThis as any).process` pattern
- Raised by: TypeScript, Patterns agents

## Proposed Solutions

### Option 1: Create setEnv helper
```typescript
function setEnv(env: Record<string, string>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).process = { env };
}
```
- **Pros**: 11 eslint-disables → 1, cleaner individual tests
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 1.

## Technical Details

- **Affected Files**: `convex/http.test.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] `setEnv()` helper created
- [ ] All `getCorsHeaders` tests use it
- [ ] eslint-disable comments reduced to 1
- [ ] Tests pass

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System

## Notes

Source: PR #50 code review triage session on 2026-02-05
