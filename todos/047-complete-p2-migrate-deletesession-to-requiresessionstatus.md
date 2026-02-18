---
status: complete
priority: p2
issue_id: "047"
tags: [code-review, consistency, refactor]
dependencies: []
---

# Migrate deleteSession to Use requireSessionStatus

## Problem Statement

`deleteSession` at `convex/sessions.ts:616` retains the ad-hoc inline pattern that PR #72 (WAR-53) was specifically created to eliminate. It uses `DELETABLE_STATUSES.has()` directly with a custom error message, while the four other mutations in the same file now use `requireSessionStatus()`. This creates an inconsistency within the same file and same category of check.

The bespoke error message ("Pause or end the session first") provides domain-specific guidance that the standardized helper does not express, which is the stated reason for the exclusion. However, this can be addressed by adjusting the `action` parameter string.

## Findings

- **Pattern Recognition Specialist**: Severity Medium — only remaining mutation with a named constant that doesn't use requireSessionStatus
- **Architecture Strategist**: Severity Low, Impact Moderate — refactor is incomplete while this retains ad-hoc pattern
- **Code Simplicity Reviewer**: Noted as the biggest consistency concern

### Evidence

```typescript
// convex/sessions.ts:616-619 — ad-hoc pattern retained
if (!DELETABLE_STATUSES.has(session.status)) {
  throw new ConvexError(
    `Cannot delete session in ${session.status} state. Pause or end the session first.`
  );
}
```

## Proposed Solutions

### Option A: Migrate with adjusted action string (Recommended)

Replace the inline check with `requireSessionStatus` using a descriptive action string:

```typescript
requireSessionStatus(session, DELETABLE_STATUSES, "delete session");
```

**Pros:** Full consistency with the 4 other mutations; single guard pattern across the file
**Cons:** Loses the "Pause or end the session first" guidance in the error message
**Effort:** Small (5 minutes)
**Risk:** Low — error message format changes but same states blocked/allowed

### Option B: Add inline comment explaining intentional exclusion

Keep the ad-hoc check but add a comment:

```typescript
// Intentionally not using requireSessionStatus — custom error message
// provides actionable guidance ("Pause or end the session first").
if (!DELETABLE_STATUSES.has(session.status)) { ... }
```

**Pros:** Preserves domain-specific error guidance
**Cons:** Inconsistency persists, but is now documented
**Effort:** Trivial
**Risk:** None

## Technical Details

**Affected files:**
- `convex/sessions.ts` — deleteSession mutation (~line 616)

## Acceptance Criteria

- [ ] `deleteSession` either uses `requireSessionStatus` or has inline comment explaining exclusion
- [ ] All existing tests pass
- [ ] Typecheck and lint pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-18 | Created from PR #72 code review | 6 of 7 agents flagged this inconsistency |
| 2026-02-18 | Approved for work during triage | Batch-approved with all PR #72 findings |

## Resources

- PR #72: https://github.com/Esk3tit/wtcs-map-vote/pull/72
- Related: WAR-53 (refactor status checks)
