---
status: ready
priority: p3
issue_id: "014"
tags: [code-review, testing, duplication]
dependencies: []
---

# Consolidate createWhitelistedAdmin into createAuthenticatedAdmin

## Problem Statement

`admins.test.ts` defines a local `createWhitelistedAdmin()` helper (line 20-40) that duplicates logic from `createAuthenticatedAdmin()` in `test.setup.ts`. The only difference is the local version accepts `overrides` for the admin factory. Adding an `overrides` param to `createAuthenticatedAdmin` would eliminate the duplication.

## Findings

- Location: `convex/admins.test.ts:20-40` (local helper) vs `convex/test.setup.ts:95-117` (shared helper)
- Both create auth user + admin records and set up identity with `userId|sessionId` format
- Local version adds `overrides` parameter for `isRootAdmin: true` etc.
- ~20 lines of duplication, one fewer mental model for contributors
- Raised by: Architecture, Patterns, Simplicity agents

## Proposed Solutions

### Option 1: Add overrides to createAuthenticatedAdmin
- Add optional `overrides` parameter to `createAuthenticatedAdmin` in `test.setup.ts`
- Remove local `createWhitelistedAdmin` from `admins.test.ts`
- Update all call sites
- **Pros**: Single source of truth, less duplication
- **Cons**: Minor refactor across many tests
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 1.

## Technical Details

- **Affected Files**: `convex/test.setup.ts`, `convex/admins.test.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] `createAuthenticatedAdmin` accepts overrides
- [ ] `createWhitelistedAdmin` removed from admins.test.ts
- [ ] All tests pass

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System

## Notes

Source: PR #50 code review triage session on 2026-02-05
