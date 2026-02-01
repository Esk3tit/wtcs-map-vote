---
status: complete
priority: p3
issue_id: "018"
tags: [code-review, performance, frontend]
dependencies: ["002"]
---

# Add Visibility-State Awareness and AbortController to Heartbeat

## Problem Statement

The heartbeat fires every 30s regardless of tab visibility, wasting server resources for background tabs. Additionally, using `AbortController` instead of a boolean `cancelled` flag would actually cancel in-flight HTTP requests on unmount rather than just ignoring responses.

## Findings

- **Source agents:** performance-oracle, julik-frontend-races-reviewer
- **File:** `src/hooks/usePlayerAuth.ts`

## Proposed Solutions

Add `document.visibilityState` check to skip heartbeats when tab is hidden. Use `AbortController` for fetch cancellation.
- **Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] Heartbeats paused when tab is hidden, resumed when visible
- [ ] Fetch requests cancelled on unmount via AbortController signal

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by 2 agents |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
