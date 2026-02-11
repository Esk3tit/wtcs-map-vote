---
status: ready
priority: p2
issue_id: "001"
tags: [code-review, security, validation]
dependencies: []
---

# Add length limit on `reason` string in pauseSession

## Problem Statement

The `pauseSession` mutation accepts an optional `reason` string with no length constraint. A malicious or careless admin could pass an extremely large string, causing excessive storage consumption in the `auditLogs` table. This is a defense-in-depth concern — while only authenticated admins can call this, unbounded strings violate input validation best practices.

## Findings

- **Location:** `convex/sessions.ts` — `pauseSession` mutation, `reason: v.optional(v.string())`
- **Agents:** security-sentinel (Medium severity)
- **Context:** The `reason` is stored in `auditDetails` in the audit log. No other mutation accepts free-text input without validation.
- **Risk:** Low in practice (admin-only), but inconsistent with the project's thorough input validation patterns elsewhere (e.g., `validateName` enforces `MAX_NAME_LENGTH`).

## Proposed Solutions

### Option 1: Add length validation with existing pattern (Recommended)
- Add `if (args.reason && args.reason.length > MAX_REASON_LENGTH) throw ...` check
- Define `MAX_REASON_LENGTH` constant in `convex/lib/constants.ts` (e.g., 500 chars)
- **Pros:** Consistent with existing validation patterns, simple
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

### Option 2: Use Convex string length validator
- Use `v.optional(v.string())` with a custom validator or post-parse check
- **Pros:** Catches at validator level
- **Cons:** Convex `v.string()` doesn't have built-in max length; still needs runtime check
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1: Add `MAX_REASON_LENGTH` constant (500 chars) in `convex/lib/constants.ts` and validate in `pauseSession` handler.

## Technical Details

- **Affected Files:** `convex/sessions.ts`, `convex/lib/constants.ts`
- **Related Components:** pauseSession mutation, audit logging
- **Database Changes:** No

## Acceptance Criteria

- [ ] `MAX_REASON_LENGTH` constant defined in `convex/lib/constants.ts`
- [ ] `pauseSession` validates `reason` length before use
- [ ] Test added for oversized reason rejection
- [ ] Existing tests still pass

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (approve all)
- Status changed from pending to ready

### 2026-02-11 - Created from code review
**By:** Claude Review System
**Actions:**
- Identified by security-sentinel agent during PR #60 review
- No existing length validation for free-text audit fields

## Resources

- PR #60: https://github.com/Esk3tit/wtcs-map-vote/pull/60
- Related pattern: `convex/lib/validation.ts` — `validateName`
