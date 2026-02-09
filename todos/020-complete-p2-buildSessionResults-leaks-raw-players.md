# buildSessionResults Returns Raw Player Docs

**Priority:** P2
**Status:** ready
**Source:** WAR-35 review (security-sentinel)
**Files:** `convex/sessions.ts`

## Problem

`buildSessionResults` returns a `players` field containing raw `Doc<"sessionPlayers">` objects, which include `token` and `ipAddress`. Currently no caller destructures `players` from the result — only `maps`, `teams`, `winnerMap`, and `banHistory` are used. However:

1. The raw data is in the return value, creating a latent GDPR risk
2. If a future developer adds `players` to the `getSessionResults` query response (which is unauthenticated), tokens and IPs would leak

Convex `returns` validators on `getSessionResults` currently prevent this from reaching the client, but it's defense-in-depth to fix.

## Recommendation

Either:
- Remove `players` from the `buildSessionResults` return type (break out player queries where needed)
- Apply `toAdminPlayer()` or `toSanitizedPlayer()` before returning

## References

- `convex/sessions.ts` `buildSessionResults` (lines 207-236)
- `convex/sessions.ts` `getSessionResults` query (consumer)
