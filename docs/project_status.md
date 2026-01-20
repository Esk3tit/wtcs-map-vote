# Project Status

Current progress and next steps for the WTCS Map Vote project.

**Last Updated:** January 20, 2026

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

---

## Next Steps

### Convex Functions (Priority: High)

Implement the Convex functions to power the application:

1. **Authentication**
   - [ ] Set up Convex Auth with Google OAuth provider
   - [ ] Implement admin whitelist check
   - [ ] Create player token authentication flow
   - [ ] Add uniqueness validation (email, token)

2. **Core Functions**
   - [x] Teams CRUD operations (create, update, delete, list)
   - [x] Maps CRUD operations (create, update, deactivate, reactivate, list, get, upload URL)
   - [x] Sessions CRUD operations (create, update, delete, list, get, setMaps, duplicate)
   - [ ] Session lifecycle mutations (finalize, start, pause, resume, end)
   - [ ] Player token validation and IP locking
   - [ ] Voting mutations (submitBan, submitVote)
   - [x] Cascade delete helpers for data integrity

3. **Real-Time Subscriptions**
   - [ ] Session state subscription
   - [ ] Map state updates
   - [ ] Player connection status
   - [ ] Timer synchronization

4. **Connect Frontend**
   - [ ] Replace mock data with Convex queries
   - [ ] Wire up mutations to forms/actions
   - [ ] Add loading and error states

### Future Work

- [ ] Timer expiration handling (scheduled functions)
- [x] Session cleanup cron job (complete)
- [x] Audit logging (complete - `convex/audit.ts`)
- [x] File upload for team logos (complete)
- [x] File upload for map images (complete)
- [ ] Rate limiting
- [ ] Production deployment to Netlify + Convex Cloud

---

## Known Issues

*None currently tracked.*

---

## Blockers

*None currently.*
