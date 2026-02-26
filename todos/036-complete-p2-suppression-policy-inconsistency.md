---
status: complete
priority: p2
issue_id: "036"
tags: [code-review, architecture, audio]
dependencies: []
---

# Suppression Policy Inconsistency Across Alert Types

## Problem Statement

The audio alert suppression logic in `useAudioAlerts.ts` is inconsistent across different sound types. Some alerts (turn-start, timer-warning) use `isPhaseInitialMount` to suppress on first render, while others (vote-click) don't have equivalent guards. The `map-banned` and `winner-fanfare` alerts use `prevPhase` comparison but rely on a different mechanism than the timer-based alerts.

This creates a fragile system where adding new alert types requires understanding multiple suppression strategies, increasing the risk of false-positive sounds on page load or reconnection.

## Findings

- **pattern-recognition-specialist**: Flagged inconsistent suppression rules across alert types
- **architecture-strategist**: Identified suppression policy gap as the main architectural concern
- **performance-oracle**: Noted the inconsistency could lead to unnecessary sound triggers
- Location: `src/hooks/useAudioAlerts.ts`

## Proposed Solutions

### Option 1: Unified Suppression Guard
- Add a single `isInitialRender` ref that gates ALL sound triggers on first render
- **Pros**: Simple, consistent, easy to reason about
- **Cons**: Minimal - straightforward change
- **Effort**: Small
- **Risk**: Low

### Option 2: Suppression Policy Object
- Create a `suppressionPolicy` config that maps each sound to its suppression rules
- **Pros**: Declarative, self-documenting, extensible
- **Cons**: More abstraction for 6 sounds may be over-engineering
- **Effort**: Medium
- **Risk**: Low

## Recommended Action

Option 1: Unified suppression guard. Add a single isInitialRender ref that gates ALL sound triggers on first render.

## Technical Details

- **Affected Files**: `src/hooks/useAudioAlerts.ts`
- **Related Components**: `useAudio.ts`, `audio.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] All audio alerts use a consistent suppression mechanism
- [ ] No false-positive sounds on page load or reconnection
- [ ] Adding a new alert type follows a clear pattern
- [ ] Existing tests pass

## Work Log

### 2026-02-25 - Created from code review
**By:** Claude Code Review
**Actions:**
- Identified during PR #84 review (WAR-62 Audio Alerts)
- Flagged by 3 independent review agents

## Resources

- PR: #84
- Related: `src/hooks/useAudioAlerts.ts`
