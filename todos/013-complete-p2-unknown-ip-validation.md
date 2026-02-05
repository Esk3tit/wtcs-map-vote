---
status: ready
priority: p2
issue_id: "013"
tags: [code-review, security, auth, player-auth]
dependencies: []
---

# "unknown" IP Accepted by Token Activation

## Problem Statement

When no IP headers are present, `extractClientIp` returns `"unknown"`, which passes the `ipAddress.trim()` emptiness check in `validateAndLockToken` and gets stored as the player's IP address. Any other player behind a similarly misconfigured proxy would also match `"unknown"`, bypassing IP locking.

The project already has `ipaddr.js` as a dependency.

## Findings

- Location: `convex/http.ts:27-35` (`extractClientIp`) and `convex/playerAuth.ts` (IP validation)
- The string `"unknown"` passes the empty-string check and gets stored as a valid IP
- Two players behind misconfigured proxies could share a token via matching `"unknown"` IPs
- Low exploitability since Convex Cloud's edge proxy always adds headers
- Raised by: Security agent

## Proposed Solutions

### Option 1: Reject "unknown" as invalid IP in playerAuth
- Add `if (ipAddress === "unknown")` check alongside the empty-string check
- Add tests for this case
- **Pros**: Simple fix, closes the gap
- **Cons**: Minimal -- "unknown" is not a valid IP anyway
- **Effort**: Small
- **Risk**: Low

### Option 2: Validate IP format using ipaddr.js
- Use `ipaddr.js` (already a dependency) to validate the extracted IP is syntactically valid
- Reject anything that doesn't parse as IPv4 or IPv6
- Also covers non-IP values in X-Forwarded-For
- **Pros**: Comprehensive validation, handles IPv6 too
- **Cons**: Slightly more code
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 2 -- use `ipaddr.js` for proper IP validation since it's already a dependency.

## Technical Details

- **Affected Files**: `convex/playerAuth.ts`, `convex/playerAuth.test.ts`, `convex/http.test.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] "unknown" IP rejected by `validateAndLockToken` and `playerHeartbeat`
- [ ] IP format validated (rejects non-IP strings)
- [ ] Tests added for "unknown", empty X-Forwarded-For, non-IP values, IPv6
- [ ] All existing tests still pass

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approve all)
- Status: ready

## Notes

Source: PR #50 code review triage session on 2026-02-05
