# Project Status

Current progress and next steps for the WTCS Map Vote project.

**Last Updated:** March 2, 2026

---

## Completed

### Frontend Foundation
- [x] Project scaffolding with Vite + React 19 + TypeScript
- [x] TanStack Router setup with file-based routing
- [x] Tailwind CSS 4 with CSS variables
- [x] shadcn/ui component library (base-vega style)
- [x] Path aliases configured (`@/` for src imports)

### UI Components
- [x] Core shadcn/ui components installed and configured
- [x] Admin sidebar with navigation
- [x] Session card component
- [x] All route layouts created (admin, player, results)

### Views (Static/Mock)
- [x] Admin dashboard layout
- [x] Session create form
- [x] Session detail view
- [x] Teams management page
- [x] Login page
- [x] Player lobby view
- [x] Player voting view
- [x] Results view

### Mobile Responsiveness
- [x] Mobile sidebar toggle for admin layout
- [x] Vote page mobile layout fixes
- [x] Lobby map grid responsive
- [x] Teams table horizontal scroll
- [x] Tap-friendly map selection (vs hover-only)

### Developer Experience
- [x] CLAUDE.md project guidelines
- [x] Documentation structure (docs/ folder)
- [x] Base UI render prop pattern documented
- [x] Bun runtime for build scripts
- [x] MCP testing guidance (Playwright, Convex)
- [x] `/update-docs-and-commit` slash command

### Convex Backend
- [x] Convex project initialization (`npx convex dev`)
- [x] Convex deployment configuration
- [x] Environment variables setup
- [x] Complete database schema (`convex/schema.ts`) with 8 tables
- [x] All indexes defined (18 total) for efficient queries
- [x] TypeScript types auto-generated (`convex/_generated/`)
- [x] Teams CRUD operations (`convex/teams.ts`)
- [x] Maps CRUD operations (`convex/maps.ts`)
- [x] URL validation with `validator.js`
- [x] SSRF-safe URL validation (`convex/lib/urlValidation.ts`)
- [x] Shared name validation (`convex/lib/validation.ts`)
- [x] Cascade delete helper (`convex/lib/cascadeDelete.ts`)
- [x] Type definitions (`convex/lib/types.ts`)
- [x] Shared constants (`convex/lib/constants.ts`)
- [x] N+1 query optimization patterns documented
- [x] Code review todo tracking system
- [x] Team logo upload with Convex storage (`convex/teams.ts`)
- [x] Image upload/URL picker component (`src/components/ui/image-source-picker.tsx`)
- [x] Orphaned storage cleanup cron job (`convex/crons.ts`, `convex/storage.ts`)
- [x] Image constants shared module (`convex/lib/imageConstants.ts`)
- [x] Maps admin page with image upload (`src/routes/admin/maps.tsx`)
- [x] Map image storage support (`imageStorageId` field)
- [x] Shared storage validation (`convex/lib/storageValidation.ts`)
- [x] URL validation unit tests (`convex/lib/urlValidation.test.ts`)
- [x] Session cleanup for privacy (`convex/sessionCleanup.ts`)
- [x] listTeams pagination support
- [x] React performance optimizations (useMemo, React.memo)
- [x] Sessions CRUD operations (`convex/sessions.ts`)
- [x] `paginationOptsValidator` migration for teams and sessions
- [x] Pagination best practices documentation
- [x] Centralized audit logging module (`convex/audit.ts`)
- [x] Audit action types and validators
- [x] convex-test unit testing framework setup
- [x] Teams CRUD unit tests (`convex/teams.test.ts`)
- [x] Maps CRUD unit tests (`convex/maps.test.ts`)
- [x] Sessions CRUD unit tests (`convex/sessions.test.ts`)
- [x] Session players edge case tests (WAR-18) - token expiry, capacity, state restrictions
- [x] Session maps edge case tests (WAR-19) - snapshots, boundaries, unicode, rapid reassignments
- [x] Test infrastructure and smoke tests (`convex/smoke.test.ts`)

