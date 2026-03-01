---
status: complete
priority: p3
issue_id: "071"
tags: [code-review, architecture, rate-limiting]
dependencies: []
---

# Add Retry-After HTTP header on 429 responses

## Problem Statement

When HTTP endpoints return 429 status for rate-limited requests, they include `retryAfter` in the JSON body but don't set the standard `Retry-After` HTTP header. While the client parses the JSON body directly, the missing header violates HTTP conventions and may confuse CDN/proxy layers.

## Findings

- **Location**: `convex/http.ts` — `createPlayerHandler` and `createVotingHandler`
- **Evidence**: Both handlers return `new Response(JSON.stringify(...), { status: 429 })` without `Retry-After` header
- **Flagged by**: security-sentinel, architecture-strategist, pattern-recognition-specialist

## Proposed Solutions

### Option A: Add Retry-After header alongside JSON body (Recommended)
- When returning 429, add `headers: { "Retry-After": String(Math.ceil(retryAfter / 1000)) }`
- **Pros**: Standards-compliant, helps proxies/CDNs, minimal change
- **Cons**: Slightly more code
- **Effort**: Small
- **Risk**: Low

## Technical Details

**Affected files:**
- `convex/http.ts` — 429 response construction in both handlers

## Acceptance Criteria

- [ ] 429 responses include `Retry-After` header with seconds value
- [ ] JSON body still includes `retryAfter` in milliseconds for client

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-03-01 | Created | From PR #93 code review |
| 2026-03-01 | Approved | Triage: approved all findings — status pending → ready |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/93
- [MDN: Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
