# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this codebase.

## Project Overview

WTCS Map Vote - A React application for map voting functionality.

## Tech Stack

- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 7
- **Routing:** TanStack Router (file-based)
- **Backend/Database:** Convex
- **Styling:** Tailwind CSS 4 with CSS variables
- **UI Components:** shadcn/ui (base-vega style) with Base UI primitives
- **Icons:** Lucide React
- **Notifications:** Sonner (toast)
- **Package Manager:** Bun

## Commands

- `bun run dev` - Start development server
- `bun run build` - Type-check and build for production
- `bun run lint` - Run ESLint
- `bun run preview` - Preview production build

## Project Structure

```
/
├── convex/
│   ├── schema.ts         # Database schema (8 tables, 14 indexes)
│   ├── _generated/       # Auto-generated types (do not edit)
│   ├── lib/              # Shared utilities (cascadeDelete, types)
│   └── *.ts              # Convex functions (queries, mutations, actions)
├── docs/
│   ├── plans/            # Working plans (gitignored)
│   ├── solutions/        # Documented solutions and patterns
│   ├── convex_rules.md   # Convex coding guidelines
│   └── SPECIFICATION.md  # Full product & engineering spec
├── todos/                # Code review findings and follow-up work
├── .env.example          # Environment variables template
└── src/
    ├── components/
    │   ├── ui/           # shadcn/ui components (do not edit directly)
    │   ├── layout/       # Layout components (sidebar, headers, etc.)
    │   └── session/      # Session-related components
    ├── routes/           # TanStack Router file-based routes
    │   ├── __root.tsx    # Root layout
    │   ├── index.tsx     # Home redirect
    │   ├── login.tsx     # Admin login page
    │   ├── admin.tsx     # Admin layout (wraps /admin/* routes)
    │   ├── admin/        # Admin nested routes (dashboard, create, teams, etc.)
    │   ├── lobby.$token.tsx    # Player waiting room
    │   ├── vote.$token.tsx     # Player voting interface
    │   └── results.$sessionId.tsx  # Session results page
    ├── lib/
    │   └── utils.ts      # Utility functions (cn helper)
    ├── routeTree.gen.ts  # Auto-generated route tree (do not edit)
    ├── App.tsx           # Router provider setup
    ├── main.tsx          # Entry point
    └── index.css         # Global styles and Tailwind
```

## Code Conventions

### Imports

Use the `@/` path alias for imports from src/:
```tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

### Components

- Use functional components with TypeScript
- Export components as named exports
- **shadcn/ui preset is already configured** - a custom preset (base-vega style) was created via shadcn web, stick to it
- **Prefer existing shadcn components** - check available components in `src/components/ui/` before building custom ones
- Add new shadcn components with `bunx shadcn@latest add <component>`
- **Minimize new dependencies** - use what's already in the project when possible

### Base UI Render Prop Pattern

This project uses **Base UI** (not Radix UI). Base UI does NOT support `asChild` - use the `render` prop instead for polymorphic components:

```tsx
// WRONG - asChild doesn't exist in Base UI
<Button asChild>
  <Link to="/path">Click</Link>
</Button>

// CORRECT - use render prop
<Button render={<Link to="/path" />}>
  Click
</Button>

// Also works for other components like PopoverTrigger
<PopoverTrigger render={<Button variant="outline" />}>
  Open Menu
