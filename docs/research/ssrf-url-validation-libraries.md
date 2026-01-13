# SSRF URL Validation Libraries Research

**Date:** January 13, 2026
**Status:** Research Complete
**Purpose:** Evaluate libraries for secure URL validation (SSRF prevention) for map/team image URLs

---

## Executive Summary

After extensive research, **the recommended approach is to build a thin wrapper around `ipaddr.js`** rather than using higher-level SSRF libraries. This is because:

1. **Convex Runtime Limitation**: Our URL validation runs in Convex mutations, which use a limited V8 runtime (no Node.js APIs). Libraries like `url-sheriff` and `ssrfcheck` use Node.js-specific modules (`node:dns`, `net.BlockList`) that won't work.

2. **ipaddr.js is the Foundation**: All the recommended SSRF libraries (`url-sheriff`, `ssrfcheck`, `request-filtering-agent`, `ssrf-req-filter`, `got-ssrf`) use `ipaddr.js` internally for IP range detection. It's browser-compatible with 56M weekly downloads.

3. **Our Use Case is Simpler**: We only need to validate that user-provided URLs don't point to private/internal IPs. We don't need DNS resolution (which would be a runtime limitation anyway).

---

## Library Comparison Matrix

| Library | Weekly Downloads | Dependencies | Node.js Required | Convex Compatible | API Simplicity | Known CVEs |
|---------|-----------------|--------------|------------------|-------------------|----------------|------------|
| **ipaddr.js** | 56.4M | 0 | No | ✅ Yes | Medium | None |
| **validator.js** | 15.8M | 0 | No | ✅ Yes | High | None |
| **request-filtering-agent** | 81.8K | ipaddr.js | Partial | ❌ No | Medium | None |
| **ssrf-req-filter** | 44.5K | ipaddr.js | Yes (net) | ❌ No | High | None |
| **got-ssrf** | 4.0K | ipaddr.js, debug | Yes | ❌ No | High | None |
| **ssrfcheck** | 2.4K | 0 | Yes (net.BlockList) | ❌ No | High | CVE-2025-8267 (fixed in 1.2.0) |
| **url-sheriff** | 919 | ipaddr.js | Yes (dns, util) | ❌ No | High | None |

---

## Detailed Analysis

### 1. url-sheriff

