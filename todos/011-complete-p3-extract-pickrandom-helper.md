---
status: complete
priority: p3
issue_id: "011"
tags: [code-review, quality]
dependencies: []
---

# Extract pickRandom CSPRNG helper to eliminate duplication

## Problem Statement

The 4-line CSPRNG random selection pattern is duplicated between `resolveRound` and `forceRandomSelection` in `convex/voting.ts`. Both use identical logic: create `Uint32Array(1)`, call `crypto.getRandomValues()`, modulo by array length.

## Findings

- **Location:** `convex/voting.ts:376-379` (resolveRound) and `convex/voting.ts:760-763` (forceRandomSelection)
- **Agents:** pattern-recognition-specialist, code-simplicity-reviewer
- **Context:** Exact structural duplicate, only differing in the input array variable name.

## Proposed Solutions

### Option 1: Extract private helper (Recommended)
```typescript
function pickRandom<T>(items: T[]): T {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return items[buf[0] % items.length];
}
```
- **Pros:** DRY, both callsites become one-liners
- **Cons:** One more function to understand (trivial)
- **Effort:** Small
- **Risk:** Low

### Option 2: Leave as-is
- Only 2 callsites, 4 lines each
- **Pros:** Inline code is self-contained
- **Cons:** Duplication stays
- **Effort:** None
- **Risk:** None

## Recommended Action

Option 1: Extract private `pickRandom<T>(items: T[]): T` helper in voting.ts Private Helpers section.

## Technical Details

- **Affected Files:** `convex/voting.ts`
- **Related Components:** Voting round resolution, force random selection
- **Database Changes:** No

## Acceptance Criteria

- [ ] `pickRandom` helper extracted
- [ ] Both `resolveRound` and `forceRandomSelection` use it
- [ ] All tests pass

## Work Log

### 2026-02-12 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (approve all)
- Status changed from pending to ready

### 2026-02-12 - Created from code review
**By:** Claude Review System
**Actions:**
- Identified by pattern-recognition and code-simplicity agents during PR #62 review

## Resources

- PR #62: https://github.com/Esk3tit/wtcs-map-vote/pull/62
