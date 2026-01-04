# WTCS Map Vote/Ban System — Product & Engineering Specification

**Version:** 1.0  
**Last Updated:** January 2, 2026  
**Status:** Ready for Development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [User Roles & Authentication](#2-user-roles--authentication)
3. [Session Management](#3-session-management)
4. [Voting Formats](#4-voting-formats)
5. [Map Management](#5-map-management)
6. [Real-Time Features](#6-real-time-features)
7. [Data Model](#7-data-model)
8. [Convex Functions](#8-convex-functions)
9. [UI Screens & Routes](#9-ui-screens--routes)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Technical Stack](#11-technical-stack)
12. [Security Considerations](#12-security-considerations)
13. [Future Considerations](#13-future-considerations)

---

## 1. Project Overview

### 1.1 Purpose

A private web-based map vote/ban system for esports matches. The system enables tournament administrators to create voting sessions where players select or eliminate maps using one of two formats: ABBA (2-player alternating bans) or Multiplayer (simultaneous voting rounds).

### 1.2 Target Users

- **Administrators:** Tournament organizers (WTCS staff) who create and manage voting sessions
- **Players:** Competitors who participate in map bans/votes via temporary access tokens

### 1.3 Key Characteristics

- **Private access** — No public sessions, token-gated player access
- **Real-time** — Live updates for all participants via WebSocket subscriptions
- **Server-authoritative** — All vote logic runs server-side to prevent tampering
- **Multi-session** — Support for 6+ concurrent sessions
- **Mobile-responsive** — Works on desktop and mobile browsers

### 1.4 Scale

- ~12 concurrent users maximum (players + staff)
- Primary user base: EU, Russia, Ukraine with some Western/South American users
- Not latency-sensitive (voting, not gameplay)

---

## 2. User Roles & Authentication

### 2.1 Role Hierarchy

```
Root Admin
    └── Admin
            └── Player (temporary, session-scoped)
```

### 2.2 Root Admin

- **Setup:** Manual database entry during initial deployment (no hardcoded emails)
- **Capabilities:**
  - All Admin capabilities
  - Grant/revoke Admin access to other users
  - View all admins and manage whitelist

### 2.3 Admins

- **Authentication:** Google OAuth 2.0
- **Access Control:** Email whitelist (extensible to support domain restrictions in future)
- **Capabilities:**
  - Create, edit, start, pause, resume, and end sessions
  - Manage registered teams
  - Manage map pool (add/edit/delete maps)
  - View all sessions and audit logs
  - Generate player access tokens
  - Intervene in sessions (force random, vote on behalf of disconnected players)

### 2.4 Players

- **Authentication:** Temporary access tokens (no account required)
- **Token Characteristics:**
  - URL format: `https://wtcsmapban.com/vote/{token}`
  - Unique per player per session
  - Validity: Until session ends (24-hour maximum as fallback, configurable)
  - IP-locked on first use (prevents sharing mid-session)
- **Capabilities:**
  - Join assigned session
  - Submit bans/votes when it's their turn
  - View real-time session state

### 2.5 Authentication Flow

**Admin Flow:**
1. Navigate to `/login`
2. Click "Sign in with Google"
3. Google OAuth redirect
4. Backend validates email against whitelist
5. If approved → redirect to `/admin/dashboard`
6. If not approved → show "Access denied" message

**Player Flow:**
1. Receive token URL from admin (out-of-band: Discord, email, etc.)
2. Navigate to token URL
3. Backend validates token exists and is not expired
4. If first use → lock token to current IP address
5. If IP matches → show lobby/voting interface
6. If IP mismatch → show "Session locked to another device" error

---

## 3. Session Management

### 3.1 Session Lifecycle

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
│ EXPIRED  │  (if not started within 2 weeks)
└──────────┘
```

**States:**
- **DRAFT:** Session created but not yet finalized (can edit all settings)
- **WAITING:** Session finalized, waiting for players to connect and admin to start
- **IN_PROGRESS:** Active voting in progress
- **PAUSED:** Voting paused (e.g., player disconnect)
- **COMPLETE:** Voting finished, winner determined
- **EXPIRED:** Auto-expired after 2 weeks without starting

### 3.2 Session Creation

**Required Fields:**
- Match name (e.g., "Grand Final", "Match A5")
- Format: ABBA or Multiplayer
- Player/team assignments
- Map pool selection (default: 5 maps, configurable)
- Turn timer duration (default: 30 seconds)

**Format-Specific Configuration:**

*ABBA (2 players):*
- Player A assignment (team name)
- Player B assignment (team name)

*Multiplayer (2-4 players, configurable):*
- Player 1-N assignments (team name for each)
- Number of players (2, 3, or 4)

### 3.3 Session Editing

**Editable before WAITING/IN_PROGRESS:**
- Format (ABBA ↔ Multiplayer)
- All other fields

**Editable during WAITING (before start):**
- Match name
- Team names/assignments
- Map pool selection
- Turn timer duration

**NOT editable once created:**
- Format cannot change after session moves to WAITING

### 3.4 Session Actions

| Action | Available In States | Description |
|--------|-------------------|-------------|
| Edit | DRAFT, WAITING | Modify session configuration |
| Finalize | DRAFT | Move to WAITING, generate player tokens |
| Start | WAITING | Begin voting (requires all players connected) |
| Pause | IN_PROGRESS | Pause voting and timers |
| Resume | PAUSED | Resume voting and timers |
| Force Random | IN_PROGRESS, PAUSED | Admin picks random remaining map as winner |
| Vote on Behalf | IN_PROGRESS | Admin submits vote for disconnected player |
| End | Any (except COMPLETE, EXPIRED) | Force-end session |
| Reset | COMPLETE | Reset session to WAITING for replay |
| Clone | Any | Create new session with same configuration |

### 3.5 Session Expiration

- Sessions in DRAFT or WAITING state expire after **2 weeks** of inactivity
- Expired sessions move to EXPIRED state and are hidden from active views
- Expired sessions are retained in database (for audit purposes)

---

## 4. Voting Formats

### 4.1 ABBA Format (2 Players)

**Purpose:** Alternating ban format for 1v1 or team-vs-team matches.

**Turn Order:**
1. Player A bans a map
2. Player B bans a map
3. Player B bans a map
4. Player A bans a map
5. Remaining map is the winner

**Rules:**
- 5 maps in pool → 4 bans → 1 winner
- One ban per turn, turns alternate in ABBA pattern
- Each turn has a timer (default: 30 seconds)
- Turn cannot be skipped (auto-random if timer expires)

**Timer Expiry:**
- When timer reaches 0, system automatically bans a random available map on behalf of the current player
- Session continues to next turn

**Visual Indicators:**
- Current turn highlighted (green banner for active player)
- Progress tracker showing completed/remaining turns
- Countdown timer (amber/warning color when low)
- Banned maps shown grayed out with red X and "Banned by [Team]" label

### 4.2 Multiplayer Format (2-4 Players)

**Purpose:** Simultaneous voting for multi-team scenarios.

**Round Flow:**
1. All players vote simultaneously (one vote per player per round)
2. Timer counts down during voting
3. When all votes submitted (or timer expires), reveal results
4. Any map receiving ≥1 vote is eliminated
5. Repeat until one map remains

**Player Count:** Configurable (2, 3, or 4 players)

**Rules:**
- Each player votes for ONE map to eliminate per round
- Votes are hidden until all submitted or timer expires
- Maps with any votes are eliminated
- Maps with zero votes survive to next round

**Resolution Scenarios:**

| Scenario | Maps Left | Action |
|----------|-----------|--------|
| Normal | >1 | Start new round |
| Winner | 1 | That map is the winner |
| Deadlock (all eliminated) | 0 | Revote with same maps |
| Revote deadlock | 0 | Random selection from revote pool |

**Timer Expiry Handling:**
- Admin chooses action:
  - **Pause:** Wait for player to return (5-minute auto-pause on disconnect, extendable by admin)
  - **Skip:** Proceed without non-voters' input
  - **Vote on behalf:** Admin submits vote for missing player(s)

**Visual Indicators:**
- Vote status per player (checkmark = voted, spinner = waiting)
- Your vote shown with amber "Your vote" badge (pending state)
- Round results reveal animation
- Eliminated maps shown grayed with vote counts

### 4.3 Disconnect Handling (Both Formats)

**Detection:** Player WebSocket disconnects or heartbeat timeout (15 seconds)

**Auto-Response:**
1. Timer pauses immediately
2. 5-minute grace period starts
3. Admin notified of disconnection
4. Admin can:
   - **Wait:** Extend pause indefinitely until player returns
   - **Random:** Force random selection to end session
   - **Vote on behalf:** Submit a ban/vote for the disconnected player
   - **Resume:** If player reconnects, resume normal voting

**Reconnection:**
- If same IP → resume session
- If different IP → block access (token already IP-locked)

---

## 5. Map Management

### 5.1 Map Pool System

Maps are managed via an admin CMS interface, not hardcoded.

**Map Entity:**
- ID (auto-generated)
- Name (e.g., "Jungle", "Alaska", "Ardennes")
- Image URL (uploaded file)
- Active (boolean — available for session creation)
- Created at
- Updated at

### 5.2 Admin Map Management

**Capabilities:**
- Add new maps (name + image upload)
- Edit existing maps (name, image)
- Deactivate maps (soft delete — hide from new sessions)
- Reactivate maps
- View all maps (active and inactive)

**Image Requirements:**
- Aspect ratio: 16:9 recommended
- Format: JPG, PNG, WebP
- Max size: 2MB
- Storage: Convex file storage or external CDN

### 5.3 Session Map Pool

When creating a session:
1. Admin sees grid of all active maps
2. Admin selects maps for this session's pool
3. Default: 5 maps (configurable, minimum based on format)
4. Selected maps are copied to session (snapshot — changes to master map don't affect active sessions)

**Minimum Maps by Format:**
- ABBA: 5 maps (4 bans + 1 winner)
- Multiplayer: 2+ maps

---

## 6. Real-Time Features

### 6.1 Real-Time Updates

Powered by Convex WebSocket subscriptions.

**Subscribed Data:**
- Session state (status, current turn, timer)
- Map states (available, banned, winner)
- Player connection status
- Vote submissions (revealed after round in multiplayer)

**Update Frequency:**
- Instant for user actions (bans, votes)
- 1-second intervals for timer countdown

### 6.2 Countdown Timer

**Behavior:**
- Starts when turn/round begins
- Counts down from configured duration (default: 30s)
- Pauses if session paused
- Visual warning at 10 seconds (color change, optional pulse animation)
- Audio alert at 5 seconds

**Server-Authoritative:**
- Timer state stored server-side
- Client displays server time, not local countdown
- Prevents manipulation via client clock changes

### 6.3 Audio Alerts

| Event | Sound | Priority |
|-------|-------|----------|
| Your turn starts | Attention chime | Required |
| Timer warning (5s) | Urgent beep | Required |
| Timer expired | Timeout buzzer | Required |
| Vote submitted | Click/confirm | Nice to have |
| Map banned | Elimination sound | Nice to have |
| Winner revealed | Victory fanfare | Nice to have |

**Implementation:**
- HTML5 Audio API
- Sounds bundled as static assets
- User can toggle audio on/off (persisted in localStorage)

### 6.4 Connection Status

**Indicators:**
- Green dot = Connected
- Yellow dot = Reconnecting
- Red dot = Disconnected

**Shown for:**
- Current player (own status)
- All players in session (for admin view and player awareness)

---

## 7. Data Model

### 7.1 Convex Schema

```typescript
// schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Admin users (Google OAuth)
  admins: defineTable({
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    isRootAdmin: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.number(),
  }).index("by_email", ["email"]),

  // Registered teams (reusable across sessions)
  teams: defineTable({
    name: v.string(),
    logoUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // Master map pool (CMS-managed)
  maps: defineTable({
    name: v.string(),
    imageUrl: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active", ["isActive"]),

  // Voting sessions
  sessions: defineTable({
    matchName: v.string(),
    format: v.union(v.literal("ABBA"), v.literal("MULTIPLAYER")),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("WAITING"),
      v.literal("IN_PROGRESS"),
      v.literal("PAUSED"),
      v.literal("COMPLETE"),
      v.literal("EXPIRED")
    ),
    
    // Configuration
    turnTimerSeconds: v.number(), // default: 30
    mapPoolSize: v.number(), // default: 5
    playerCount: v.number(), // 2 for ABBA, 2-4 for MULTIPLAYER
    
    // State
    currentTurn: v.number(), // 0-indexed turn number
    currentRound: v.number(), // for MULTIPLAYER
    timerStartedAt: v.optional(v.number()), // timestamp when current timer started
    timerPausedAt: v.optional(v.number()), // timestamp when paused (null if running)
    winnerMapId: v.optional(v.id("sessionMaps")),
    
    // Metadata
    createdBy: v.id("admins"),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(), // auto-expire timestamp
  })
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"])
    .index("by_expiresAt", ["expiresAt"]),

  // Player slots in a session
  sessionPlayers: defineTable({
    sessionId: v.id("sessions"),
    role: v.string(), // "PLAYER_A", "PLAYER_B", "PLAYER_1", "PLAYER_2", etc.
    teamName: v.string(),
    token: v.string(), // unique access token
    tokenExpiresAt: v.number(),
    ipAddress: v.optional(v.string()), // locked on first use
    isConnected: v.boolean(),
    lastHeartbeat: v.optional(v.number()),
    hasVotedThisRound: v.boolean(), // for MULTIPLAYER
  })
    .index("by_session", ["sessionId"])
    .index("by_token", ["token"]),

  // Maps assigned to a session (snapshot from master pool)
  sessionMaps: defineTable({
    sessionId: v.id("sessions"),
    mapId: v.id("maps"), // reference to master map
    name: v.string(), // snapshot
    imageUrl: v.string(), // snapshot
    state: v.union(
      v.literal("AVAILABLE"),
      v.literal("BANNED"),
      v.literal("WINNER")
    ),
    bannedByPlayerId: v.optional(v.id("sessionPlayers")),
    bannedAtTurn: v.optional(v.number()),
    bannedAtRound: v.optional(v.number()),
    voteCount: v.optional(v.number()), // for MULTIPLAYER reveal
  })
    .index("by_session", ["sessionId"])
    .index("by_session_state", ["sessionId", "state"]),

  // Individual votes (for MULTIPLAYER rounds)
  votes: defineTable({
    sessionId: v.id("sessions"),
    round: v.number(),
    playerId: v.id("sessionPlayers"),
    mapId: v.id("sessionMaps"),
    submittedAt: v.number(),
    submittedByAdmin: v.boolean(), // true if admin voted on behalf
  })
    .index("by_session_round", ["sessionId", "round"])
    .index("by_player_round", ["playerId", "round"]),

  // Audit log
  auditLogs: defineTable({
    sessionId: v.id("sessions"),
    action: v.string(), // "BAN", "VOTE", "START", "PAUSE", "RESUME", "COMPLETE", etc.
    actorType: v.union(v.literal("ADMIN"), v.literal("PLAYER"), v.literal("SYSTEM")),
    actorId: v.optional(v.string()), // admin ID, player ID, or null for system
    details: v.object({
      mapId: v.optional(v.id("sessionMaps")),
      mapName: v.optional(v.string()),
      teamName: v.optional(v.string()),
      turn: v.optional(v.number()),
      round: v.optional(v.number()),
      reason: v.optional(v.string()), // "TIMEOUT", "MANUAL", "ADMIN_OVERRIDE"
    }),
    timestamp: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"]),
});
```

### 7.2 Relationships Diagram

```
admins
   │
   ├──< sessions (createdBy)
   │        │
   │        ├──< sessionPlayers
   │        │        │
   │        │        └──< votes
   │        │
   │        ├──< sessionMaps
   │        │
   │        └──< auditLogs
   │
teams (standalone, referenced by name in sessionPlayers)
   │
maps (master pool)
   │
   └──< sessionMaps (snapshot reference)
```

---

## 8. Convex Functions

### 8.1 Authentication Functions

```typescript
// auth.ts

// Verify Google OAuth token and check whitelist
mutation: authenticateAdmin({ googleToken: string })
  → { adminId, email, name, isRootAdmin } | { error: "NOT_WHITELISTED" }

// Check if email is whitelisted
query: isEmailWhitelisted({ email: string })
  → boolean

// Root admin: add email to whitelist
mutation: addAdminToWhitelist({ email: string, name: string })
  → { adminId }

// Root admin: remove admin access
mutation: removeAdmin({ adminId: Id })
  → { success: boolean }

// List all admins
query: listAdmins()
  → Admin[]
```

### 8.2 Team Functions

```typescript
// teams.ts

query: listTeams()
  → Team[]

mutation: createTeam({ name: string, logoUrl?: string })
  → { teamId }

mutation: updateTeam({ teamId: Id, name?: string, logoUrl?: string })
  → { success: boolean }

mutation: deleteTeam({ teamId: Id })
  → { success: boolean }
```

### 8.3 Map Functions

```typescript
// maps.ts

query: listMaps({ includeInactive?: boolean })
  → Map[]

query: getMap({ mapId: Id })
  → Map

mutation: createMap({ name: string, imageUrl: string })
  → { mapId }

mutation: updateMap({ mapId: Id, name?: string, imageUrl?: string })
  → { success: boolean }

mutation: deactivateMap({ mapId: Id })
  → { success: boolean }

mutation: reactivateMap({ mapId: Id })
  → { success: boolean }

// File upload for map images
mutation: generateUploadUrl()
  → { uploadUrl: string }
```

### 8.4 Session Functions

```typescript
// sessions.ts

// Queries
query: listSessions({ status?: Status[], limit?: number })
  → Session[]

query: getSession({ sessionId: Id })
  → SessionWithDetails

query: getSessionByToken({ token: string })
  → SessionWithDetails | { error: "INVALID_TOKEN" | "EXPIRED" | "IP_MISMATCH" }

// Real-time subscription for session state
query: subscribeToSession({ sessionId: Id })
  → SessionState (reactive)

// Mutations - Creation & Configuration
mutation: createSession({
  matchName: string,
  format: "ABBA" | "MULTIPLAYER",
  playerCount: number,
  turnTimerSeconds: number,
  mapPoolSize: number,
})
  → { sessionId }

mutation: updateSession({
  sessionId: Id,
  matchName?: string,
  turnTimerSeconds?: number,
  // Note: format cannot be changed after creation
})
  → { success: boolean }

mutation: assignPlayer({
  sessionId: Id,
  role: string,
  teamName: string,
})
  → { playerId, token }

mutation: updatePlayerAssignment({
  playerId: Id,
  teamName: string,
})
  → { success: boolean }

mutation: setSessionMaps({
  sessionId: Id,
  mapIds: Id[],
})
  → { success: boolean }

// Mutations - Lifecycle
mutation: finalizeSession({ sessionId: Id })
  → { success: boolean } // DRAFT → WAITING

mutation: startSession({ sessionId: Id })
  → { success: boolean } // WAITING → IN_PROGRESS

mutation: pauseSession({ sessionId: Id })
  → { success: boolean }

mutation: resumeSession({ sessionId: Id })
  → { success: boolean }

mutation: endSession({ sessionId: Id })
  → { success: boolean } // Force end

mutation: resetSession({ sessionId: Id })
  → { success: boolean } // COMPLETE → WAITING (replay)

mutation: cloneSession({ sessionId: Id })
  → { newSessionId } // Create copy

// Mutations - Admin Interventions
mutation: forceRandomSelection({ sessionId: Id })
  → { winnerMapId }

mutation: adminVoteOnBehalf({
  sessionId: Id,
  playerId: Id,
  mapId: Id,
})
  → { success: boolean }
```

### 8.5 Voting Functions

```typescript
// votes.ts

// Player submits a ban (ABBA)
mutation: submitBan({
  token: string,
  mapId: Id,
  clientIp: string,
})
  → { success: boolean } | { error: "NOT_YOUR_TURN" | "MAP_UNAVAILABLE" | ... }

// Player submits a vote (MULTIPLAYER)
mutation: submitVote({
  token: string,
  mapId: Id,
  clientIp: string,
})
  → { success: boolean } | { error: "ALREADY_VOTED" | "MAP_UNAVAILABLE" | ... }

// Process round results (called by system or admin)
mutation: resolveRound({ sessionId: Id })
  → { 
    eliminatedMaps: Id[],
    remainingMaps: Id[],
    isComplete: boolean,
    winnerMapId?: Id,
    needsRevote: boolean,
  }

// Player heartbeat (connection status)
mutation: playerHeartbeat({ token: string, clientIp: string })
  → { success: boolean }
```

### 8.6 Audit Functions

```typescript
// audit.ts

query: getSessionAuditLog({ sessionId: Id })
  → AuditLogEntry[]

// Scheduled job: clean up old audit logs (if needed for storage)
mutation: cleanupOldAuditLogs({ olderThanDays: number })
  → { deletedCount: number }
```

### 8.7 Scheduled Functions

```typescript
// crons.ts

// Run every hour: expire stale sessions
scheduled: expireStaleSessions()
  → { expiredCount: number }

// Run every minute: check for timer expirations
scheduled: checkTimerExpirations()
  → { processedCount: number }

// Optional: Run daily: cleanup old audit logs
scheduled: cleanupAuditLogs()
  → { deletedCount: number }
```

---

## 9. UI Screens & Routes

### 9.1 Route Structure

```
/                           → Redirect to /admin/dashboard
/login                      → Admin Google OAuth login

/admin                      → Layout with sidebar
  /admin/dashboard          → Active sessions list
  /admin/teams              → Team management
  /admin/maps               → Map pool management (CMS)
  /admin/create             → Create new session
  /admin/session/:id        → Session detail & control
  /admin/session/:id/edit   → Edit session (before start)
  /admin/settings           → Admin management (root only)

/lobby/:token               → Player waiting room
/vote/:token                → Player voting interface
/results/:sessionId         → Results page (public-ish, no auth)
```

### 9.2 Admin Screens

#### Login (`/login`)
- Centered card with WTCS branding
- "Sign in with Google" button
- Error state for non-whitelisted emails
- Redirect to dashboard on success

#### Dashboard (`/admin/dashboard`)
- Sidebar navigation (Sessions, Teams, Maps, Settings)
- Header with "Active Sessions" title + "Create Session" button
- Session cards grid:
  - Match name
  - Teams (vs format)
  - Format badge (ABBA / Multiplayer)
  - Status badge (color-coded)
  - Player connection status
  - Created timestamp
  - "View" button
- Empty state with illustration
- Filter/sort options (by status, date)

#### Teams Management (`/admin/teams`)
- Header with "Registered Teams" + "Add Team" button
- Table: team name, logo, sessions count, date added, actions
- Add/Edit modal: name input, logo upload
- Delete confirmation dialog
- Empty state

#### Map Management (`/admin/maps`)
- Header with "Map Pool" + "Add Map" button
- Grid of map cards:
  - Map image (16:9)
  - Map name
  - Active/Inactive badge
  - Edit/Deactivate actions
- Add/Edit modal: name input, image upload
- Drag-and-drop reordering (optional, nice-to-have)
- Show inactive maps toggle

#### Create Session (`/admin/create`)
- Back button to dashboard
- Form sections:
  1. **Match Name** — Text input
  2. **Format** — Toggle cards (ABBA vs Multiplayer with descriptions)
  3. **Player Count** — (Multiplayer only) 2/3/4 selector
  4. **Team Assignments** — Comboboxes (search registered teams or type custom)
  5. **Map Pool** — Grid of active maps with checkboxes, counter shows selected/required
  6. **Turn Timer** — Number input with seconds label
- "Create Session" submit button (disabled until valid)

#### Session Detail (`/admin/session/:id`)
- Back button
- Header: match name, format badge, status badge
- Action buttons based on state:
  - DRAFT: "Finalize", "Edit", "Delete"
  - WAITING: "Start Session", "Edit"
  - IN_PROGRESS: "Pause", "Force Random", "End Session"
  - PAUSED: "Resume", "Force Random", "End Session"
  - COMPLETE: "Reset", "Clone", "View Results"

- **Player Access Codes Card:**
  - For each player slot:
    - Team name + role description
    - Access code/token (monospace) with copy button
    - Status: "Not activated" | "Connected" | "Disconnected"
    - IP address (if locked)

- **Live Status Card:**
  - Current turn/round indicator
  - Map grid showing current state
  - Countdown timer (large)
  - For multiplayer: vote submission status per player

- **Vote History Card:**
  - Table: turn/round #, team, action, map, timestamp
  - Empty state before any votes

#### Edit Session (`/admin/session/:id/edit`)
- Same form as Create, pre-populated
- Only editable fields shown (based on current state)
- "Save Changes" button

#### Admin Settings (`/admin/settings`) — Root Admin Only
- Admin whitelist management
- Add admin: email input + "Add" button
- Admin list: email, name, role (Root/Admin), date added, remove button
- Cannot remove yourself or demote last root admin

### 9.3 Player Screens

#### Lobby (`/lobby/:token`)
- Match name + format badge
- Identity card:
  - "You are joining as: [Team Name]"
  - Role description (e.g., "Player A - Bans 1st & 4th")
  - Connection status indicator
  - "Session locked to your device" message
- Pulsing "Waiting for admin to start..." animation
- Map preview: row of map thumbnails showing pool
- Other players' connection status
- Footer: "Admin will start when all players are ready"

#### Voting - ABBA (`/vote/:token`)
- Header: match name, format badge, "You are: [Team Name]"
- Turn status banner:
  - Your turn: Green "YOUR TURN TO BAN" banner
  - Waiting: Gray "Waiting for [Other Team]..." banner
- Large countdown timer (amber when your turn, gray when waiting)
- Map grid (5 cards):
  - Available: full color, hoverable, "BAN" button on hover/tap
  - Banned: grayscale, red X overlay, "Banned by [Team]" label
- Progress tracker: horizontal stepper showing turn order with completions
- Footer: audio toggle, "Session locked to your device"
- Confirmation dialog before ban submission

#### Voting - Multiplayer (`/vote/:token`)
**State 1 - Voting:**
- "SELECT A MAP TO ELIMINATE" banner
- Countdown timer
- Map grid: clickable, amber border on selection
- "Confirm Vote" button (disabled until selection)
- Confirmation dialog

**State 2 - Waiting:**
- "VOTE SUBMITTED - WAITING FOR OTHERS" banner
- Your selected map has amber "Your vote" badge
- Other maps neutral
- Player status bar: shows who has voted (checkmarks/spinners)

**State 3 - Reveal:**
- "ROUND [N] RESULTS" banner
- Vote counts revealed on each map
- Elimination animation (maps with votes fade to gray + X)
- Maps with 0 votes get "Safe" badge
- Auto-advance to next round after 3 seconds

- Footer status bar: all players with vote status
- Previously eliminated maps shown in smaller section

#### Results (`/results/:sessionId`)
- Match name + teams + "COMPLETE" badge
- Trophy icon + large winning map card (amber glow)
- "WINNER" badge on map
- Ban history card: ordered list showing team + banned map for each turn/round
- Visual summary: row of all map thumbnails (banned ones grayed with X, winner highlighted)
- "Back to Lobby" or close message for players
- (Admins see additional "Create New Session" button)

### 9.4 Error States

| Route | Error | Display |
|-------|-------|---------|
| `/vote/:token` | Invalid token | "Invalid or expired link. Contact your tournament admin." |
| `/vote/:token` | IP mismatch | "This session is locked to another device." |
| `/vote/:token` | Session ended | Redirect to `/results/:sessionId` |
| `/login` | Not whitelisted | "Access denied. Your email is not authorized." |
| `/admin/*` | Not logged in | Redirect to `/login` |
| Any | Network error | Toast notification + retry button |

---

## 10. Edge Cases & Error Handling

### 10.1 Voting Edge Cases

| Scenario | Handling |
|----------|----------|
| Player submits ban for already-banned map | Reject with error, no state change |
| Player submits during wrong turn (ABBA) | Reject with "NOT_YOUR_TURN" error |
| Player double-submits vote (Multiplayer) | Reject second vote, keep first |
| Timer expires with no submission (ABBA) | Auto-ban random available map |
| Timer expires with missing votes (Multiplayer) | Admin chooses: pause, skip, or vote on behalf |
| All maps eliminated in round (Multiplayer) | Trigger revote phase |
| Revote also eliminates all | Random selection from revote pool |
| Only 1 map remains after round | Declare winner, end session |

### 10.2 Connection Edge Cases

| Scenario | Handling |
|----------|----------|
| Player disconnects mid-turn | Pause timer, 5-min grace period, notify admin |
| Player reconnects within grace period | Resume timer from paused state |
| Player reconnects after grace period | Admin must manually resume |
| Player tries different IP | Block access, show "locked to another device" |
| Admin disconnects | Session continues, admin can rejoin |
| All players disconnect | Session pauses, waits for reconnection |

### 10.3 Session Edge Cases

| Scenario | Handling |
|----------|----------|
| Admin starts with player not connected | Block start, show "waiting for players" |
| Admin edits during active voting | Block, only allowed in DRAFT/WAITING |
| Session reset after completion | Clear votes, reset maps to AVAILABLE, go to WAITING |
| Session cloned | Copy all config, generate new tokens, start as DRAFT |
| 2-week expiration reached | Auto-transition to EXPIRED state |

### 10.4 Concurrency Edge Cases

| Scenario | Handling |
|----------|----------|
| Two votes arrive simultaneously | Convex handles via optimistic concurrency; first write wins |
| Admin and player act same moment | Server-side ordering; atomic transactions |
| Multiple browser tabs same token | All tabs receive updates; only one can submit |

---

## 11. Technical Stack

### 11.1 Frontend

| Technology | Purpose |
|------------|---------|
| Vite | Build tool and dev server |
| React 19 | UI framework |
| TypeScript | Type safety |
| TanStack Router | File-based routing, type-safe navigation |
| Tailwind CSS v4 | Styling (CSS variables, dark mode) |
| ShadCN UI (Base UI) | Component primitives |
| Lucide React | Icons |
| Sonner | Toast notifications |
| cmdk | Command palette / searchable dropdowns |

### 11.2 Backend

| Technology | Purpose |
|------------|---------|
| Convex | Real-time database, serverless functions, WebSocket subscriptions |
| Convex Auth | Authentication (Google OAuth integration) |
| Convex File Storage | Map image uploads |
| Convex Crons | Scheduled jobs (expiration, cleanup) |

### 11.3 Infrastructure

| Service | Purpose |
|---------|---------|
| Netlify | Static site hosting (frontend) |
| Convex Cloud | Backend hosting (database, functions) |
| OVH | Domain registration (wtcsmapban.com) |
| Cloudflare | DNS, CDN (via Netlify) |

### 11.4 Development Tools

| Tool | Purpose |
|------|---------|
| Bun | Package manager and runtime |
| ESLint | Linting |
| Prettier | Code formatting |
| CodeRabbit | Automated code review |

---

## 12. Security Considerations

### 12.1 Authentication & Authorization

- **Admin auth:** Google OAuth 2.0 with email whitelist
- **Player auth:** Cryptographically random tokens (URL-safe, 32+ characters)
- **Token generation:** Use `crypto.randomUUID()` or Convex's ID generation
- **IP locking:** Player tokens lock to first-use IP address

### 12.2 Server-Side Validation

All mutations validate:
- User identity (admin ID or player token)
- Permission for action (correct turn, correct session state)
- Data integrity (map exists, map available, session active)
- Rate limiting (prevent spam submissions)

### 12.3 Input Validation

- Sanitize all user inputs (team names, match names)
- Validate file uploads (type, size)
- Escape any user-generated content in UI

### 12.4 Data Protection

- Player IPs stored only for session duration
- Audit logs retained indefinitely (no PII beyond IP)
- No password storage (OAuth only)
- HTTPS enforced in production

### 12.5 Rate Limiting

- Max 10 vote attempts per minute per token
- Max 100 API calls per minute per admin
- WebSocket reconnection backoff

---

## 13. Future Considerations

### 13.1 Not in V1 (Documented for Later)

- **Spectator/broadcast view:** Read-only view for stream overlays
- **Tournament brackets:** Integration with bracket management
- **Custom audio uploads:** Admin-uploadable sound effects
- **Localization:** Multi-language support
- **Dark/light theme toggle:** Currently dark-only
- **Export functionality:** CSV/JSON export of results
- **Webhooks:** Notify external systems of results
- **Mobile app:** Native iOS/Android apps

### 13.2 Domain Restriction

The admin whitelist is email-based. Future enhancement could add:
- Domain-based restrictions (e.g., `*@wtcs.gg`)
- Role-based permissions beyond root/admin binary

### 13.3 Storage Scaling

Convex free tier considerations:
- Monitor database size
- Implement audit log cleanup if needed (configurable retention)
- Consider image CDN if file storage limits approached

### 13.4 Analytics

Potential future metrics:
- Session completion rates
- Average session duration
- Most banned maps
- Player engagement patterns

---

## Appendix A: Default Configuration Values

| Setting | Default | Range | Notes |
|---------|---------|-------|-------|
| Turn timer | 30 seconds | 10-120 | Per turn/round |
| Map pool size | 5 | 2-10 | Per session |
| Player count (Multiplayer) | 4 | 2-4 | Configurable |
| Token validity | 24 hours | - | Fallback, ends with session |
| Session expiry | 2 weeks | - | From creation if not started |
| Disconnect grace period | 5 minutes | - | Auto-pause duration |
| Heartbeat interval | 5 seconds | - | Client ping frequency |
| Heartbeat timeout | 15 seconds | - | Disconnect detection |

---

## Appendix B: Status Color Coding

| Status | Background | Text | Border |
|--------|------------|------|--------|
| DRAFT | `muted` | `muted-foreground` | `border` |
| WAITING | `chart-4/20` | `chart-4` | `chart-4/30` |
| IN_PROGRESS | `primary/20` | `primary` | `primary/30` |
| PAUSED | `amber-500/20` | `amber-500` | `amber-500/30` |
| COMPLETE | `green-500/20` | `green-500` | `green-500/30` |
| EXPIRED | `muted` | `muted-foreground` | `border` |

---

## Appendix C: Audit Log Action Types

| Action | Actor | Details |
|--------|-------|---------|
| `SESSION_CREATED` | ADMIN | - |
| `SESSION_UPDATED` | ADMIN | Changed fields |
| `SESSION_FINALIZED` | ADMIN | - |
| `SESSION_STARTED` | ADMIN | - |
| `SESSION_PAUSED` | ADMIN/SYSTEM | Reason |
| `SESSION_RESUMED` | ADMIN | - |
| `SESSION_ENDED` | ADMIN | - |
| `SESSION_RESET` | ADMIN | - |
| `SESSION_CLONED` | ADMIN | New session ID |
| `SESSION_EXPIRED` | SYSTEM | - |
| `PLAYER_CONNECTED` | PLAYER | IP address |
| `PLAYER_DISCONNECTED` | SYSTEM | - |
| `PLAYER_RECONNECTED` | PLAYER | - |
| `MAP_BANNED` | PLAYER/ADMIN | Map ID, turn/round |
| `VOTE_SUBMITTED` | PLAYER/ADMIN | Map ID, round |
| `ROUND_RESOLVED` | SYSTEM | Eliminated maps |
| `TIMER_EXPIRED` | SYSTEM | Turn/round |
| `RANDOM_SELECTION` | ADMIN/SYSTEM | Winner map ID |
| `WINNER_DECLARED` | SYSTEM | Map ID |

---

*End of Specification*
