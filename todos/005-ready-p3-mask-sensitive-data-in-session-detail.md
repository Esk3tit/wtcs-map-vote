---
status: done
priority: p3
issue_id: "005"
tags: [code-review, security, ux]
dependencies: []
---

# Consider Masking Sensitive Data in Session Detail UI

## Problem Statement

Player access tokens and IP addresses are displayed in plain text on the session detail page. While this is an admin-only page (with auth coming in Phase 2), the plain-text display creates shoulder-surfing and screen-sharing risks for tournament organizers.

## Findings

### Tokens in plain text (line 344)
```tsx
<Input value={player.token} readOnly ... />
```
The token is the sole authentication mechanism for players. Visible to anyone observing the admin screen.

### IP addresses in full (lines 366-369)
```tsx
{player.ipAddress}
```
PII displayed without masking. Could be observed during screen sharing.

### Pre-existing auth gap (NOT in scope for this PR)
Backend queries (`getSession`, `getRecentLogs`) have no auth checks — documented as Phase 2 with existing TODOs (`todos/014-pending-p1-audit-queries-missing-authorization.md` referenced in code). This is a known gap, not introduced by this PR.

## Proposed Solutions

### Solution A: Add reveal toggle for tokens (Recommended for later)
Show tokens masked by default (`••••Q2`), with a click-to-reveal eye icon button.

- **Pros:** Reduces shoulder-surfing risk, professional UX
- **Cons:** Adds interaction complexity, may slow admin workflow
- **Effort:** Small-Medium
- **Risk:** Low

### Solution B: No change (acceptable for now)
This is an admin tool for tournament organizers. Tokens are short-lived (tokenExpiresAt field). The page will be auth-gated in Phase 2.

- **Pros:** No code change, simpler
- **Cons:** Tokens visible on screen
- **Effort:** None
- **Risk:** Low (mitigated by future auth)

## Recommended Action

Accept as-is for this PR. Revisit when auth (Phase 2) is implemented — at that point, the page will be properly gated and masking becomes a UX polish item rather than a security concern.

## Acceptance Criteria

- [x] Decision documented (accepted as-is, deferred to Phase 2)
- [ ] If implementing: tokens show `••••XX` by default with reveal toggle
- [ ] If implementing: IP addresses partially masked (`***.***.***.42`)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #37 security review. Pre-existing auth gap is tracked separately. |
| 2026-01-24 | Approved | Triage: approved (deferred to Phase 2 auth) |
| 2026-01-24 | Closed | Accepted as-is; deferred to Phase 2 auth |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/37
- Auth TODO: Referenced in `convex/audit.ts:208-209`
