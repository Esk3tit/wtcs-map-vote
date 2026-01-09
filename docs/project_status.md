# Project Status

Current progress and next steps for the WTCS Map Vote project.

**Last Updated:** January 9, 2026

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
- [x] All indexes defined (14 total) for efficient queries
- [x] TypeScript types auto-generated (`convex/_generated/`)

---

## In Progress

### Code Review Follow-ups
- [ ] Implement uniqueness enforcement in mutations (token, email)
- [ ] Create cascade delete helpers for sessions
- [ ] Add missing performance indexes (4 identified)

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
   - [ ] Admin CRUD operations (teams, maps, sessions)
   - [ ] Session lifecycle mutations (create, finalize, start, pause, resume, end)
   - [ ] Player token validation and IP locking
   - [ ] Voting mutations (submitBan, submitVote)
   - [ ] Cascade delete helpers for data integrity

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
