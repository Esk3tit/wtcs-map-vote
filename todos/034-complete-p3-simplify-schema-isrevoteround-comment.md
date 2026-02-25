---
status: complete
priority: p3
issue_id: "034"
tags: [code-review, quality]
dependencies: []
---

# Simplify schema comment for isRevoteRound

## Problem Statement

The NOTE comment in `schema.ts` references implementation details (`SESSION_RESET_PATCHES, endSession, completeSession`) that belong in code, not schema. Schema comments should describe what the field means, not which functions touch it.

## Findings

- Location: `convex/schema.ts:69-70`
- Current: 2 lines with implementation coupling
- Suggested: 1 line describing semantics only

## Proposed Solutions

### Option 1: Single-line semantic comment
```typescript
// NOTE: Persists through pause/resume so deadlock state survives the cycle.
```
- **Pros**: Cleaner, no implementation coupling
- **Cons**: Loses the pointer to clearing sites
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Replace 2-line comment with 1-line semantic comment.

## Technical Details

- **Affected Files**: `convex/schema.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Comment is one line, describes field semantics only
- [ ] No function names referenced in schema comment

## Resources

- PR #83 review — Simplicity Reviewer

## Work Log

### 2026-02-25 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approve all)
- Status: ready
