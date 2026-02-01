---
status: complete
priority: p2
issue_id: "017"
tags: [code-review, robustness]
dependencies: []
---

# Fragile SITE_URL Construction from CONVEX_URL

## Problem Statement

`usePlayerAuth.ts` derives the HTTP action URL by replacing `.cloud` with `.site` in `VITE_CONVEX_URL`. The `as string` cast hides a potential `undefined`. If the env var is missing or doesn't contain `.cloud`, the URL silently becomes wrong.

## Findings

- **Source agents:** security-sentinel, architecture-strategist, kieran-typescript-reviewer, julik-frontend-races-reviewer
- **File:** `src/hooks/usePlayerAuth.ts` lines 3-4

## Proposed Solutions

### Solution A: Add runtime guard
```typescript
if (!CONVEX_URL || !CONVEX_URL.includes(".cloud")) {
  throw new Error("VITE_CONVEX_URL is not configured correctly");
}
```
- **Effort:** Small | **Risk:** None

### Solution B: Use explicit VITE_CONVEX_SITE_URL env var
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Missing or misconfigured env var produces a clear error, not a silent wrong URL

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 4 agents |

## Resources

- PR: [#45](https://github.com/Esk3tit/wtcs-map-vote/pull/45)
