---
status: complete
priority: p3
issue_id: "004"
tags: [code-review, wide-event, documentation]
dependencies: []
---

# Document Double Emission on HTTP-to-Mutation Paths

## Problem Statement

Player HTTP endpoints emit two wide events per request: one from the HTTP action layer (`http.ts`) and one from the internal mutation layer (`playerAuth.ts`, `voting.ts`). This is intentional — the HTTP layer captures transport context (status codes, CORS, request path) while the mutation captures business logic context (session state, player details, IP locking).

However, this design decision is not documented, and a future developer might try to "fix" the duplication.

## Findings

**Agent:** performance-oracle, architecture-strategist

**Evidence:**
- `createPlayerHandler` in `http.ts` creates a wide event for each HTTP request
- `validateAndLockToken`, `playerHeartbeat`, `playerReady` in `playerAuth.ts` each create their own wide event
- Same pattern for `createVotingHandler` → `submitBan`/`submitVote`
- Total: 2 events per player HTTP request (by design)

## Proposed Solutions

### Option A: Add Code Comment Explaining the Pattern

Add a brief comment in `http.ts` near the wide event creation:

```typescript
// Note: HTTP handler emits its own wide event for transport-level context
// (status code, path, CORS). The underlying mutation also emits a wide event
// for business logic context. This dual-emission is intentional.
```

- **Pros:** Low effort, prevents confusion
- **Cons:** None
- **Effort:** Trivial
- **Risk:** None

### Option B: Add Section to Architecture Docs

Document the wide event layering strategy in `docs/architecture.md`.

- **Pros:** More discoverable, good for onboarding
- **Cons:** Slightly more effort
- **Effort:** Small
- **Risk:** None

## Recommended Action

Option A: Add a brief inline comment in `http.ts` explaining dual emission is intentional.

## Acceptance Criteria

- [ ] Comment added in http.ts OR docs updated
- [ ] Future developers understand dual emission is intentional

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review of PR #95 | Performance impact is negligible (~3-9us per event) |
| 2026-03-02 | Approved during triage — Option A selected | Trivial effort, prevents future confusion |

## Resources

- `convex/http.ts` — HTTP handler wide events
- `convex/playerAuth.ts`, `convex/voting.ts` — mutation-layer wide events
