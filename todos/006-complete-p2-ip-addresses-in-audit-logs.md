---
status: complete
priority: p2
issue_id: "006"
tags: [code-review, security, privacy, gdpr]
dependencies: []
---

# IP Addresses Persist in Audit Log Reason Strings

## Problem Statement

Raw IP addresses are embedded in audit log `details.reason` fields (e.g., `"IP mismatch: expected 1.2.3.4, got 5.6.7.8"` and `"Token activated from IP 1.2.3.4"`). While `sessionCleanup.ts` properly clears `ipAddress` from `sessionPlayers`, the audit log entries persist indefinitely with unstructured IP data that cannot be systematically cleaned. Under GDPR, IP addresses are PII.

## Findings

- **Source agents:** security-sentinel, architecture-strategist, kieran-typescript-reviewer, data-integrity-guardian, pattern-recognition-specialist
- **File:** `convex/playerAuth.ts` lines 113, 140
- **Evidence:** String interpolation of IP addresses into audit log reason field

## Proposed Solutions

### Solution A: Hash or truncate IPs in audit messages
```typescript
reason: `IP mismatch detected for player ${player._id}`,
```
- **Effort:** Small | **Risk:** Reduces debugging capability

### Solution B: Store IP in separate rotatable audit field
Add a structured `metadata` field to audit logs that cleanup can scrub.
- **Effort:** Medium | **Risk:** Low

## Technical Details

- **Affected files:** `convex/playerAuth.ts`

## Acceptance Criteria

- [ ] Raw IP addresses not present in audit log `reason` strings
- [ ] Audit logs still provide useful security forensics information

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 5 agents |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
