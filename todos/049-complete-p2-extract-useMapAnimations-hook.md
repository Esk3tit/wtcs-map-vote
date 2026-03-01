---
status: ready
priority: p2
issue_id: "049"
tags: [code-review, architecture, react-hooks, refactor]
dependencies: ["047", "048"]
---

# Extract animation state tracking into useMapAnimations hook

## Problem Statement

The ~70 lines of animation hooks (lines 244-311 in `vote.$token.tsx`) are inlined in a route component that is already ~950 lines. The codebase has a strong convention of extracting complex stateful logic into dedicated hooks (`useRevealPhase`, `usePlayerAuth`, `useAudioAlerts`, `useSessionStatusRedirect`). The animation tracking logic involves subtle ordering dependencies between useRef, useMemo, useState, and useEffect that would be easier to reason about and test in isolation.

## Findings

- **Source**: Architecture Strategist, Pattern Recognition, Code Simplicity Reviewer
- **Location**: `src/routes/vote.$token.tsx` lines 244-311
- **Evidence**: The project has 7 custom hooks in `src/hooks/`. The `useRevealPhase` hook (232 lines) is the most directly comparable precedent -- it also tracks state transitions, uses `usePrevious`, computes derived state, and manages timers.

## Proposed Solutions

### Option A: Extract to useMapAnimations (Recommended)

```typescript
// src/hooks/useMapAnimations.ts
function useMapAnimations(params: {
  maps: ReadonlyArray<{ _id: Id<"sessionMaps">; state: string }>;
  format: string | undefined;
  isAnyReveal: boolean;
  eliminatedMapIds: Id<"sessionMaps">[] | undefined;
}): {
  animatingBanIds: Set<string>;
  eliminationStaggerIndex: Map<string, number>;
}
```

- **Pros**: Follows codebase convention, encapsulates ordering constraints, testable in isolation
- **Cons**: One more file to maintain
- **Effort**: Medium
- **Risk**: Low

### Option B: Keep inline, add section comment

- **Pros**: No file changes
- **Cons**: Component continues to grow, ordering constraints remain implicit
- **Effort**: None
- **Risk**: Low (debt accumulates)

## Recommended Action

Option A after #047 and #048 are resolved (so you extract the clean version).

## Acceptance Criteria

- [ ] Animation hooks extracted to `src/hooks/useMapAnimations.ts`
- [ ] `vote.$token.tsx` reduced by ~60-70 lines
- [ ] All animation behaviors preserved (ABBA ban, elimination stagger, late-join safety)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/87
- Pattern reference: `src/hooks/useRevealPhase.ts`
