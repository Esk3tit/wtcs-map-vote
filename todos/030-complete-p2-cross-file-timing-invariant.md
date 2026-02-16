---
status: ready
priority: p2
issue_id: "030"
tags: [code-review, documentation, war-49]
dependencies: ["027"]
---

# Cross-File Timing Invariant Underdocumented

## Problem Statement
The heartbeat system relies on a critical invariant: client `HEARTBEAT_INTERVAL_MS` must be strictly less than server `HEARTBEAT_TIMEOUT_MS`. This invariant spans two files (`src/hooks/usePlayerAuth.ts` and `convex/lib/constants.ts`) with no cross-reference or documentation linking them.

## Findings
- Source: Architecture Strategist, Code Simplicity agents
- Location: `convex/lib/constants.ts:29` — `HEARTBEAT_TIMEOUT_MS`
- Location: `src/hooks/usePlayerAuth.ts:8` — `HEARTBEAT_INTERVAL_MS`
- The constants cannot be shared (client vs server boundaries)
- A future developer could change one without knowing about the other
- No JSDoc or comment warns about this dependency

## Proposed Solutions

### Option 1: Add cross-reference comments in both files (Recommended)
Add a comment in each file pointing to the other, stating the invariant.

- **Pros**: Simple, clear, zero code change risk
- **Cons**: Comments can go stale
- **Effort**: Small (5 minutes)
- **Risk**: None

### Option 2: Add a runtime check in the cron
Log a warning if the timeout seems too tight (e.g., less than 2x a hardcoded expected interval).

- **Pros**: Active detection of misconfiguration
- **Cons**: Server can't actually read client constant, so it's just a heuristic
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
Option 1 — add cross-reference comments. This will be naturally addressed when fixing todo #027 (timing mismatch).

## Technical Details
- **Affected files**: `convex/lib/constants.ts`, `src/hooks/usePlayerAuth.ts`
- **Database changes**: None

## Acceptance Criteria
- [ ] Both files have comments referencing the other
- [ ] Invariant (interval < timeout) is stated explicitly

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from PR #68 code review | Architecture Strategist flagged |
| 2026-02-15 | Approved during triage (pending → ready) | Bulk-approved with all WAR-49 findings |

## Resources
- PR #68: https://github.com/Esk3tit/wtcs-map-vote/pull/68
