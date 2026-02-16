---
status: ready
priority: p3
issue_id: "036"
tags: [code-review, architecture, war-50]
dependencies: []
---

# Extract CountdownTimer to Shared Component

## Problem Statement
The `CountdownTimer` component (~62 lines) is defined inline in `vote.$token.tsx` (639 lines total). If the admin dashboard or other views later need a live countdown, the component should be extracted to `src/components/session/CountdownTimer.tsx` for reuse.

## Findings
- Source: TypeScript Reviewer and Architecture Strategist agents (PR #69 review)
- Location: `src/routes/vote.$token.tsx:87-149`
- Currently only one consumer (player voting page)
- The component is self-contained with clean props — extraction would be mechanical
- Admin session detail page currently shows static `{session.turnTimerSeconds}s` text, not a live countdown

## Proposed Solutions

### Option 1: Extract when a second consumer appears
Wait until the admin dashboard or another view needs a live timer, then extract.

- **Pros**: Avoids premature abstraction, follows YAGNI
- **Cons**: None — extraction is trivial when needed
- **Effort**: Small (15 minutes when needed)
- **Risk**: Low

## Technical Details
- **Affected files**: `src/routes/vote.$token.tsx`, new `src/components/session/CountdownTimer.tsx`
- **Database changes**: None

## Acceptance Criteria
- [ ] Component extracted to `src/components/session/CountdownTimer.tsx`
- [ ] `calculateRemainingTime` helper moves with it
- [ ] Existing vote page behavior unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-16 | Created from PR #69 code review | TypeScript + Architecture agents both noted file is 639 lines |

## Resources
- PR #69: https://github.com/Esk3tit/wtcs-map-vote/pull/69
