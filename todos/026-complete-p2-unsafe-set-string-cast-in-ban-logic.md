---
status: complete
priority: p2
issue_id: "026"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Unsafe `Set<string>` Cast in Ban Logic

## Problem Statement

`banHighestVotedMaps` accepts `availableMapIds: Set<string>` and casts elements with `as Id<"sessionMaps">` when comparing against tallies. This bypasses Convex's branded type system and could mask bugs if non-map IDs were accidentally passed.

## Findings

- **Location**: `convex/lib/votingHelpers.ts` — `banHighestVotedMaps` signature and `hasUnvotedMaps` check
- **Raised by**: security-sentinel, architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer, pattern-recognition-specialist (5/7 agents)
- The `Set<string>` type loses the `Id<"sessionMaps">` branding that Convex provides
- The `as Id<"sessionMaps">` cast inside the function is an unsafe escape hatch

## Proposed Solutions

### Option A: Use `Set<Id<"sessionMaps">>` (Recommended)
- **Pros**: Fully type-safe, no casts needed, matches Convex conventions
- **Cons**: Caller must construct typed set (trivial since IDs come from DB)
- **Effort**: Small
- **Risk**: Low

### Option B: Accept `availableCount: number` instead of full set
- **Pros**: Simplest possible interface — just pass count of available maps vs count in tallies
- **Cons**: Loses ability to check *which* maps are unvoted (though we only need the boolean)
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No `as Id<"sessionMaps">` cast in `banHighestVotedMaps`
- [ ] Type-safe parameter signature
- [ ] All existing tests pass
- [ ] `bun run typecheck` passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-25 | Created | From PR #82 code review |
| 2026-02-25 | Approved | Triage: approved for work |
