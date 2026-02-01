---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, security]
dependencies: []
---

# CORS Wildcard Origin Should Be Restricted

## Problem Statement

The HTTP action endpoints use `Access-Control-Allow-Origin: *`, allowing any website to make cross-origin requests to the player auth endpoints. While the token acts as a bearer credential (mitigating CSRF), a tighter origin policy provides defense-in-depth.

## Findings

- **Source agents:** security-sentinel, architecture-strategist, pattern-recognition-specialist, kieran-typescript-reviewer, data-integrity-guardian
- **File:** `convex/http.ts` line 39
- **Evidence:** `"Access-Control-Allow-Origin": "*"` in `corsHeaders` object

## Proposed Solutions

### Solution A: Use environment variable for allowed origin
```typescript
const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? "*";
```
- **Effort:** Small | **Risk:** Low

### Solution B: Dynamic origin checking against allowlist
Check the request `Origin` header against a list of allowed domains.
- **Effort:** Medium | **Risk:** Low

## Technical Details

- **Affected files:** `convex/http.ts`

## Acceptance Criteria

- [ ] CORS origin restricted to actual frontend domain in production
- [ ] Development still works (localhost allowed)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 5 agents |

## Resources

- PR: [#45](https://github.com/Esk3tit/wtcs-map-vote/pull/45)
