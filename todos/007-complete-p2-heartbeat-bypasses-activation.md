---
status: complete
priority: p2
issue_id: "007"
tags: [code-review, security]
dependencies: []
---

# Heartbeat Bypasses IP Activation Check

## Problem Statement

The `playerHeartbeat` mutation succeeds for unactivated tokens (where `player.ipAddress` is undefined), allowing anyone with a valid token to call heartbeat from any IP and set `isConnected: true` + update `lastHeartbeat`. While this does not grant data access (the reactive query still requires activation), it causes misleading connection status in the admin dashboard.

## Findings

- **Source agents:** security-sentinel, architecture-strategist, kieran-typescript-reviewer, data-integrity-guardian
- **File:** `convex/playerAuth.ts` lines 195-204
- **Evidence:** IP check is `if (player.ipAddress && ...)` which skips when ipAddress is undefined

## Proposed Solutions

### Solution A: Require activation in heartbeat (Recommended)
```typescript
if (!player.ipAddress) {
  return { status: "error" as const, error: "TOKEN_NOT_ACTIVATED" as const };
}
```
- **Effort:** Small | **Risk:** None (frontend only heartbeats after validation)

## Technical Details

- **Affected files:** `convex/playerAuth.ts`

## Acceptance Criteria

- [ ] Heartbeat rejects unactivated tokens
- [ ] Tests updated for new behavior

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 4 agents |

## Resources

- PR: [#45](https://github.com/Esk3tit/wtcs-map-vote/pull/45)
