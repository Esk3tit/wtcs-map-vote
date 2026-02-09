---
status: complete
priority: p3
issue_id: "011"
tags: [testing, refactoring, duplication]
dependencies: []
---

# Test suite redundancy in submitVote validation tests

## Problem Statement

~9 of the submitVote validation tests re-test the shared `validatePlayerForVoting` helper that is already covered by the submitBan test suite. Tests like "rejects invalid token", "rejects expired token", "rejects IP mismatch" exercise identical code paths since both mutations use the same validation helper.

## Findings

- submitBan tests (existing): cover INVALID_TOKEN, INVALID_IP, TOKEN_EXPIRED, SESSION_NOT_FOUND, IP_MISMATCH
- submitVote tests (new): duplicate coverage of the same error codes via the same helper
- The shared helper `validatePlayerForVoting` is tested indirectly through both suites

## Proposed Fix

Two options:

**Option A (recommended):** Keep the duplicate tests but add a comment noting they're integration-level coverage for the full mutation path, not unit tests of the shared helper. This provides regression safety if the mutations ever diverge.

**Option B:** Remove the redundant validation tests from submitVote suite and instead add a focused test for `validatePlayerForVoting` as a separate describe block. Keep only submitVote-specific tests (format check, already voted, map available).

Option A is simpler and provides better regression coverage at minimal cost.

## Files to Modify

- `convex/voting.test.ts` - Add clarifying comments (Option A) or restructure tests (Option B)
