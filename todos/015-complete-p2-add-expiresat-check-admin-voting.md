---
status: complete
priority: p2
issue_id: "015"
tags: [code-review, security, consistency]
dependencies: []
---

# Add expiresAt check in admin voting path

## Problem Statement

The player-facing `validatePlayerForVoting` function (line 89-95) includes an explicit `session.expiresAt < Date.now()` check that rejects votes on expired sessions. The admin `adminVoteOnBehalf` mutation only checks `session.status !== "IN_PROGRESS"` but does not check `expiresAt`. An admin could submit a vote/ban on a session whose expiry time has passed but whose status hasn't been updated to EXPIRED yet by the cron cleanup job.

## Findings

- **Location:** `convex/voting.ts:714-719` (admin validation, missing expiresAt check)
- **Agents:** security-sentinel (L-1), data-integrity-guardian, architecture-strategist, pattern-recognition-specialist
- **Context:** The window between `expiresAt` and cron cleanup is typically small. An admin acting on an about-to-expire session may actually be desired behavior (quickly finishing a session before expiry). However, the inconsistency with the player path should be resolved — either add the check or document the exemption.

## Proposed Solutions

### Option 1: Add the expiresAt guard for consistency (Recommended)
- Add `if (session.expiresAt < Date.now()) throw new ConvexError("Session has expired")` after the status check
- Matches player-facing behavior
- **Pros:** Consistent validation, prevents action on expired sessions
- **Cons:** May be too restrictive — admin might want to finish an expired-but-still-IN_PROGRESS session
- **Effort:** Small (1-2 lines + 1 test)
- **Risk:** Low

### Option 2: Document the intentional exemption
- Add a code comment explaining admins are exempt from expiry enforcement
- **Pros:** No behavior change, documents design decision
- **Cons:** Inconsistency remains
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1: Add the expiresAt guard for consistency with the player path. Small change with high consistency value.

## Acceptance Criteria

- [ ] Either expiresAt check added or exemption documented
- [ ] If check added: test verifying expired session rejection
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #63 code review | Player path checks expiresAt; admin path does not |
| 2026-02-13 | Approved during triage | Status: pending → ready. Quick fix — 1-2 lines + 1 test. |

## Resources

- PR #63: https://github.com/Esk3tit/wtcs-map-vote/pull/63
- `convex/voting.ts:89-95` — player-facing expiresAt check