</PopoverTrigger>
```

### Styling

- Use Tailwind CSS utility classes
- Use `cn()` helper from `@/lib/utils` for conditional class merging
- CSS variables are defined in `src/index.css`
- **Mobile-first responsive design** - start with mobile styles, then add breakpoints for larger screens:
  ```tsx
  // Mobile-first: base styles for mobile, then scale up
  <div className="px-4 md:px-6 lg:px-8">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  <div className="text-sm md:text-base lg:text-lg">
  ```
- Always test layouts on mobile viewports

### Routing (TanStack Router)

- Routes are defined in `src/routes/` using file-based routing
- Use `createFileRoute` to define route components
- Dynamic params use `$` prefix: `session.$sessionId.tsx` → `/session/:sessionId`
- Layout routes: `admin.tsx` wraps all `admin/*.tsx` routes with `<Outlet />`
- `routeTree.gen.ts` is auto-generated - do not edit manually
- Use `<Link to="/path">` for navigation

## Code Quality

- **TypeScript strict mode** - the project uses strict TypeScript, ensure all types are properly defined
- **No `any` types** - avoid using `any` without clear justification; prefer `unknown` or proper typing
- **Run linting before commits** - always run `bun run lint` before committing to catch issues early
- **Run build to type-check** - use `bun run build` to verify no TypeScript errors

## MCP Tools for Testing

### Playwright MCP (UI Testing)

**Always use Playwright MCP to test the UI** when:
- Adding new UI features or components
- Making any visual or layout changes
- Modifying user interactions or flows
- Fixing UI-related bugs

Use `browser_snapshot` for accessibility-based testing and `browser_take_screenshot` for visual verification. Navigate with `browser_navigate` to `http://localhost:5173` (ensure dev server is running).

### Convex MCP (Backend Testing)

**Always refer to [docs/convex_rules.md](docs/convex_rules.md)** when writing or modifying Convex functions. This contains essential guidelines for function syntax, validators, schemas, and best practices.

**Always use Convex MCP** for:
- Testing Convex functions (queries, mutations, actions)
- Inspecting or modifying database data
- Debugging backend logic
- Verifying data model changes

Key tools:
- `mcp__convex__status` - Get deployment info
- `mcp__convex__tables` - List tables and schema
- `mcp__convex__data` - Read table data
- `mcp__convex__run` - Execute Convex functions
- `mcp__convex__logs` - View function execution logs

### Database Schema

The schema is defined in `convex/schema.ts` with 8 tables:

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `admins` | Google OAuth users | `by_email` |
| `teams` | Reusable team registry | `by_name` |
| `maps` | Master map pool | `by_isActive` |
| `sessions` | Voting sessions | `by_status`, `by_createdBy`, `by_expiresAt` |
| `sessionPlayers` | Player slots with tokens | `by_sessionId`, `by_token` |
| `sessionMaps` | Maps assigned to session | `by_sessionId`, `by_sessionId_and_state` |
| `votes` | Individual votes | `by_sessionId_and_round`, `by_playerId_and_round` |
| `auditLogs` | Action history | `by_sessionId`, `by_timestamp` |

**Important:** Convex indexes do not enforce uniqueness. Mutations must validate uniqueness for `token` and `email` fields before inserting.

## Code Security

- **NEVER expose API keys or secrets in client code** - secrets must only be used server-side (Convex functions)
- **Always use environment variables for secrets** - never hardcode sensitive values
- **NEVER commit .env files** - ensure `.env*` files are in `.gitignore`
- **Validate and sanitize all user input** - never trust client-side data

## Git Workflow

- **Always create a new branch** when starting major changes
- **Never commit directly to main** - use feature branches and PRs
- Branch naming: `feature/<description>`, `fix/<description>`, etc.

## Documentation

- [Project Spec](docs/SPECIFICATION.md) - Full project requirements, API specs, tech details. Product and Engineering Design document essentially.
- [Architecture](docs/architecture.md) - System design and data flow
- [Changelog](docs/changelog.md) - Version history and changelog for changes over time, new changes in changelog should be appended instead of overwriting the changelog entirely
- [Project Status](docs/project_status.md) - Current progress and immediate things that we are currently working on
- Update files in the docs folder after major milestones and major additions to the project
- Use the /update-docs-and-commit slash command when making git commits to automatically update documentation and keep it up to date with the project (also run the command after finishing a feature and/or merging a PR)

### Working Plans

**Always create plans in `docs/plans/`** - this directory is gitignored.

When using `/workflows:plan`, `/superpowers:write-plan`, or similar planning commands, write plan files to `docs/plans/<plan-name>.md`. These are temporary working documents and should not be committed to the repository.