### Phase 2: Wire UI to Convex (COMPLETE)
- [x] Convex React hooks and patterns (WAR-5)
- [x] Admin dashboard wired to Convex (WAR-8)
- [x] Teams page wired to Convex (WAR-6)
- [x] Maps page wired to Convex (WAR-7)
- [x] Create session form wired to Convex (WAR-9)
- [x] Session detail page wired to Convex (WAR-10)
- [x] Player lobby page wired to Convex (WAR-11)
- [x] Player voting page wired to Convex (WAR-11)
- [x] Results page wired to Convex (WAR-11)
- [x] `TokenErrorPage` component for invalid/expired tokens
- [x] Convex React helper (`src/lib/convex.ts`)

### Phase 3: Authentication (COMPLETE)
- [x] Convex Auth infrastructure (WAR-23) - auth tables, providers, HTTP routes
- [x] Google OAuth provider (WAR-24) - login UI, logout, real user display
- [x] Admin whitelist system (WAR-25) - email-based access control, root admin protection
- [x] Backend auth enforcement on mutations (WAR-25)
- [x] Route auth guards (WAR-25)
- [x] Admin management UI (`/admin/settings`)
- [x] Admin audit logging (`adminAuditLogs` table)
- [x] Session invalidation for removed admins
- [x] Player token authentication flow (WAR-26, PR #45)
- [x] Server-side token validation via HTTP actions with IP locking
- [x] `usePlayerAuth` hook with heartbeat and AbortController cleanup
- [x] OAuth login fixes - JWT email claim, return validators, callback race condition
- [x] Security hardening - requireAdmin on queries, Referrer-Policy, token invalidation
- [x] Protected routes & server-side createdBy derivation (WAR-27, PR #47)
- [x] CORS restriction to SITE_URL in production with fail-closed behavior
- [x] WTCS logo integration and mobile padding fixes (WAR-28, PR #48)
- [x] Auth event logging — ADMIN_LOGIN, PLAYER_CONNECTED audit events (WAR-29, PR #49)
- [x] Auth system tests (WAR-30, WAR-21, PR #50) — 64 new tests, 500 total
- [x] 100% coverage on admins.ts, playerAuth.ts, lib/auth.ts
- [x] Full lobby URLs in session detail page (WAR-31, PR #51)

### Phase 4: Voting Module (COMPLETE)
- [x] ABBA submitBan mutation with full validation chain (WAR-32, PR #52)
- [x] Multiplayer submitVote mutation with vote tracking (WAR-33, PR #53)
- [x] Round resolution & deadlock handling for multiplayer format (WAR-34, PR #54)
- [x] Shared validation helpers (lookupAndValidatePlayer, requireAvailableSessionMap)
- [x] HTTP endpoints for submit-ban and submit-vote with CORS
- [x] 100+ voting tests (submitBan, submitVote, resolveRound, coverage gaps)
- [x] Voting query enhancements — roundHistory, voteProgress, isRevoteRound, completedRounds (WAR-35)
- [x] GDPR IP address redaction in admin session detail (WAR-35)
- [x] Frontend vote submission wiring — fetch calls, shared SITE_URL, unified handler, error handling (WAR-36, PR #56)
- [x] Multiplayer vote confirmation UI — golden border on voted map, "Your vote" label, playerVotedMapId query (WAR-37, PR #57)
- [x] Voting unit tests for coverage gaps — session expiry, revote audit, cross-round isolation (WAR-20, PR #58)

### Phase 5: Session Lifecycle (COMPLETE)
- [x] Centralized state transition map and helpers (WAR-37, PR #59)
- [x] `VALID_TRANSITIONS` map, `validateTransition`, `guardFinalize`, `guardStart`, `transitionSession`
- [x] `SessionStatePatches` type, `TransitionOptions` interface, `SESSION_RESET_PATCHES`
- [x] 60 unit tests for transition validation, guards, and atomic transitions
- [x] Session lifecycle mutations — finalize, start, pause, resume, end (WAR-38–41, PR #60)
- [x] 39 unit tests for lifecycle mutations (700 total tests)
- [x] Timer management in voting mutations (WAR-42, PR #61) — timer reset on turn/round advances
- [x] `forceRandomSelection` admin mutation (WAR-43, PR #62) — CSPRNG random winner selection
- [x] `adminVoteOnBehalf` mutation (WAR-44, PR #63) — admin ban/vote on behalf of players
- [x] `resetSession` mutation (WAR-45, PR #64) — COMPLETE→WAITING session reset for replay
- [x] `cloneSession` mutation (WAR-46, PR #65) — duplicate session configuration into new DRAFT
- [x] Timer expiration scheduled function (WAR-47, PR #66) — per-session auto-ban/auto-vote on timeout
- [x] Shared voting helpers extracted (`convex/lib/votingHelpers.ts`, `convex/lib/timerScheduling.ts`)
- [x] Admin session control buttons wired (WAR-48, PR #67) — all action buttons functional with confirmation dialogs
- [x] Disconnect detection and auto-pause (WAR-49, PR #68) — heartbeat timeout cron with auto-pause
- [x] Return validator audit — fixed `sessionMapObjectValidator` missing `submittedByAdmin` field

### Phase 6: Player Experience Polish (COMPLETE)
- [x] Player session state auto-redirects (WAR-54, PR #73) — `useSessionStatusRedirect` hook for lobby→vote→results transitions
- [x] Session paused overlay on vote page (WAR-55, PR #74) — semi-transparent overlay replaces full-page replacement
- [x] Multiplayer round results reveal (WAR-58, PR #75) — 3-second reveal phase with vote counts, winner banner, deadlock display
- [x] 3-state connection status indicators (WAR-56, PR #76) — Connected/Reconnecting/Disconnected badges with server-computed status
- [x] Player reconnection flow with retry logic (WAR-57, PR #77) — exponential backoff, DisconnectedOverlay, tab visibility handler
- [x] Session error states for active players (WAR-60, PR #78) — SessionEndedPage for EXPIRED sessions, heartbeat stop on terminal state

### Phase 7: Animation & Visual Polish (COMPLETE)
- [x] ABBA turn flash overlay (WAR-69, PR #80) — green viewport-edge glow on your-turn transition
- [x] ABBA progress tracker with ban history (WAR-61, PR #81) — map thumbnails, multiplayer round history table
- [x] Stakeholder feedback fixes (WAR-70, PR #82) — 3-rule multiplayer ban strategy, timer CSPRNG, UX fixes
- [x] Revote deadlock loop fix (PR #83) — preserve `isRevoteRound` through pause/resume
- [x] Audio alerts for voting events (WAR-62, PR #84) — 6 sound effects, mute toggle, autoplay unlock
- [x] Skeleton loading screens (WAR-65, PR #85) — layout-matching skeletons on all player pages + admin dashboard
- [x] Team logos integration (WAR-71, PR #86) — `TeamAvatar` component, batch logo resolution, all views
- [x] Animated map ban/elimination transitions (WAR-63, PR #87) — grayscale + stamp-in, staggered elimination, winner pulse
- [x] Winner celebration animation (WAR-64, PR #88) — choreographed CSS-only sequence on results page
- [x] Standardized empty states (WAR-68, PR #89) — shared `EmptyState` component with page/card variants
- [x] Lobby & vote page entrance animations (WAR-66, PR #90) — staggered map card entrances, pulsing wait text
- [x] Animation system documentation — `docs/solutions/animation-system.md`

### Phase 7b: Turn Transition Animations (COMPLETE)
- [x] Turn transition animations (WAR-67, PR #92) — banner crossfade, timer pulse, ABBA tracker transitions, round fade-in

### Phase 8: Hardening & Observability (COMPLETE)
- [x] Rate limiting on all mutations (WAR-72, PR #93)
- [x] Sentry error tracking and React error boundaries (WAR-73, PR #94)
  - React 19 error hooks, Sentry.ErrorBoundary, player/admin error fallbacks
  - Session replay (error-only), source map upload, release tracking
  - ConvexError filtering, browser noise suppression, privacy-first defaults

---

## Next Steps

### Future Work

- [ ] Production deployment to Netlify + Convex Cloud
- [ ] Performance optimizations
- [ ] Analytics and monitoring

---

## Known Issues

*None currently tracked.*

---

## Blockers

*None currently.*
