---
status: ready
priority: p3
issue_id: "011"
tags: [code-review, documentation, security, war-11]
dependencies: []
---

# Document Public Results Page Design Decision

## Problem Statement

The `getSessionResults` query is intentionally unauthenticated, allowing anyone with a session ID to view completed results. This design decision should be documented in code and/or specification to prevent future developers from "fixing" it by adding authentication.

## Findings

### Current implementation
- `convex/sessions.ts:934-1043` - `getSessionResults` query
- No authentication check - accepts any valid session ID
- Only restriction: session must be in COMPLETE status

### JSDoc comment exists but is brief
```typescript
/**
 * Get session results for public display on results page.
 * No authentication required - results are public once session is complete.
 */
export const getSessionResults = query({
```

### Information exposed publicly
- Session match name
- Team names
- Map pool (names, images)
- Ban history (who banned what, in order)
- Winner map

### Security consideration
- Session IDs are Convex IDs (opaque, not sequential)
- Enumeration is possible but difficult
- No PII is exposed (team names are public by nature)

### PR description documents the decision
> "Results page uses public access via sessionId (not token) per user preference"

## Proposed Solutions

### Solution A: Add ADR document (Recommended)
Create an Architecture Decision Record documenting this design choice.

```markdown
# ADR-001: Public Session Results

## Status
Accepted

## Context
Session results need to be viewable after voting completes...

## Decision
Results are public via session ID without authentication...

## Consequences
- Results can be shared via URL
- No sensitive data exposed
- Enumeration theoretically possible but impractical
```

- **Pros:** Formal documentation, explains reasoning
- **Cons:** New documentation pattern to maintain
- **Effort:** Small
- **Risk:** Low

### Solution B: Enhance JSDoc comment
Add more detail to the existing comment in sessions.ts.

```typescript
/**
 * Get session results for public display on results page.
 *
 * DESIGN DECISION: This query is intentionally unauthenticated.
 * Results are considered public information once a session completes.
 *
 * Security considerations:
 * - Session IDs are opaque Convex IDs (not enumerable)
 * - Only COMPLETE sessions return data
 * - No PII exposed (team names are public)
 *
 * See: docs/architecture.md#public-results
 */
```

- **Pros:** Documentation lives with code
- **Cons:** May be overlooked
- **Effort:** Small
- **Risk:** Low

### Solution C: Add note to SPECIFICATION.md
Document in the existing spec file.

- **Pros:** Central documentation location
- **Cons:** May not be read by developers working on code
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Solution B — enhance the JSDoc comment in sessions.ts. This keeps the documentation close to the code where developers will see it. Additionally, consider adding a brief note to docs/architecture.md if one doesn't exist.

## Technical Details

**Affected files:**
- `convex/sessions.ts` (enhance JSDoc on `getSessionResults`)
- `docs/architecture.md` (optionally add section on public endpoints)

## Acceptance Criteria

- [ ] JSDoc comment on `getSessionResults` explains the design decision
- [ ] Comment includes security considerations
- [ ] Optional: docs/architecture.md has section on public vs authenticated endpoints

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #38 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/38
- Security agent finding
- Data integrity agent finding
