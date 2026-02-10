---
status: complete
priority: p3
issue_id: "027"
tags: [typescript, frontend, error-handling]
dependencies: []
---

# Add union type + missing error codes for getVotingErrorMessage

## Problem Statement

`getVotingErrorMessage` takes `string` but only handles 7 of 12 known backend error codes. Using a union type creates compile-time coverage, and adding the missing codes gives more specific user messages instead of the generic fallback.

## Findings

- Location: `src/routes/vote.$token.tsx:29-47`
- Backend `submitBan` can return: `INVALID_TOKEN`, `INVALID_IP`, `TOKEN_EXPIRED`, `SESSION_NOT_FOUND`, `SESSION_NOT_IN_PROGRESS`, `FORMAT_NOT_ABBA`, `NOT_YOUR_TURN`, `MAP_UNAVAILABLE`, `IP_MISMATCH`
- Backend `submitVote` can return: `INVALID_TOKEN`, `INVALID_IP`, `TOKEN_EXPIRED`, `SESSION_NOT_FOUND`, `SESSION_NOT_IN_PROGRESS`, `FORMAT_NOT_MULTIPLAYER`, `ALREADY_VOTED`, `MAP_UNAVAILABLE`, `IP_MISMATCH`
- HTTP layer can return: `INVALID_REQUEST`
- Currently unhandled: `SESSION_NOT_FOUND`, `FORMAT_NOT_ABBA`, `FORMAT_NOT_MULTIPLAYER`, `INVALID_REQUEST`, `INVALID_IP`

## Proposed Solutions

### Option 1: Add union type and missing case mappings
- Define `VotingErrorCode` union type from all known backend error codes
- Add switch cases for `SESSION_NOT_FOUND`, `FORMAT_NOT_ABBA`, `FORMAT_NOT_MULTIPLAYER`, `INVALID_REQUEST`
- **Pros**: Compile-time coverage, better user messages
- **Cons**: Must stay in sync with backend changes
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Define the union type and add the 4 missing case mappings. Keep the `default` fallback for unknown codes.

## Technical Details

- **Affected Files**: `src/routes/vote.$token.tsx`
- **Related Components**: `convex/voting.ts` (error code definitions)
- **Database Changes**: No

## Acceptance Criteria

- [ ] `getVotingErrorMessage` parameter typed with union of all known error codes
- [ ] Missing codes have user-friendly messages
- [ ] `default` fallback retained for forward-compatibility
- [ ] `bun run typecheck && bun run lint` passes

## Work Log

### 2026-02-09 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (WAR-36 review findings)
- Status: ready

## Notes
Source: WAR-36 code review — TypeScript reviewer, Architecture reviewer
