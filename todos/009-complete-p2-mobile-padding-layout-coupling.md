---
status: complete
priority: p2
issue_id: "009"
tags: [code-review, architecture, DRY, WAR-28]
dependencies: []
---

# Mobile Padding Scattered Across 6+ Files (Layout Coupling)

## Problem Statement

The `pl-16 md:pl-8` mobile padding pattern to avoid the hamburger button is duplicated in every admin route page (6 files + sidebar). This couples content pages to layout implementation details. If the hamburger button changes size or position, all files must be updated in lockstep (shotgun surgery).

## Findings

**Architecture Review (PR #48):**

The hamburger button is defined in `src/routes/admin.tsx` (line 52-58) at `fixed top-4 left-4`, but no corresponding padding is applied to the `<main>` wrapper (line 79). Each child route must independently add `pl-16`:

| File | Padding |
|------|---------|
| `dashboard.tsx:78` | `pl-16 md:px-8 md:pl-8` |
| `create.tsx:226` | `pl-16 md:px-8 md:pl-8` |
| `teams.tsx:231` | `pl-16 md:px-8 md:pl-8` |
| `maps.tsx:238` | `pl-16 md:px-8 md:pl-8` |
| `session.$sessionId.tsx:234` | `pl-16 md:px-8 md:pl-8` |
| `settings.tsx:150` | `pl-16 md:pl-6` (different!) |
| `admin-sidebar.tsx:43` | `pl-14 md:pl-6` (also different!) |

## Proposed Solutions

### Option A: Move padding to admin layout wrapper
Add `pl-16 md:pl-0` to the `<main>` element in `admin.tsx`, then remove per-page `pl-16` overrides.
- **Pros:** Single source of truth; new pages get padding automatically
- **Cons:** Requires verifying all child page spacing still works; settings page needs restructuring first
- **Effort:** Medium
- **Risk:** Medium (visual regression risk across 6 pages)

### Option B: Extract shared AdminPageHeader component
Create `src/components/layout/admin-page-header.tsx` that centralizes the header pattern with correct padding.
- **Pros:** Reduces duplication in headers; doesn't require layout restructuring
- **Cons:** Main content padding still scattered; partial fix
- **Effort:** Small
- **Risk:** Low

### Option C: Leave as-is and document
Add a comment in `admin.tsx` near the hamburger button documenting that child pages must include `pl-16`.
- **Pros:** Zero risk; awareness for future developers
- **Cons:** Doesn't fix the duplication
- **Effort:** Trivial
- **Risk:** None

## Technical Details

**Affected files:**
- `src/routes/admin.tsx` (layout owner)
- All 6 admin route files in `src/routes/admin/`
- `src/components/layout/admin-sidebar.tsx`

## Acceptance Criteria

- [x] Mobile hamburger padding defined in one location
- [x] New admin pages get correct padding without manual addition
- [x] No visual regressions on existing pages

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #48 review | This is a pre-existing pattern; PR #48 made it more visible by fixing create/settings |
| 2026-02-05 | Approved for work during triage | Option A recommended: move padding to admin layout wrapper |
| 2026-02-05 | Resolved: Option A implemented | Added `pl-16 md:pl-0` to admin.tsx main, removed per-page `pl-16` from all 6 child pages |

## Resources

- PR #48: https://github.com/Esk3tit/wtcs-map-vote/pull/48
