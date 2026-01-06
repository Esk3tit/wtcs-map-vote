# Changelog

All notable changes to the WTCS Map Vote project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- `.env.example` template for environment variables
- `/update-docs-and-commit` slash command for automated documentation updates
- MCP Tools section in CLAUDE.md (Playwright and Convex testing guidance)
- Netlify `_redirects` file for SPA routing support

### Changed
- Updated CLAUDE.md with expanded project structure documentation

### Fixed
- 404 errors when refreshing pages on Netlify deployment (SPA routing issue)

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
