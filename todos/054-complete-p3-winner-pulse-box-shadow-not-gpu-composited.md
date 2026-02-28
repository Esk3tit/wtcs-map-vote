---
status: complete
priority: p3
issue_id: "054"
tags: [code-review, performance, css, animation]
dependencies: []
---

# Winner-pulse box-shadow animation triggers paint, not GPU compositing

## Problem Statement

The `winner-pulse` keyframe animation in `index.css` (lines 155-171) animates `box-shadow`, which is NOT a compositor-layer property. It triggers **repaint** on every frame of the 1.5s animation. The PR description claims "GPU-optimized" which is inaccurate for this specific animation. On low-end mobile devices it could cause dropped frames during the winner reveal.

Additionally, if Convex pushes a subscription update during the 5s winner reveal window, the CSS animation restarts (since React re-renders the element, resetting the `animation` property).

## Findings

- **Source**: Performance Oracle (Low-Medium), Frontend Races Reviewer (LOW)
- **Location**: `src/index.css` lines 155-171
- **Evidence**: `box-shadow` is not in the list of compositor-promoted CSS properties (only `transform`, `opacity`, `filter`, and `will-change` are)

## Proposed Solutions

### Option A: Accept as-is (Recommended for now)

The animation runs once (`forwards`), targets a single card, and lasts 1.5s. The practical impact is minor.

### Option B: Replace with pseudo-element opacity animation

Use a `::after` pseudo-element with a static `box-shadow` and animate only its `opacity` (GPU-composited). Requires structural changes to VoteMapCard.

- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] Winner animation remains visually appealing
- [ ] No dropped frames on target mobile devices

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |
