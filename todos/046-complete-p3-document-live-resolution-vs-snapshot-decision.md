---
status: complete
priority: p3
issue_id: "046"
tags: [code-review, documentation, architecture]
dependencies: []
---

# Document live resolution vs snapshot architectural decision

## Problem Statement

The project uses two different strategies for resolving related data: **snapshots** (maps copy `name`/`imageUrl` into `sessionMaps` at assignment time) and **live resolution** (team logos are looked up from the `teams` table at query time). This divergence is intentional but undocumented, which may confuse future developers.

## Findings

- **Source**: Architecture strategist (PR #86 review)
- **Location**: `convex/lib/teamLogos.ts` module header comment
- **Evidence**: The existing snapshot pattern is documented in `sessions.ts` (line 853: "changes to master maps don't affect active sessions" and line 1533: "Intentionally copies name/imageUrl"). The live resolution choice for logos has no similar documentation.

## Proposed Solutions

### Option A: Add a comment to `convex/lib/teamLogos.ts` module header

```typescript
/**
 * Team Logo Resolution
 *
 * Shared utility for resolving team logos by name.
 *
 * Unlike sessionMaps (which snapshot map images at assignment time),
 * team logos are resolved live from the teams table. This is intentional:
 * logos are cosmetic identity markers and should reflect current branding,
 * whereas map images are part of the voting domain and must be immutable
 * during a session.
 */
```

- **Pros**: Explains the decision where developers will encounter it
- **Cons**: None
- **Effort**: Trivial (5 minutes)
- **Risk**: None

## Recommended Action

Go with Option A. Add the module header comment explaining the architectural decision.

## Technical Details

- **Affected files**: `convex/lib/teamLogos.ts` (comment only)

## Acceptance Criteria

- [ ] Module header explains the live resolution choice and contrasts it with the snapshot pattern

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | Identified during PR #86 code review |
| 2026-02-28 | Approved | Approved during triage — ready to work on |

## Resources

- PR #86: https://github.com/Esk3tit/wtcs-map-vote/pull/86
