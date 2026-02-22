---
status: complete
priority: p2
issue_id: "011"
tags: [code-review, duplication, connection-status]
dependencies: ["010"]
---

# Deduplicate ownConnectionStatus Derivation (Lobby vs Vote)

## Problem Statement

Both `lobby.$token.tsx` and `vote.$token.tsx` independently derive `ownConnectionStatus` from `auth.status` using slightly different logic. The lobby page uses a 3-branch if/else (with an unreachable "disconnected" fallback), while the vote page was already simplified to a 2-branch ternary. This duplication means changes to the mapping logic must be made in two places.

## Findings

- **Source**: pattern-recognition-specialist, code-simplicity-reviewer, kieran-typescript-reviewer
- **Locations**:
  - `src/routes/lobby.$token.tsx` — 3-branch derivation with "disconnected" fallback
  - `src/routes/vote.$token.tsx` — 2-branch ternary (already simplified)
- **Risk**: Low — both work correctly today, but the lobby version hasn't been type-narrowed

## Proposed Solutions

### Option A: Extract `deriveOwnConnectionStatus(authStatus)` helper
- **Pros**: Single source of truth, testable, reusable
- **Cons**: Another small utility file
- **Effort**: Small
- **Risk**: Low

### Option B: Align lobby to match vote page pattern (inline)
- **Pros**: No new files, just copy the simpler pattern
- **Cons**: Still duplicated, just consistently duplicated
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option B: Align lobby to match vote page 2-branch ternary (simplest, no new files)

## Technical Details

- **Affected files**: `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx`
- **Note**: Lobby page should also narrow type to exclude "disconnected" since auth.status === "error" redirects before this code runs

## Acceptance Criteria

- [x] ownConnectionStatus derivation logic exists in one place (or is identically simple in both)
- [x] Lobby page type is narrowed to exclude unreachable "disconnected"

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready

## Resources

- PR #76: Enhanced connection status indicators
