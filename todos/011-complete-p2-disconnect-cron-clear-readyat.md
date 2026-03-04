---
status: complete
priority: p2
issue_id: "011"
tags: [code-review, data-integrity, auto-start]
dependencies: []
---

# Disconnect Cron Should Clear readyAt

## Problem Statement

The disconnect cron in `sessionCleanup.ts` marks players as `isConnected: false` when their heartbeat lapses, but does **not** clear `readyAt`. This means a reconnected player appears "ready" in the lobby even though they disconnected and may not intend to be ready anymore.

With auto-start now depending on `allReady && allConnected`, a player who disconnects and reconnects could inadvertently trigger auto-start without re-confirming readiness.

## Findings

**Agent:** data-integrity-guardian

**Evidence:**
- `sessionCleanup.ts` disconnect logic patches `isConnected: false` but leaves `readyAt` intact
- `playerReady` in `playerAuth.ts` checks `allReady && allConnected` for auto-start
- A player who disconnects and reconnects would still have `readyAt` set from before disconnect
- This could cause unexpected auto-start when the reconnected player's heartbeat restores `isConnected: true`

## Proposed Solutions

### Option A: Clear readyAt on Disconnect (Recommended)

Add `readyAt: undefined` to the disconnect patch in `sessionCleanup.ts`:

```typescript
await ctx.db.patch(player._id, {
  isConnected: false,
  readyAt: undefined, // Force re-confirmation after disconnect
});
```

- **Pros:** Safe default — player must explicitly re-ready after reconnect, prevents accidental auto-start
- **Cons:** Minor UX friction for brief disconnects (player must click Ready again)
- **Effort:** Small
- **Risk:** Low

### Option B: Keep readyAt on Disconnect

Leave current behavior. Rely on the fact that `allConnected` check prevents auto-start while disconnected.

- **Pros:** No UX change, player doesn't need to re-ready after brief network blip
- **Cons:** Stale ready state could cause confusion; reconnect + `isConnected: true` could trigger auto-start unexpectedly
- **Effort:** None
- **Risk:** Medium (unexpected auto-start on reconnect)

## Recommended Action

_To be decided during triage._

## Technical Details

**Affected files:**
- `convex/sessionCleanup.ts` — disconnect logic

## Acceptance Criteria

- [ ] Disconnect cron clears `readyAt` alongside `isConnected: false`
- [ ] Player must re-click Ready after reconnecting
- [ ] Auto-start does not trigger on reconnect with stale readyAt
- [ ] Existing tests pass, new test covers disconnect-clears-readyAt

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from code review of PR #98 | data-integrity-guardian flagged stale readyAt on disconnect |
| 2026-03-03 | Approved during triage — batch approved | Ready to work on |

## Resources

- PR #98: https://github.com/Esk3tit/wtcs-map-vote/pull/98
- `convex/sessionCleanup.ts` — disconnect cron
- `convex/playerAuth.ts` — auto-start logic in `playerReady`
