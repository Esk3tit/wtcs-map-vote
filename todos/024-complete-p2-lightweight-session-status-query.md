---
status: complete
priority: p2
issue_id: "024"
tags: [code-review, performance, war-54]
dependencies: []
---

# Create Lightweight Session Status Query for Results Page

## Problem Statement
The results page subscribes to `getSessionByToken` solely for session status redirect detection, but this query is one of the heaviest in the codebase. It fetches all session players (`.collect()`), all session maps (`.collect()`), the player's current vote, computes `otherPlayers`, `sortedPlayers`, `isYourTurn`, builds `roundHistory`, and computes `voteProgress`. The redirect hook only reads two fields: `session._id` and `session.status`. All other data is fetched, serialized, transmitted over WebSocket, deserialized, and discarded.

Additionally, because `getSessionByToken` reads from `sessionPlayers`, `sessionMaps`, and `votes` tables, Convex's reactive system re-evaluates the query whenever any of those tables change for the session — even on a static completed session where only session status matters.

## Findings
- Source: Performance Oracle agent
- Location: `src/routes/results.$sessionId.tsx:29-32` (subscription), `convex/sessions.ts:1566-1722` (query definition)
- The lobby and vote pages need the full `getSessionByToken` response for their UI, so this only affects the results page
- Anonymous viewers (no token) correctly skip the subscription via `"skip"` parameter
- With 2 players per session, the results page doubles per-session subscription load for token-bearing viewers

## Proposed Solutions

### Option 1: Create `getSessionStatusByToken` lightweight query
Add a new Convex query that only looks up the player by token, validates token/expiry, fetches the session document, and returns `{ status, session: { _id, status } }`. Reads only from `sessionPlayers` and `sessions` tables (2 tables vs 3+). No `.collect()` calls, no in-memory computation.

- **Pros**: Eliminates 3 unnecessary `.collect()` queries, narrows reactive dependencies, cuts WebSocket payload from dozens of objects to 2 string fields
- **Cons**: Adds a new query to maintain alongside `getSessionByToken`
- **Effort**: Small (~30 lines of new query + 1 import change on results page)
- **Risk**: Low

### Option 2: Keep current approach, document the overhead
The overhead is small for 2-8 concurrent players per session. Document the design decision and revisit if performance becomes an issue.

- **Pros**: No new code to maintain
- **Cons**: Unnecessary work on every reactive update, compounds with concurrent viewers
- **Effort**: None
- **Risk**: Low (but accumulates)

## Recommended Action
Option 1. The effort is minimal and the reactive dependency narrowing is a clear win.

## Technical Details
- **Affected files**: `convex/sessions.ts` (new query), `src/routes/results.$sessionId.tsx` (change import)
- **Tables involved**: `sessionPlayers` (by_token index), `sessions`

## Acceptance Criteria
- [ ] New `getSessionStatusByToken` query exists and is type-safe
- [ ] Results page uses lightweight query instead of `getSessionByToken`
- [ ] `SessionQueryData` type still satisfied by new query's return type
- [ ] Typecheck, lint, and tests pass

## Work Log
| Date | Action | Notes |
|------|--------|-------|
| 2026-02-18 | Created | Performance Oracle review finding for PR #73 |
| 2026-02-18 | Resolved | Added `getSessionStatusByToken` query, updated results page to use it |

## Resources
- PR #73: https://github.com/Esk3tit/wtcs-map-vote/pull/73
- Heavy query: `convex/sessions.ts:1566-1722`
- Results page subscription: `src/routes/results.$sessionId.tsx:29-32`
