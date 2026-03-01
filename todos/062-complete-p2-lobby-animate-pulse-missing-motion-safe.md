---
status: ready
priority: p2
issue_id: "062"
tags: [code-review, accessibility, animation, war-66]
dependencies: []
---

# Lobby animate-pulse missing motion-safe prefix

## Problem Statement

The `animate-pulse` class on the lobby waiting text (line 240) does not use the `motion-safe:` prefix. Every other animation in this PR and the codebase uses `motion-safe:` to respect `prefers-reduced-motion: reduce`. This is an accessibility inconsistency.

## Findings

- **Location:** `src/routes/lobby.$token.tsx:240`
- Current: `className="text-lg text-muted-foreground animate-pulse"`
- Expected: `className="text-lg text-muted-foreground motion-safe:animate-pulse"`
- All stagger animations in this PR use `motion-safe:` prefix consistently
- The Loader2 spinner above it uses `animate-spin` (also without `motion-safe:`, but spinners are typically exempt as functional indicators)

## Proposed Solutions

### Option 1: Add motion-safe prefix
- **Pros**: Consistent with codebase convention, respects user accessibility preferences
- **Cons**: None
- **Effort**: Small (1 line change)
- **Risk**: Low

## Acceptance Criteria

- [ ] `animate-pulse` on lobby waiting text uses `motion-safe:animate-pulse`
- [ ] Users with `prefers-reduced-motion: reduce` see static text

## Work Log

### 2026-02-28 - Created from code review
**By:** Claude Code Review
**Actions:** Identified during pattern-recognition-specialist and frontend-races-reviewer analysis

## Resources

- PR #90: WAR-66 lobby pulsing wait + staggered maps
