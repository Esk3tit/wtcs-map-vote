# BUG: MULTIPLAYER Round History Always Empty in Production

**Priority:** P1
**Status:** ready
**Source:** WAR-35 review (data-integrity-guardian)
**Files:** `convex/sessions.ts`, `convex/voting.ts`, `convex/sessions.test.ts`

## Problem

`buildRoundHistory` at line 158 filters banned maps with:
```typescript
.filter((m) => m.state === "BANNED" && m.bannedByPlayerId)
```

But the MULTIPLAYER `banVotedMaps` function in `voting.ts` (lines 173-181) does NOT set `bannedByPlayerId` — it only sets `state`, `voteCount`, and `bannedAtRound`. This means **all MULTIPLAYER bans are silently excluded** from `roundHistory`.

Downstream impact:
1. `getSessionByToken` returns empty `roundHistory` for MULTIPLAYER sessions
2. `buildSessionResults` also delegates to `buildRoundHistory`, so `banHistory` in results is empty too

## Why Tests Don't Catch This

The MULTIPLAYER roundHistory test (line 4441) artificially sets `bannedByPlayerId` in test data (lines 4482, 4491), which doesn't match what `banVotedMaps` actually writes. The test is non-representative of production behavior.

## Fix

**Line 158 of `convex/sessions.ts`:**
```typescript
// Before (broken for MULTIPLAYER):
.filter((m) => m.state === "BANNED" && m.bannedByPlayerId)

// After:
.filter((m) => m.state === "BANNED")
```

The downstream code at line 180-191 already handles `bannedByPlayerId` being undefined gracefully (falls back to `"Unknown"` for `bannedByTeam`).

**Test fix (line 4482, 4491):**
Remove `bannedByPlayerId` from MULTIPLAYER test data to match real `banVotedMaps` behavior. The test should still pass after the filter fix, and this makes it representative.

## References

- `convex/sessions.ts` line 158 (broken filter)
- `convex/voting.ts` lines 167-181 (`banVotedMaps` — no `bannedByPlayerId`)
- `convex/voting.ts` line 483 (ABBA ban — DOES set `bannedByPlayerId`)
- `convex/sessions.test.ts` lines 4441-4518 (non-representative test)
