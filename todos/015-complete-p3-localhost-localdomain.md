---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, security, ssrf, pr-16]
dependencies: ["012"]
---

# P3: localhost.localdomain Not Blocked in SSRF Validation

## Problem Statement

The localhost check in `convex/lib/urlValidation.ts` blocks `localhost` and `*.localhost` but misses `localhost.localdomain`, a common alias on Linux systems.

## Findings

**Source:** Security Sentinel review of PR #16

**Location:** `convex/lib/urlValidation.ts` lines 76-79

**Current Code:**
```typescript
if (hostname === "localhost" || hostname.endsWith(".localhost")) {
  return false;
}
```

**Bypass:**
- `http://localhost.localdomain/` - passes validation

**Impact:** Low. Most environments do not resolve `localhost.localdomain` externally.

## Proposed Solutions

### Solution A: Add localhost.localdomain check (Recommended)

**Implementation:**
```typescript
if (
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "localhost.localdomain"
) {
  return false;
}
```

**Effort:** Small (5 minutes)
**Risk:** Very Low

## Acceptance Criteria

- [ ] `http://localhost.localdomain/` is blocked
- [ ] `npx convex typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from PR #16 code review | Minor edge case |
