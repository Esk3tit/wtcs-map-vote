# Project Status

Current progress and next steps for the WTCS Map Vote project.

**Last Updated:** January 4, 2026

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

---

## In Progress

### Documentation
- [ ] Seeding initial documentation files (this PR)

---

## Next Steps

### Convex Integration (Priority: High)

Backend setup and integration with Convex:

1. **Initialize Convex**
   - [ ] Run `npx convex dev` to initialize project
   - [ ] Configure Convex deployment
   - [ ] Set up environment variables

2. **Schema Definition**
   - [ ] Create `convex/schema.ts` with data model from spec
   - [ ] Define tables: admins, teams, maps, sessions, sessionPlayers, sessionMaps, votes, auditLogs
   - [ ] Add indexes for common queries

3. **Authentication**
   - [ ] Set up Convex Auth with Google OAuth provider
   - [ ] Implement admin whitelist check
   - [ ] Create player token authentication flow

4. **Core Functions**
   - [ ] Admin CRUD operations (teams, maps, sessions)
   - [ ] Session lifecycle mutations (create, finalize, start, pause, resume, end)
   - [ ] Player token validation and IP locking
   - [ ] Voting mutations (submitBan, submitVote)

5. **Real-Time Subscriptions**
   - [ ] Session state subscription
   - [ ] Map state updates
   - [ ] Player connection status
   - [ ] Timer synchronization

6. **Connect Frontend**
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
