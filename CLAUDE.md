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
- `bun run build` - Type-check app and build for production
- `bun run typecheck` - Type-check both app and convex (run before commits)
- `bun run typecheck:convex` - Type-check only convex folder
- `bun run lint` - Run ESLint
- `bun run preview` - Preview production build

## Project Structure

```
/
├── convex/
│   ├── schema.ts         # Database schema (8 tables, 21 indexes)
│   ├── _generated/       # Auto-generated types (do not edit)
│   ├── lib/              # Shared utilities (validators, validation, constants, etc.)
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

### Convex Function Style

Follow these conventions for all Convex function files (`convex/*.ts`, excluding `_generated/` and `lib/`):

**Module Header** (required):
```typescript
/**
 * Module Name
 *
 * Brief description of what this module handles.
 */
```

**Section Dividers** (when file has multiple categories):
```typescript
// ============================================================================
// Section Name (Validators, Types, Private Helpers, Queries, Mutations)
// ============================================================================
```

**Import Order** (with blank lines between groups):
1. Convex generated imports (`"./_generated/*"`)
2. Convex library imports (`"convex/*"`)
3. Local lib imports (`"./lib/*"`)
4. Other local imports (sibling modules)

**JSDoc** (required for all exported functions):
```typescript
/**
 * Brief description. Additional context if needed.
 *
 * @param paramName - Description
 */
```

**Error Messages**:
- Short: `"Entity not found"` (no period)
- With context: `"Cannot update. Only DRAFT state allowed."` (period)

**TODO Format**: `// TODO: Description (Phase 2)`

**Reference**: See `convex/audit.ts` as the style reference implementation.

## Code Quality

- **TypeScript strict mode** - the project uses strict TypeScript, ensure all types are properly defined
- **No `any` types** - avoid using `any` without clear justification; prefer `unknown` or proper typing
- **Run typecheck before commits** - always run `bun run typecheck` to catch TypeScript errors in both app and convex
- **Run linting before commits** - always run `bun run lint` before committing to catch issues early

**Important:** The app (`src/`) and convex (`convex/`) folders have separate TypeScript configs. `bun run build` only checks `src/`, so always use `bun run typecheck` to check both before pushing.

## Testing Tools

### Convex Unit Tests

The project uses `convex-test` for backend unit testing. Test files are in `convex/*.test.ts`.

**Run tests (IMPORTANT: use `bun run test`, NOT `bun test`):**
```bash
bun run test                          # Run all tests (uses vitest)
bunx vitest run convex/maps.test.ts   # Run specific test file
bunx vitest                           # Watch mode
```

> **Warning:** `bun test` uses Bun's built-in test runner which is incompatible with `convex-test`. Always use `bun run test` (invokes vitest via package.json) or `bunx vitest run`.

**Test structure:**
- `convex/smoke.test.ts` - Infrastructure smoke tests
- `convex/teams.test.ts` - Teams CRUD unit tests
- `convex/maps.test.ts` - Maps CRUD unit tests
- `convex/sessions.test.ts` - Sessions CRUD unit tests
- `convex/audit.test.ts` - Audit logging unit tests

**Key patterns:**
```typescript
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

// Create test context with schema
const createTestContext = () => convexTest(schema);

// Use factories for test data
const mapFactory = (overrides = {}) => ({
  name: "Test Map",
  imageUrl: "https://example.com/map.png",
  isActive: true,
  ...overrides,
});

// Test mutations and queries
it("creates a map", async () => {
  const t = createTestContext();
  const result = await t.mutation(api.maps.createMap, {
    name: "New Map",
    imageUrl: "https://example.com/map.png",
  });
  expect(result.success).toBe(true);
});
```

**Note:** Convex storage IDs cannot be tested directly with convex-test. Tests requiring storage validation are skipped with documentation.

### Dev Browser Skill (UI Testing)

**Always use the `/dev-browser` skill to test the UI** when:
- Adding new UI features or components
- Making any visual or layout changes
- Modifying user interactions or flows
- Fixing UI-related bugs

