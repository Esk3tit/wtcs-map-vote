# Changelog

All notable changes to the WTCS Map Vote project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] - 2026-03-03 - Production Release

The 1.0.0 release marks WTCS Map Vote as feature-complete and production-ready. This release consolidates all work from 98 pull requests across 8 development phases, delivering a real-time competitive map voting application built on React 19, Convex, and TanStack Router.

### Core Platform

- **React 19 + TypeScript + Vite 7** frontend with TanStack Router file-based routing
- **Convex real-time backend** with 8-table schema, 21 indexes, and full TypeScript type safety
- **Tailwind CSS 4** styling with shadcn/ui (base-vega) component library
- **Netlify deployment** with automatic Convex deploy on merge to main
- **Mobile-first responsive design** across all admin and player views

### Authentication & Security

- **Google OAuth** admin authentication via `@convex-dev/auth` with email-based whitelist
- **Player token authentication** via HTTP actions with IP locking and heartbeat validation
- **Admin management UI** with root admin protection and session invalidation
- **Rate limiting** on all mutations to prevent abuse
- **SSRF-safe URL validation** for external image URLs
- **CORS restriction** to `SITE_URL` in production with fail-closed behavior
- **Audit logging** — dual system: session-scoped `auditLogs` and global `adminAuditLogs`

### Voting Engine

- **ABBA ban format** — alternating ban turns with full validation chain
- **Multiplayer vote format** — simultaneous voting with round resolution and deadlock handling
- **Timer management** — per-session auto-ban/auto-vote on timeout via scheduled functions
- **Admin overrides** — `forceRandomSelection` (CSPRNG), `adminVoteOnBehalf`, session reset/clone
- **Round history, vote progress, and revote tracking** queries

### Session Lifecycle

- **Full state machine** — DRAFT → WAITING → ACTIVE → PAUSED → COMPLETE with centralized transition map
- **Disconnect detection & auto-pause** via heartbeat timeout cron
- **Auto-start** — sessions automatically start when all players are connected and ready
- **Persistent ready toggle** with audio notification on ready state changes
- **Audio consent gate** before lobby entry for browser autoplay compliance
- **Player auto-redirects** — lobby → vote → results transitions via `useSessionStatusRedirect`

### Admin Experience

- **Dashboard** with session overview, quick actions, and skeleton loading
- **Teams management** — CRUD with logo upload (Convex storage) and `TeamAvatar` component
- **Maps management** — CRUD with image upload/URL picker, active/inactive toggle
- **Session management** — create, configure, start, pause, resume, end, reset, clone, delete
- **Session detail page** — real-time player status, lobby URLs, GDPR-compliant IP redaction
- **Paginated lists** using `paginationOptsValidator` across all admin tables
- **Standardized empty states** with shared `EmptyState` component

### Player Experience

- **Lobby** — real-time map grid with staggered entrance animations, pulsing wait indicator
- **Voting interface** — tap-friendly map selection, vote confirmation UI, golden border feedback
- **Session paused overlay** — semi-transparent overlay during admin pause
- **Disconnected overlay** — exponential backoff reconnection with retry logic
- **3-state connection indicators** — Connected/Reconnecting/Disconnected badges
- **Session error states** — `SessionEndedPage` for expired sessions, `TokenErrorPage` for invalid tokens
- **Multiplayer round results reveal** — 3-second reveal phase with vote counts and winner banner

### Animation & Visual Polish

- **ABBA turn flash overlay** — green viewport-edge glow on your-turn transition
- **ABBA progress tracker** with map thumbnails and multiplayer round history table
- **Animated map ban/elimination transitions** — grayscale + stamp-in, staggered elimination
- **Winner celebration animation** — choreographed CSS-only sequence on results page
- **Turn transition animations** — banner crossfade, timer pulse, round fade-in
- **Skeleton loading screens** on all player pages and admin dashboard
- **Team logos** throughout all views with batch resolution
- **6 audio alerts** for voting events with mute toggle and autoplay unlock

### Observability & Monitoring

- **Sentry error tracking** — React 19 error hooks, `Sentry.ErrorBoundary`, session replay (error-only)
- **Source map upload** via `@sentry/vite-plugin` with post-upload cleanup and release tracking
- **Wide event structured logging** across all Convex functions with business context enrichment
- **PostHog analytics** with session replay, privacy-safe token sanitization, `VITE_PUBLIC_` env vars
- **Core Web Vitals monitoring** via `web-vitals` library (LCP, FID, CLS, FCP, TTFB)
- **ConvexError filtering**, browser noise suppression, extension error filtering

### Testing & Quality

- **700+ unit tests** via `convex-test` and Vitest across all backend modules
- **CI/CD pipeline** — GitHub Actions with typecheck, lint, test with coverage, and PR coverage comments
- **Coverage thresholds** enforced: 70% lines/branches/statements, 75% functions
- **100% coverage** on `admins.ts`, `playerAuth.ts`, `lib/auth.ts`

### Developer Experience

- **Comprehensive documentation** — CLAUDE.md, SPECIFICATION.md, architecture.md, convex_rules.md, sentry_rules.md
- **Code review todo tracking** system in `todos/` directory
- **Convex coding style guide** with module headers, section dividers, JSDoc, and error message conventions
- **Shared utility library** — validators, validation helpers, constants, type definitions, cascade delete
- **Pagination best practices** documentation

---

### Previous Pre-Release Versions

<details>
<summary>Click to expand pre-release changelog (v0.0.1 – v0.22.0)</summary>

## [0.22.0] - 2026-03-01 - Turn Transitions, Rate Limiting & Sentry (WAR-67, 72–73, PRs #91–94)

### Added

