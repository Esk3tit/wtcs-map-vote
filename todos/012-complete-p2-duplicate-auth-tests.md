---
status: ready
priority: p2
issue_id: "012"
tags: [code-review, testing, auth, duplication]
dependencies: []
---

# lib/auth.test.ts Almost Entirely Duplicates admins.test.ts

## Problem Statement

`convex/lib/auth.test.ts` (233 lines) tests `getCurrentAdmin`, `requireAdmin`, `requireRootAdmin`, and `normalizeEmail` through the same public API endpoints (`admins.getMe`, `admins.listAdmins`, `admins.addAdmin`) that `admins.test.ts` already covers. ~180 of 233 lines are redundant.

Only one test is unique: "user record has no email" (line 78-95) which covers a specific `getCurrentAdmin` branch not tested elsewhere.

## Findings

- Location: `convex/lib/auth.test.ts`
- Specific duplicates:
  - `getCurrentAdmin` returns null when not authenticated → same as `admins.getMe` test (admins.test.ts:48)
  - `requireAdmin` throws when not authenticated → same as `listAdmins` auth test (admins.test.ts:94)
  - `requireRootAdmin` throws for non-root → same as `addAdmin` auth test (admins.test.ts:340)
  - `normalizeEmail` tests → overlap with `isEmailWhitelisted` and `getAdminByEmail` tests
- Raised by: Simplicity, Patterns agents

## Proposed Solutions

### Option 1: Move unique test to admins.test.ts, delete file
- Move "user record has no email" test into `admins.test.ts` under `getMe` section
- Delete `convex/lib/auth.test.ts`
- **Pros**: Eliminates 210 lines of duplication, zero coverage loss
- **Cons**: Concentrates more tests in already-large admins.test.ts
- **Effort**: Small
- **Risk**: Low

### Option 2: Keep file but strip to unique tests only
- Remove all duplicate tests
- Keep only the "no email on user record" test (~20 lines)
- **Pros**: Maintains separate file for auth helpers
- **Cons**: File with 1 test feels odd
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 1 -- move the unique test to `admins.test.ts` and delete the file. Cleaner organization.

## Technical Details

- **Affected Files**: `convex/lib/auth.test.ts` (delete), `convex/admins.test.ts` (add 1 test)
- **Database Changes**: No

## Acceptance Criteria

- [ ] "user record has no email" test moved to admins.test.ts
- [ ] `convex/lib/auth.test.ts` deleted
- [ ] All tests pass
- [ ] Coverage thresholds still met

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approve all)
- Status: ready

## Notes

Source: PR #50 code review triage session on 2026-02-05
