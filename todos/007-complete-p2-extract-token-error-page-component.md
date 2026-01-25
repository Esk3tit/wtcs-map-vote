---
status: ready
priority: p2
issue_id: "007"
tags: [code-review, dry, architecture, war-11]
dependencies: []
---

# Extract Shared TokenErrorPage Component

## Problem Statement

`TokenErrorPage` is duplicated identically in `lobby.$token.tsx` and `vote.$token.tsx`. Both contain the same error message mappings for `INVALID_TOKEN`, `TOKEN_EXPIRED`, and `SESSION_NOT_FOUND`. If error messages need to be updated, changes must be made in multiple places.

## Findings

### Duplicate TokenErrorPage implementations
- `src/routes/lobby.$token.tsx:180-213` (~33 lines)
- `src/routes/vote.$token.tsx:422-455` (~33 lines)
- Byte-for-byte identical implementations

### Code duplication
```tsx
// Identical in both files:
function TokenErrorPage({ error }: { error: string }) {
  const errorMessages: Record<string, { title: string; message: string }> = {
    INVALID_TOKEN: {
      title: "Invalid Access Code",
      message: "This access code is invalid or has been revoked...",
    },
    TOKEN_EXPIRED: {
      title: "Access Code Expired",
      message: "This access code has expired...",
    },
    SESSION_NOT_FOUND: {
      title: "Session Not Found",
      message: "The voting session could not be found...",
    },
  };
  // ... identical rendering
}
```

### Related but different component
- `src/routes/results.$sessionId.tsx:198-236` has `ResultsErrorPage`
- Handles different error types (`SESSION_NOT_COMPLETE`)
- Could potentially be unified but has distinct requirements

## Proposed Solutions

### Solution A: Extract to shared session component (Recommended)
Create `src/components/session/TokenErrorPage.tsx` and import from both pages.

```tsx
// src/components/session/TokenErrorPage.tsx
export function TokenErrorPage({ error }: { error: string }) {
  // ... single implementation
}
```

- **Pros:** Single source of truth, consistent error UX, easy to maintain
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low

### Solution B: Create generic ErrorPage with error type prop
Create a more flexible error page that handles all session error types.

- **Pros:** More reusable, handles all error scenarios
- **Cons:** More complex, may be over-engineering
- **Effort:** Medium
- **Risk:** Low

### Solution C: Keep separate but create shared error messages constant
Extract just the error messages to a shared constant.

- **Pros:** Some deduplication
- **Cons:** Still duplicated rendering logic
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Solution A — extract the full `TokenErrorPage` component to `src/components/session/TokenErrorPage.tsx`.

## Technical Details

**Affected files:**
- `src/components/session/TokenErrorPage.tsx` (new file)
- `src/routes/lobby.$token.tsx` (remove local component, add import)
- `src/routes/vote.$token.tsx` (remove local component, add import)

**Potential future unification:**
- Could later merge with `ResultsErrorPage` if error handling patterns converge

## Acceptance Criteria

- [ ] `TokenErrorPage` component exists at `src/components/session/TokenErrorPage.tsx`
- [ ] `lobby.$token.tsx` imports from shared component
- [ ] `vote.$token.tsx` imports from shared component
- [ ] Error displays identical to before (no visual regression)
- [ ] TypeScript typecheck passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #38 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/38
- Pattern recognition agent finding
- Code simplicity agent finding
