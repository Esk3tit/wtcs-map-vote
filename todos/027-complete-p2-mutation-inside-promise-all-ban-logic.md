---
status: complete
priority: p2
issue_id: "027"
tags: [code-review, architecture, concurrency]
dependencies: []
---

# Mutation Inside `Promise.all` in Ban Logic

## Problem Statement

`banHighestVotedMaps` uses `bannedIds.push()` inside a `Promise.all` callback. While Convex mutations are single-threaded (so no race condition), the pattern of mutating a shared array inside concurrent-looking code is misleading and fragile.

## Findings

- **Location**: `convex/lib/votingHelpers.ts` — `banHighestVotedMaps` function body
- **Raised by**: performance-oracle, architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer (4/7 agents)
- `Promise.all` with `.map()` that pushes to external array is an anti-pattern
- Convex runs mutations single-threaded, so there's no actual race, but the pattern is confusing

## Proposed Solutions

### Option A: Filter-then-map pattern (Recommended)
- Separate filtering (which maps to ban) from DB writes
- `const mapsToBan = entries.filter(pred); await Promise.all(mapsToBan.map(patch)); return mapsToBan.map(id)`
- **Pros**: Clear separation of concerns, no shared mutation, idiomatic
- **Cons**: Iterates twice (negligible for small arrays)
- **Effort**: Small
- **Risk**: Low

### Option B: Sequential for-of loop
- Use `for (const [mapId, count] of tallies)` with sequential `await ctx.db.patch`
- **Pros**: Simple, no concurrency confusion
- **Cons**: Slightly slower (sequential DB writes), though pool sizes are small (3-15 maps)
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No `push()` inside `Promise.all` callback
- [ ] Ban logic produces same results
- [ ] All existing tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-25 | Created | From PR #82 code review |
| 2026-02-25 | Approved | Triage: approved for work |
