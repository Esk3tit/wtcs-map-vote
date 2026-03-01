---
status: complete
priority: p2
issue_id: "068"
tags: [code-review, documentation, animation]
dependencies: []
---

# Document Animation System Taxonomy

## Problem Statement

The project now has 4 custom keyframes, tw-animate-css utilities, and a JS animation hook, but no documentation explaining the animation system architecture. Future contributors must read multiple components to understand which animation approach is used where and why.

## Findings

- **4 custom keyframes** in `src/index.css` @theme block: `border-flash`, `stamp-in`, `timer-pulse`, `winner-pulse`
- **tw-animate-css utilities**: `animate-in`, `fade-in`, `slide-in-from-bottom`, etc. used across vote, lobby, results pages
- **JS-managed animation state**: `useMapAnimations` hook in `src/hooks/useMapAnimations.ts` — detects AVAILABLE→BANNED transitions via Convex subscription diffs
- **CSS transitions**: `transition-colors`, `transition-[box-shadow,opacity]`, `transition-[filter,opacity]` on various elements
- **Accessibility**: All decorative animations use `motion-safe:` prefix; functional spinners use bare `animate-spin`

No single document catalogs when to use which approach or explains the layering.

## Proposed Solutions

### Option 1: Add section to docs/architecture.md
- **Pros**: Single location, near existing architecture docs
- **Cons**: architecture.md may grow large
- **Effort**: Small (30 min)
- **Risk**: Low

### Option 2: Create docs/solutions/animation-system.md
- **Pros**: Standalone reference, can be detailed
- **Cons**: Another file to maintain
- **Effort**: Small (30 min)
- **Risk**: Low

## Recommended Action

Create `docs/solutions/animation-system.md` as a standalone reference (Option 2). Keeps architecture.md focused on high-level system design while providing a detailed animation reference.

## Technical Details
- **Affected Files**: `docs/architecture.md` or new `docs/solutions/animation-system.md`
- **Related Components**: All animation-using components across vote, lobby, results pages
- **Database Changes**: None

## Acceptance Criteria
- [x] Document lists all custom keyframes with purpose and location
- [x] Document explains CSS transition vs keyframe vs JS-managed animation decision criteria
- [x] Document explains `motion-safe:` accessibility convention
- [x] Document mentions the z-index layering for overlays (z-40, z-45, z-50)

## Work Log

### 2026-02-28 - Created during PR #91 review
**By:** Code review (architecture-strategist agent)
**Actions:**
- Identified documentation gap during turn transition animation PR review
- All 4 review agents approved PR #91 — this is a follow-up improvement

### 2026-02-28 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**
- Animation system has grown across 4 PRs (#87, #88, #90, #91) without centralized docs
- Small effort, high value for onboarding contributors

### 2026-02-28 - Completed
**By:** Claude Code
**Actions:**
- Created `docs/solutions/animation-system.md` with full animation system documentation
- Covers all 4 custom keyframes, tw-animate-css utilities, CSS transitions, JS-managed state
- Includes decision criteria table, accessibility conventions, z-index scale, choreographed sequences
- All acceptance criteria met

## Resources
- PR #91: turn transition animations
- PR #87: animated map transitions
- PR #88: winner celebration animation
- PR #90: lobby stagger animations
