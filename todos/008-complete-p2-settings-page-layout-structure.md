---
status: complete
priority: p2
issue_id: "008"
tags: [code-review, architecture, consistency, WAR-28]
dependencies: []
---

# Settings Page Lacks Standard Admin Layout Structure

## Problem Statement

`src/routes/admin/settings.tsx` uses a flat `<div>` wrapper instead of the `<header>` + `<main>` layout structure used by all other admin pages. This causes:

1. No sticky header bar with `border-b border-border/50 bg-card/30 backdrop-blur-sm`
2. Different padding values (`p-6 pl-16 md:pl-6`) vs standard (`px-4 py-4 pl-16 md:px-8 md:pl-8`)
3. Loading and "Access Denied" early-return states have no hamburger padding at all (`p-6` with no `pl-16`)

## Findings

**Pattern Recognition Review (PR #48):**

All five other admin pages follow this structure:
```tsx
<div className="flex-1 flex flex-col">
  <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
    <div className="px-4 py-4 pl-16 md:px-8 md:pl-8">
      <h1>Page Title</h1>
    </div>
  </header>
  <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
    {/* content */}
  </main>
</div>
```

Settings page (line 150) uses:
```tsx
<div className="p-6 pl-16 md:pl-6 max-w-4xl mx-auto space-y-8">
```

Early returns (lines 71-100) use `p-6` or plain `div` with no mobile padding offset.

## Proposed Solutions

### Option A: Refactor settings to match standard layout
Restructure settings.tsx to use `<header>` + `<main>` like other pages.
- **Pros:** Full visual and structural consistency
- **Cons:** Larger change; needs testing
- **Effort:** Small
- **Risk:** Low

### Option B: Add hamburger padding to early returns only
Just add `pl-16 md:pl-0` to the loading/error states.
- **Pros:** Minimal change, fixes the functional overlap
- **Cons:** Structural inconsistency remains
- **Effort:** Small
- **Risk:** Low

## Technical Details

**Affected files:**
- `src/routes/admin/settings.tsx`

## Acceptance Criteria

- [ ] Settings page uses `<header>` + `<main>` structure matching other admin pages
- [ ] Loading spinner and "Access Denied" card don't overlap hamburger on mobile
- [ ] Desktop padding values match other admin pages (`md:px-8 md:pl-8`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #48 review | Pre-existing issue; PR fixed the main content area but not early returns |

## Resources

- PR #48: https://github.com/Esk3tit/wtcs-map-vote/pull/48
- Reference layout: `src/routes/admin/dashboard.tsx` lines 76-91
