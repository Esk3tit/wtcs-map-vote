---
status: resolved
priority: p2
issue_id: "017"
tags: [code-review, architecture, audit, pr-21]
dependencies: []
---

# Audit Types Should Be in lib/types.ts Not Locally Defined

## Problem Statement

The `ActorType` and `AuditDetails` types are defined locally in `convex/audit.ts` (lines 28-37) instead of in `convex/lib/types.ts` where `AuditAction` is defined. This creates inconsistent organization and potential for type drift.

**Why it matters:**
- Inconsistent with established pattern (AuditAction is in lib/types.ts)
- Types could drift out of sync if defined in multiple places
- Makes it harder to import types for external consumers

## Findings

**Source:** architecture-strategist agent, simplicity-reviewer agent, PR #21 review

**Current state:**
```typescript
// convex/audit.ts lines 28-37 - locally defined
export type ActorType = "ADMIN" | "PLAYER" | "SYSTEM";

export interface AuditDetails {
  mapId?: Id<"sessionMaps">;
  mapName?: string;
  teamName?: string;
  turn?: number;
  round?: number;
  reason?: string;
}

// But AuditAction is imported from lib/types.ts
import type { AuditAction } from "./lib/types";
```

**Inconsistency:** AuditAction comes from `lib/types.ts` but ActorType and AuditDetails are local.

## Proposed Solutions

### Solution 1: Move Types to lib/types.ts (Recommended)

**Pros:** Consistent organization, single source of truth
**Cons:** Requires updating imports
**Effort:** Small
**Risk:** Low

Move to `convex/lib/types.ts`:
```typescript
export type ActorType = "ADMIN" | "PLAYER" | "SYSTEM";

export interface AuditDetails {
  mapId?: Id<"sessionMaps">;
  mapName?: string;
  teamName?: string;
  turn?: number;
  round?: number;
  reason?: string;
}
```

Update `convex/audit.ts`:
```typescript
import type { AuditAction, ActorType, AuditDetails } from "./lib/types";
```

### Solution 2: Use Schema-Inferred Types

**Pros:** No manual type maintenance, always in sync with schema
**Cons:** Requires importing Doc type
**Effort:** Small
**Risk:** Low

```typescript
import type { Doc } from "./_generated/dataModel";

type ActorType = Doc<"auditLogs">["actorType"];
type AuditDetails = Doc<"auditLogs">["details"];
```

## Recommended Action

**RESOLVED**: Moved `ActorType` and `AuditDetails` to `convex/lib/types.ts`. Updated `convex/audit.ts` to import these types instead of defining locally.

## Technical Details

**Affected Files:**
- `convex/audit.ts` (lines 28-37)
- `convex/lib/types.ts`

## Acceptance Criteria

- [ ] ActorType and AuditDetails defined in lib/types.ts (or inferred from schema)
- [ ] audit.ts imports types instead of defining locally
- [ ] No duplicate type definitions
- [ ] TypeScript build passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-16 | Created from PR #21 review | Types should be centralized in lib/types.ts |
| 2026-01-16 | Resolved: Moved types to lib/types.ts | Consistent organization with AuditAction |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/21
