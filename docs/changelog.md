# Changelog

All notable changes to the WTCS Map Vote project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Fixed
- **Admin Loading Spinner Centering**: Loading spinners in admin pages (dashboard, teams, maps, session detail) are now properly centered vertically and horizontally instead of appearing stuck at the top of the content area.

### Added
- **Create Session Form Wired to Convex** (WAR-9):
  - Atomic `createSession` mutation with player and map assignment in single transaction
  - Form validation with backend constants imported from `convex/lib/constants.ts`
  - Real-time team and map data from Convex queries
  - Submit button disabled when turn timer is invalid
  - Loading states and error handling
- **Player Pages Wired to Convex** (PR #38):
  - Player lobby page (`/lobby/$token`) with real-time session subscription
  - Player voting page (`/vote/$token`) with map ban/pick UI
  - Results page (`/results/$sessionId`) with final session outcomes
  - `TokenErrorPage` component for invalid/expired token handling
  - Real-time player connection status
- **Session Detail Page Wired to Convex** (WAR-10):
  - `getSessionDetail` query with full session data, players, maps, and audit logs
  - Real-time subscriptions for live session updates
  - Proper handling of Convex IDs as opaque strings (not numeric validation)
  - Accessibility improvements (aria-label on copy button)
  - Loading and error states for session detail view
- **Dashboard Wired to Convex** (WAR-8):
  - `listSessionsForDashboard` paginated query with player enrichment (assignedPlayerCount, teams)
  - Server-side filtering excludes COMPLETE/EXPIRED sessions from active view
  - Explicit field selection (no spread) prevents data over-exposure
  - `SessionCard` rewritten with schema-derived types (`Pick<Doc<"sessions">, ...>`)
  - `CompletedSessionRow` component for inactive sessions
  - shadcn/ui Accordion for collapsible completed/expired section
  - Shared `formatTeamDisplay` utility (`src/components/session/utils.ts`)
  - 9 unit tests for the dashboard query (enrichment, filtering, pagination)
- **Solution Documentation** (`docs/solutions/test-failures/`):
  - Documented that Convex tests must use `bun run test` (vitest), not `bun test`

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
