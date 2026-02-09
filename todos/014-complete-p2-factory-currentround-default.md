---
status: complete
priority: p2
issue_id: "014"
tags: [code-review, testing, data-integrity]
dependencies: []
---

# Fix sessionFactory currentRound default (0 vs production 1)

## Problem Statement

The `sessionFactory` in `convex/test.factories.ts` defaults `currentRound` to `0`, while production code (`createSession` and `createSessionFull` in `convex/sessions.ts`) initializes sessions with `currentRound: 1`. This mismatch is currently masked because `createMultiplayerSession` in the test file explicitly overrides `currentRound: 1`, but any future test using the raw factory would get round 0, which never occurs in production.

## Findings

- `convex/test.factories.ts:117` — `currentRound: overrides.currentRound ?? 0`
- `convex/sessions.ts:393` — `currentRound: 1` (createSession)
- `convex/sessions.ts:897` — `currentRound: 1` (createSessionFull)
- `convex/voting.test.ts:779` — `currentRound: overrides.currentRound ?? 1` (masks factory default)
- Source: Data Integrity Guardian reviewer

## Proposed Fix

Change the factory default from `0` to `1`:
```typescript
currentRound: overrides.currentRound ?? 1,
```

## Files to Modify

- `convex/test.factories.ts:117` — Change default from `0` to `1`
