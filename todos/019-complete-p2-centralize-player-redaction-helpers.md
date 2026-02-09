# Centralize Player Redaction Helpers

**Priority:** P2
**Status:** ready
**Source:** WAR-35 review (architecture-strategist, security-sentinel)
**Files:** `convex/sessions.ts`

## Problem

GDPR IP redaction is done inline per-query using destructuring patterns:
```typescript
rawPlayers.map(({ ipAddress, ...rest }) => ({ ...rest, isIpLocked: !!ipAddress }))
```

And `sanitizePlayer` uses an allowlist in a separate inline function. If a new query returns player data, developers must remember to apply the correct redaction pattern. There's no centralized enforcement.

## Recommendation

Extract two shared helpers:

1. **`toAdminPlayer(player)`** — strips `ipAddress`, adds `isIpLocked` boolean (for admin-facing queries like `getSession`)
2. **`toSanitizedPlayer(player)`** — allowlist of safe fields only (for player-facing queries like `getSessionByToken`)

Place in `convex/lib/playerRedaction.ts` or keep in `sessions.ts` as named private helpers.

## References

- `convex/sessions.ts` lines 288-323 (getSession handler, inline redaction)
- `convex/sessions.ts` lines 1186-1192 (sanitizePlayer inline function)
- `convex/admins.ts` `toAdminResponse` pattern (existing precedent)
