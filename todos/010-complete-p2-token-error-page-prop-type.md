---
status: complete
priority: p2
issue_id: "010"
tags: [code-review, typescript, quality]
dependencies: []
---

# TokenErrorPage Prop Type Should Be Union, Not String

## Problem Statement

`TokenErrorPage` accepts `error: string` but handles 7 specific error codes. Any arbitrary string passes the type checker and silently renders "An unexpected error occurred." The error codes from `usePlayerAuth`, `getSessionByToken`, and the error page itself are manually kept in sync with no compile-time enforcement.

## Findings

- **Source agents:** pattern-recognition-specialist, kieran-typescript-reviewer
- **File:** `src/components/session/TokenErrorPage.tsx` line 4
- **Evidence:** `export function TokenErrorPage({ error }: { error: string })`

## Proposed Solutions

### Solution A: Define shared error union type (Recommended)
```typescript
type TokenError = "INVALID_TOKEN" | "TOKEN_EXPIRED" | "SESSION_NOT_FOUND" | "TOKEN_NOT_ACTIVATED" | "IP_MISMATCH" | "SESSION_NOT_ACTIVE" | "NETWORK_ERROR";
export function TokenErrorPage({ error }: { error: TokenError }) {
```
- **Effort:** Small | **Risk:** None

## Technical Details

- **Affected files:** `src/components/session/TokenErrorPage.tsx`, callers in route files

## Acceptance Criteria

- [ ] Error prop is a union type
- [ ] Callers get compile-time error if passing unknown error codes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 2 agents |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
