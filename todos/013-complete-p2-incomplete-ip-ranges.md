---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, security, ssrf, pr-16]
dependencies: ["012"]
---

# P2: Incomplete IP Range Blocklist in SSRF Validation

## Problem Statement

The `UNSAFE_IP_RANGES` set in `convex/lib/urlValidation.ts` is missing several special-purpose IP ranges that ipaddr.js recognizes. While most are unlikely attack vectors, adding them provides defense-in-depth.

## Findings

**Source:** Security Sentinel review of PR #16

**Location:** `convex/lib/urlValidation.ts` lines 16-34

**Missing IPv4 Ranges:**
| Range | CIDR | Purpose |
|-------|------|---------|
| `as112` | 192.31.196.0/24, 192.175.48.0/24 | DNS blackhole infrastructure |
| `amt` | 192.52.193.0/24 | Automatic Multicast Tunneling |

**Missing IPv6 Ranges:**
| Range | Purpose |
|-------|---------|
| `discard` | 100::/64 - Discard prefix |
| `benchmarking` | 2001:2::/48 - Benchmarking |
| `orchid2` | 2001:20::/28 - ORCHID v2 |
| `as112v6` | Various - DNS blackhole |

**Impact:** Low to medium. These ranges are unlikely to host sensitive services, but completeness is preferable.

## Proposed Solutions

### Solution A: Add all missing ranges (Recommended)

**Description:** Add the complete list of ipaddr.js recognized ranges

**Implementation:**
```typescript
const UNSAFE_IP_RANGES = new Set([
  // IPv4
  "unspecified", "broadcast", "multicast", "linkLocal", "loopback",
  "carrierGradeNat", "private", "reserved",
  "as112", "amt",  // ADD THESE
  // IPv6
  "uniqueLocal", "ipv4Mapped", "rfc6145", "rfc6052", "6to4", "teredo",
  "discard", "benchmarking", "orchid2", "as112v6", "amt",  // ADD THESE
]);
```

**Pros:**
- Complete coverage
- No runtime cost (Set lookup is O(1))

**Cons:**
- None significant

**Effort:** Small (5 minutes)
**Risk:** Very Low

## Recommended Action

**Implement Solution A** - Add all missing ranges for completeness.

## Acceptance Criteria

- [ ] All ipaddr.js recognized unsafe ranges are in UNSAFE_IP_RANGES
- [ ] `npx convex typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from PR #16 code review | Security Sentinel identified incomplete ranges |

## Resources

- ipaddr.js source: https://github.com/whitequark/ipaddr.js/blob/master/lib/ipaddr.js
