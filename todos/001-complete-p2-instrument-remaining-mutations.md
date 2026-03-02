---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, observability, wide-event]
dependencies: []
---

# Instrument Remaining Mutations with Wide Events

## Problem Statement

10 exported mutations in `maps.ts`, `teams.ts`, and `audit.ts` are not instrumented with wide events. This creates an observability gap — admin CRUD operations on maps and teams produce no structured logs for debugging or monitoring.

## Findings

**Agent:** pattern-recognition-specialist, architecture-strategist

**Evidence:**

| File | Uninstrumented Mutations |
|------|------------------------|
| `convex/maps.ts` | `createMap`, `updateMap`, `deactivateMap`, `reactivateMap`, `generateUploadUrl` |
| `convex/teams.ts` | `createTeam`, `updateTeam`, `deleteTeam`, `generateUploadUrl` |
| `convex/audit.ts` | `logActionMutation` (internalMutation) |

All other modules (`sessions.ts`, `voting.ts`, `playerAuth.ts`, `sessionCleanup.ts`, `storage.ts`, `admins.ts`, `http.ts`) are fully instrumented.

## Proposed Solutions

### Option A: Add Wide Events to All 10 Mutations

- **Pros:** Complete observability coverage, consistent pattern across all modules
- **Cons:** More code, `audit.ts` logging its own logging is arguably meta
- **Effort:** Medium (follow existing pattern from `sessions.ts` mutations)
- **Risk:** Low

### Option B: Instrument Only maps.ts and teams.ts (Skip audit.ts)

- **Pros:** Covers the meaningful gap; `logActionMutation` is internal plumbing that already writes to the audit table
- **Cons:** Not 100% coverage
- **Effort:** Small-Medium
- **Risk:** Low

## Recommended Action

Option B: Instrument maps.ts (5 mutations) and teams.ts (4 mutations). Skip audit.ts `logActionMutation` — it's internal plumbing that already writes to the audit table.

## Technical Details

- **Affected files:** `convex/maps.ts`, `convex/teams.ts`, `convex/audit.ts`
- **Pattern to follow:** See `convex/sessions.ts:createSession` (line ~530) for the canonical pattern

## Acceptance Criteria

- [ ] All mutations in maps.ts wrapped with wide event try/catch/finally
- [ ] All mutations in teams.ts wrapped with wide event try/catch/finally
- [ ] Decision made on audit.ts `logActionMutation`
- [ ] Tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run typecheck`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review of PR #95 | 10 of ~30 mutations lack instrumentation |
| 2026-03-02 | Approved during triage — Option B selected | Skip audit.ts meta-logging |

## Resources

- PR #95: Wide Event Structured Logging
- Pattern reference: `convex/sessions.ts`
