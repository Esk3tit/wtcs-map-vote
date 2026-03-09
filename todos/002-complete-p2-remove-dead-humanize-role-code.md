---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, simplicity, dead-code]
dependencies: ["001"]
---

# Remove Dead humanizeRole Code or Fix Data Model

## Problem Statement
`humanizeRole` in `src/lib/formatting.ts` is effectively dead code for current data. The DB stores `"Player A"` (Title Case), which does not contain underscores, so `humanizeRole` always returns the input unchanged via the else branch. The function only does real work for `"PLAYER_A"` format, which is never stored in production.

## Findings
- `src/lib/formatting.ts:6-13` defines `humanizeRole`
- Only used in `formatPlayerRole` fallback (`src/routes/admin/session.$sessionId.tsx`)
- For current DB data (`"Player A"`), it's a no-op
- If data model is fixed to UPPER_SNAKE_CASE (todo #001), `humanizeRole` becomes useful

## Proposed Solutions

### Option 1: Remove humanizeRole, use `return role` in formatPlayerRole
- **Pros**: Removes dead code, simpler
- **Cons**: If data model changes later (todo #001), need to re-add
- **Effort**: Small
- **Risk**: Low

### Option 2: Keep humanizeRole, fix data model first (depends on #001)
- **Pros**: humanizeRole becomes useful after #001 is resolved
- **Cons**: Dead code in the meantime
- **Effort**: None (wait for #001)
- **Risk**: Low

## Recommended Action
Depends on #001. If #001 standardizes on UPPER_SNAKE_CASE, keep humanizeRole. If #001 standardizes on Title Case, remove humanizeRole.

## Technical Details
- **Affected Files**: `src/lib/formatting.ts`, `src/routes/admin/session.$sessionId.tsx`

## Acceptance Criteria
- [ ] No dead code paths in formatting.ts
- [ ] formatPlayerRole fallback works correctly for actual data format

## Work Log

### 2026-03-09 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Depends on resolution of #001

## Resources
- PR #101: https://github.com/Esk3tit/wtcs-map-vote/pull/101
