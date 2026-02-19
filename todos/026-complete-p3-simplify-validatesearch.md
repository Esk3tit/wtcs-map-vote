---
status: complete
priority: p3
issue_id: "026"
tags: [code-review, quality, war-54]
dependencies: []
---

# Simplify validateSearch Spread Pattern in Results Route

## Problem Statement
The `validateSearch` in the results route uses a conditional spread pattern that requires a double-take to read:

```typescript
validateSearch: (search: Record<string, unknown>): { token?: string } => ({
  ...(typeof search.token === "string" ? { token: search.token } : {}),
}),
```

A simpler ternary does the same thing more clearly.

## Findings
- Source: Code Simplicity Reviewer + Kieran TypeScript Reviewer (both flagged independently)
- Location: `src/routes/results.$sessionId.tsx:12-16`
- TanStack Router does not distinguish between `{ token: undefined }` and `{}` for search params

## Proposed Solutions

### Option 1: Replace with direct ternary
```typescript
validateSearch: (search: Record<string, unknown>): { token?: string } => ({
  token: typeof search.token === "string" ? search.token : undefined,
}),
```

- **Pros**: Reads in 5 seconds, same behavior
- **Cons**: None
- **Effort**: Small (2 minutes)
- **Risk**: None

## Acceptance Criteria
- [ ] validateSearch uses ternary pattern
- [ ] Typecheck passes
- [ ] Search params still work (token present and absent)

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-18 | Created | Simplicity + TypeScript review finding for PR #73 |
| 2026-02-18 | Resolved | Replaced conditional spread with direct ternary |

## Resources
- PR #73: https://github.com/Esk3tit/wtcs-map-vote/pull/73
- Results route: `src/routes/results.$sessionId.tsx:12-16`
