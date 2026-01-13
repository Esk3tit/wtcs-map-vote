---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, testing, security, pr-16]
dependencies: []
---

# P3: Missing Unit Tests for Security-Critical URL Validation

## Problem Statement

The `convex/lib/urlValidation.ts` module is security-critical but has no unit tests. For a module that protects against SSRF attacks, tests would provide regression protection and documentation of expected behavior.

## Findings

**Source:** Architecture Strategist review of PR #16

**Impact:** If the validation logic is accidentally changed or a dependency is updated, there's no automated way to verify the security properties still hold.

**Key test cases needed:**
1. IPv4 private ranges (10.x, 172.16.x, 192.168.x)
2. IPv4 loopback (127.x)
3. IPv4 link-local/cloud metadata (169.254.x)
4. IPv6 loopback (::1)
5. IPv6 private (fc00::)
6. IPv4-mapped IPv6 (::ffff:127.0.0.1)
7. Localhost hostnames
8. Public IPs (should pass)
9. Domain names (should pass)
10. Invalid URLs (should fail)

## Proposed Solutions

### Solution A: Create Vitest unit tests

**Description:** Add unit tests using the project's existing test framework

**Implementation:**
```typescript
// convex/lib/urlValidation.test.ts
import { describe, it, expect } from 'vitest';
import { isSecureUrl, validateSecureUrl } from './urlValidation';

describe('isSecureUrl', () => {
  it('blocks private IPv4 ranges', () => {
    expect(isSecureUrl('http://10.0.0.1/')).toBe(false);
    expect(isSecureUrl('http://192.168.1.1/')).toBe(false);
    expect(isSecureUrl('http://172.16.0.1/')).toBe(false);
  });

  it('blocks loopback addresses', () => {
    expect(isSecureUrl('http://127.0.0.1/')).toBe(false);
    expect(isSecureUrl('http://[::1]/')).toBe(false);
  });

  it('blocks cloud metadata IPs', () => {
    expect(isSecureUrl('http://169.254.169.254/')).toBe(false);
  });

  it('blocks localhost hostnames', () => {
    expect(isSecureUrl('http://localhost/')).toBe(false);
    expect(isSecureUrl('http://test.localhost/')).toBe(false);
  });

  it('allows public IPs', () => {
    expect(isSecureUrl('http://8.8.8.8/')).toBe(true);
  });

  it('allows domain names', () => {
    expect(isSecureUrl('https://example.com/image.png')).toBe(true);
  });
});
```

**Effort:** Medium (1-2 hours)
**Risk:** Very Low

## Recommended Action

Create unit tests after P1 fix is implemented to ensure tests cover the corrected behavior.

## Acceptance Criteria

- [ ] Unit test file created
- [ ] All security-critical paths covered
- [ ] Tests pass with `bun test` or equivalent
- [ ] Tests documented in PR

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from PR #16 code review | Security modules need test coverage |
