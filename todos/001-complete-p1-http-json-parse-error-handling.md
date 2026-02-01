---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, security, robustness]
dependencies: []
---

# Missing JSON Parse Error Handling in HTTP Actions

## Problem Statement

Both HTTP action handlers in `convex/http.ts` call `req.json()` without a try/catch. If a client sends a request with invalid JSON (empty body, malformed JSON, non-JSON content type), `req.json()` throws an unhandled exception, resulting in a 500 Internal Server Error. This leaks implementation details and creates noisy error logs.

## Findings

- **Source agents:** security-sentinel, kieran-typescript-reviewer, data-integrity-guardian, architecture-strategist
- **File:** `convex/http.ts` lines 51 and 96
- **Evidence:** `const body = await req.json();` called without error handling in both validate-token and heartbeat handlers
- **Additional concern:** `req.json()` returns `Promise<any>`, violating the project's "No `any` types" rule. The `body` variable is implicitly `any`.

## Proposed Solutions

### Solution A: Wrap in try/catch with typed validation (Recommended)
```typescript
let body: unknown;
try {
  body = await req.json();
} catch {
  return new Response(
    JSON.stringify({ status: "error", error: "INVALID_REQUEST" }),
    { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}
const token =
  typeof body === "object" && body !== null && "token" in body
    ? (body as { token: unknown }).token
    : undefined;
```
- **Pros:** Handles malformed requests gracefully, eliminates `any` type
- **Cons:** Slightly more verbose
- **Effort:** Small
- **Risk:** None

### Solution B: Simple try/catch without type narrowing
```typescript
let body;
try { body = await req.json(); } catch {
  return new Response(JSON.stringify({ status: "error", error: "INVALID_REQUEST" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
```
- **Pros:** Quick fix
- **Cons:** Still has implicit `any`
- **Effort:** Small
- **Risk:** None

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `convex/http.ts`
- **Components:** validate-token handler (line 51), heartbeat handler (line 96)

## Acceptance Criteria

- [ ] `req.json()` wrapped in try/catch in both handlers
- [ ] Malformed JSON returns 400 with `INVALID_REQUEST` error
- [ ] `body` variable is typed (not `any`)
- [ ] Existing tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by security-sentinel and kieran-typescript-reviewer |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
