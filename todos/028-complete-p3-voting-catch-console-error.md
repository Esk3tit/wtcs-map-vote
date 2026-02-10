---
status: complete
priority: p3
issue_id: "028"
tags: [debugging, frontend, observability]
dependencies: []
---

# Add console.error in voting submission catch block

## Problem Statement

The `submitAction` catch block in `vote.$token.tsx` shows a toast but does not log the error. If the fetch fails for a non-network reason (e.g., `res.json()` throws because the server returned HTML, a CORS issue, or a timeout), the developer has zero visibility into the actual cause. The user sees "Network error" but the root cause is hidden.

## Findings

- Location: `src/routes/vote.$token.tsx:230`
- Empty `catch` block — no error variable captured
- Compare to `usePlayerAuth.ts` which also has silent catch blocks for heartbeat (acceptable there since heartbeats are non-fatal retries)
- For voting submissions, the error is meaningful and should be logged

## Proposed Solutions

### Option 1: Add console.error with error variable
- Capture the error in the catch clause and log it
- **Pros**: Zero-cost debugging improvement, helps production troubleshooting
- **Cons**: None
- **Effort**: Small (1 line)
- **Risk**: Low

```typescript
} catch (error) {
  console.error("Vote submission failed:", error);
  toast.error("Network error. Please try again.");
}
```

## Recommended Action

Add `console.error` with the caught error object.

## Technical Details

- **Affected Files**: `src/routes/vote.$token.tsx`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Catch block captures and logs the error
- [ ] Toast message unchanged
- [ ] `bun run typecheck && bun run lint` passes

## Work Log

### 2026-02-09 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (WAR-36 review findings)
- Status: ready

## Notes
Source: WAR-36 code review — TypeScript reviewer, Frontend races reviewer
