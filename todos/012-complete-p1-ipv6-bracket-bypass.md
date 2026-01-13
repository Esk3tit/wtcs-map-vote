---
status: pending
priority: p1
issue_id: "012"
tags: [code-review, security, ssrf, pr-16]
dependencies: []
---

# P1 CRITICAL: IPv6 Bracketed Address Bypass in SSRF Validation

## Problem Statement

The SSRF URL validation in `convex/lib/urlValidation.ts` has a critical bypass vulnerability. IPv6 addresses in URLs are enclosed in brackets (e.g., `http://[::1]/`), but the `URL.hostname` property returns the hostname WITH brackets. The `ipaddr.isValid()` function returns `false` for bracketed addresses, causing the IP range check to be skipped entirely.

**This allows internal IPv6 addresses to bypass validation completely.**

## Findings

**Source:** Security Sentinel review of PR #16

**Location:** `convex/lib/urlValidation.ts` lines 82-91

**Proof of Concept:**
```javascript
const url = "http://[::1]/admin";
// new URL(url).hostname returns "[::1]"
// ipaddr.isValid("[::1]") returns false
// Range check is SKIPPED - URL passes validation!
```

**Affected URLs that bypass validation:**
- `http://[::1]/` - localhost bypass
- `http://[::ffff:127.0.0.1]/` - IPv4-mapped localhost bypass
- `http://[::ffff:169.254.169.254]/` - Cloud metadata bypass
- `http://[fc00::1]/` - Private IPv6 network bypass

**Impact:** An attacker could submit URLs pointing to internal services using IPv6 notation, potentially accessing cloud metadata endpoints, internal APIs, or localhost services if these URLs are ever fetched server-side.

## Proposed Solutions

### Solution A: Strip brackets before IP validation (Recommended)

**Description:** Remove brackets from IPv6 hostnames before passing to ipaddr.js

**Pros:**
- Simple fix (3-4 lines of code)
- Maintains existing validation flow
- No new dependencies

**Cons:**
- None significant

**Effort:** Small (15 minutes)
**Risk:** Low

**Implementation:**
```typescript
// In isSecureUrl(), after extracting hostname:
let hostnameForIpCheck = hostname;

// Strip brackets from IPv6 addresses for IP validation
if (hostname.startsWith('[') && hostname.endsWith(']')) {
  hostnameForIpCheck = hostname.slice(1, -1);
}

// Check if hostname is an IP address
if (ipaddr.isValid(hostnameForIpCheck)) {
  const addr = ipaddr.process(hostnameForIpCheck);
  const range = addr.range();
  if (UNSAFE_IP_RANGES.has(range)) {
    return false;
  }
}
```

### Solution B: Pre-normalize hostname before all checks

**Description:** Create a `normalizeHostname()` helper that strips brackets

**Pros:**
- More explicit/readable
- Reusable if needed elsewhere

**Cons:**
- Adds abstraction for single use case
- Slightly more code

**Effort:** Small (20 minutes)
**Risk:** Low

## Recommended Action

**Implement Solution A** - Direct bracket stripping is minimal and effective.

## Technical Details

**Affected Files:**
- `convex/lib/urlValidation.ts`

**Test Cases to Verify Fix:**
- `http://[::1]/` - Should be BLOCKED (loopback)
- `http://[::ffff:127.0.0.1]/` - Should be BLOCKED (IPv4-mapped loopback)
- `http://[::ffff:169.254.169.254]/` - Should be BLOCKED (cloud metadata)
- `http://[fc00::1]/` - Should be BLOCKED (private)
- `http://[2607:f8b0:4004:800::200e]/` - Should be ALLOWED (public IPv6)

## Acceptance Criteria

- [ ] URLs with bracketed IPv6 loopback addresses are blocked
- [ ] URLs with bracketed IPv6 private addresses are blocked
- [ ] URLs with bracketed IPv6 link-local addresses are blocked
- [ ] URLs with bracketed public IPv6 addresses are still allowed
- [ ] Tested with Convex MCP tools
- [ ] `npx convex typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from PR #16 code review | Security Sentinel identified critical bypass |

## Resources

- PR #16: https://github.com/Esk3tit/wtcs-map-vote/pull/16
- ipaddr.js documentation: https://github.com/whitequark/ipaddr.js
- RFC 2732 (IPv6 URL format): https://www.rfc-editor.org/rfc/rfc2732
