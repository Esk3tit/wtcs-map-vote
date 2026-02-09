---
status: complete
priority: p3
issue_id: "005"
tags: [code-style, readability, voting]
dependencies: []
---

# Remove "Step N" comments from voting.ts

## Problem Statement

The `submitBan` handler has 7 inline "Step N" comments (e.g., `// Step 5: Check session is IN_PROGRESS`) that restate what the code already says. The numbering is also non-sequential (jumps from "Step 1-3" to "Step 5", skipping step 4).

## Findings

- Location: `convex/voting.ts` lines 173, 180, 185, 190, 200, 204, 209
- Comments add no information beyond what the code expresses
- Non-sequential numbering references an external spec that isn't linked
- The `// === Success: execute the ban ===` divider and `// Check if all bans are complete` are useful and should be kept

## Proposed Solutions

### Option 1: Remove all "Step N" comments
- Delete the 7 step comments, keep meaningful section dividers
- **Pros**: Less visual noise, code is self-documenting
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action

Option 1 — remove step comments.

## Technical Details

- **Affected Files**: `convex/voting.ts`
- **Database Changes**: No

## Acceptance Criteria

- [x] All "Step N" comments removed
- [x] Section dividers (`// === Success ===`, `// Check if all bans...`) retained
- [x] Typecheck passes

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

## Notes

Source: Triage session on 2026-02-08 (PR #52 review)
