---
status: ready
priority: p2
issue_id: "063"
tags: [code-review, consistency, animation, war-66]
dependencies: []
---

# Lobby map stagger delay not extracted to constant

## Problem Statement

The lobby page uses a hardcoded `50` for the map thumbnail stagger delay (line 253), while the vote page properly extracts `MAP_STAGGER_DELAY_MS = 50` as a named constant. This inconsistency makes the relationship between the two pages less obvious and harder to maintain.

## Findings

- **Location:** `src/routes/lobby.$token.tsx:253`
- Current: `style={{ animationDelay: \`${index * 50}ms\` }}`
- Vote page uses: `MAP_STAGGER_DELAY_MS = 50` (extracted constant)
- Results page uses: `ANIMATION_DELAY.MAP_GRID_STAGGER = 50` (extracted constant)
- Only the lobby page uses a magic number

## Proposed Solutions

### Option 1: Extract to local constant
- Add `const MAP_STAGGER_DELAY_MS = 50;` at module level in lobby page
- **Pros**: Self-documenting, consistent with vote page pattern
- **Cons**: Duplicated constant across files
- **Effort**: Small (2 line change)
- **Risk**: Low

### Option 2: Share constant from a common module
- Move to a shared animation constants file
- **Pros**: Single source of truth
- **Cons**: Over-engineering for a simple value, creates coupling
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Lobby stagger delay uses a named constant instead of magic number `50`
- [ ] Constant name matches convention used in vote page

## Work Log

### 2026-02-28 - Created from code review
**By:** Claude Code Review
**Actions:** Identified during pattern-recognition-specialist analysis

## Resources

- PR #90: WAR-66 lobby pulsing wait + staggered maps
