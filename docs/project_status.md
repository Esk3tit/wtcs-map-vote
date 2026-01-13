# Project Status

Current progress and next steps for the WTCS Map Vote project.

**Last Updated:** January 12, 2026

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
- [x] URL validation with `validator.js`
- [x] Cascade delete helper (`convex/lib/cascadeDelete.ts`)
- [x] Type definitions (`convex/lib/types.ts`)
- [x] N+1 query optimization patterns documented

---

## In Progress

### Teams CRUD PR (#14)
- [x] Core CRUD operations implemented
- [x] URL validation with validator.js
- [x] Performance indexes added
- [x] All PR comments addressed
- [ ] Awaiting merge to main

See `todos/` directory for detailed findings from code review.

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
   - [ ] Maps CRUD operations
   - [ ] Sessions CRUD operations
   - [ ] Session lifecycle mutations (create, finalize, start, pause, resume, end)
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
- [ ] Session cleanup cron job
- [ ] Audit logging
- [ ] File upload for map images
- [ ] Rate limiting
- [ ] Production deployment to Netlify + Convex Cloud

---

## Known Issues

*None currently tracked.*

---

## Blockers

*None currently.*
