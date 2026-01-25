---
status: ready
priority: p2
issue_id: "006"
tags: [code-review, performance, ux, war-11]
dependencies: []
---

# Timer Does Not Sync with Server timerStartedAt

## Problem Statement

The `CountdownTimer` component in `vote.$token.tsx` initializes with `turnTimerSeconds` (the configured timer duration) but does not account for `timerStartedAt` from the server. If a player joins mid-turn or refreshes the page, they see the full timer duration instead of the actual remaining time, causing confusion during voting.

## Findings

### Timer initialization ignores elapsed time
- `src/routes/vote.$token.tsx:25-49` - CountdownTimer component
- `src/routes/vote.$token.tsx:203-207` - Timer usage with key prop
- Timer uses `initialSeconds={session.turnTimerSeconds}` which is the total duration
- The `timerStartedAt` field exists in session data but is not used

### Code showing the issue
```tsx
<CountdownTimer
  key={`${session.currentTurn}-${session.currentRound}`}
  initialSeconds={session.turnTimerSeconds}  // Always full duration!
  isActive={session.status === "IN_PROGRESS"}
/>
```

### Impact scenarios
1. Player opens page 15 seconds into a 30-second turn → sees 30 seconds instead of 15
2. Player refreshes page mid-turn → timer resets to full duration
3. Network hiccup causes reconnection → timer shows wrong time

## Proposed Solutions

### Solution A: Calculate remaining time from timerStartedAt (Recommended)
Modify the timer component to accept `timerStartedAt` and calculate remaining time dynamically.

```tsx
function CountdownTimer({
  turnTimerSeconds,
  timerStartedAt,
  isActive,
}: {
  turnTimerSeconds: number;
  timerStartedAt: number | undefined;
  isActive: boolean;
}) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!isActive || !timerStartedAt) return;
    const timer = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [isActive, timerStartedAt]);

  if (!timerStartedAt) return <span>--:--</span>;

  const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
  const remaining = Math.max(0, turnTimerSeconds - elapsed);

  return <span>0:{remaining.toString().padStart(2, "0")}</span>;
}
```

- **Pros:** Accurate remaining time, handles late-joining players, handles page refresh
- **Cons:** Requires `timerStartedAt` to be exposed in the query (it may already be)
- **Effort:** Small
- **Risk:** Low

### Solution B: Return computed remainingSeconds from server
Add `remainingSeconds` computed field to `getSessionByToken` response.

- **Pros:** Server is authoritative, no client clock drift
- **Cons:** Requires backend change, still stale by the time it renders
- **Effort:** Medium
- **Risk:** Low

### Solution C: Keep current approach with disclaimer
Add a comment that the timer is approximate and will be fixed with vote mutations.

- **Pros:** No code changes
- **Cons:** Poor UX for players, timer desync issues remain
- **Effort:** None
- **Risk:** High (user confusion)

## Recommended Action

Solution A — calculate remaining time from `timerStartedAt`. The session query already returns this field.

## Technical Details

**Affected files:**
- `src/routes/vote.$token.tsx` (lines 25-49, 203-207)

**Dependencies:**
- Ensure `timerStartedAt` is included in `getSessionByToken` session response

## Acceptance Criteria

- [ ] Timer shows correct remaining time when page is loaded mid-turn
- [ ] Timer maintains correct time after page refresh
- [ ] Timer displays placeholder when `timerStartedAt` is undefined
- [ ] All players see approximately the same remaining time (within 1-2 seconds)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #38 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/38
- Performance agent finding
- Architecture agent finding
