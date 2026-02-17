---
status: complete
priority: p3
issue_id: "045"
tags: [code-review, quality]
dependencies: []
---

# Add AbortSignal.timeout to handleReady Fetch

## Problem Statement

The `handleReady` callback in `lobby.$token.tsx` uses `fetch()` without a timeout. If the server is unresponsive, the request hangs indefinitely, leaving the button in a loading state.

## Findings

- **Pattern Recognition**: Recommended adding `AbortSignal.timeout` for robustness

### Evidence

- `src/routes/lobby.$token.tsx:48-52` — fetch with no signal/timeout

## Proposed Solutions

### Option A: Add AbortSignal.timeout (Recommended)

```typescript
const res = await fetch(`${SITE_URL}/api/player/ready`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token }),
  signal: AbortSignal.timeout(10_000),
});
```

**Pros:** Prevents indefinite hang, good UX
**Cons:** Minor addition
**Effort:** Trivial
**Risk:** Low

## Technical Details

**Affected files:**
- `src/routes/lobby.$token.tsx`

## Acceptance Criteria

- [ ] Fetch has a timeout (e.g., 10s)
- [ ] Timeout produces a user-friendly error toast
- [ ] Button returns to non-loading state on timeout

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #71 code review | Pattern recognition agent suggested |

## Resources

- PR #71: https://github.com/Esk3tit/wtcs-map-vote/pull/71
