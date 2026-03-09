---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, architecture, data-model]
dependencies: []
---

# Reconcile PlayerRole Type with Actual Stored Values

## Problem Statement
The `PlayerRole` type in `convex/lib/types.ts` defines roles as `"PLAYER_A" | "PLAYER_B" | "PLAYER_1" | ...` (UPPER_SNAKE_CASE), but the actual data written to the DB via `create.tsx` uses `"Player A"`, `"Player B"` (Title Case). This mismatch caused the bugs fixed in PR #101 and will cause the same class of bug for any future code that trusts the type definition.

Additionally, test files are inconsistent: tests using `createSessionFull` write `"Player A"`, while tests inserting directly into DB use `"PLAYER_A"`. This means some tests run against phantom data.

## Findings
- `convex/lib/types.ts:18-24` defines `PlayerRole` as UPPER_SNAKE_CASE
- `src/routes/admin/create.tsx:181-188` writes Title Case
- `convex/sessions.test.ts` uses `"Player A"` (matches production)
- `convex/voting.test.ts`, `convex/playerAuth.test.ts`, `convex/sessionCleanup.test.ts` use `"PLAYER_A"` (does NOT match production)
- `docs/SPECIFICATION.md:466` documents UPPER_SNAKE_CASE
- Backend never compares role strings (uses positional indexing), so mismatch is currently frontend-only

## Proposed Solutions

### Option 1: Change create.tsx to write UPPER_SNAKE_CASE
- **Pros**: Aligns with type definition, spec, and most test data
- **Cons**: Requires data migration for existing sessions, or a backward-compat normalization layer
- **Effort**: Medium
- **Risk**: Medium (existing sessions have Title Case data)

### Option 2: Update PlayerRole type to match Title Case reality
- **Pros**: No migration needed, matches what's actually stored
- **Cons**: Unconventional format for enum-like constants
- **Effort**: Small
- **Risk**: Low

### Option 3: Keep normalization layer (current state)
- **Pros**: No changes needed beyond PR #101
- **Cons**: Every consumption site must remember to normalize; type is misleading
- **Effort**: None
- **Risk**: Medium (future bugs likely)

## Recommended Action
Option 2 implemented. Updated `PlayerRole` type to Title Case to match actual stored values. Fixed all test files to use consistent Title Case format. No migration needed.

## Technical Details
- **Affected Files**: `convex/lib/types.ts`, `convex/voting.test.ts`, `convex/playerAuth.test.ts`, `convex/sessionCleanup.test.ts`, `convex/sessionLifecycle.test.ts`, `convex/wideEvent.test.ts`, `convex/sessions.test.ts`, `docs/SPECIFICATION.md`
- **Related Components**: Session creation, player display, ABBA progress tracker
- **Database Changes**: None — type updated to match existing data

## Acceptance Criteria
- [ ] `PlayerRole` type matches actual stored values
- [ ] All test files use consistent role format
- [ ] `docs/SPECIFICATION.md` matches implementation
- [ ] No normalization needed at consumption sites (or single normalized layer)
- [ ] Tests pass

## Work Log

### 2026-03-09 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending to ready

**Learnings:**
- Root cause of PR #101 bugs was this data model inconsistency
- Backend is immune (uses positional indexing) but frontend is vulnerable

## Resources
- PR #101: https://github.com/Esk3tit/wtcs-map-vote/pull/101
- Type definition: `convex/lib/types.ts:18-24`
- Creation code: `src/routes/admin/create.tsx:181-188`
