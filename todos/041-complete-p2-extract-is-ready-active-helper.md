---
status: complete
priority: p2
issue_id: "041"
tags: [code-review, architecture, quality]
dependencies: []
---

# Extract isReadyActive Helper for Duplicated Ready Check

## Problem Statement

The "is player ready" logic (`readyAt != null && now - readyAt < READY_EXPIRY_MS`) is duplicated across 3-4 locations:

1. `lobby.$token.tsx:113` — current player check
2. `lobby.$token.tsx:243` — other player check
3. `admin/session.$sessionId.tsx` — PlayerReadyBadge component
4. Potentially any future consumer

Duplication increases risk of divergence if the ready logic changes (e.g., adding server-side enforcement).

## Findings

- **Architecture Strategist**: Flagged as MEDIUM — duplicated logic across 4 locations
- **Simplicity Reviewer**: Suggested extracting `isReadyActive` helper (low priority)
- **TypeScript Reviewer**: Flagged as MEDIUM — duplicated readiness check across 3 locations

### Evidence

- `src/routes/lobby.$token.tsx:113` — `player.readyAt != null && now - player.readyAt < READY_EXPIRY_MS`
- `src/routes/lobby.$token.tsx:243` — `otherPlayer.readyAt != null && now - otherPlayer.readyAt < READY_EXPIRY_MS`
- `src/routes/admin/session.$sessionId.tsx` — PlayerReadyBadge has similar logic

## Proposed Solutions

### Option A: Extract to shared utility (Recommended)

Create `isReadyActive(readyAt: number | undefined, now: number): boolean` in a shared location (e.g., `src/lib/ready.ts` or import from `convex/lib/constants.ts`).

**Pros:** Single source of truth, easy to update, self-documenting
**Cons:** One more import
**Effort:** Small
**Risk:** Low

### Option B: Keep inline, add comment referencing canonical logic

Leave duplicated but add `// See READY_EXPIRY_MS` comments to link them.

**Pros:** No new files
**Cons:** Still duplicated, comments can go stale
**Effort:** Trivial
**Risk:** Low

## Recommended Action

Option A — extract helper.

## Technical Details

**Affected files:**
- New: `src/lib/ready.ts` (or add to existing utils)
- `src/routes/lobby.$token.tsx`
- `src/routes/admin/session.$sessionId.tsx`
- `src/components/session/ReadyCountdown.tsx` (could use it too)

## Acceptance Criteria

- [ ] Single `isReadyActive()` function used in all locations
- [ ] Function accepts `readyAt` and `now` parameters
- [ ] All existing ready checks replaced with the helper
- [ ] No behavioral change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #71 code review | 3 agents flagged duplication |

## Resources

- PR #71: https://github.com/Esk3tit/wtcs-map-vote/pull/71
