---
status: complete
priority: p2
issue_id: "011"
tags: [code-review, frontend, race-condition]
dependencies: []
---

# Token Change Does Not Reset Auth State to Loading

## Problem Statement

If the `token` prop changes in `usePlayerAuth` (e.g., navigating between token URLs), the effect cleanup fires and re-runs, but the component state remains `"authenticated"` from the previous token until the new validation completes. During this window, the Convex reactive query runs with the old auth status but new token, potentially causing a brief inconsistency.

## Findings

- **Source agents:** julik-frontend-races-reviewer
- **File:** `src/hooks/usePlayerAuth.ts` lines 40-96

## Proposed Solutions

### Solution A: Reset state at effect start (Recommended)
```typescript
useEffect(() => {
  let cancelled = false;
  setStatus("loading");
  setError(null);
  // ... rest of effect
```
- **Effort:** Small (2 lines) | **Risk:** None

## Technical Details

- **Affected files:** `src/hooks/usePlayerAuth.ts`

## Acceptance Criteria

- [ ] Auth state resets to "loading" when token changes
- [ ] No stale auth state between token transitions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by julik-frontend-races-reviewer |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
