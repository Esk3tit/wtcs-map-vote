# Architecture

System design and data flow for the WTCS Map Vote application.

---

## Overview

WTCS Map Vote is a real-time map voting/banning system for esports tournaments. It enables tournament administrators to create voting sessions where players select or eliminate maps using one of two formats: ABBA (2-player alternating bans) or Multiplayer (simultaneous voting rounds).

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Admin Views │  │Player Views │  │    Shared Components    │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                      │
│                   TanStack Router                               │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                    WebSocket/HTTP
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                          ▼                                      │
│                   Convex Backend                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Queries   │  │  Mutations  │  │   Scheduled Functions   │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                      │
│                   Convex Database                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 7 |
| Routing | TanStack Router (file-based) |
| Styling | Tailwind CSS 4, CSS Variables |
| Components | shadcn/ui (Base UI primitives) |
| Backend | Convex (database, functions, real-time) |
| Auth | Convex Auth (Google OAuth) |
| Hosting | Netlify (frontend), Convex Cloud (backend) |

---

## Frontend Architecture

### Route Structure

```
src/routes/
├── __root.tsx              # Root layout (providers, global UI)
├── index.tsx               # Home redirect → /admin/dashboard
├── login.tsx               # Admin Google OAuth login
├── admin.tsx               # Admin layout wrapper
├── admin/
│   ├── dashboard.tsx       # Active sessions list
│   ├── create.tsx          # Create new session
│   ├── teams.tsx           # Team management
│   └── session.$sessionId.tsx  # Session detail & control
├── lobby.$token.tsx        # Player waiting room
├── vote.$token.tsx         # Player voting interface
└── results.$sessionId.tsx  # Session results page
```

### Component Organization

```
src/components/
├── ui/           # shadcn/ui primitives (do not edit directly)
├── layout/       # Layout components (AdminSidebar, headers)
└── session/      # Session-specific components (SessionCard)
```

### Data Flow

1. **Real-time subscriptions** via Convex `useQuery` hooks
2. **Mutations** via Convex `useMutation` hooks
3. **Optimistic updates** handled by Convex client
4. **WebSocket reconnection** managed automatically

---

## Backend Architecture (Planned)

### Convex Functions

| Type | Purpose |
|------|---------|
| Queries | Read data, subscribe to real-time updates |
| Mutations | Write data, validate business logic |
| Actions | External API calls, complex operations |
| Scheduled | Timer expiration, session cleanup |

### Data Model

See [SPECIFICATION.md](./SPECIFICATION.md#7-data-model) for the complete schema.

**Core Tables:**
- `admins` - Admin users (Google OAuth)
- `teams` - Registered teams
- `maps` - Master map pool
- `sessions` - Voting sessions
- `sessionPlayers` - Player slots with tokens
- `sessionMaps` - Maps assigned to sessions
- `votes` - Individual votes (Multiplayer)
- `auditLogs` - Action history

### Authentication

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin     │────▶│ Google OAuth│────▶│Email Check  │
│   Login     │     │   Flow      │     │(Whitelist)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
              ┌─────────────┐
              │  Dashboard  │
              └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Player    │────▶│Token Lookup │────▶│ IP Lock     │
│  Token URL  │     │             │     │ Check       │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
              ┌─────────────┐
              │ Lobby/Vote  │
              └─────────────┘
```

---

## Session State Machine

```
┌──────────┐     ┌─────────┐     ┌─────────────┐     ┌──────────┐
│  DRAFT   │────▶│ WAITING │────▶│ IN_PROGRESS │────▶│ COMPLETE │
└──────────┘     └─────────┘     └─────────────┘     └──────────┘
     │                │                 │
     │                │                 ▼
     │                │          ┌──────────┐
     │                └─────────▶│  PAUSED  │
     │                           └──────────┘
     ▼
┌──────────┐
│ EXPIRED  │  (2 weeks without starting)
└──────────┘
```

---

## Voting Formats

### ABBA Format (2 Players)

Turn order: A → B → B → A
- 5 maps in pool
- 4 bans total
- 1 winner remains

### Multiplayer Format (2-4 Players)

Round-based simultaneous voting:
- All players vote at once
- Maps with votes are eliminated
- Repeat until 1 map remains
- Deadlock handling: revote → random selection

---

## Real-Time Features

| Feature | Implementation |
|---------|---------------|
| Session state | Convex subscription |
| Map updates | Convex subscription |
| Timer countdown | Server-authoritative with client display |
| Player presence | Heartbeat + WebSocket status |
| Vote reveals | Batch update after round |

---

## Security Model

- **Admin auth**: Google OAuth + email whitelist
- **Player auth**: Cryptographic tokens + IP locking
- **Server validation**: All logic runs server-side
- **Rate limiting**: Prevent spam submissions

---

## Infrastructure

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   OVH       │────▶│ Cloudflare  │────▶│   Netlify   │
│  (Domain)   │     │  (DNS/CDN)  │     │  (Frontend) │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               │
                                        ┌──────┴──────┐
                                        │   Convex    │
                                        │   Cloud     │
                                        │ (Backend)   │
                                        └─────────────┘
```
