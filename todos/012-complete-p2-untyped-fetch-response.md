---
status: complete
priority: p2
issue_id: "012"
tags: [code-review, typescript, quality]
dependencies: []
---

# Untyped res.json() in usePlayerAuth Hook

## Problem Statement

Both `data` and `hbData` from `res.json()` are implicitly `any`. The `data.error` value is passed directly to `setError` (which expects `AuthError | null`) with no validation. If the server returns an unexpected error string, it becomes a garbage `AuthError` value at runtime with no compile-time protection.

## Findings

- **Source agents:** kieran-typescript-reviewer
- **File:** `src/hooks/usePlayerAuth.ts` lines 53 and 68
- **Evidence:** `const data = await res.json();` and `const hbData = await hbRes.json();` — both `any`

## Proposed Solutions

### Solution A: Type the response and validate (Recommended)
```typescript
type ValidateTokenResponse =
  | { status: "ok" }
  | { status: "error"; error: AuthError };

const data: unknown = await res.json();
// Validate or cast with guard
```
- **Effort:** Small | **Risk:** None

## Technical Details

- **Affected files:** `src/hooks/usePlayerAuth.ts`

## Acceptance Criteria

- [ ] `res.json()` results are properly typed (not `any`)
- [ ] Unknown error codes from server are handled gracefully

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by kieran-typescript-reviewer |

## Resources

- PR: [#45](https://github.com/Esk3tit/wtcs-map-vote/pull/45)
