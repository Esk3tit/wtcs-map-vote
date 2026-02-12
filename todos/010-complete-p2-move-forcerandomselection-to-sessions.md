---
status: complete
priority: p2
issue_id: "010"
tags: [code-review, architecture]
dependencies: []
---

# Move forceRandomSelection from voting.ts to sessions.ts

## Problem Statement

The `forceRandomSelection` mutation is an admin lifecycle action placed in `convex/voting.ts`, which was previously a single-concern module for player-facing voting mechanics (`internalMutation` only). All other admin session lifecycle mutations (`endSession`, `pauseSession`, `resumeSession`, `startSession`, `finalizeSession`) live in `convex/sessions.ts`. The project specification (section 8.4) also places this under "Session Functions", not "Voting Functions".

## Findings

- **Location:** `convex/voting.ts:735-789`
- **Agents:** architecture-strategist, pattern-recognition-specialist
- **Context:** `voting.ts` previously exported only `internalMutation` functions called via HTTP actions. Adding a public `mutation` with `requireAdmin` auth mixes two different access patterns (player-via-HTTP vs admin-direct) in the same module. The `completeSession` private helper is the coupling point that motivated placement here.

## Proposed Solutions

### Option 1: Move mutation to sessions.ts + extract completeSession (Recommended)
- Extract `completeSession` helper to `convex/lib/sessionLifecycle.ts` (it is a session state transition helper)
- Move `forceRandomSelection` to `convex/sessions.ts` Lifecycle Mutations section
- Move tests to `convex/sessions.test.ts`
- **Pros:** Clean module boundaries, matches spec, consistent with all other admin mutations
- **Cons:** Requires extracting `completeSession` which is used by `submitBan` and `resolveRound` too
- **Effort:** Medium
- **Risk:** Low (well-tested, just moving code)

### Option 2: Keep in voting.ts with TODO comment
- Add a comment documenting the architectural debt
- **Pros:** No refactoring needed now
- **Cons:** Module boundary continues to erode; future admin voting actions will likely land here too
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1: Move mutation to `sessions.ts` + extract `completeSession` to `sessionLifecycle.ts`.

## Technical Details

- **Affected Files:** `convex/voting.ts`, `convex/sessions.ts`, `convex/lib/sessionLifecycle.ts`, `convex/voting.test.ts`, `convex/sessions.test.ts`
- **Related Components:** Session lifecycle, voting module
- **Database Changes:** No

## Acceptance Criteria

- [ ] `forceRandomSelection` lives in `convex/sessions.ts`
- [ ] `completeSession` extracted to `convex/lib/sessionLifecycle.ts`
- [ ] Both `voting.ts` and `sessions.ts` import shared `completeSession`
- [ ] All tests pass after relocation
- [ ] Module headers updated

## Work Log

### 2026-02-12 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (approve all)
- Status changed from pending to ready

### 2026-02-12 - Created from code review
**By:** Claude Review System
**Actions:**
- Identified by architecture-strategist and pattern-recognition agents during PR #62 review

## Resources

- PR #62: https://github.com/Esk3tit/wtcs-map-vote/pull/62
- Spec section 8.4: `docs/SPECIFICATION.md`
