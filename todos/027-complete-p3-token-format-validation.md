---
status: complete
priority: p3
issue_id: "027"
tags: [code-review, security, war-54]
dependencies: ["026"]
---

# Add Token Format Validation in Results validateSearch

## Problem Statement
The `validateSearch` on the results route accepts any string as a token. An attacker could craft a URL with an arbitrarily long or malformed token value that would be passed to the Convex `getSessionByToken` query. While Convex handles this gracefully (indexed lookup returns no match, returns `INVALID_TOKEN` error), rejecting malformed tokens at the routing layer is better defense in depth.

## Findings
- Source: Security Sentinel agent
- Location: `src/routes/results.$sessionId.tsx:12-16`
- Legitimate tokens are UUIDs from `crypto.randomUUID()` (36 chars with hyphens, or 32 hex chars without)
- Backend handles invalid tokens gracefully but the extra query is unnecessary

## Proposed Solutions

### Option 1: Add UUID format regex validation
```typescript
validateSearch: (search: Record<string, unknown>): { token?: string } => ({
  token: typeof search.token === "string" &&
    /^[a-f0-9-]{32,36}$/.test(search.token)
    ? search.token
    : undefined,
}),
```

- **Pros**: Rejects garbage before it hits Convex, defense in depth
- **Cons**: Regex must match actual token format (verify UUID format)
- **Effort**: Small (5 minutes)
- **Risk**: Low (must verify token format matches regex)

### Option 2: Keep current approach
Backend already validates. Adding client-side validation adds a maintenance surface if token format changes.

- **Pros**: Simpler code, single validation point
- **Cons**: Unnecessary queries for obviously-invalid tokens
- **Effort**: None
- **Risk**: None

## Acceptance Criteria
- [ ] Malformed tokens (too long, non-hex characters) are rejected by validateSearch
- [ ] Valid UUID tokens still work
- [ ] Typecheck passes

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-18 | Created | Security Sentinel review finding for PR #73 |
| 2026-02-18 | Resolved | Added `/^[a-f0-9]{32}$/` regex to validateSearch (combined with todo 026) |

## Resources
- PR #73: https://github.com/Esk3tit/wtcs-map-vote/pull/73
- Token generation: `convex/sessions.ts` (uses `crypto.randomUUID()`)
