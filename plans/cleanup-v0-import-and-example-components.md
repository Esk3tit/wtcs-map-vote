# chore: Remove unused v0-import directory and example components

## Overview

Remove unused code artifacts that were part of the initial scaffolding:
- `_v0-import/` directory (Vercel v0 generated components, now fully extracted)
- `src/components/example.tsx` and `src/components/component-example.tsx` (demo components)

## Verification Summary

### v0-import Components - All Extracted

All v0 components have been properly integrated into TanStack Router file-based routes:

| v0-import Component | Extracted To |
|---------------------|--------------|
| `admin-login.tsx` | `src/routes/login.tsx` |
| `admin-dashboard.tsx` | `src/routes/admin/dashboard.tsx` |
| `create-session-form.tsx` | `src/routes/admin/create.tsx` |
| `teams-management.tsx` | `src/routes/admin/teams.tsx` |
| `session-detail.tsx` | `src/routes/admin/session.$sessionId.tsx` |
| `player-lobby.tsx` | `src/routes/lobby.$token.tsx` |
| `player-voting-abba.tsx` | `src/routes/vote.$token.tsx` |
| `player-voting-multiplayer.tsx` | `src/routes/vote.$token.tsx` |
| `voting-results.tsx` | `src/routes/results.$sessionId.tsx` |
| `theme-provider.tsx` | Not needed (CSS handles theming) |

### v0-import Hooks - Unused

- `use-mobile.ts` - Zero imports in `src/`
- `use-toast.ts` - Zero imports in `src/` (using sonner instead)

### v0-import Public Assets - Already Copied

All 17 assets already exist in `/public`:
- Map images: `dust2.jpg`, `mirage.jpg`, `inferno.jpg`, `nuke.jpg`, `ancient.jpg`, `anubis.jpg`, `vertigo.jpg`
- Icons: `icon.svg`, `icon-dark-32x32.png`, `icon-light-32x32.png`, `apple-icon.png`
- Placeholders: `placeholder.jpg`, `placeholder.svg`, `placeholder-logo.png`, `placeholder-logo.svg`, `placeholder-user.jpg`
- Other: `admin-interface.png`

### Example Components - Unused

- `ComponentExample` exported but never imported in any route
- Only circular self-references between the two files

## Acceptance Criteria

- [ ] Delete `_v0-import/` directory completely
- [ ] Delete `src/components/example.tsx`
- [ ] Delete `src/components/component-example.tsx`
- [ ] Remove from git tracking
- [ ] Verify build still succeeds (`bun run build`)
- [ ] Verify lint passes (`bun run lint`)

## Implementation

```bash
# Remove files
rm -rf _v0-import/
rm src/components/example.tsx
rm src/components/component-example.tsx

# Verify build
bun run build
bun run lint

# Stage and commit
git add -A
git commit -m "chore: remove unused v0-import directory and example components

- Delete _v0-import/ (all components extracted to routes)
- Delete example.tsx and component-example.tsx (unused demo code)
- Verified: no imports reference these files
- Build and lint pass"
```

## Risk Assessment

**Risk Level:** Very Low

- No imports reference these files
- All functionality already exists in proper routes
- Easy to recover from git history if needed