- **Turn transition animations** (WAR-67, PRs #91–92) — Banner crossfade, timer pulse, ABBA tracker transitions, and round fade-in for ABBA format
- **Rate limiting on all mutations** (WAR-72, PR #93) — Server-side rate limiting to prevent abuse
- **Sentry error tracking** (WAR-73, PR #94) — Full Sentry integration with `@sentry/react`:
  - React 19 error hooks (`onUncaughtError`, `onCaughtError`, `onRecoverableError`)
  - `Sentry.ErrorBoundary` in root layout as last-resort catch-all
  - TanStack Router `defaultErrorComponent` for admin routes, shared `PlayerRouteErrorComponent` for player routes
  - Session replay (error-only, privacy-first defaults with `maskAllText`/`blockAllMedia`)
  - Source map upload via `@sentry/vite-plugin` with post-upload cleanup
  - Release tracking tied to git commit SHA
  - ConvexError filtering, browser noise suppression, extension error filtering
  - Sentry rules documentation (`docs/sentry_rules.md`)

### Changed

- Sourcemap generation gated on Sentry upload configuration (`sentryUploadEnabled` flag)
- `initSentry` short-circuits when DSN is missing (no SDK initialization)
- Admin error fallback hides error details in production (`import.meta.env.DEV` guard)
- HMR-safe `unhandledrejection` handler with `import.meta.hot.dispose()` cleanup
- `execSync` in vite.config.ts wrapped in try/catch for non-git environments

---

## [0.21.0] - 2026-03-01 - Animation & Visual Polish (WAR-60–70, PRs #80–90)

This release completes the player experience polish phase and introduces a comprehensive animation system across all player-facing pages.

### Added

- **ABBA turn flash overlay** (WAR-69, PR #80) — Green viewport-edge glow pulse (~700ms) when it becomes your turn to ban, using `pointer-events: none` to avoid blocking interaction
- **ABBA progress tracker** (WAR-61, PR #81) — Extracted `ABBAProgressTracker` component showing completed bans with map thumbnails; multiplayer round history table with vote counts per round
- **Audio alerts** (WAR-62, PR #84) — HTML5 Audio sound effects for 6 voting events (your-turn, ban-confirmed, round-resolved, winner, countdown-warning, error); `AudioManager` singleton with preloading, mute toggle persisted to localStorage, autoplay unlock on first gesture
- **Skeleton loading screens** (WAR-65, PR #85) — Layout-matching skeleton screens replace spinner on lobby, vote, results, and admin dashboard; each mirrors actual grid columns, aspect ratios, and responsive breakpoints
- **Team logos integration** (WAR-71, PR #86) — `TeamAvatar` component with deterministic color fallbacks and 2-letter initials; `resolveTeamLogos()` shared backend utility for batch logo resolution; logos shown in admin lobby, player lobby, voting status bar, ABBA progress tracker, results page, and session detail
- **Animated map transitions** (WAR-63, PR #87) — ABBA ban: 0.5s grayscale + red X stamp-in overlay; multiplayer elimination: 0.8s staggered grayscale per card (150ms intervals); winner pulse: amber/gold one-shot glow; `useMapAnimations` hook for detecting AVAILABLE→BANNED via Convex subscription diffs
- **Winner celebration animation** (WAR-64, PR #88) — Choreographed CSS-only sequence on results page: trophy bounce → card slide-up → winner glow pulse → ban history fade → staggered map grid entrance; reuses `stamp-in` and `winner-pulse` keyframes
- **Standardized empty states** (WAR-68, PR #89) — Shared `EmptyState` component (`src/components/ui/empty-state.tsx`) with `"page"` and `"card"` variants using discriminated union TypeScript type; replaces 5 inline implementations across admin pages
- **Lobby entrance animations** (WAR-66, PR #90) — Pulsing "Waiting for admin..." text; staggered `animate-in fade-in` + 50ms delay per map card on lobby; staggered map card entrance on vote page first mount
- **Animation system documentation** — `docs/solutions/animation-system.md` catalogs all custom keyframes, tw-animate-css utilities, JS-managed animation state, CSS transitions, decision criteria, accessibility conventions, and z-index layering

### Changed

- **Multiplayer voting logic** (WAR-70, PR #82) — 3-rule ban strategy: (1) unvoted maps exist → ban all voted maps, (2) all maps voted + partial tie → ban highest, (3) global tie → deadlock/revote
- **Timer expiration** (WAR-70, PR #82) — Random selection now uses CSPRNG for fairness; timer wording updated
- **Session pause/resume** (PR #83) — `isRevoteRound` flag preserved through pause/resume to prevent infinite deadlock loops

### Fixed

- **Revote deadlock loop** (PR #83) — `resumeSession` was clearing `isRevoteRound`, causing infinite REVOTE cycles instead of triggering random selection on second tie
- **Stakeholder feedback** (WAR-70, PR #82) — Timer, voting logic, and UX fixes from user testing session

### Technical Notes

- **4 custom CSS keyframes** in `src/index.css` `@theme` block: `border-flash` (700ms), `stamp-in` (400ms), `timer-pulse` (300ms), `winner-pulse` (1.5s)
- **Accessibility**: All decorative animations use `motion-safe:` prefix; functional spinners use bare `animate-spin`
- **Z-index scale**: z-40 (overlays) → z-[45] (priority overlays) → z-50 (dialogs) → z-[100] (toasts)
- **New shared modules**: `src/hooks/useMapAnimations.ts`, `src/lib/animation.ts`, `convex/lib/teamLogos.ts`, `src/components/session/team-avatar.tsx`

---

## [0.20.0] - 2026-02-23 - Session Error States for Active Players (WAR-60, PR #78)

### Added
- **`SessionEndedPage` component** (`src/components/session/SessionEndedPage.tsx`) — Full-page error component for terminal session states (EXPIRED, ENDED_BY_ADMIN, DELETED) with per-reason icon, title, and message
- **EXPIRED session guards** on lobby and vote pages — detects EXPIRED status and renders `SessionEndedPage` instead of broken/frozen UI
- **Heartbeat stop on EXPIRED** — `usePlayerAuth` accepts `sessionExpired` option to stop heartbeat interval and retry timers when session reaches terminal state, preventing unnecessary DB writes
- **Latching pattern** — `sessionExpired` state latches to `true` once detected to prevent flash of loading spinner when subscription is skipped

### Changed
- **`usePlayerAuth` hook** — Added `UsePlayerAuthOptions` interface with `sessionExpired` boolean; `isSubscriptionActive` now checks `!sessionExpired`
- **Icon type** in `SessionEndedPage` — Uses `LucideIcon` type instead of `typeof Clock` for proper icon prop typing

### Technical Notes
- Separate `useEffect` for cleanup avoids re-running the main auth/heartbeat lifecycle
- TypeScript narrowing limitation: `case "EXPIRED"` kept in `getWaitingMessage()` switch because TS doesn't propagate early-return narrowing through destructuring

---

## [0.19.0] - 2026-02-23 - Player Reconnection Flow (WAR-57, PR #77)

### Added
- **Exponential backoff retry** in `usePlayerAuth` — 2s, 4s, 8s, 16s delays on heartbeat network failure instead of transitioning to permanent error
- **`disconnected` auth state** — New state after all retries exhaust with manual "Retry Connection" button
- **`DisconnectedOverlay` component** — Shows reconnection progress with retry attempt counter, accessible UI (ARIA live region, focus management, scroll lock)
- **Tab visibility handler** — Immediate heartbeat when tab regains focus via `visibilitychange` + `pageshow` (iOS bfcache) with 2s debounce
- **Per-request timeout** — `AbortSignal.timeout(8s)` keeps retry window predictable

### Changed
- **Two-mode heartbeat system** — Normal 30s `setInterval` switches to chained `setTimeout` with backoff on network failure
- **Error distinction** — Network errors → retry → `disconnected`; server auth errors → permanent `error`

### Technical Notes
- `DisconnectedOverlay` at `z-[45]` (above `SessionPausedOverlay` z-40, below dialogs z-50)
- Manual `retry()` re-validates token from scratch via `retryTrigger` counter

---

## [0.18.0] - 2026-02-22 - 3-State Connection Status Indicators (WAR-56, PR #76)

### Added
- **`ConnectionStatusBadge` component** — Reusable 3-state indicator (Connected/Reconnecting/Disconnected) with dot, optional label, size variants, and WCAG accessibility (`role="status"`, `aria-label`)
- **`computeConnectionStatus()` helper** — Server-side derivation from `isConnected` + `lastHeartbeat` staleness
- **`connectionStatusValidator`** added to shared validators
- **`HEARTBEAT_INTERVAL_MS`** moved to server-side constants for shared use

### Changed
- **Player-facing and admin-facing queries** — `toSanitizedPlayer` and `toAdminPlayer` now include `connectionStatus` field
- **Heartbeat disconnect cron** — Extended to scan WAITING sessions (marks disconnected but does NOT auto-pause)
- **`usePlayerAuth` hook** — Added `reconnecting` state with consecutive heartbeat failure tracking (1 miss → reconnecting, 2+ → error)

---

## [0.17.0] - 2026-02-22 - Multiplayer Round Results Reveal (WAR-58, PR #75)

### Added
- **3-second reveal phase** after multiplayer voting round completes — shows round results before auto-advancing to next round
- **Eliminated maps** display vote counts, grayscale overlay, and red X marker
- **Surviving maps** get "Safe" badge with green ring
- **Previously eliminated maps** from prior rounds shown in smaller section below main grid
- **Winner determination** — 5-second "WINNER!" banner with trophy icons and gold highlights before redirecting to `/results`
- **Deadlock display** — "Deadlock! Revoting with same maps..." banner for 3 seconds
- **`usePrevious` hook** — Detects `currentRound` changes from Convex subscription to trigger reveals
- **`useRevealTimer` hook** — Pause-aware countdown timer for reveal phases

### Changed
- **Server timer offset** — `timerStartedAt` offset by 3 seconds so players get full configured timer after reveal phase
- **`useSessionStatusRedirect`** suppressed during reveal phases by passing `undefined` data

### Technical Notes
- Client-side reveal phase using `useReducer` state machine (`VOTING` → `REVEALING` → `VOTING` / `WINNER_REVEAL` → `REDIRECTING`)
- Pause support: reveal timer pauses when session is paused by admin, resumes on unpause
- Accessibility: ARIA live region announces round results, `motion-safe:` prefix respects `prefers-reduced-motion`

---

## [0.16.0] - 2026-02-20 - Session Paused Overlay (WAR-55, PR #74)

### Changed
- **Paused state on vote page now shows semi-transparent overlay** instead of full-page replacement — players retain visual context of map grid, timer, and turn order while the session is paused
- Overlay uses `backdrop-blur-sm` and `bg-black/50` for readability with underlying content visible
- All interaction beneath overlay disabled via HTML `inert` attribute (pointer, keyboard, assistive tech)
- Overlay auto-dismisses reactively when admin resumes session (Convex subscription)

### Added
- **`SessionPausedOverlay` component** (`src/components/session/SessionPausedOverlay.tsx`) — centered Card with spinner, "Session Paused" heading, focus management, scroll lock, and mobile-responsive sizing
- Accessible dialog semantics (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) for screen reader announcement on pause

### Technical Notes
- Overlay at `z-40` (below `z-50` AlertDialog and Sonner toasts)
- `CountdownTimer` already handles pause via `timerPausedAt` — no timer changes needed
- Uses `tw-animate-css` `animate-in fade-in duration-200` for enter animation

---

## [0.15.0] - 2026-02-19 - Player Session State Auto-Redirects (WAR-54, PR #73)

### Added
- **`useSessionStatusRedirect` hook** — reactive session status subscription that auto-redirects players between lobby, vote, and results pages based on session state transitions
- Lobby page auto-redirects to `/vote` when session starts (WAITING → IN_PROGRESS)
- Vote page auto-redirects to `/results` when session completes (IN_PROGRESS → COMPLETE)
- Results page redirects away if session is not in a terminal state

### Technical Notes
- Uses `getSessionStatusByToken` lightweight query (avoids full session payload)
- Redirect sets are explicit per page to prevent redirect loops
- PAUSED status excluded from vote page redirects (players stay on vote page)

---

## [0.14.1] - 2026-02-19 - Return Validator Bug Fix

### Fixed
- **`sessionMapObjectValidator` missing `submittedByAdmin` field** — Hand-written return validator in `convex/sessions.ts` was missing `submittedByAdmin: v.optional(v.boolean())`, causing `ReturnsValidationError` at runtime when `getSession` returned session maps with the `submittedByAdmin` property. Convex return validators are strict and reject undeclared properties.

### Technical Notes
- Audited all 40+ Convex functions for validator/schema mismatches — this was the only issue found
- 3 queries without `returns` validators (`listSessions`, `listSessionsForDashboard`, `listTeams`) intentionally left without validators to avoid future drift bugs
- TypeScript, lint, and all 840 tests pass clean

---

## [0.14.0] - 2026-02-15 - Phase 5: Disconnect Detection & Auto-Pause (WAR-49, PR #68)

### Added
- **`checkHeartbeatTimeouts` internal mutation** (WAR-49) — Cron-triggered disconnect detection that runs every 30 seconds to scan IN_PROGRESS sessions for stale heartbeats
- **`HEARTBEAT_TIMEOUT_MS` constant** — 60-second timeout (2× client `HEARTBEAT_INTERVAL_MS`) to tolerate one missed heartbeat and avoid false positives
- **Auto-pause on disconnect** — ABBA: pauses for ANY player disconnect (both must be present); MULTIPLAYER: pauses only for unvoted player disconnect
- **Fresh session read before pause** — Prevents stale-state rollback if session was completed by another mutation during processing
- **`PLAYER_DISCONNECTED` audit events** — Logged with `actorType: "SYSTEM"` for each newly disconnected player
- **10 unit tests** — Detection (marks stale, skips fresh, skips already disconnected, logs audit), ABBA auto-pause (any disconnect, timerPausedAt, audit reason), MULTIPLAYER auto-pause (unvoted pauses, voted doesn't), edge cases (no sessions, multiple sessions, status change guard)

### Technical Notes
- Uses `transitionSession` directly instead of `pauseSession` mutation (which requires admin auth context)
- Detection latency: worst case ~90 seconds (60s timeout + 30s cron interval)
- Reconnection handled implicitly by heartbeat endpoint (`playerAuth.ts`) setting `isConnected: true`; admin must manually resume paused session

---

## [0.13.0] - 2026-02-15 - Phase 5: Admin Session Controls & Timer Expiration (WAR-47–48, PRs #66–67)

### Added
- **Timer expiration scheduled function** (WAR-47, PR #66) — Per-session timer expiration via `ctx.scheduler.runAt()` with guard-based no-op pattern for race condition safety
  - ABBA: auto-bans random available map for idle player on timeout
  - MULTIPLAYER: auto-votes random map for each unvoted player on timeout
  - Guard checks: session status, `timerStartedAt` match, `timerPausedAt` absence
  - Timers scheduled at all 5 start points: `startSession`, `resumeSession`, `executeBan`, `resolveRound` (ROUND_ADVANCED), `resolveRound` (REVOTE)
  - 15 unit tests for guard no-ops, ABBA auto-ban, and MULTIPLAYER auto-vote scenarios
- **Shared voting helpers** (`convex/lib/votingHelpers.ts`) — Extracted `executeBan`, `executeVote`, `resolveRound`, `validateTargetMap` from `convex/voting.ts` for reuse by timer expiry and admin vote-on-behalf
- **Timer scheduling helper** (`convex/lib/timerScheduling.ts`) — `scheduleTimerExpiry` wraps `ctx.scheduler.runAt()` with proper format/timestamp args
- **Admin session control buttons wired** (WAR-48, PR #67) — All admin action buttons on session detail page now functional:
  - Finalize (DRAFT → WAITING), Start (WAITING → IN_PROGRESS), Pause/Resume toggle
  - End Session and Force Random Selection with confirmation dialogs
  - Reset (COMPLETE → WAITING) and Clone (any state → new DRAFT) with confirmation
  - Vote/Ban on Behalf with map selection dialog for disconnected/timed-out players
  - View Results link for completed sessions
  - Loading states, toast notifications, and error handling throughout

---

## [0.12.0] - 2026-02-13 - Phase 5: Session Management Mutations (WAR-42–46, PRs #61–65)

### Added
- **Timer management in voting mutations** (WAR-42, PR #61) — Reset `timerStartedAt` on turn/round advances and clear timer fields on session completion so player UI countdown works beyond the first turn/round
- **`forceRandomSelection` mutation** (WAR-43, PR #62) — Admin action to randomly select a winner from remaining available maps, immediately completing an active or paused session. Uses CSPRNG for competitive integrity. Logs `RANDOM_SELECTION` and `WINNER_DECLARED` audit events
- **`adminVoteOnBehalf` mutation** (WAR-44, PR #63) — Allow admins to submit a ban (ABBA) or vote (MULTIPLAYER) on behalf of a disconnected or timed-out player. Adds `submittedByAdmin` field to `sessionMaps` schema
- **`resetSession` mutation** (WAR-45, PR #64) — Session reset for replay. Clears all voting data (votes, map ban metadata, player vote state) and returns COMPLETE → WAITING while preserving configuration and player assignments. Extends `expiresAt` by 2 weeks
- **`cloneSession` mutation** (WAR-46, PR #65) — Duplicates a session's configuration into a new DRAFT session. Copies players (fresh tokens) and maps (reset to AVAILABLE) but NOT votes, audit logs, or timer state. Source can be in any status
- **~100 unit tests** across WAR-42–46 covering timer resets, force random selection, admin vote-on-behalf for both formats, session reset with data cleanup, clone with data isolation

### Changed
- **`sessionMaps` schema** — Added optional `submittedByAdmin` boolean field (WAR-44)

---

## [0.11.0] - 2026-02-11 - Phase 5: Session Lifecycle Mutations (WAR-38–41, PR #60)

### Added
- **`finalizeSession`** (WAR-38) — DRAFT → WAITING transition with `guardFinalize` (validates player count and map pool size)
- **`startSession`** (WAR-39) — WAITING → IN_PROGRESS with `guardStart` (checks player connectivity), sets `startedAt`, `timerStartedAt`, `currentTurn`, `currentRound`
- **`pauseSession`** (WAR-40) — IN_PROGRESS → PAUSED, records `timerPausedAt`, optional reason in audit log
- **`resumeSession`** (WAR-40) — PAUSED → IN_PROGRESS with timer arithmetic preserving elapsed time, clears `isRevoteRound` per schema TODO
- **`endSession`** (WAR-41) — Any active state → COMPLETE (admin force-end), clears timer fields, sets `completedAt`
- **39 unit tests** covering happy paths, guard failures, wrong-status rejections, audit logging, timer preservation, and force-end from all active states
- All mutations use `transitionSession` helper from WAR-37 for atomic validate + patch + audit

### Technical Notes
- `validateTransition()` is called before guard functions for correct error ordering (fast-fail on invalid transitions)
- Timer resume arithmetic: `elapsed = timerPausedAt - timerStartedAt`, then `adjustedTimerStart = now - elapsed`
- IP cleanup deferred to existing hourly cron (`clearCompletedSessionIps`) — `ctx.scheduler.runAfter` incompatible with convex-test

---

## [0.10.0] - 2026-02-11 - Phase 5: Session Lifecycle Helpers (WAR-37, PR #59)

### Added
- **Session state transition map** — `VALID_TRANSITIONS` in `convex/lib/constants.ts` defines all valid state transitions across 6 statuses (DRAFT, WAITING, IN_PROGRESS, PAUSED, COMPLETE, EXPIRED)
- **`validateTransition`** — Pure function that throws `ConvexError` with descriptive message on invalid transitions, including terminal state detection
- **`guardFinalize`** — Async guard for DRAFT→WAITING checking player count and map pool size
- **`guardStart`** — Async guard for WAITING→IN_PROGRESS checking player count and connectivity (IP activation)
- **`transitionSession`** — Atomic helper that validates transition, patches session, and logs audit event in a single Convex transaction
- **`SessionStatePatches` type** — Narrowed type restricting patchable fields to 8 runtime state fields only
- **`TransitionOptions` interface** — Options object pattern for `transitionSession` (auditAction, actorType, actorId, patches, auditDetails)
- **`SESSION_RESET_PATCHES`** — Predefined reset patches for COMPLETE→WAITING session reset (for WAR-45)
- **New audit actions** — `SESSION_RESET` and `SESSION_CLONED` added to `AuditAction` type and validators
- **60 unit tests** — Full coverage for transition validation, guard functions, atomic transitions, edge cases

---

## [0.9.0] - 2026-02-11 - Phase 4: Voting Module

Complete voting system for both ABBA (2-player ban) and Multiplayer (simultaneous voting) formats. Includes backend mutations, HTTP endpoints, round resolution with deadlock handling, frontend wiring, vote confirmation UI, GDPR compliance, and comprehensive test coverage (100+ voting tests).

### Added

#### Voting Unit Tests (WAR-20, PR #58)
- **Comprehensive voting coverage** — Tests for session expiry guards, revote audit log verification, cross-round vote isolation, explicit round parameter in vote factory
- **Post-resolve safety documentation** — Documents behavior when votes arrive after round resolution

#### Multiplayer Vote Confirmation UI (WAR-37, PR #57)
- **Golden border indicator** — After confirming a vote in MULTIPLAYER mode, the voted map shows a golden amber ring (`ring-2 ring-amber-400`) while waiting for other players
- **"Your vote" text label** — Accessibility-compliant non-color indicator below the voted map name (WCAG 1.4.1)
- **`playerVotedMapId` in `getSessionByToken`** — Backend returns the current player's voted map ID using the existing `by_playerId_and_round` index; auto-clears on round transition
- **Server-derived state with optimistic UI** — Persists across page refresh, syncs across tabs; optimistic `useState` bridges the gap between HTTP response and Convex subscription update

#### Frontend Vote Submission Wiring (WAR-36, PR #56)
- **Vote submission fetch calls** — Replaced console.log stubs with actual `fetch()` calls to `/api/player/submit-ban` and `/api/player/submit-vote` HTTP endpoints
- **Shared `SITE_URL` utility** — `src/lib/convexHttp.ts` extracts Convex HTTP action URL with runtime validation, shared by `usePlayerAuth.ts` and `vote.$token.tsx`
- **Unified action handler** — Merged duplicate `confirmBan`/`confirmVote` into single `submitAction` with `pendingAction.type` discriminant
- **Single confirmation dialog** — Collapsed two `AlertDialog` components into one with conditional title/description/button text
- **Error handling** — `res.ok` check, `AbortSignal.timeout(10_000)`, typed response, `VotingErrorCode` union type with all 12 known error codes
- **Auto-dismiss effects** — Dialog auto-closes when map becomes unavailable or turn expires (reactive Convex query)
- **`console.error` logging** — Vote submission catch block now logs errors for debugging

#### Voting Query Enhancements (WAR-35, PR #55)
- **`roundHistory`** — Structured round-by-round ban history in `getSessionByToken` response, derived from existing sessionMaps data
- **`buildRoundHistory` helper** — Groups banned maps by turn (ABBA) or round (MULTIPLAYER), works for both active and completed sessions
- **`voteProgress`** — Aggregate vote count for MULTIPLAYER IN_PROGRESS sessions (`totalPlayers`, `votedCount`, `allVoted`) without revealing individual choices
- **`isRevoteRound`** — Exposed in session data for deadlock revote UI state
- **`completedRounds`** — Derived completed rounds count for progress tracking
- **Refactored `buildSessionResults`** — Now delegates to `buildRoundHistory` internally, eliminating code duplication
- **17 new unit tests** across 5 groups: roundHistory, voteProgress, isRevoteRound, completedRounds, privacy enforcement, GDPR

#### Round Resolution & Deadlock Handling (WAR-34, PR #54)
- **`resolveRound` helper** — Auto-triggers inside `submitVote` when all players have voted in a multiplayer round
- **Vote tallying** — Counts votes per map, bans maps with ≥1 vote, advances game state
- **Deadlock detection** — When all remaining maps are banned (tied votes), triggers a revote round with `isRevoteRound=true`
- **Double deadlock → random selection** — If revote produces the same deadlock, randomly selects a winner from the pre-ban pool
- **`isRevoteRound` schema field** — Optional boolean on sessions table to track deadlock state
- **2 new audit actions** — `ROUND_REVOTE_TRIGGERED`, `REVOTE_DEADLOCK_RANDOM_SELECTION`
- **28 unit tests** across 5 groups: normal resolution, deadlock→revote, double deadlock→random, audit logging, edge cases
- **Stakeholder scenario covered** — 4 maps, 4 players, each votes different → deadlock → revote → same → random winner

#### Multiplayer submitVote Mutation (WAR-33, PR #53)
- **`submitVote` internalMutation** — Multiplayer voting with full validation chain (IP → token → session → format → round → duplicate vote)
- **HTTP endpoint** `POST /api/player/submit-vote` with CORS preflight support
- **Vote tracking** — Records individual votes in `votes` table, updates `voteCount` on session maps, tracks `hasVotedThisRound` per player
- **Shared helpers** — Deduplicated `lookupAndValidatePlayer`, `requireAvailableSessionMap`, and HTTP handler patterns with ABBA module
- **25 unit tests** across 5 groups: validation errors, happy path, duplicate/round tracking, audit logging, edge cases

#### Voting Module & ABBA submitBan Mutation (WAR-32, PR #52)
- **`convex/voting.ts`** — New voting module with `submitBan` internalMutation for ABBA map ban flow
- **ABBA turn pattern** `[0, 1, 1, 0]` — Player 0 bans first, then Player 1 twice, then Player 0 again
- **Full validation chain**: IP → token → expiry → IP match → session status → format → turn order → map availability (cross-session guard)
- **Auto-winner declaration** when all bans complete (`mapPoolSize - 1` bans), marks last map as WINNER and session as COMPLETE
- **Audit logging**: `MAP_BANNED` and `WINNER_DECLARED` events logged atomically within the same transaction
- **HTTP endpoint** `POST /api/player/submit-ban` with CORS preflight support
- **32 unit tests** across 5 groups: validation errors, happy path, completion logic, audit logging, edge cases
- **Dynamic map pool support** — works with any pool size (3, 5, 7, etc.), not hardcoded to 5
- **LAN-safe** — allows same IP for both players

### Changed

#### GDPR: IP Address Redaction (WAR-35)
- **Admin session detail** — `ipAddress` field removed from `getSession` query response, replaced with boolean `isIpLocked`
- **Frontend** — Orange IP badge now shows "IP Locked" instead of actual IP address
- **Validator** — `sessionPlayerObjectValidator` renamed to `adminPlayerObjectValidator` with `isIpLocked` replacing `ipAddress`

---

## [0.8.0] - 2026-02-05 - Phase 3 Complete: Authentication & Admin UX

Phase 3 complete! Full authentication system with admin whitelist, player token auth, OAuth login, audit logging, and comprehensive test coverage. Plus admin UX improvements.

### Added

#### Show Full Lobby URLs (WAR-31, PR #51)
- **Full lobby URLs** displayed in session detail page instead of raw 32-char tokens
- **"Copy All Links"** button copies all player URLs as formatted list (`Team Name: URL`)
- **Unified copy handler** with `lastCopied` state — eliminates duplication, prevents timeout race conditions

#### Auth System Tests (WAR-30, WAR-21, PR #50)
- **Comprehensive auth test coverage**; 481 total tests passing (11 skipped)
- **`convex/authCallback.test.ts`** (6 tests) — `extractProfileString` pure function, documented untestable callback paths
- **`convex/http.test.ts`** (20 tests) — `extractClientIp` parsing incl. IPv6/edge cases, `getCorsHeaders` CORS origin logic with env mocking
- **Extended `convex/playerAuth.test.ts`** (+17 tests) — IP validation edge cases, `"unknown"` IP rejection, reconnection logging, heartbeat throttling, token expiry boundary
- **Extended `convex/admins.test.ts`** (+18 tests) — `invalidateAdminSessions` success cases, audit log pagination, consolidated auth helper tests
- **Deleted `convex/lib/auth.test.ts`** — duplicate tests consolidated into `admins.test.ts`
- **Shared `createAuthenticatedAdmin`** helper in `test.setup.ts` now accepts overrides
- **100% coverage** on `admins.ts`, `playerAuth.ts`, and `lib/auth.ts`

### Changed

- Exported `extractProfileString` from `convex/auth.ts` for direct testing
- Exported `extractClientIp` and `getCorsHeaders` from `convex/http.ts` for direct testing
- Updated dependencies: react 19.2.4, convex 1.31.7, @tanstack/react-router 1.158.1, typescript-eslint 8.54.0, shadcn 3.8.3

#### Auth Event Logging (WAR-29, PR #49)
- **`ADMIN_LOGIN` audit event** — logged to `adminAuditLogs` when whitelisted admin signs in via Google OAuth
- **`PLAYER_CONNECTED` audit event** — logged to session `auditLogs` on actual reconnections (not every page load)
- **Documented `ADMIN_LOGIN_DENIED` limitation** — Convex transactional rollback prevents persisting audit logs when `ConvexError` is thrown
- **Extracted duplicated name/avatar update logic** in auth callback into shared pattern

#### Branding & Polish (WAR-28, PR #48)
- **WTCS logo** integrated into login page and admin sidebar header (clickable link to dashboard)
- **Mobile padding fixes** on create session and admin settings pages (hamburger menu overlap)
- **Settings page layout** restructured for mobile responsiveness with table overflow handling
- **Centralized mobile padding** in `admin.tsx` layout (`pl-16 md:pl-0`)
- **Removed placeholder assets** (`placeholder-logo.svg`, `placeholder-logo.png`)

#### Protected Routes & Server-Side Auth (WAR-27, PR #47)
- **Derive `createdBy` server-side** from `requireAdmin(ctx)` in `createSession` — removed client-supplied `createdBy` arg
- **Added `requireAdmin`** to read queries (`listMaps`, `getMap`, `listTeams`) preventing unauthenticated data access
- **Restricted CORS** to `SITE_URL` env var in production with `Vary: Origin` header; falls back to `*` in local dev; fails closed in Convex Cloud when `SITE_URL` is missing
- **Deleted `getFirstAdmin`** temporary workaround query
- **Updated all tests** for auth context requirements and removed obsolete `createdBy` validation tests

#### OAuth Login Documentation (PR #46)
- **Solution doc** for three OAuth login root causes from PR #45
- **CLAUDE.md** updated with auth pattern guidance (`getAuthUserId` vs `ctx.auth.getUserIdentity()`)

#### Phase 3: Authentication - Player Token Auth & OAuth Fixes (WAR-26, PR #45)
- **Server-side player token validation** via HTTP actions (`POST /api/player/validate-token`, `POST /api/player/heartbeat`)
- **IP locking** on first token use — prevents link sharing between devices
- **`usePlayerAuth` hook** (`src/hooks/usePlayerAuth.ts`) — HTTP-based token validation with heartbeat, AbortController cleanup, visibility-state awareness
- **Security hardening**: `requireAdmin` on 5 unauthenticated admin queries (sessions + audit), `Referrer-Policy: same-origin` header, token invalidation on session cleanup
- **Audit logging**: `TOKEN_ACTIVATED`, `TOKEN_IP_BLOCKED` events
- **22 new unit tests** for `playerAuth` module; 431 total tests passing
- **Solution documentation**: `docs/solutions/integration-issues/convex-auth-oauth-login-failures.md`

#### Phase 3: Authentication - Admin Whitelist System (WAR-25)
- **Admin whitelist table** (`admins`) with email-based access control
- **`by_isRootAdmin` index** for efficient role-based queries
- **Root admin protection** - Cannot remove/demote the last root admin
- **Admin management UI** (`/admin/settings`) - Add, remove, promote, demote admins
- **Session invalidation** - Force logout removed/modified admins by deleting auth sessions
- **Admin audit logging** (`adminAuditLogs` table) - Track all admin management actions
- **Backend auth enforcement** on all admin mutations (maps, teams, sessions)
- **Route auth guard** in admin layout - Redirects unauthenticated users to login
- **Type-safe OAuth profile extraction** - Helper function for `@convex-dev/auth` callbacks
- **`getAdmin` and `getAdminByEmail` queries** for admin lookup
- **Comprehensive unit tests** - 409 tests covering all admin functionality
- **Solution documentation** in `docs/solutions/`:
  - `convex-patterns/type-safe-oauth-profile-extraction.md`
  - `convex-patterns/boolean-index-for-role-queries.md`
  - `test-failures/convex-test-auth-whitelist-pattern.md`
  - `integration-issues/github-graphql-api-queries-with-gh-cli.md`

### Fixed

#### OAuth Login Failures (WAR-26, PR #45)
- **`getCurrentAdmin()` JWT fix** — was reading `identity.email` from JWT which `@convex-dev/auth` doesn't include; now uses `getAuthUserId()` to look up email from `users` table
- **Return validator mismatch** — admin queries returned `_creationTime` not in validators; added `toAdminResponse()` helper to strip system fields
- **OAuth callback race condition** — `beforeLoad` redirect stripped `?code=` before ConvexAuthProvider could process it (worked ~1 in 8 attempts); replaced with component-level redirect and `sessionStorage` flag
- **Stale refresh tokens** — `signOut()` before `signIn()` in OAuth flow to clear stale tokens
- **Test setup for `getAuthUserId`** — identity subject now uses `userId|sessionId` format with `users` table record

### Changed
- **convex/auth.ts** - Uses `extractProfileString()` helper for type-safe profile field access
- **convex/auth.ts** - Uses `by_email` index for whitelist lookup (was `.filter()`)
- **All test files** - Migrated to use `createAuthenticatedAdmin()` helper for auth context

### Fixed
- **Email normalization** in user lookup - Consistent lowercase comparison
- **ConvexError usage** - Replaced `Error` with `ConvexError` for consistent error handling
- **Unused imports** removed from test files (lint errors)

#### Phase 3: Authentication - Login UI & Logout (WAR-24)
- **Google OAuth provider** added to `convex/auth.ts`
- **`getCurrentUser` query** (`convex/admins.ts`) - Returns authenticated user info (name, email, picture) from `ctx.auth.getUserIdentity()`
- **Real logout** in admin sidebar - Uses `signOut()` from `@convex-dev/auth/react` with error handling
- **Real user display** in admin sidebar - Shows Google profile name, email, and picture
- **Sticky sidebar** on desktop (`md:sticky md:top-0 md:h-screen`) - Logout button always visible
- **Login page improvements**:
  - Loading state with spinner during OAuth flow
  - Window focus listener to reset loading state on popup cancel
  - Enhanced styling with gradients, animations, and accessibility
  - Mobile-responsive design with proper touch targets
- **Code review todo files** created for P1 auth issues (deferred to separate Linear issue):
  - `010-pending-p1-missing-backend-auth-on-mutations.md`
  - `011-pending-p1-missing-route-auth-guard.md`

### Changed
- **`buttonVariants`** (`src/components/ui/variants.ts`) - Added `cursor-pointer` to base styles
- **Mobile sidebar header** - Added `pl-14 md:pl-6` padding to prevent hamburger menu overlap

### Fixed
- **Logout error handling** - Try/catch with `finally` block ensures navigation to login even if signOut fails
- **Login loading state** - Now resets on OAuth popup cancel via window focus event

#### Phase 3: Authentication - Convex Auth Setup (WAR-23)
- **Convex Auth infrastructure** installed and configured (`@convex-dev/auth`, `@auth/core@0.37.0`)
- **7 auth tables** added via `authTables` spread in schema:
  - `users` - User profiles from OAuth
  - `authAccounts` - Links users to auth providers
  - `authSessions` - Active session tracking
  - `authRefreshTokens` - Token refresh management
  - `authVerificationCodes` - OTP/magic link codes
  - `authVerifiers` - PKCE verifiers for OAuth
  - `authRateLimits` - Rate limiting for auth
- **Auth module files** created:
  - `convex/auth.ts` - Auth exports (signIn, signOut, etc.)
  - `convex/auth.config.ts` - Provider configuration with env var validation
  - `convex/http.ts` - HTTP router with auth callback routes
- **ConvexAuthProvider** replaces ConvexProvider in React entry point
- **Environment variable validation** added for `CONVEX_SITE_URL` and `VITE_CONVEX_URL` (fail-fast)
- **Dependency pinned**: `@convex-dev/auth` pinned to exact version `0.0.90` (pre-1.0 stability)

### Changed
- Updated all dependencies to latest versions (Convex 1.31.6, TanStack Router 1.157.12, etc.)

---

## [0.7.0] - 2026-01-25 - Phase 2: Wire UI to Convex

Phase 2 complete! All admin and player pages are now wired to Convex with real-time data.

### Added

#### Convex React Integration (WAR-5)
- **Convex React helper** (`src/lib/convex.ts`): Re-exports hooks and API for cleaner imports
- **ConvexProvider** properly configured in `main.tsx`
- **Consistent loading patterns** across all pages using `Loader2` spinner
- **TypeScript type flow** from Convex to React with `Id<>` and `Doc<>` types

#### Admin Dashboard (WAR-8)
- `listSessionsForDashboard` paginated query with player enrichment (assignedPlayerCount, teams)
- Server-side filtering excludes COMPLETE/EXPIRED sessions from active view
- Explicit field selection (no spread) prevents data over-exposure
- `SessionCard` rewritten with schema-derived types (`Pick<Doc<"sessions">, ...>`)
- `CompletedSessionRow` component for inactive sessions
- shadcn/ui Accordion for collapsible completed/expired section
- Shared `formatTeamDisplay` utility (`src/components/session/utils.ts`)
- 9 unit tests for the dashboard query (enrichment, filtering, pagination)

#### Teams Page (WAR-6)
- **Sessions count column** showing how many sessions each team is in
- **AlertDialog** for delete confirmation (replaces native `confirm()`)
- Full CRUD wired to Convex mutations
- 42 unit tests covering all team operations

#### Maps Page (WAR-7)
- Card grid layout with 16:9 aspect ratio images
- Add/edit dialogs with `ImageSourcePicker` for upload/URL images
- Active/inactive toggle with visual distinction
- Deactivate confirmation with reactivate option
- 46 unit tests covering all map operations

#### Create Session Form (WAR-9)
- Atomic `createSession` mutation with player and map assignment in single transaction
- Form validation with backend constants imported from `convex/lib/constants.ts`
- Real-time team and map data from Convex queries
- Submit button disabled when turn timer is invalid
- Loading states and error handling

#### Session Detail Page (WAR-10)
- `getSessionDetail` query with full session data, players, maps, and audit logs
- Real-time subscriptions for live session updates
- Proper handling of Convex IDs as opaque strings (not numeric validation)
- Accessibility improvements (aria-label on copy button)
- Loading and error states for session detail view

#### Player Pages (WAR-11)
- Player lobby page (`/lobby/$token`) with real-time session subscription
- Player voting page (`/vote/$token`) with map ban/pick UI
- Results page (`/results/$sessionId`) with final session outcomes
- `TokenErrorPage` component for invalid/expired token handling
- Real-time player connection status

#### Documentation
- Solution documentation for test failures (`docs/solutions/test-failures/`)
- Documented that Convex tests must use `bun run test` (vitest), not `bun test`

### Fixed
- **Admin Loading Spinner Centering**: Loading spinners in admin pages (dashboard, teams, maps, session detail) are now properly centered vertically and horizontally

### Changed
- CLAUDE.md: Emphasized correct test runner (`bun run test` not `bun test`)

---

## [0.6.0] - 2026-01-20

### Added
- **Session Maps Edge Case Tests** (WAR-19):
  - Audit log on reassignment with content verification
  - Boundary tests at MIN_MAP_POOL_SIZE (3) and MAX_MAP_POOL_SIZE (15)
  - Snapshot persistence when source map is updated or deactivated
  - Edge cases: long names (100 chars), special characters/unicode, multiple sessions isolation
  - Rapid sequential reassignments verification
  - Optional field initialization tests
  - Uses constants from `convex/lib/constants.ts` for maintainability
- **Session Players Edge Case Tests** (WAR-18):
  - Token expiry handling with `TOKEN_EXPIRY_MS` constant
  - Comprehensive `assignPlayer` mutation coverage
  - Player capacity and state restriction tests
- **Audit Logging Unit Tests** (`convex/audit.test.ts`):
  - 45 tests covering all audit logging functions
  - `logActionMutation`: success cases, actor types, action types, details validation
  - `getSessionAuditLog`: empty state, pagination, ordering, session filtering
  - `getRecentLogs`: default behavior, limit handling, limit clamping
  - Edge cases: boundary conditions, identical timestamps, optional fields
  - Performance optimization: shared test data in `beforeAll` for limit clamping tests
- **GitHub Actions CI Workflow Enhancements** (`.github/workflows/ci.yml`):
  - Runs on push to main and all PRs
  - Steps: typecheck app, typecheck convex, lint, test with coverage
  - Catches convex TypeScript errors before deployment
  - Coverage reporting with `vitest-coverage-report-action` (PR comments)
  - Coverage artifact upload with 7-day retention
  - Bun dependency caching via `actions/cache@v4`
  - Concurrency control - new pushes cancel in-progress runs
- **TypeScript Commands**:
  - `bun run typecheck` - Check both app and convex TypeScript
  - `bun run typecheck:convex` - Check only convex folder
- **Sessions CRUD Unit Tests** (`convex/sessions.test.ts`):
  - 93+ tests covering all sessions CRUD operations (expanded via WAR-18/WAR-19)
  - Test helpers: `createAdmin()`, `createSessionInStatus()`, `createFullSession()`
  - `createSession`: 29 tests (success, validation, boundary values, audit)
  - `listSessions`: 8 tests (empty, pagination, filtering by status)
  - `getSession`: 5 tests (success with relations, not found)
  - `updateSession`: 11 tests (success, validation, state restrictions, audit)
  - `deleteSession`: 9 tests (cascade delete with players/maps/votes, state restrictions, audit)
  - `assignPlayer`: 20+ tests (success, validation, capacity, state restrictions, token expiry, audit)
  - `setSessionMaps`: 20+ tests (success, validation, state restrictions, snapshots, edge cases, audit)
  - Session state machine tests (DRAFT, WAITING, IN_PROGRESS, PAUSED, COMPLETE, EXPIRED)
  - Cascade delete verification for related entities
- **Maps CRUD Unit Tests** (`convex/maps.test.ts`):
  - 125+ tests covering all maps CRUD operations
  - Factory pattern for test data creation
  - Comprehensive validation tests (name, URL, SSRF protection)
  - Session blocking tests for active map protection
  - Soft-delete pattern tests (deactivate/reactivate)
  - Edge cases: case-sensitivity, whitespace trimming, duplicate names
  - SSRF protection tests using `it.each` for private IP ranges
- **Teams CRUD Unit Tests** (`convex/teams.test.ts`):
  - Complete coverage for teams CRUD operations
  - Session blocking protection tests
  - Validation and uniqueness tests
- **Test Infrastructure** (`convex/smoke.test.ts`):
  - convex-test framework integration
  - Bun test runner configuration
  - Factory pattern helpers
- **Centralized Audit Logging Module** (`convex/audit.ts`):
  - `logAction()` helper for same-transaction logging from mutations
  - `logActionMutation` internal mutation for actions/cross-function calls
  - `getSessionAuditLog` paginated query (sorted by timestamp desc)
  - `getRecentLogs` convenience query (capped at 100 entries)
  - 19 audit action types covering session lifecycle, player events, voting actions
  - DRY pattern with `createAuditLogEntry()` helper to eliminate duplication

### Changed
- **Vitest Coverage Configuration** (`vitest.config.ts`):
  - Added `json-summary` reporter for PR coverage comments
  - Enabled coverage thresholds: 70% lines, 75% functions, 70% branches, 70% statements
  - Changed test command from `test:once` to `test:coverage` in CI
- **Type Organization** (`convex/lib/types.ts`):
  - Added `ActorType` ("ADMIN" | "PLAYER" | "SYSTEM")
  - Added `AuditDetails` interface for audit log metadata
  - Expanded `AuditAction` with SESSION_DELETED, SESSION_EXPIRED, PLAYER_ASSIGNED, MAPS_ASSIGNED
- **Validators** (`convex/lib/validators.ts`):
  - Added `actorTypeValidator`, `auditDetailsValidator`
  - Updated `auditActionValidator` with 4 new action types
- **CLAUDE.md**:
  - Updated CI/CD section with coverage thresholds and deployment info
  - Updated testing section to use `/dev-browser` skill instead of Playwright MCP

---

## [0.5.0] - 2026-01-15

### Added
- **Sessions CRUD Operations** (`convex/sessions.ts`):
  - `listSessions` - Paginated query with status filtering, sorted by creation date
  - `getSession` - Get session with resolved map images (sanitized: no IP addresses exposed)
  - `createSession` - Create session with map validation and voting configuration
  - `updateSession` - Update draft sessions with map/config changes
  - `deleteSession` - Cascade delete sessions with all related data
  - `setSessionMaps` - Assign/update maps for a session (snapshot from map pool)
  - `duplicateSession` - Clone session configuration for quick setup
  - Full audit logging integration for all mutations
- **Shared Validators** (`convex/lib/validators.ts`):
  - `mapIdsValidator` - Reusable map ID array validation (3+ maps, max 50)
  - `paginationOptsValidator` for standardized pagination
- **Range Validation Helper** (`convex/lib/validation.ts`):
  - `validateRange()` - Generic min/max validation with custom error messages
  - Used for timer durations, map counts, player limits
- **Pagination Best Practices Documentation** (`docs/solutions/pagination/`):
  - Comprehensive guide for Convex pagination patterns
  - `usePaginatedQuery` hook usage with gapless pagination
  - Reference implementations and common pitfalls

### Changed
- **Teams Pagination Migration** (`convex/teams.ts`, `src/routes/admin/teams.tsx`):
  - Migrated from manual cursor/limit to `paginationOptsValidator`
  - Frontend uses `usePaginatedQuery` hook for reactive pagination
  - "Load More" button with proper loading states
- **Teams Table UI** (`src/routes/admin/teams.tsx`):
  - Restructured for better column alignment and symmetry
  - Combined avatar + team name into single "Team" column
  - Centered all headers and content for balanced design
  - Fixed edge cell padding for proper visual spacing
- **listSessions Pagination**:
  - Simplified to single-status queries for correctness
  - Uses `paginationOptsValidator` for gapless reactive pagination

### Removed
- Unused `sessionObjectValidator` and `teamObjectValidator` (dead code cleanup)

---

## [0.4.0] - 2026-01-14

### Added
- **Maps Admin Page** (`src/routes/admin/maps.tsx`):
  - Full map pool management UI at `/admin/maps`
  - Grid layout with 16:9 aspect ratio map cards
  - Add/edit dialogs with `ImageSourcePicker` for upload/URL images
  - Active/inactive toggle filter
  - Deactivate confirmation dialog with reactivate option
  - Map Pool link in admin sidebar navigation
- **Map Image Storage** (`convex/maps.ts`):
  - `imageStorageId` field for Convex storage uploads
  - `validateStorageFile()` for server-side file validation
  - `validateImageUrl()` for SSRF-safe URL validation
  - Storage cleanup when replacing/removing images
  - JSDoc documentation for upload workflow
- **Shared Storage Validation** (`convex/lib/storageValidation.ts`):
  - Extracted `validateStorageFile()` from duplicated code (DRY)
  - Used by both Maps and Teams CRUD operations
- **URL Validation Tests** (`convex/lib/urlValidation.test.ts`):
  - 34 comprehensive unit tests for SSRF protection
  - Tests cover private IPv4/IPv6 ranges, loopback, cloud metadata, localhost
- **Session Cleanup** (`convex/sessionCleanup.ts`):
  - `clearSessionIpAddresses` - Utility to clear IP addresses for a given session (privacy)
  - `expireStaleSessions` - Mark stale sessions as expired and clear their IPs
  - `clearCompletedSessionIps` - Batch cleanup of IPs from old completed sessions
  - Cron jobs for automated privacy compliance
- **`listTeams` Pagination** (`convex/teams.ts`):
  - Added `limit` and `cursor` args for paginated queries
  - Returns `continueCursor` and `isDone` for client-side pagination

### Changed
- Maps CRUD now validates both storage uploads and external URLs
- Teams page updated to handle paginated `listTeams` response
- Maps page uses `useMemo` for filtering (performance optimization)
- `MapCard` component wrapped with `React.memo` (prevents unnecessary re-renders)

### Removed
- Unused `getReferencedStorageIds` internal query (dead code cleanup)

---

## [0.3.1] - 2026-01-13

### Added
- **Team Logo Upload** (`convex/teams.ts`, `src/components/ui/image-source-picker.tsx`):
  - Direct file upload to Convex storage (PNG, JPG, WebP up to 2MB)
  - External URL fallback option with SSRF protection
  - Dual-source support: `logoStorageId` (Convex) or `logoUrl` (external)
  - Automatic storage cleanup on logo replacement/removal
  - Hourly cron job for orphaned file cleanup (`convex/crons.ts`)
  - Server-side file validation (size, MIME type)
  - Reusable `ImageSourcePicker` component with tabs for upload/URL
  - Drag-and-drop upload with keyboard accessibility
  - Memory-safe blob URL management with ref-based cleanup
- **SSRF-Safe URL Validation** (`convex/lib/urlValidation.ts`):
  - `isSecureUrl()` - Validates URLs are not pointing to internal/private IP addresses
  - `validateSecureUrl()` - Throws ConvexError for invalid URLs
  - Protection against IPv4 private ranges (10.x, 172.16.x, 192.168.x)
  - Protection against IPv4 loopback (127.x) and link-local (169.254.x)
  - Protection against IPv6 loopback (::1), link-local (fe80::), private (fc00::)
  - Protection against tunneling protocols (6to4, Teredo)
  - Blocks localhost hostname variants
  - Uses `ipaddr.js` for robust IP classification
- **Shared Name Validation** (`convex/lib/validation.ts`):
  - `validateName()` - Reusable name validation with trimming and length checks
  - Used by both Maps and Teams CRUD operations (DRY)
- Code review todo tracking system (`todos/012-017`)

### Changed
- Maps CRUD now uses SSRF-safe URL validation for `imageUrl`
- Teams CRUD now uses SSRF-safe URL validation for `logoUrl`
- Refactored duplicate name validation into shared module
- `updateTeam` and `deleteTeam` now delete database records before storage cleanup (atomicity fix)

### Security
- Fixed critical IPv6 bracket bypass vulnerability (`http://[::1]/` was not being blocked)
- Added comprehensive IP range blocking for SSRF protection

---

## [0.3.0] - 2025-01-13

### Added
- **Maps CRUD Operations** (`convex/maps.ts`):
  - `listMaps` - Query maps with optional inactive filter, sorted by name
  - `getMap` - Get single map by ID
  - `createMap` - Create map with name/URL validation and uniqueness check
  - `updateMap` - Update map with validation, uniqueness check, and active session protection
  - `deactivateMap` - Soft delete with active session protection
  - `reactivateMap` - Restore deactivated map with duplicate name check
  - `generateUploadUrl` - Generate Convex storage upload URL for images
- **Teams CRUD Operations** (`convex/teams.ts`):
  - `listTeams` - Query all teams sorted by name
  - `createTeam` - Create team with name uniqueness validation
  - `updateTeam` - Update team with active session protection
  - `deleteTeam` - Delete team with cascade protection
- Shared constants module (`convex/lib/constants.ts`):
  - `MAX_NAME_LENGTH`, `MAX_URL_LENGTH` validation constants
  - `ACTIVE_SESSION_STATUSES` type-safe set for session checks
- Shared utilities (`convex/lib/`):
  - `cascadeDelete.ts` - Atomic cascade delete for sessions
  - `types.ts` - Type definitions for PlayerRole, AuditAction
- Complete Convex database schema with 8 tables (`convex/schema.ts`):
  - `admins` - Google OAuth users with email whitelist
  - `teams` - Reusable team registry
  - `maps` - Master map pool (CMS-managed)
  - `sessions` - Voting sessions with state machine
  - `sessionPlayers` - Player slots with token authentication
  - `sessionMaps` - Maps assigned to session (snapshot pattern)
  - `votes` - Individual votes for Multiplayer format
  - `auditLogs` - Action history and audit trail
- Schema indexes (18 total):
  - `maps.by_name` - Name sorting and uniqueness lookup
  - `maps.by_isActive_and_name` - Compound index for filtering + sorting
  - `sessionMaps.by_mapId` - Deactivation session check
  - `sessionPlayers.by_teamName` - Team lookup optimization
  - `sessionPlayers.by_tokenExpiresAt` - Token cleanup
  - `sessionPlayers.by_lastHeartbeat` - Heartbeat monitoring
  - `votes.by_sessionId_and_playerId` - Vote queries
  - `auditLogs.by_sessionId_and_timestamp` - Log queries
- URL validation using `validator.js` for map image and team logo URLs
- N+1 query solution documentation (`docs/solutions/`)
- Convex project initialization and deployment configuration
- Code review todos directory (`todos/`) for tracking follow-up work
- `.env.example` template for environment variables
- `/update-docs-and-commit` slash command for automated documentation updates
- MCP Tools section in CLAUDE.md (Playwright and Convex testing guidance)
- Netlify `_redirects` file for SPA routing support
- Meta description tag for SEO
- Apple touch icon for iOS devices

### Changed
- Updated CLAUDE.md with expanded project structure documentation
- Browser tab title from "vite-app" to "WTCS Map Vote"
- Favicon from Vite logo to custom project icon (`/icon.svg`)

### Fixed
- 404 errors when refreshing pages on Netlify deployment (SPA routing issue)

### Removed
- Unused `public/vite.svg` (Vite default favicon)
- Unused `by_isActive` standalone index (superseded by compound index)

---

## [0.2.0] - 2025-01-02

### Added
- Mobile sidebar toggle for admin layout
- Mobile close callback to admin sidebar component
- Documentation structure (`docs/` folder with spec, architecture, changelog, project status)
- Documentation section in CLAUDE.md referencing all docs

### Fixed
- Vote page footer items now stack properly on small screens
- Map selection changed from hover-only to tap-friendly click for mobile
- Vote page header and timer layout improved for mobile viewports
- Teams table now has horizontal scroll on mobile
- Admin header padding adjusted for mobile hamburger menu
- Lobby map grid made responsive for mobile devices

---

## [0.1.1] - 2025-01-01

### Changed
- Build and preview scripts now use Bun runtime (`bunx --bun vite`)
- Consistent with dev script which already used Bun

---

## [0.1.0] - 2024-12-31

### Fixed
- Replaced `asChild` prop with `render` prop for Base UI compatibility
- Fixed Button and PopoverTrigger components to use correct Base UI pattern

### Changed
- Updated CLAUDE.md with Base UI render prop pattern documentation

---

## [0.0.1] - 2024-12-20

### Added
- Initial project setup with Vite + React 19 + TypeScript
- ShadCN UI setup with base-vega style preset
- TanStack Router with file-based routing
- Tailwind CSS 4 with CSS variables
- Core UI components from v0 integration:
  - Admin dashboard layout with sidebar
  - Session management views (create, detail, list)
  - Player views (lobby, voting, results)
  - Login page
  - Teams management page
- Component library:
  - Button, Badge, Card, Input, Textarea
  - Dialog, AlertDialog, Popover, Command
  - Select, Combobox, DropdownMenu
  - Table, ScrollArea, Avatar
  - Field, InputGroup, Label, Separator
- Session card component for dashboard display
- Admin sidebar with navigation

### Infrastructure
- Bun as package manager
- ESLint configuration
- TypeScript strict mode
- Path aliases (`@/` for src imports)

</details>
