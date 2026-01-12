---
status: completed
priority: p2
issue_id: "009"
tags: [code-review, security, validation, convex]
dependencies: []
---

# Logo URL Validation (XSS/SSRF Risk)

## Problem Statement

The `logoUrl` field accepts any string without validation. This is stored directly in the database and presumably rendered in the UI, creating potential XSS and SSRF attack vectors.

**Why it matters:** Malicious URLs could execute JavaScript in user browsers or cause the server to make requests to internal resources.

## Findings

**Source:** Security Sentinel review of PR #14

**Location:** `convex/teams.ts` lines 33, 55-56, 106-108

```typescript
// No validation on logoUrl
const teamId = await ctx.db.insert("teams", {
  name: trimmedName,
  logoUrl: args.logoUrl,  // Any string accepted
  updatedAt: Date.now(),
});
```

**Attack Vectors:**
1. **XSS:** `javascript:alert(document.cookie)` - executes if rendered as href
2. **SSRF:** `http://169.254.169.254/latest/meta-data/` - AWS metadata access
3. **Phishing:** `https://evil-site.com/fake-login`

## Proposed Solutions

### Option A: Basic URL validation (Recommended)
**Pros:** Simple, blocks obvious attacks
**Cons:** May block some valid URLs
**Effort:** Small
**Risk:** Low

```typescript
function isValidLogoUrl(url: string | undefined): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname === '169.254.169.254') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

### Option B: HTTPS only
**Pros:** Simplest, most secure
**Cons:** Blocks HTTP URLs
**Effort:** Small
**Risk:** Low

```typescript
if (args.logoUrl && !args.logoUrl.startsWith('https://')) {
  throw new ConvexError("Logo URL must use HTTPS");
}
```

## Recommended Action

Option A - Validate URL format and block dangerous protocols/hosts.

## Technical Details

**Affected files:**
- `convex/teams.ts` (createTeam, updateTeam)

## Acceptance Criteria

- [x] `javascript:` URLs are rejected
- [x] `data:` URLs are rejected (or explicitly allowed if needed)
- [x] Internal IP addresses are rejected
- [x] HTTPS URLs are accepted
- [x] Empty/undefined logoUrl is accepted

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-12 | Identified in PR #14 code review | URL validation needed |
| 2026-01-12 | Fixed in commit bd980d2 | Added isValidLogoUrl() function blocking javascript:, data:, localhost, internal IPs |

## Resources

- [PR #14](https://github.com/Esk3tit/wtcs-map-vote/pull/14)
- OWASP XSS Prevention Cheat Sheet
