---
status: complete
priority: p3
issue_id: "010"
tags: [code-review, consistency, WAR-28]
dependencies: ["008"]
---

# Minor Padding Inconsistencies Across Admin Pages

## Problem Statement

Several minor padding inconsistencies exist across admin pages that don't affect functionality but create subtle visual differences:

1. **Sidebar header uses `pl-14`** while pages use `pl-16` (8px gap difference from hamburger)
2. **Settings page uses `md:pl-6`** while other pages use `md:pl-8` on desktop
3. **`create.tsx` main uses `py-8`** instead of `py-6 md:py-8` (extra vertical padding on mobile)
4. **`create.tsx` has redundant `bg-background`** on outer wrapper (parent already sets this)

## Findings

**Pattern Recognition Review (PR #48):**

Standard desktop padding is `md:px-8 md:pl-8` (5 pages). Settings uses `md:pl-6` (line 150). Sidebar uses `pl-14 md:pl-6` (line 43).

`create.tsx` line 224 has `bg-background` which is redundant since `admin.tsx` already sets `bg-background` on the root div.

`create.tsx` line 240 uses `py-8` instead of the standard `py-6 md:py-8`.

## Proposed Solutions

### Option A: Normalize all values
- Sidebar: `pl-14` -> `pl-16`
- Settings desktop: `md:pl-6` -> `md:pl-8`
- Create main: `py-8` -> `py-6 md:py-8`
- Create wrapper: remove `bg-background`
- **Effort:** Small
- **Risk:** Low

## Technical Details

**Affected files:**
- `src/components/layout/admin-sidebar.tsx:43`
- `src/routes/admin/settings.tsx:150`
- `src/routes/admin/create.tsx:224,240`

## Acceptance Criteria

- [x] All admin pages use identical desktop padding values
- [x] Sidebar and page headers use same `pl-` value
- [x] No redundant background classes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #48 review | Minor inconsistencies accumulated as pages were built independently |
| 2026-02-05 | Approved for work during triage | Note: settings padding item #2 may already be fixed by 008 restructure; verify during implementation |
| 2026-02-05 | Resolved: All items fixed | Sidebar pl-14→pl-16, create py-8→py-6 md:py-8, removed redundant bg-background. Settings padding fixed by 009. |

## Resources

- PR #48: https://github.com/Esk3tit/wtcs-map-vote/pull/48