**Author:** [Liran Tal](https://lirantal.com/) (Node.js Security Expert, Snyk Developer Advocate, GitHub Star)

**What it does:**
- Validates URLs against SSRF attacks
- Supports allow-lists (domains, IPs, regex patterns)
- Performs DNS resolution to detect private IPs behind domain names
- Configurable scheme restrictions

**API:**
```typescript
const sheriff = new URLSheriff({ allowedSchemes: ['https', 'http'] });
await sheriff.isSafeURL('https://example.com'); // true
await sheriff.isSafeURL('https://127.0.0.1'); // throws Error
```

**Pros:**
- Created by a renowned Node.js security expert
- Most comprehensive protection (DNS rebinding protection)
- Well-maintained with security-focused development
- Apache-2.0 license

**Cons:**
- ❌ **Uses `node:dns/promises`** - Won't work in Convex mutations
- ❌ **Uses `node:util`** - Won't work in Convex default runtime
- Async API (due to DNS lookups)
- Very new (919 downloads/week)

**Sources:**
- [npm](https://www.npmjs.com/package/url-sheriff)
- [GitHub](https://github.com/lirantal/url-sheriff)

---

### 2. ssrfcheck

**Author:** Felippe Regazio

**What it does:**
- Validates URL strings for potential SSRF attacks
- Checks for private IPs, localhost, loopback addresses
- Blocks RFC-forbidden characters
- Detects octal/decimal domain encodings

**API:**
```typescript
import { isSSRFSafeURL } from 'ssrfcheck';
isSSRFSafeURL('https://example.com'); // true
isSSRFSafeURL('https://127.0.0.1'); // false
```

**Pros:**
- Simple true/false API
- Zero listed dependencies
- Synchronous operation
- MIT license

**Cons:**
- ❌ **Uses `require('net').BlockList`** - Won't work in Convex mutations
- Had CVE-2025-8267 (multicast bypass) - fixed in v1.2.0
- Low adoption (2.4K downloads/week)
- Does NOT check path traversal or DNS rebinding

**Security Note:**
> CVE-2025-8267 (CVSS 8.8 High): Incomplete denylist failed to block 224.0.0.0/4 multicast range. Fixed in version 1.2.0+.

**Sources:**
- [npm](https://www.npmjs.com/package/ssrfcheck)
- [GitHub](https://github.com/felippe-regazio/ssrfcheck)
- [CVE-2025-8267](https://security.snyk.io/vuln/SNYK-JS-SSRFCHECK-9510756)
- [Bypass Analysis](https://www.nodejs-security.com/blog/bypassing-ssrf-safeguards-ssrfcheck)

---

### 3. request-filtering-agent

**Author:** azu

**What it does:**
- HTTP(S) Agent that blocks requests to private/reserved IPs
- DNS rebinding protection
- Works with node-fetch, axios, got, node-http-proxy

**API:**
```typescript
import { useAgent } from 'request-filtering-agent';
fetch(url, { agent: useAgent(url) });
```

**Pros:**
- High adoption (81.8K downloads/week)
- DNS rebinding protection
- Comprehensive IP range coverage via ipaddr.js
- Active maintenance

**Cons:**
- ❌ **HTTP Agent pattern** - Only useful for making requests, not validating stored URLs
- ❌ **Requires Node.js http/https modules**
- Not suitable for our use case (we validate URLs, not make requests)

**Sources:**
- [npm](https://www.npmjs.com/package/request-filtering-agent)
- [GitHub](https://github.com/azu/request-filtering-agent)

---

### 4. ssrf-req-filter

**Author:** Yash Mehta

**What it does:**
- Module to prevent SSRF when making HTTP requests
- Blocks local and private IP addresses
- Works with Axios and node-fetch

**API:**
```typescript
const ssrfFilter = require('ssrf-req-filter');
axios.get(url, { httpAgent: ssrfFilter(url), httpsAgent: ssrfFilter(url) });
```

**Pros:**
- Decent adoption (44.5K downloads/week)
- Simple integration with HTTP clients
- Uses ipaddr.js internally

**Cons:**
- ❌ **HTTP Agent pattern** - Not for URL validation
- ❌ **Requires Node.js modules**
- Security warning: Must override BOTH httpAgent and httpsAgent to prevent cross-protocol redirect bypass

**Sources:**
- [npm](https://www.npmjs.com/package/ssrf-req-filter)
- [GitHub](https://github.com/y-mehta/ssrf-req-filter)

---

### 5. got-ssrf

**Author:** Jane Jeon (Hanover Computing)

**What it does:**
- SSRF protection specifically for the `got` HTTP client
- Automatically rejects SSRF requests

**API:**
```typescript
import got from 'got-ssrf';
await got('https://example.com'); // works
await got('https://127.0.0.1'); // throws
```

**Pros:**
- Seamless integration with got
- Uses ipaddr.js for IP classification

**Cons:**
- ❌ **ESM-only** - May have compatibility issues
- ❌ **Specific to `got` HTTP client**
- ❌ **Not for URL validation** - Only for making requests
- LGPL-3.0 license (copyleft)
- Low adoption (4K downloads/week)

**Sources:**
- [npm](https://www.npmjs.com/package/got-ssrf)

---

### 6. ipaddr.js

**Author:** whitequark

**What it does:**
- Parse and manipulate IPv4 and IPv6 addresses
- Check if IP belongs to special ranges (private, loopback, multicast, etc.)
- CIDR matching

**API:**
```typescript
import ipaddr from 'ipaddr.js';
const ip = ipaddr.parse('192.168.1.1');
ip.range(); // 'private'

const ip2 = ipaddr.parse('8.8.8.8');
ip2.range(); // 'unicast' (public)
```

**Pros:**
- ✅ **Browser-compatible** - Works in Convex mutations
- ✅ **Zero dependencies**
- ✅ **Massive adoption** (56.4M downloads/week)
- ✅ **Battle-tested** - Used by all other SSRF libraries
- Comprehensive range detection:
  - `private` (RFC1918: 10.x, 172.16-31.x, 192.168.x)
  - `loopback` (127.x)
  - `linkLocal` (169.254.x)
  - `multicast` (224-239.x)
  - `broadcast` (255.255.255.255)
  - `reserved` (various RFC ranges)
  - `carrierGradeNat` (100.64.x)
  - `unicast` (public addresses)

**Cons:**
- Low-level library - requires wrapper code
- Does NOT validate URL format (only IP addresses)

**Sources:**
- [npm](https://www.npmjs.com/package/ipaddr.js)
- [GitHub](https://github.com/whitequark/ipaddr.js)

---

### 7. validator.js (Current)

**What it does:**
- General-purpose string validation
- URL format validation with protocol restrictions

**API:**
```typescript
import validator from 'validator';
validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true });
```

**Pros:**
- ✅ **Already in our codebase**
- ✅ **Browser-compatible**
- ✅ **Massive adoption** (15.8M downloads/week)
- ✅ **Excellent URL format validation**

**Cons:**
- ❌ **No SSRF protection** - Doesn't check for private IPs
- Only validates URL format, not security

**Sources:**
- [npm](https://www.npmjs.com/package/validator)
- [Snyk Security Analysis](https://snyk.io/node-js/validator)

---

## Convex Runtime Considerations

### Default Runtime (Queries/Mutations)
- Based on V8 (Chrome's engine)
- Browser-like environment
- **NO Node.js APIs**: `dns`, `net`, `fs`, etc. are unavailable
- Supports: Fetch (actions only), crypto, TextEncoder/Decoder, Streams

### Node.js Runtime (Actions only)
- Available via `"use node"` directive
- Full Node.js 20/22 API access
- Higher latency, cold starts possible

**Implication:** Our URL validation in mutations CANNOT use libraries that depend on Node.js modules.

**Sources:**
- [Convex Runtimes](https://docs.convex.dev/functions/runtimes)
- [Convex Bundling](https://docs.convex.dev/functions/bundling)

---

## OWASP Recommendations

OWASP recommends a **defense-in-depth strategy** for SSRF prevention:

1. **URL Normalization** - Canonical form, replace backslashes, eliminate credentials
2. **Protocol Restriction** - Only allow `http` and `https`
3. **Use WHATWG URL API** - Consistent parsing of IPv6, ports, credentials
4. **IP Classification** - Reject private, loopback, link-local, multicast, reserved ranges
5. **Redirect Validation** - Validate each redirect hop
6. **Safe HTTP Client Config** - Short timeouts, disable redirects

> "Blacklists, regex checks, or string matching fail against encoding tricks, DNS rebinding, and IPv6 edge cases."

**Sources:**
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP SSRF Prevention in Node.js](https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs)
- [Snyk SSRF Prevention Guide](https://snyk.io/blog/preventing-server-side-request-forgery-node-js/)

---

## Recommendation

### Approach: validator.js + ipaddr.js Wrapper

Since no existing high-level SSRF library works in Convex's default runtime, the recommended approach is:

1. **Keep validator.js** for URL format validation (already working)
2. **Add ipaddr.js** for IP range classification
3. **Write a thin wrapper** that:
   - Parses the URL hostname
   - Checks if hostname is an IP address
   - If IP, validates it's not private/reserved/loopback/etc.
   - If domain name, we accept it (DNS resolution not available in mutations)

### Implementation Example

```typescript
import validator from 'validator';
import ipaddr from 'ipaddr.js';

const UNSAFE_RANGES = new Set([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'carrierGradeNat',
  'private',
  'reserved',
  'uniqueLocal',    // IPv6
  'ipv4Mapped',     // IPv6
  'rfc6145',        // IPv6
  'rfc6052',        // IPv6
  '6to4',           // IPv6
  'teredo',         // IPv6
]);

function isSecureImageUrl(url: string): boolean {
  // 1. Validate URL format
  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
  })) {
    return false;
  }

  // 2. Extract hostname
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  // 3. Check if hostname is an IP address
  if (ipaddr.isValid(hostname)) {
    const ip = ipaddr.parse(hostname);
    const range = ip.range();

    // Block unsafe IP ranges
    if (UNSAFE_RANGES.has(range)) {
      return false;
    }
  }

  // 4. Domain names pass through (can't DNS resolve in Convex mutation)
  // This is acceptable because:
  // - URLs are rendered client-side, not fetched server-side
  // - Real SSRF requires server-side fetching
  // - We block direct IP-based attacks

  return true;
}
```

### Why This Approach?

| Consideration | Our Solution |
|---------------|--------------|
| Convex compatibility | ✅ ipaddr.js is browser-compatible |
| URL format validation | ✅ validator.js (already using) |
| Private IP blocking | ✅ ipaddr.js range detection |
| DNS rebinding protection | ⚠️ Not possible without DNS resolution |
| Multicast/reserved blocking | ✅ ipaddr.js covers all RFC ranges |
| Maintenance burden | Low - both libraries are mature and stable |
| Bundle size | ~5KB combined |

### Limitation: DNS Rebinding

Our solution cannot protect against DNS rebinding attacks (where a domain initially resolves to a public IP, then later resolves to a private IP). However:

1. **Our use case doesn't fetch URLs server-side** - We only store and render them client-side
2. **DNS rebinding is primarily a server-side concern** - Attackers would target your server, not your users
3. **Full DNS protection would require an Action** - Moving validation to a Convex Action with `"use node"` would add latency and complexity

If DNS rebinding protection becomes a requirement, we could:
- Use a Convex Action with url-sheriff for full DNS validation
- Call the Action from the mutation before storing

---

## Alternative: Convex Action Approach

If full DNS-based SSRF protection is required:

```typescript
// convex/actions/validateUrl.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import URLSheriff from "url-sheriff";

const sheriff = new URLSheriff({
  allowedSchemes: ['https', 'http']
});

export const validateImageUrl = action({
  args: { url: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    try {
      await sheriff.isSafeURL(args.url);
      return true;
    } catch {
      return false;
    }
  },
});
```

**Trade-offs:**
- ✅ Full DNS rebinding protection
- ❌ Additional latency (Action vs Mutation)
- ❌ Cold start potential
- ❌ More complex architecture

---

## Conclusion

**Primary Recommendation:** Add `ipaddr.js` and create a thin wrapper function to augment our existing `validator.js` URL validation. This provides:

- Protection against direct IP-based SSRF attacks
- Blocking of all RFC-defined private/reserved ranges
- Zero additional Node.js dependencies
- Convex mutation compatibility
- Minimal code changes

**Installation:**
```bash
bun add ipaddr.js
```

**Estimated Implementation:** ~30 lines of code in `convex/lib/urlValidation.ts`

---

## Sources

- [url-sheriff npm](https://www.npmjs.com/package/url-sheriff)
- [ssrfcheck npm](https://www.npmjs.com/package/ssrfcheck)
- [CVE-2025-8267 - ssrfcheck vulnerability](https://security.snyk.io/vuln/SNYK-JS-SSRFCHECK-9510756)
- [request-filtering-agent GitHub](https://github.com/azu/request-filtering-agent)
- [ssrf-req-filter GitHub](https://github.com/y-mehta/ssrf-req-filter)
- [ipaddr.js GitHub](https://github.com/whitequark/ipaddr.js)
- [Convex Runtimes Documentation](https://docs.convex.dev/functions/runtimes)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Snyk SSRF Prevention Guide](https://snyk.io/blog/preventing-server-side-request-forgery-node-js/)
- [Liran Tal - Node.js Security](https://lirantal.com/)
- [Node.js Security Blog - SSRF Bypasses](https://www.nodejs-security.com/)
