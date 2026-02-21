---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, patterns, dry]
dependencies: []
---

# Extract isInteractive Guard (Repeated 3x)

## Problem Statement

The interactive guard condition `phase === "VOTING" && !isPaused` is repeated three times in `vote.$token.tsx` — for click handlers, keyboard handlers, and the `inert` attribute. This creates a maintenance risk if the condition changes.

## Findings

- **Source**: pattern-recognition-specialist
- **Location**: `src/routes/vote.$token.tsx`
- **Occurrences**:
  1. Vote button click handler guard
  2. Keyboard navigation guard
  3. `inert` attribute on the voting section

## Proposed Solutions

### Option A: Derive `isInteractive` Boolean (Recommended)
```typescript
const isInteractive = phaseState.phase === "VOTING" && !isPaused;
```
Then use `isInteractive` in all three locations.

- **Pros**: Single source of truth, self-documenting name, trivial change
- **Cons**: None
- **Effort**: Small
- **Risk**: None

## Recommended Action

Implement Option A: Derive isInteractive boolean

## Technical Details

- **Affected files**: `src/routes/vote.$token.tsx`

## Acceptance Criteria

- [ ] Single `isInteractive` derived boolean
- [ ] All three guard locations use it
- [ ] No behavior change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | Pattern recognition reviewer found 3x repetition |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |

## Resources

- PR #75: Multiplayer round results reveal
