---
status: complete
priority: p2
issue_id: "002"
tags: [architecture, dry, player-auth, voting]
dependencies: []
---

# Extract shared token validation logic

## Problem Statement

`validatePlayerForVoting` in `voting.ts` duplicates ~30 lines of read-only validation from `validateAndLockToken` in `playerAuth.ts`. Both perform: IP check, token lookup, expiry check, IP match, session fetch. If the validation contract changes, both must be updated in lockstep.

## Findings

- Location: `convex/voting.ts:69-109` (validatePlayerForVoting)
- Location: `convex/playerAuth.ts:33-155` (validateAndLockToken)
- The shared logic covers 5 validation steps (~30 lines)
- `validateAndLockToken` adds write-side effects (IP locking, heartbeat, audit logging)
- `validatePlayerForVoting` is read-only — intentionally documented in JSDoc

## Proposed Solutions

### Option 1: Extract `lookupPlayerByToken` to `convex/lib/auth.ts`
- Create a shared function that handles steps 1-4 (IP check, token lookup, expiry, IP match)
- Both callers import and use it, then layer on their own logic
- **Pros**: Single source of truth for token validation, easy to maintain
- **Cons**: Adds a new shared dependency
- **Effort**: Medium (1-2 hours including test updates)
- **Risk**: Low

## Recommended Action

Option 1 — extract shared helper to `convex/lib/auth.ts`.

## Technical Details

- **Affected Files**: `convex/lib/auth.ts`, `convex/voting.ts`, `convex/playerAuth.ts`
- **Related Components**: Player authentication, voting validation
- **Database Changes**: No

## Resources

- Original finding: PR #52 multi-agent code review (architecture + pattern recognition reviewers)
- Related issues: None

## Acceptance Criteria

- [ ] Shared `lookupPlayerByToken` helper exists in `convex/lib/auth.ts`
- [ ] `validatePlayerForVoting` and `validateAndLockToken` both use the shared helper
- [ ] No duplicated validation logic
- [ ] All existing tests pass
- [ ] Typecheck passes

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

## Notes

Source: Triage session on 2026-02-08 (PR #52 review)
