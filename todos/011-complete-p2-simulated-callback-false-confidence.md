---
status: ready
priority: p2
issue_id: "011"
tags: [code-review, testing, auth, architecture]
dependencies: []
---

# Simulated Callback Tests Provide False Confidence

## Problem Statement

The "auth callback effects" tests in `authCallback.test.ts` (lines 66-326) re-implement the `afterUserCreatedOrUpdated` callback logic via `t.run()` + `ctx.db.patch/insert`, then assert the re-implementation works. They don't exercise the real callback code in `auth.ts`. If callback logic changes, these tests would still pass.

This is a known framework limitation (convex-test can't invoke `convexAuth()` callbacks), honestly documented in the file header. But ~260 lines of simulation tests create false confidence.

## Findings

- Location: `convex/authCallback.test.ts:66-326`
- The `extractProfileString` tests (lines 23-55) and "unauthorized email" tests (lines 328-374) are genuinely valuable
- ~150 lines of simulated tests essentially test `ctx.db.patch` and `ctx.db.insert` (Convex infrastructure), not application code
- Raised by: Security, Architecture, Simplicity, Patterns agents

## Proposed Solutions

### Option 1: Shrink simulated tests, add drift-risk warnings
- Keep `extractProfileString` tests (trim to 3-4 from 8)
- Keep "unauthorized email" logic tests
- Replace simulated callback tests with a concise comment block explaining the testing gap
- Add `// WARNING: Update these tests when modifying auth.ts afterUserCreatedOrUpdated` comments
- **Pros**: Reduces false confidence, honest about coverage gaps
- **Cons**: Lose some documentation value of the simulation tests
- **Effort**: Small
- **Risk**: Low

### Option 2: Convert simulated tests to contract documentation
- Rename describe block to "auth callback contract (simulated -- not integration)"
- Add per-test comments cross-referencing specific `auth.ts` lines
- Keep all tests but make it crystal clear they're contract docs, not real tests
- **Pros**: Preserves documentation value, reduces confusion
- **Cons**: Still ~260 lines of low-value tests
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option 1 -- shrink the simulated tests. The 8 `extractProfileString` tests can be reduced to 3 (non-empty string, empty string, non-string). The simulated callback effects can be replaced with clear documentation comments.

## Technical Details

- **Affected Files**: `convex/authCallback.test.ts`
- **Related Components**: `convex/auth.ts` (the callback being "tested")
- **Database Changes**: No

## Acceptance Criteria

- [ ] `extractProfileString` tests reduced to 3-4 (no coverage loss)
- [ ] Simulated callback tests either removed or clearly labeled as contract docs
- [ ] Tests pass
- [ ] Coverage thresholds still met

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approve all)
- Status: ready
- Ready to be picked up

## Notes

Source: PR #50 code review triage session on 2026-02-05
