---
status: resolved
priority: p2
issue_id: "005"
tags: [code-review, security, privacy, gdpr]
dependencies: []
---

# IP Address Privacy/GDPR Compliance

## Problem Statement

The `sessionPlayers.ipAddress` field stores IP addresses as PII without defined retention period, anonymization strategy, or deletion mechanism. Per GDPR and similar regulations, IP addresses require proper data handling.

**Why it matters:** Legal liability for storing PII without proper data handling, especially with EU/Russia/Ukraine users (spec Section 1.4).

## Findings

**Source:** Security Sentinel review

**Location:** `convex/schema.ts:76`

```typescript
ipAddress: v.optional(v.string()), // locked on first use
```

**Specification Reference (Section 12.4):**
> "Player IPs stored only for session duration"

The schema stores IPs but doesn't enforce the retention policy.

## Proposed Solutions

### Option A: Implement IP cleanup in session expiration (Recommended) - IMPLEMENTED
**Pros:** Follows spec, minimal changes
**Cons:** Relies on cron job running
**Effort:** Small
**Risk:** Low

Clear IP addresses when sessions complete/expire in `expireStaleSessions` cron.

### Option B: Hash IPs instead of storing plaintext
**Pros:** Reduces PII exposure, still allows IP-locking validation
**Cons:** More complex implementation
**Effort:** Medium
**Risk:** Low

### Option C: Document and accept current approach
**Pros:** No code changes
**Cons:** Potential compliance risk
**Effort:** None
**Risk:** Medium (compliance)

## Recommended Action

Option A - Implement IP cleanup when sessions expire. Document this in CLAUDE.md or a privacy policy.

## Technical Details

**Affected files:**
- `convex/crons.ts` - Added cron jobs for session expiration and IP cleanup
- `convex/sessionCleanup.ts` - New file with IP cleanup and session expiration functions

## Acceptance Criteria

- [x] IPs cleared when session status becomes COMPLETE or EXPIRED
- [x] Retention policy documented (in code comments, references spec Section 12.4)
- [x] No IPs stored longer than session duration

## Implementation Details

Created `convex/sessionCleanup.ts` with three internal mutations:

1. **`clearSessionIpAddresses`** - Clears IP addresses for a specific session (utility function)
2. **`expireStaleSessions`** - Expires DRAFT/WAITING sessions past their `expiresAt` time and clears their IPs
3. **`clearCompletedSessionIps`** - Clears IPs from completed sessions (catches any that slipped through)

Updated `convex/crons.ts` with two new hourly cron jobs:
- `expire stale sessions` - Runs `expireStaleSessions` to handle session expiration with IP cleanup
- `cleanup completed session IPs` - Runs `clearCompletedSessionIps` as a safety net

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-09 | Identified in code review | GDPR implications for IP storage |
| 2026-01-14 | Implemented Option A | Created sessionCleanup.ts with cron jobs for IP cleanup on session expiration/completion |

## Resources

- [PR #11](https://github.com/Esk3tit/wtcs-map-vote/pull/11)
- docs/SPECIFICATION.md Section 12.4 (Data Protection)
- GDPR Article 5 (data minimization)
