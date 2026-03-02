---
status: complete
priority: p3
issue_id: "002"
tags: [code-review, wide-event, quality]
dependencies: []
---

# Add returnError Convenience Helper to WideEvent

## Problem Statement

Error-return paths across `http.ts`, `voting.ts`, and `playerAuth.ts` repeat the same two-line pattern 38 times:
```typescript
ev.setOutcome("error");
ev.set("error", "ERROR_CODE");
```

This is verbose and the separation between `setOutcome` and `set("error", ...)` is easy to get wrong (e.g., forgetting one of the two calls).

## Findings

**Agent:** code-simplicity-reviewer, pattern-recognition-specialist, kieran-typescript-reviewer

**Evidence:**
- 38 occurrences of `ev.setOutcome("error")` across 3 files
- `http.ts`: 6 occurrences
- `voting.ts`: 16 occurrences
- `playerAuth.ts`: 16 occurrences

Note: `ev.setError(err)` (used in catch blocks for thrown errors) already sets outcome to "error" unconditionally. The issue is only with the error-return pattern.

## Proposed Solutions

### Option A: Add `ev.returnError(code)` Helper

```typescript
/** Set error outcome and error code for returned (non-thrown) errors. */
returnError(code: string): void {
  this.fields.outcome = "error";
  this.fields.error = code;
  this.fields.errorType = "business";
}
```

- **Pros:** Single call replaces two, enforces "business" errorType for returned errors
- **Cons:** Another method on WideEvent; minor API surface increase
- **Effort:** Small
- **Risk:** Low

### Option B: Keep Current Pattern

- **Pros:** Explicit, no new API surface
- **Cons:** Verbose, 38 repetitions
- **Effort:** None
- **Risk:** None

## Recommended Action

Option A: Add `returnError(code)` helper to WideEvent class and update all 38 call sites.

## Acceptance Criteria

- [ ] Helper method added to WideEvent (if chosen)
- [ ] All 38 call sites updated to use new helper
- [ ] Unit tests added for new helper
- [ ] Tests pass, typecheck passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review of PR #95 | 38 instances of repeated pattern |
| 2026-03-02 | Approved during triage — Option A selected | Small effort, good DRY improvement |

## Resources

- `convex/lib/wideEvent.ts` — WideEvent class
- `convex/playerAuth.ts`, `convex/voting.ts`, `convex/http.ts` — call sites
