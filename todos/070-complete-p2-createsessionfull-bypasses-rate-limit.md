---
status: complete
priority: p2
issue_id: "070"
tags: [code-review, security, rate-limiting]
dependencies: []
---

# Rate limit createSessionFull mutation

## Problem Statement

`createSessionFull` in `convex/sessions.ts` is a convenience mutation that creates a session with players and maps in one call. It bypasses the `createSession` rate limit because it doesn't call `rateLimiter.limit()` directly — it's a separate mutation from `createSession`.

## Findings

- **Location**: `convex/sessions.ts` — `createSessionFull` mutation
- **Evidence**: `createSession` has rate limiting, but `createSessionFull` does not
- **Flagged by**: pattern-recognition-specialist, security-sentinel, data-integrity-guardian

## Proposed Solutions

### Option A: Add adminMutation rate limit (Recommended)
- Add `rateLimiter.limit(ctx, "adminMutation", { key: adminId, throws: true })` at the top of `createSessionFull`
- **Pros**: Consistent with other admin mutations, simple
- **Cons**: Uses generic admin limit rather than session-specific
- **Effort**: Small
- **Risk**: Low

### Option B: Add createSession rate limit
- Use `rateLimiter.limit(ctx, "createSession", { key: adminId, throws: true })`
- **Pros**: Same limit as createSession, prevents circumvention
- **Cons**: May be too restrictive if admin needs to create many sessions quickly
- **Effort**: Small
- **Risk**: Low

## Technical Details

**Affected files:**
- `convex/sessions.ts` — `createSessionFull` mutation

## Acceptance Criteria

- [ ] `createSessionFull` has rate limiting applied
- [ ] Rate limit is consistent with `createSession` or `adminMutation` pattern

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-03-01 | Created | From PR #93 code review |
| 2026-03-01 | Approved | Triage: approved all findings — status pending → ready |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/93
