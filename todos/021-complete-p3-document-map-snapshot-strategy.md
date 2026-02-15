---
status: complete
priority: p3
issue_id: "021"
tags: [code-review, documentation]
dependencies: []
---

# Document Map Snapshot Strategy in cloneSession

## Problem Statement
The `cloneSession` mutation copies map data from source `sessionMaps` snapshots rather than re-fetching from the master `maps` table. This is intentional but not documented in code, which could confuse future developers.

## Findings
- Location: `convex/sessions.ts:1432-1443`
- Design decision confirmed during planning: "Copy from source sessionMaps"
- Rationale: Preserves historical state even if master maps are renamed/deleted

## Proposed Solutions

### Option 1: Add inline comment explaining the decision
- **Pros**: Minimal change, clarifies intent
- **Cons**: None
- **Effort**: Small (10 minutes)
- **Risk**: Low

## Recommended Action
Add a brief comment above the map cloning section.

## Technical Details
- **Affected Files**: `convex/sessions.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Comment added explaining map snapshot strategy is intentional
- [ ] No code changes

## Work Log

### 2026-02-14 - Approved for Work
**By:** Claude Triage System

## Resources
- Source: Code review of PR #65 (WAR-46)
- Design decision: WAR-46 planning session
