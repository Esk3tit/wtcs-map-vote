---
status: complete
priority: p2
issue_id: "008"
tags: [consistency, api, naming]
dependencies: []
---

# Error code naming inconsistency between submitBan and submitVote

## Problem Statement

`submitBan` uses `FORMAT_NOT_ABBA` to reject non-ABBA sessions, while `submitVote` uses `NOT_MULTIPLAYER` to reject non-multiplayer sessions. The naming conventions differ: one uses a `FORMAT_NOT_*` prefix pattern, the other drops the prefix entirely. This inconsistency makes the error codes harder to document and handle uniformly on the frontend.

## Findings

- `convex/voting.ts:98` — `FORMAT_NOT_ABBA` (submitBan)
- `convex/voting.ts:308` — `NOT_MULTIPLAYER` (submitVote)
- The plan explicitly chose `NOT_MULTIPLAYER` per Linear issue spec, but the mismatch with `FORMAT_NOT_ABBA` creates an inconsistency

## Proposed Fix

Align naming to use the same pattern. Two options:

**Option A (recommended):** Rename `NOT_MULTIPLAYER` → `FORMAT_NOT_MULTIPLAYER` to match the existing `FORMAT_NOT_ABBA` pattern. More descriptive and consistent.

**Option B:** Rename `FORMAT_NOT_ABBA` → `NOT_ABBA` to match the shorter pattern. Requires updating existing tests and any frontend code handling this error.

Option A is preferred since `submitBan` shipped first and may already have consumers.

## Files to Modify

- `convex/voting.ts` - Rename the error literal in submitVote return type and handler
- `convex/voting.test.ts` - Update test assertions for the renamed error code
- `convex/http.ts` - No changes needed (error codes are opaque to HTTP layer)
