---
status: complete
priority: p3
issue_id: "044"
tags: [code-review, ui, skeleton]
dependencies: []
---

# Update ResultsPageSkeleton with avatar placeholders

## Problem Statement

All other skeleton screens (dashboard, lobby, vote) were updated with circular avatar placeholders to match the new `TeamAvatar` integration, but `ResultsPageSkeleton` was missed. The header section still shows a single rectangular placeholder where team avatars now appear.

## Findings

- **Source**: Pattern recognition specialist (PR #86 review)
- **Location**: `src/routes/results.$sessionId.tsx`, lines 232-236 (`ResultsPageSkeleton`)
- **Evidence**: Current skeleton header:
  ```tsx
  <div className="h-9 w-72 bg-muted rounded mx-auto" />
  <div className="h-6 w-48 bg-muted rounded mx-auto" />  {/* should include avatar circles */}
  <div className="h-6 w-24 bg-muted rounded-full mx-auto" />
  ```

## Proposed Solutions

### Option A: Add circular placeholders to match the "Team A vs Team B" header

- **Pros**: Consistent with other skeletons, matches loaded state layout
- **Cons**: None
- **Effort**: Small (15 minutes)
- **Risk**: None

Replace the `w-48` bar with a flex layout containing two circle + text pairs:
```tsx
<div className="flex items-center justify-center gap-3">
  <div className="size-8 bg-muted rounded-full shrink-0" />
  <div className="h-6 w-24 bg-muted rounded" />
  <div className="h-6 w-8 bg-muted rounded" />
  <div className="size-8 bg-muted rounded-full shrink-0" />
  <div className="h-6 w-24 bg-muted rounded" />
</div>
```

## Recommended Action

Go with Option A. Replace the `w-48` bar with the flex layout containing circle + text pairs.

## Technical Details

- **Affected files**: `src/routes/results.$sessionId.tsx` (ResultsPageSkeleton function)

## Acceptance Criteria

- [ ] `ResultsPageSkeleton` header has circular avatar placeholders
- [ ] Layout matches the actual loaded state with team avatars

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | Identified during PR #86 code review |
| 2026-02-28 | Approved | Approved during triage — ready to work on |

## Resources

- PR #86: https://github.com/Esk3tit/wtcs-map-vote/pull/86
