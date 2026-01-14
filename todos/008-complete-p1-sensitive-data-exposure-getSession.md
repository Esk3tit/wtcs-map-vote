---
status: pending
priority: p1
issue_id: "008"
tags: [code-review, security, sessions, pr-20]
dependencies: []
---

# Sensitive Data Exposure in getSession Response

## Problem Statement

The `getSession` query returns full player objects including sensitive fields (`token`, `ipAddress`) that should never be exposed in API responses. This allows anyone who can query a session to obtain all player tokens (enabling session hijacking) and IP addresses (privacy violation).

## Findings

### Security Sentinel Analysis

**Location:** `/Users/khaiphan/Documents/wtcs-map-vote/convex/sessions.ts` lines 57-69, 176-202

The `sessionPlayerObjectValidator` includes sensitive fields:
```typescript
const sessionPlayerObjectValidator = v.object({
  // ...
  token: v.string(),           // SENSITIVE: Player access token exposed
  ipAddress: v.optional(v.string()),  // SENSITIVE: PII
  // ...
});
```

The `getSession` query returns full player objects without redacting sensitive data.

**Impact:**
- Token exposure enables player impersonation
- IP address exposure is a privacy violation
- Any client can enumerate sessions and harvest credentials

## Proposed Solutions

### Option A: Create Separate Public/Admin Views (Recommended)
Create two validator variants:
- `sessionPlayerPublicValidator` - excludes token, ipAddress
- `sessionPlayerAdminValidator` - includes all fields (for authenticated admin queries)

**Pros:** Clean separation, explicit about what's exposed
**Cons:** More code, need to maintain two validators
**Effort:** Medium
**Risk:** Low

### Option B: Redact Fields in Query Handler
Manually strip sensitive fields before returning:
```typescript
players: players.map(({ token, ipAddress, ...rest }) => rest)
```

**Pros:** Quick fix, minimal code change
**Cons:** Easy to forget, TypeScript types won't reflect actual return
**Effort:** Small
**Risk:** Medium (validator/return mismatch)

### Option C: Return Token Only During assignPlayer
Tokens should only be returned once during `assignPlayer` (already done). Just remove from `getSession` return.

**Pros:** Simple, matches security best practice
**Cons:** Need to ensure token is never needed elsewhere
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/sessions.ts` - getSession query, sessionPlayerObjectValidator

**Components:**
- Session queries
- Player data model

## Acceptance Criteria

- [ ] `getSession` does not return `token` field for players
- [ ] `getSession` does not return `ipAddress` field for players
- [ ] TypeScript validator matches actual returned data
- [ ] `assignPlayer` still returns the token (only time it should be exposed)

## Work Log

| Date | Action | Learning |
|------|--------|----------|
| 2026-01-14 | Created from PR #20 review | Security review identified token/IP exposure |

## Resources

- PR #20: https://github.com/Esk3tit/wtcs-map-vote/pull/20
- OWASP A01: Broken Access Control
