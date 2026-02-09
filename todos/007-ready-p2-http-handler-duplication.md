---
status: complete
priority: p2
issue_id: "007"
tags: [refactoring, http, duplication]
dependencies: []
---

# HTTP handler duplication between submit-ban and submit-vote

## Problem Statement

The `POST /api/player/submit-vote` handler in `convex/http.ts` is a near-verbatim copy of the `submit-ban` handler. Both handlers share identical logic for: JSON parsing, token extraction, mapId extraction, type validation, IP extraction, error wrapping for invalid Convex IDs, and response formatting. The only differences are the mutation called and the variable names.

## Findings

- `convex/http.ts:157-228` (submit-ban handler) and `convex/http.ts:234-298` (submit-vote handler) share ~90% identical code
- Both extract `token` and `mapId` from the body with the same validation
- Both call `extractClientIp(req)` and wrap the mutation call in a try/catch for invalid ID format
- Future voting endpoints will likely need the same pattern

## Proposed Fix

Extract a shared `createVotingHandler(mutationRef)` factory (similar to existing `createPlayerHandler`) that accepts the mutation reference and handles:
- JSON body parsing
- `token` + `mapId` extraction and validation
- IP extraction
- Mutation invocation with try/catch for invalid ID
- Response formatting with CORS headers

The two routes would then become:
```typescript
http.route({
  path: "/api/player/submit-ban",
  method: "POST",
  handler: createVotingHandler(internal.voting.submitBan),
});

http.route({
  path: "/api/player/submit-vote",
  method: "POST",
  handler: createVotingHandler(internal.voting.submitVote),
});
```

## Files to Modify

- `convex/http.ts` - Extract factory, replace both handlers
