---
status: complete
priority: p2
issue_id: "010"
tags: [code-review, typescript, type-safety, connection-status]
dependencies: []
---

# Consolidate ConnectionStatus Type to Single Source of Truth

## Problem Statement

The `ConnectionStatus` type (`"connected" | "reconnecting" | "disconnected"`) is defined independently in 3+ locations: `convex/sessions.ts` (inline return type), `ConnectionStatusBadge.tsx` (props type), and `AdminConnectionBadge` (inline). This violates DRY and risks the definitions drifting apart over time.

## Findings

- **Source**: kieran-typescript-reviewer, pattern-recognition-specialist, architecture-strategist
- **Locations**:
  - `convex/sessions.ts` — `computeConnectionStatus()` return type (inline union)
  - `src/components/session/ConnectionStatusBadge.tsx` — `ConnectionStatusBadgeProps.status` type
  - `src/routes/admin/session.$sessionId.tsx` — `AdminConnectionBadge` props
  - `src/routes/lobby.$token.tsx` — `ownConnectionStatus` variable type
  - `src/routes/vote.$token.tsx` — `ownConnectionStatus` variable type
- **Risk**: Low — all definitions currently match, but future changes could cause drift

## Proposed Solutions

### Option A: Export type from ConnectionStatusBadge and reuse everywhere
- **Pros**: Minimal change, component already "owns" the visual mapping
- **Cons**: Frontend component becomes the canonical source for a backend concept
- **Effort**: Small
- **Risk**: Low

### Option B: Create `convex/lib/connectionStatus.ts` with shared type and helper
- **Pros**: Backend owns the type, `computeConnectionStatus` can live alongside it
- **Cons**: Slightly more files, need to ensure frontend can import from convex/lib
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option B: Create `convex/lib/connectionStatus.ts` — backend owns the canonical type

## Technical Details

- **Affected files**: All files listed in Findings
- **Pattern**: Extract `type ConnectionStatus = "connected" | "reconnecting" | "disconnected"` to one canonical location

## Acceptance Criteria

- [ ] Single canonical `ConnectionStatus` type definition
- [ ] All usages import from the canonical location
- [ ] No inline union type definitions for connection status remain

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready

## Resources

- PR #76: Enhanced connection status indicators
