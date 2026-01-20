# WTCS Map Vote

A real-time map voting/banning system for esports tournaments. Tournament administrators create voting sessions where players select or eliminate maps using ABBA (alternating bans) or Multiplayer (simultaneous voting) formats.

## Features

- **Two Voting Formats**
  - **ABBA**: 2-player alternating bans (A→B→B→A pattern)
  - **Multiplayer**: 2-4 players vote simultaneously each round

- **Real-Time Updates**: Live session state via WebSocket subscriptions
- **Admin Dashboard**: Create sessions, manage teams and maps, monitor voting
- **Player Access**: Token-based authentication with IP locking
- **Mobile Responsive**: Works on desktop and mobile browsers

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 7 |
| Routing | TanStack Router (file-based) |
| Styling | Tailwind CSS 4, shadcn/ui (Base UI) |
| Backend | Convex (database, real-time, auth) |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Convex](https://convex.dev/) account

### Installation

```bash
# Clone the repository
git clone https://github.com/Esk3tit/wtcs-map-vote.git
cd wtcs-map-vote

# Install dependencies
bun install

# Copy environment template
cp .env.example .env
# Fill in your Convex and Google OAuth credentials
```

### Development

```bash
# Start Convex backend (in one terminal)
npx convex dev

# Start frontend dev server (in another terminal)
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

### Build

```bash
bun run build
bun run preview
```

## Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── layout/       # Sidebar, headers
│   └── session/      # Session-specific components
├── routes/           # TanStack Router file-based routes
│   ├── admin/        # Admin dashboard, create, teams
│   ├── lobby.$token.tsx   # Player waiting room
│   └── vote.$token.tsx    # Player voting interface
└── lib/              # Utilities

docs/
├── SPECIFICATION.md  # Full product & engineering spec
├── architecture.md   # System design
├── changelog.md      # Version history
└── project_status.md # Current progress
```

## Testing

The project uses `convex-test` with Vitest for backend unit testing.

```bash
bun test                        # Run all tests
bun test convex/sessions.test.ts  # Run specific test file
bun run test:coverage           # Run tests with coverage report
```

**Test Coverage:**
- Teams CRUD operations
- Maps CRUD operations (including SSRF protection)
- Sessions CRUD operations (93+ tests)
- Audit logging functions
- URL validation (34 security tests)

Coverage thresholds are enforced at 70% lines, 75% functions, 70% branches.

## Documentation

- [Specification](docs/SPECIFICATION.md) - Complete product requirements
- [Architecture](docs/architecture.md) - System design and data flow
- [Changelog](docs/changelog.md) - Version history
- [Project Status](docs/project_status.md) - Current progress and roadmap

## License

Private project for WTCS esports tournaments.
