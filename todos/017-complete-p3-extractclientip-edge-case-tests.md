---
status: ready
priority: p3
issue_id: "017"
tags: [code-review, testing, security]
dependencies: ["013"]
---

# Add extractClientIp Edge Case Tests

## Problem Statement

`extractClientIp` tests cover normal cases but miss adversarial inputs: empty X-Forwarded-For, non-IP values, IPv6 addresses. The function returns whatever the rightmost entry is without validation. Low risk since Convex Cloud's edge proxy controls the header.

## Findings

- Location: `convex/http.test.ts:18-67`
- Missing: empty string header, non-IP values, IPv6 addresses
- Depends on #013 (IP validation) for the fix to actually reject bad values
- Raised by: Security agent

## Proposed Solutions

### Option 1: Add edge case tests
- Test empty `X-Forwarded-For: ""`
- Test non-IP values (e.g., `"not-an-ip"`)
- Test IPv6 addresses (`"::1"`, `"2001:db8::1"`)
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 1. Best done alongside #013 (IP validation fix).

## Technical Details

- **Affected Files**: `convex/http.test.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Edge case tests added
- [ ] Tests pass

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System

## Notes

Source: PR #50 code review triage session on 2026-02-05
Depends on #013 for validation behavior.
