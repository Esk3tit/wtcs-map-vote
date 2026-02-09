# Project Status

Current progress and next steps for the WTCS Map Vote project.

**Last Updated:** February 9, 2026

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

### Phase 4: Voting Module (IN PROGRESS)
- [x] ABBA submitBan mutation with full validation chain (WAR-32, PR #52)
- [x] Multiplayer submitVote mutation with vote tracking (WAR-33, PR #53)
- [x] Round resolution & deadlock handling for multiplayer format (WAR-34, PR #54)
- [x] Shared validation helpers (lookupAndValidatePlayer, requireAvailableSessionMap)
- [x] HTTP endpoints for submit-ban and submit-vote with CORS
- [x] 85+ voting tests (submitBan, submitVote, resolveRound)
- [x] Voting query enhancements — roundHistory, voteProgress, isRevoteRound, completedRounds (WAR-35)
- [x] GDPR IP address redaction in admin session detail (WAR-35)

---

## Next Steps

### Session Lifecycle (Priority: High)
   - [ ] Session lifecycle mutations (finalize, start, pause, resume, end)
   - [ ] Timer expiration handling (scheduled functions)

### Real-Time Features
   - [ ] Session state subscription
   - [ ] Map state updates during voting
   - [ ] Player connection status
   - [ ] Timer synchronization

### Future Work

- [ ] Rate limiting
- [ ] Production deployment to Netlify + Convex Cloud
- [ ] Performance optimizations
- [ ] Analytics and monitoring

---

## Known Issues

*None currently tracked.*

---

## Blockers

*None currently.*
