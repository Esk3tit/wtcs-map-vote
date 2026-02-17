---
status: complete
priority: p2
issue_id: "042"
tags: [code-review, security, performance]
dependencies: []
---

# Add Write-Skip Guard to playerReady Mutation

## Problem Statement

The `playerReady` mutation always writes `readyAt: Date.now()` on every call, even if the player just pressed ready moments ago. Unlike `playerHeartbeat` which has a `HEARTBEAT_SKIP_MS` guard to avoid unnecessary writes, `playerReady` has no such protection.

A user rapidly clicking the ready button causes unnecessary database writes and reactive query churn.

## Findings

- **Security Sentinel**: Flagged as MEDIUM — DB write amplification from rapid re-ready calls
- **Performance Oracle**: Flagged as LOW — always writes without skip-if-fresh
- **Architecture Strategist**: Flagged as LOW — no rate limiting on ready endpoint

### Evidence

- `convex/playerAuth.ts:285` — `await ctx.db.patch(player._id, { readyAt: Date.now() });` with no freshness check
- `convex/playerAuth.ts:200-206` — heartbeat has `HEARTBEAT_SKIP_MS` guard for comparison

## Proposed Solutions

### Option A: Add READY_SKIP_MS guard (Recommended)

Skip the write if `readyAt` is still within a threshold (e.g., 5 seconds). Similar to the heartbeat pattern.

```typescript
const READY_SKIP_MS = 5_000;
if (player.readyAt && Date.now() - player.readyAt < READY_SKIP_MS) {
  return { status: "ok" as const };
}
```

**Pros:** Consistent with heartbeat pattern, reduces write amplification
**Cons:** Player sees no visual feedback if clicking within 5s (but countdown resets are negligible)
**Effort:** Small
**Risk:** Low

### Option B: Client-side debounce only

Disable the button for a few seconds after clicking.

**Pros:** No backend changes
**Cons:** Doesn't protect against malicious clients, inconsistent with heartbeat approach
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — add server-side skip guard. Optionally combine with client-side debounce.

## Technical Details

**Affected files:**
- `convex/playerAuth.ts` — playerReady handler
- `convex/lib/constants.ts` — add READY_SKIP_MS constant
- `convex/playerAuth.test.ts` — add test for skip behavior

## Acceptance Criteria

- [ ] Rapid re-ready calls within threshold return `ok` without writing
- [ ] Ready still works after threshold expires
- [ ] Test covers the skip behavior
- [ ] Consistent with heartbeat skip pattern

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #71 code review | Security + performance agents flagged |

## Resources

- PR #71: https://github.com/Esk3tit/wtcs-map-vote/pull/71
