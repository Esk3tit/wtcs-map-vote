---
status: complete
priority: p3
issue_id: "025"
tags: [code-review, quality, war-54]
dependencies: []
---

# Add Exhaustiveness Guard to useEffect Navigate Tree

## Problem Statement
The `shouldRedirect` function has an exhaustive `never` default case for `currentPage`, but the `useEffect` navigate block uses `if/else if` chains without a terminal assertion. If a developer adds a new page to `shouldRedirect` but forgets to add the corresponding `navigate` call, `shouldRedirect` would return `true` (showing a spinner) but the `useEffect` would silently no-op, leaving the user on an infinite spinner.

## Findings
- Source: Architecture Strategist agent
- Location: `src/hooks/useSessionStatusRedirect.ts:66-92` (useEffect navigate block)
- The `shouldRedirect` function at lines 21-38 already has the `never` guard
- The lobby page's `getWaitingMessage` at lines 132-134 also uses this pattern
- Risk is low since the code is compact, but the guard provides compile-time safety

## Proposed Solutions

### Option 1: Add terminal else with never assertion
Add a final `else` block after the results case that asserts `never` on `currentPage`:

```typescript
} else {
  const _exhaustive: never = currentPage;
  throw new Error(`Unhandled page navigation: ${_exhaustive}`);
}
```

- **Pros**: Compile-time error if a new page is added without navigation target
- **Cons**: 3 more lines
- **Effort**: Small (5 minutes)
- **Risk**: None

## Acceptance Criteria
- [ ] `useEffect` navigate block has exhaustive `never` guard on `currentPage`
- [ ] Typecheck passes

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-18 | Created | Architecture Strategist review finding for PR #73 |
| 2026-02-18 | Resolved | Added `else { const _exhaustive: never = currentPage; }` to useEffect navigate chain |

## Resources
- PR #73: https://github.com/Esk3tit/wtcs-map-vote/pull/73
- Hook file: `src/hooks/useSessionStatusRedirect.ts:66-92`
