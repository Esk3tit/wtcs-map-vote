---
status: ready
priority: p3
issue_id: "003"
tags: [code-review, wide-event, architecture]
dependencies: []
---

# Extract withWideEvent HOF Wrapper

## Problem Statement

Every instrumented function follows the same boilerplate pattern:

```typescript
handler: async (ctx, args) => {
  const ev = createWideEvent("module", "fn", "type");
  const startTime = Date.now();
  try {
    // ... business logic ...
    ev.setOutcome("ok");
    return result;
  } catch (err) {
    ev.setError(err);
    throw err;
  } finally {
    ev.setDuration(startTime);
    ev.emit();
  }
}
```

This adds ~8 lines of scaffolding to every function. With ~30 instrumented functions, that's ~198 lines of repetitive code.

## Findings

**Agent:** architecture-strategist, code-simplicity-reviewer

**Evidence:**
- 11 `ev.setError(err); throw err;` catch blocks across 4 files
- 30+ functions with identical try/catch/finally structure
- Pattern is stable and unlikely to change

## Proposed Solutions

### Option A: Higher-Order Function Wrapper

```typescript
function withWideEvent<T>(
  module: string,
  fn: string,
  fnType: FnType,
  handler: (ctx: any, args: any, ev: WideEvent) => Promise<T>
) {
  return async (ctx: any, args: any): Promise<T> => {
    const ev = createWideEvent(module, fn, fnType);
    const startTime = Date.now();
    try {
      const result = await handler(ctx, args, ev);
      return result;
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  };
}
```

- **Pros:** ~198 LOC reduction, impossible to forget finally block, consistent error handling
- **Cons:** Adds indirection, `ev` becomes a parameter instead of local variable, typing is tricky with Convex function signatures
- **Effort:** Medium-Large (must update 30+ call sites)
- **Risk:** Medium (Convex type system may resist generic wrapper)

### Option B: Keep Current Explicit Pattern

- **Pros:** No indirection, each function is self-contained, easy to customize per-function
- **Cons:** Repetitive, risk of forgetting finally block in new functions
- **Effort:** None
- **Risk:** None

## Recommended Action

Option A: Implement HOF wrapper. Defer until after todo #001 completes (more call sites = more savings). Verify Convex type system compatibility first with a spike.

## Acceptance Criteria

- [ ] HOF wrapper implemented with proper TypeScript types
- [ ] All instrumented functions migrated to use wrapper
- [ ] No change in emitted event structure
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review of PR #95 | ~198 LOC savings possible but typing complexity is a concern |
| 2026-03-02 | Approved during triage — Option A selected | Defer until after #001 completes |

## Resources

- `convex/lib/wideEvent.ts` — core library
- All instrumented files: sessions.ts, voting.ts, playerAuth.ts, sessionCleanup.ts, admins.ts, http.ts, storage.ts
