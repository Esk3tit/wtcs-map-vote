---
status: done
priority: p3
issue_id: "003"
tags: [code-review, quality, simplification]
dependencies: ["001"]
---

# Simplify Switch Statements to Record Lookups

## Problem Statement

Three switch statements (`getStatusColor`, `getActorIcon`, `getActorBadgeVariant`) are pure key-to-value lookups with no branching logic. They use 43 lines of switch/case boilerplate where 21 lines of Record constants would be clearer and eliminate dead `default` branches.

## Findings

### `getStatusColor` (lines 47-64): 17 lines
Each case returns a single className string. A `Record<SessionStatus, string>` is more direct.

### `getActorIcon` (lines 98-109): 12 lines
Each case returns `<IconComponent className="w-3 h-3" />`. A record mapping to icon components is cleaner.

### `getActorBadgeVariant` (lines 111-124): 14 lines
Each case returns a badge variant string. A `Record<ActorType, string>` is more direct.

### Dead `default` branches
All three switches have `default` cases that are unreachable if the types are properly narrowed (which depends on TODO 002). These are dead code that the compiler cannot warn about with `string` params.

## Proposed Solutions

### Solution A: Convert to Record constants (Recommended)
```typescript
const STATUS_COLORS: Record<SessionStatus, string> = {
  DRAFT: "bg-muted/50 text-muted-foreground border-border",
  WAITING: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  // ...
};

const ACTOR_ICONS: Record<ActorType, typeof Shield> = {
  ADMIN: Shield,
  PLAYER: User,
  SYSTEM: Bot,
};

const ACTOR_BADGE_VARIANTS: Record<ActorType, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  PLAYER: "secondary",
  SYSTEM: "outline",
};
```

- **Pros:** ~22 lines saved, no dead branches, easier to scan, type-checked keys
- **Cons:** Slightly different pattern from `session-card.tsx` (until TODO 001 is done)
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Solution A — after TODO 001 extracts these to shared utils.

## Technical Details

**Affected files:**
- `src/routes/admin/session.$sessionId.tsx` (or `src/components/session/utils.ts` after TODO 001)

**Net LOC reduction:** ~22 lines

## Acceptance Criteria

- [ ] No switch statements for pure key-value lookups
- [ ] Record constants used with proper type annotations
- [ ] No dead `default` branches
- [ ] TypeScript typecheck passes
- [ ] Visual output unchanged

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #37 code review |
| 2026-01-24 | Approved | Triage: approved for fixing |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/37
