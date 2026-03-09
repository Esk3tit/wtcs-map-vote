---
status: complete
priority: p3
issue_id: "005"
tags: [code-review, robustness]
dependencies: ["001"]
---

# Wrap Raw player.role Displays with humanizeRole

## Problem Statement
`player.role` is rendered raw (without formatting) in two locations. Currently works because the DB stores Title Case, but would break if the data model is fixed to UPPER_SNAKE_CASE.

## Findings
- `src/routes/vote.$token.tsx:518` - `{player.role}` displayed as "You are: Player A"
- `src/routes/lobby.$token.tsx:305` - `({player.role})` displayed as "(Player A)"
- Both would show `"PLAYER_A"` if data format changes

## Proposed Solutions

### Option 1: Wrap with humanizeRole
- `{humanizeRole(player.role)}` at both locations
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Apply after #001 is resolved to ensure consistency.

## Technical Details
- **Affected Files**: `src/routes/vote.$token.tsx`, `src/routes/lobby.$token.tsx`

## Acceptance Criteria
- [ ] player.role displays correctly regardless of stored format
- [ ] No raw role strings rendered in UI

## Work Log

### 2026-03-09 - Approved for Work
**By:** Claude Triage System

## Resources
- PR #101: https://github.com/Esk3tit/wtcs-map-vote/pull/101