Invoke with `/dev-browser` or use the Skill tool. The skill provides browser automation with persistent page state for navigating, clicking, filling forms, taking screenshots, and testing web apps. Navigate to `http://localhost:5173` (ensure dev server is running).

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

### Convex Pagination Pattern

Use `paginationOptsValidator` for all paginated queries. This is the standard pattern:

**Backend (Convex function):**
```typescript
import { paginationOptsValidator } from "convex/server";

export const listItems = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("items")
      .withIndex("by_name")
      .order("asc")
      .paginate(args.paginationOpts);
  },
});
```

**Frontend (React component):**
```typescript
import { usePaginatedQuery } from "convex/react";

const { results, status, loadMore } = usePaginatedQuery(
  api.items.listItems,
  {},
  { initialNumItems: 50 }
);

const isLoading = status === "LoadingFirstPage";
const canLoadMore = status === "CanLoadMore";
```

See `docs/solutions/pagination/convex-pagination-best-practices.md` for comprehensive guidance.

### Convex Shared Utilities

Reusable modules in `convex/lib/`:

| Module | Purpose |
|--------|---------|
| `validators.ts` | Shared validators (`mapIdsValidator`, reusable arg validators) |
| `validation.ts` | Input validation helpers (`validateName`, `validateRange`) |
| `constants.ts` | Shared constants (`MAX_NAME_LENGTH`, `ACTIVE_SESSION_STATUSES`) |
| `urlValidation.ts` | SSRF-safe URL validation for external images |
| `storageValidation.ts` | Convex storage file validation (size, MIME type) |
| `cascadeDelete.ts` | Atomic cascade delete for sessions and related data |
| `types.ts` | Shared TypeScript types (`PlayerRole`, `AuditAction`) |
| `imageConstants.ts` | Image upload constraints (max size, allowed types) |

**Always check for existing utilities** before creating new validation or helper functions.

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

## CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on all PRs and pushes to main:

| Step | Command | Purpose |
|------|---------|---------|
| Typecheck (App) | `bun run build` | Catch frontend TypeScript errors |
| Typecheck (Convex) | `bunx tsc --noEmit -p convex/tsconfig.json` | Catch backend TypeScript errors |
| Lint | `bun run lint` | Enforce code style |
| Test with Coverage | `bun run test:coverage` | Run tests and generate coverage report |
| Coverage Comment | vitest-coverage-report-action | Post coverage summary on PRs |

**Coverage Thresholds** (enforced in `vitest.config.ts`):
- Lines: 70%
- Functions: 75%
- Branches: 70%
- Statements: 70%

**Features:**
- Dependency caching via `actions/cache@v4` for faster builds
- Concurrency control - new pushes cancel in-progress runs
- Coverage artifact uploaded and retained for 7 days
- PR comments show coverage summary and file breakdown

**Local Validation:**
```bash
bun run typecheck && bun run lint && bun run test:coverage
```

### Deployment (Netlify)

Convex and frontend deployment are handled automatically by Netlify on merge to main:
```bash
npx convex deploy --cmd 'bun run build'
```

No additional GitHub Actions deploy job needed - Netlify manages both frontend hosting and Convex deployment.

## Documentation

- [Project Spec](docs/SPECIFICATION.md) - Full project requirements, API specs, tech details
- [Architecture](docs/architecture.md) - System design and data flow
- [Convex Rules](docs/convex_rules.md) - Convex coding guidelines and best practices
- [Changelog](docs/changelog.md) - Version history (append only, never overwrite)
- [Project Status](docs/project_status.md) - Current progress and next steps
- [Pagination Guide](docs/solutions/pagination/convex-pagination-best-practices.md) - Convex pagination patterns
- Update docs after major milestones and feature completions
- Use `/update-docs-and-commit` after finishing features or merging PRs

### Working Plans

**Always create plans in `docs/plans/`** - this directory is gitignored.

When using `/workflows:plan`, `/superpowers:write-plan`, or similar planning commands, write plan files to `docs/plans/<plan-name>.md`. These are temporary working documents and should not be committed to the repository.
