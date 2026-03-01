---
status: complete
priority: p3
issue_id: "051"
tags: [code-review, maintainability, constants, animation]
dependencies: []
---

# Extract animation timing constants (150ms stagger, 600ms timeout)

## Problem Statement

Magic numbers for animation timing are scattered across two files without named constants:
- `150` (stagger delay) appears twice in `VoteMapCard.tsx` (lines 132, 144)
- `600` (animation timeout) in `vote.$token.tsx` line 290, implicitly linked to the 500ms CSS duration + 100ms buffer
- `500` / `800` (transition durations) in CSS classes

The project has an established pattern of extracting timing constants (see `REVEAL_DURATION_MS`, `WINNER_REVEAL_DURATION_MS` in `convex/lib/constants.ts`).

## Findings

- **Source**: Pattern Recognition (Medium), Architecture Strategist, Code Simplicity Reviewer
- **Location**: `src/components/session/VoteMapCard.tsx` lines 132, 144; `src/routes/vote.$token.tsx` line 290

## Proposed Solutions

### Option A: Local constants at component/hook level

```typescript
const ELIMINATION_STAGGER_DELAY_MS = 150;
const BAN_ANIMATION_DURATION_MS = 500;
const BAN_ANIMATION_BUFFER_MS = 600; // BAN_ANIMATION_DURATION_MS + 100ms buffer
```

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Stagger delay `150` replaced with named constant
- [ ] Timeout `600` replaced with named constant with comment explaining relationship to CSS duration

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |
