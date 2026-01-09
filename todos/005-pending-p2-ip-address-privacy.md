---
status: pending
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

### Option A: Implement IP cleanup in session expiration (Recommended)
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
- `convex/crons.ts` (when created) - expireStaleSessions
- `convex/sessions.ts` - session completion handler

## Acceptance Criteria

- [ ] IPs cleared when session status becomes COMPLETE or EXPIRED
- [ ] Retention policy documented
- [ ] No IPs stored longer than session duration

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-09 | Identified in code review | GDPR implications for IP storage |

## Resources

- PR #11: https://github.com/Esk3tit/wtcs-map-vote/pull/11
- SPECIFICATION.md Section 12.4 (Privacy)
- GDPR Article 5 (data minimization)
