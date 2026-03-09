---
status: complete
priority: p3
issue_id: "005"
tags: [code-review, robustness]
dependencies: ["001"]
---

# Raw player.role Displays — Resolved via Data Model Fix

## Problem Statement
`player.role` was rendered raw in two locations. The concern was that if the data format changed, the display would break.

## Resolution
This was resolved by Todo #001 (reconcile PlayerRole type). The `PlayerRole` type now matches the actual stored Title Case format ("Player A", "Player B"), so raw `player.role` display is correct and type-safe. The `normalizeRole` utility in `src/lib/formatting.ts` is used for case-insensitive comparison where needed (e.g., ABBA progress tracker).

## Findings
- `src/routes/vote.$token.tsx:518` - `{player.role}` displayed correctly as "Player A"
- `src/routes/lobby.$token.tsx:305` - `({player.role})` displayed correctly as "(Player A)"
- `humanizeRole` was removed (dead code for Title Case data)
- `normalizeRole` handles comparison logic in `formatPlayerRole` and `isPlayerA` check

## Technical Details
- **No code changes needed** — data model fix guarantees correct display format
- `normalizeRole` from `@/lib/formatting` used for role comparisons

## Acceptance Criteria
- [x] player.role displays correctly with Title Case stored format
- [x] PlayerRole type matches stored values

## Work Log

### 2026-03-09 - Approved for Work
**By:** Claude Triage System

### 2026-03-09 - Resolved (No Changes Needed)
- Data model fix in #001 made this a non-issue
- humanizeRole removed as dead code
- normalizeRole handles comparison where needed

## Resources
- PR #101: https://github.com/Esk3tit/wtcs-map-vote/pull/101
