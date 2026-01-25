---
status: ready
priority: p3
issue_id: "010"
tags: [code-review, architecture, robustness, war-11]
dependencies: []
---

# Add Server-Authoritative Turn Detection

## Problem Statement

The vote page calculates `isYourTurn` client-side using a hardcoded ABBA pattern array. This logic makes assumptions about player ordering and could drift from server state. The server should be the authoritative source for whose turn it is.

## Findings

### Client-side turn calculation
- `src/routes/vote.$token.tsx:94-107`
- Uses hardcoded `abbaPattern = [0, 1, 1, 0]`
- Assumes current player is always index 0 in `allPlayers`
- The `% abbaPattern.length` creates infinite cycling (but ABBA ends after 4 bans)

```typescript
// Current fragile implementation:
const abbaPattern = [0, 1, 1, 0];
const currentTurnPlayerIndex = session.format === "ABBA"
  ? abbaPattern[session.currentTurn % abbaPattern.length]
  : null;
const isYourTurn = session.format === "ABBA"
  ? currentTurnPlayerIndex === playerIndex
  : !player.hasVotedThisRound;
```

### Issues with current approach
1. Hardcoded pattern could desync if server logic changes
2. `playerIndex = 0` assumption is implicit and fragile
3. The modulo creates infinite cycling but ABBA has finite turns
4. Server already tracks turn state - why recalculate client-side?

### Server has authoritative state
The session schema includes:
- `currentTurn: v.number()` - which turn we're on
- `currentRound: v.number()` - which round
- `status: sessionStatusValidator` - session state

## Proposed Solutions

### Solution A: Add isYourTurn to query response (Recommended)
Compute `isYourTurn` server-side in `getSessionByToken` and include in response.

```typescript
// In getSessionByToken handler:
const isYourTurn = computeIsYourTurn(session, player);
return {
  // ...existing fields
  isYourTurn,
};
```

- **Pros:** Server is authoritative, simpler client code, no pattern hardcoding
- **Cons:** Backend change required
- **Effort:** Small
- **Risk:** Low

### Solution B: Add activePlayerId to session response
Return the ID of the player whose turn it is.

```typescript
return {
  session: {
    // ...existing fields
    activePlayerId: computeActivePlayer(session),
  },
};
```

- **Pros:** More flexible, client can derive isYourTurn
- **Cons:** Still requires client logic, more data transferred
- **Effort:** Small
- **Risk:** Low

### Solution C: Keep client-side with better comments
Document the assumptions in the code.

- **Pros:** No backend changes
- **Cons:** Still fragile, could drift from server
- **Effort:** Small
- **Risk:** Medium

## Recommended Action

Solution A — add `isYourTurn: boolean` to the `getSessionByToken` response. This is the cleanest approach and makes the server the single source of truth for turn state.

## Technical Details

**Affected files:**
- `convex/sessions.ts` (add `isYourTurn` computation in `getSessionByToken`)
- `src/routes/vote.$token.tsx` (remove local turn calculation, use `data.isYourTurn`)

**Server-side computation:**
```typescript
function computeIsYourTurn(
  session: Doc<"sessions">,
  player: Doc<"sessionPlayers">,
  allPlayers: Doc<"sessionPlayers">[]
): boolean {
  if (session.format === "MULTIPLAYER") {
    return !player.hasVotedThisRound;
  }
  if (session.format === "ABBA") {
    const abbaPattern = [0, 1, 1, 0];
    const sortedPlayers = [...allPlayers].sort((a, b) =>
      a._creationTime - b._creationTime
    );
    const playerIndex = sortedPlayers.findIndex((p) => p._id === player._id);
    const activeIndex = abbaPattern[session.currentTurn % abbaPattern.length];
    return playerIndex === activeIndex;
  }
  return false;
}
```

## Acceptance Criteria

- [ ] `isYourTurn` field added to `getSessionByToken` response
- [ ] Server computes turn based on session state and player
- [ ] Vote page uses `data.isYourTurn` instead of local calculation
- [ ] Hardcoded `abbaPattern` removed from frontend
- [ ] Turn detection works correctly for both ABBA and Multiplayer formats

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #38 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/38
- Architecture agent finding
