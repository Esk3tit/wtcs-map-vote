# Animation System Architecture

This document catalogs the animation approaches used across the WTCS Map Vote project, explains when to use each one, and describes the accessibility conventions that apply to all of them.

## Table of Contents

1. [Custom CSS Keyframes](#custom-css-keyframes)
2. [tw-animate-css Utilities](#tw-animate-css-utilities)
3. [CSS Transitions](#css-transitions)
4. [JS-Managed Animation State](#js-managed-animation-state)
5. [Decision Criteria](#decision-criteria)
6. [Accessibility: motion-safe Convention](#accessibility-motion-safe-convention)
7. [Z-Index Layering Scale](#z-index-layering-scale)
8. [Choreographed Sequences](#choreographed-sequences)
9. [Key Files](#key-files)

---

## Custom CSS Keyframes

Four custom keyframes are defined in the `@theme` block of `src/index.css`. Tailwind 4 exposes them as `animate-*` utilities automatically.

### `border-flash` (700ms)

- **Purpose:** Green inset box-shadow glow on the viewport edge when it becomes the player's turn (ABBA format).
- **Easing:** `ease-out`
- **Behavior:** Fades opacity 0 -> 1 (at 15%) -> 0. One-shot, `forwards` fill.
- **Used by:** `TurnFlashOverlay` (`motion-safe:animate-border-flash`).
- **Trigger:** JS state change (`isYourTurn` false-to-true transition). The overlay mounts, the keyframe plays, and `onAnimationEnd` unmounts it.

### `stamp-in` (400ms)

- **Purpose:** Overshoot bounce entrance for ban/elimination icons (X mark) and winner icons (Trophy).
- **Easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring overshoot)
- **Behavior:** scale 0 -> 1.2 (at 60%) -> 1. One-shot, `forwards` fill.
- **Used by:** `VoteMapCard` (ban overlay X icon, elimination X icon, winner Trophy icon), results page (Trophy hero icon).
- **Trigger:** React conditional rendering -- the icon mounts when the relevant state condition is true and the keyframe plays on mount.

### `timer-pulse` (300ms)

- **Purpose:** Subtle scale pulse on the countdown timer when a new turn/round starts.
- **Easing:** `ease-in-out`
- **Behavior:** scale 1 -> 1.05 (at 50%) -> 1. One-shot, no fill. GPU-composited (transform only).
- **Used by:** Vote page timer element (`motion-safe:animate-timer-pulse`).
- **Trigger:** React `key` prop change (`key={timer-${session.currentTurn}-${session.currentRound}}`). Changing the key forces React to unmount/remount the DOM node, which restarts the CSS animation.

### `winner-pulse` (1.5s)

- **Purpose:** Amber/gold glow that pulses and settles to a steady glow on the winning map card.
- **Easing:** `ease-in-out`
- **Behavior:** Box-shadow from 0 -> bright (at 20%) -> dim (at 40%) -> medium (at 60%) -> steady (at 100%). One-shot, `forwards` fill.
- **Used by:** `VoteMapCard` (winner state), results page winner card (`motion-safe:animate-winner-pulse`).
- **CSS variable:** `--winner-glow-rgb: 251, 191, 36` (amber-400) is extracted as a theme variable for the `rgba()` calls.
- **Performance note:** Uses `box-shadow` which triggers paint (not GPU-composited). This is acceptable because it applies to a single card as a one-shot animation. If jank appears on low-end devices, switch to a pseudo-element with `opacity` transition.

---

## tw-animate-css Utilities

The project imports `tw-animate-css` (line 2 of `src/index.css`), which provides Tailwind-native entrance animation utilities. These are used extensively for fade-in and slide-in effects.

### Common utility combinations

| Pattern | Effect | Used On |
|---------|--------|---------|
| `animate-in fade-in duration-300` | Fade in over 300ms | Map card stagger entrance, reveal overlays |
| `animate-in fade-in duration-500` | Slower fade in | Winner banner, round results banner, survivor/winner cards |
| `animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200` | Fade + slide up with delay | Winner badge inside map card |
| `animate-in fade-in zoom-in-75 duration-500 delay-300` | Fade + scale from 75% with delay | Survivor "Safe" badge |
| `animate-in fade-in slide-in-from-bottom-4 duration-500` | Fade + slide up (larger distance) | Results page winner card |
| `animate-in fade-in duration-200` | Quick fade in | Overlay backdrops (paused, disconnected) |

### Stagger pattern

Map card grids use `fill-mode-backwards` with per-card `animationDelay` set via inline `style` to create a stagger effect:

```tsx
<div
  className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:fill-mode-backwards"
  style={{ animationDelay: `${index * MAP_STAGGER_DELAY_MS}ms` }}
>
```

The stagger delay constant (`MAP_STAGGER_DELAY_MS = 50`) is defined in `src/lib/animation.ts`.

---

## CSS Transitions

CSS transitions handle smooth state-based crossfades where the element stays in the DOM but its visual properties change.

### `transition-colors duration-300`

- **Used by:** ABBA progress tracker step circles (fill color on completion), connecting lines (bg-primary vs bg-border), step labels (text color on current step), and the vote page turn banner (green vs muted background on turn switch).
- **Pattern:** The Tailwind class is always present on the element; the conditional classes that change (e.g., `bg-primary` vs `bg-border`) swap on state change and the transition smoothly animates the color difference.

### `transition-[box-shadow,opacity] duration-200`

- **Used by:** `VoteMapCard` root card element for hover/selection shadow effects and opacity changes during normal voting.
- **Pattern:** Scoped to specific properties to avoid animating layout-triggering properties.

### `transition-[box-shadow,opacity] duration-500 ease-out`

- **Used by:** `VoteMapCard` during ABBA ban transition (`justBanned` state). The card's opacity transitions from 1 to 0.6 over 500ms when a ban is detected.

### `transition-[filter,opacity]`

- **Used by:** `VoteMapCard` image element for grayscale/brightness filter changes. When a map is banned, the image smoothly transitions to `grayscale`. When eliminated in multiplayer reveal, it transitions to `grayscale brightness-50`.
- **Stagger support:** Elimination stagger applies `transitionDelay` via inline style to create a cascading grayscale effect across eliminated cards.

### `transition-colors` (bare, on interactive elements)

- **Used by:** Mute toggle button (`hover:bg-muted transition-colors`), various UI chrome elements.

---

## JS-Managed Animation State

### `useMapAnimations` hook (`src/hooks/useMapAnimations.ts`)

This hook bridges the gap between Convex real-time subscription data and visual animation state. It is needed because Convex subscriptions update reactively (the data just changes), but animations require detecting the *transition* between states.

**What it does:**

1. **ABBA ban detection:** Tracks previous map states via `useRef`. On each render, compares the previous state map with the current one. When a map transitions from `AVAILABLE` to `BANNED`, it adds the map ID to the `animatingBanIds` set.

2. **Per-ID animation timers:** Each newly banned map gets its own `setTimeout` (600ms) that clears it from `animatingBanIds`. Timers are stored in a `Map<string, ReturnType<typeof setTimeout>>` ref so that Convex subscription updates mid-animation do not cancel pending cleanup timeouts.

3. **Elimination stagger indices:** Computes the index position of each map within `revealData.eliminatedMapIds` for multiplayer reveal stagger delays.

**Why JS is needed here:**

CSS cannot detect that a data value changed from one specific value to another. The Convex subscription simply provides the current state -- there is no "transition event." The hook creates the concept of a transition by comparing previous and current snapshots, then exposes a time-limited signal (`animatingBanIds`) that CSS classes can react to.

### `TurnFlashOverlay` component state

The `TurnFlashOverlay` uses a similar ref-comparison pattern (`prevTurnRef`) to detect when `isYourTurn` transitions from `false` to `true`. It manages a `isFlashing` state that mounts the overlay div, which then plays the `border-flash` keyframe. Cleanup happens via both `onAnimationEnd` and a 750ms fallback timer (for when `prefers-reduced-motion` suppresses the animation class).

### `useRevealPhase` state machine

The `useRevealPhase` hook manages a phase state machine (`VOTING` -> `REVEALING` -> `WINNER_REVEAL` -> `REDIRECTING`) with timer-driven transitions. It does not directly control CSS but determines which animation classes are applied by the consuming components based on the current phase.

---

## Decision Criteria

Use this guide when adding new animations:

| Approach | When to Use | Examples |
|----------|-------------|---------|
| **CSS transitions** | Element stays in DOM; a property changes smoothly between two states (color, opacity, shadow). | Turn banner background crossfade, progress tracker step colors, map card hover effects. |
| **CSS keyframes via `@theme`** | One-shot mount-triggered animation. The element appears (or a React `key` change forces remount) and the animation plays once. | Ban icon stamp-in, timer pulse on turn change, winner glow, turn flash overlay. |
| **tw-animate-css** | Entrance animations with standard fade/slide/zoom patterns. Especially useful with stagger delays for grid layouts. | Map card grid entrance, results page choreography, reveal banner fade-in. |
| **JS-managed (`useRef` + `useState`)** | Complex multi-step sequences or when you need to detect a *data transition* (value A changed to value B) rather than a simple mount/unmount. | ABBA ban detection across Convex subscription updates, turn flash detection, reveal phase state machine. |

**Rules of thumb:**

1. If the element mounts/unmounts and you just need it to fade in, use `tw-animate-css`.
2. If a property changes while the element stays in the DOM, use a CSS `transition-*` class.
3. If you need a custom timing curve or multi-step keyframe, define it in the `@theme` block of `src/index.css`.
4. If the animation depends on detecting a state *change* in subscription data (not just the current value), use a JS hook with ref-based previous-value comparison.
5. Always trigger keyframe restarts via React `key` prop changes rather than imperative DOM manipulation.

---

## Accessibility: motion-safe Convention

All decorative animations use Tailwind's `motion-safe:` variant prefix. This ensures users with `prefers-reduced-motion: reduce` enabled see instant state changes instead of animated transitions.

### Rules

- **Decorative animations:** Always prefix with `motion-safe:`. This includes entrance animations, glow effects, color transitions, stamp-in bounces, and stagger delays.
  ```tsx
  // Correct
  className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
  className="motion-safe:transition-colors motion-safe:duration-300"
  className="motion-safe:animate-border-flash"
  ```

- **Functional spinners:** Use bare `animate-spin` without the `motion-safe:` prefix. Loading indicators convey essential state information and should always be visible.
  ```tsx
  // Correct — functional spinner
  <Loader2 className="animate-spin" />
  ```

- **Motion-reduce fallbacks:** For animations that convey important state (like the winner glow), provide a `motion-reduce:` static fallback:
  ```tsx
  className="motion-safe:animate-winner-pulse motion-reduce:shadow-lg motion-reduce:shadow-amber-400/30"
  ```

- **Hidden when reduced:** The `TurnFlashOverlay` uses `motion-reduce:hidden` to completely hide the flash effect for users who prefer reduced motion, since the turn state is also communicated via the banner text.

- **Overlay entrances:** The `SessionPausedOverlay` and `DisconnectedOverlay` use bare `animate-in fade-in duration-200` (without `motion-safe:`) because these are blocking modals where the brief fade helps orient the user. This is a deliberate exception for overlay UX.

---

## Z-Index Layering Scale

Overlays use a consistent z-index scale to avoid stacking conflicts:

| Z-Index | Purpose | Components |
|---------|---------|------------|
| `z-40` | Full-screen overlays | `SessionPausedOverlay`, `TurnFlashOverlay` |
| `z-[45]` | Priority overlays (must appear above z-40) | `DisconnectedOverlay` |
| `z-50` | Dialogs and sheets | shadcn `AlertDialog`, `Sheet` (confirmation dialogs) |
| `z-[100]` | Toasts | Sonner toast notifications |

The `TurnFlashOverlay` sits at `z-40` with `pointer-events-none` so it never blocks interaction. The `DisconnectedOverlay` at `z-[45]` renders above the paused overlay because connection loss takes priority. The confirmation `AlertDialog` at `z-50` renders via portal and appears above all page-level overlays.

---

## Choreographed Sequences

### Results page entrance

The results page (`src/routes/results.$sessionId.tsx`) defines a choreographed celebration sequence with explicit delay constants:

```typescript
const ANIMATION_DELAY = {
  WINNER_CARD: 400,     // Winner card slides in
  WINNER_PULSE: 800,    // Winner glow begins
  BAN_HISTORY: 1000,    // Ban history section fades in
  MAP_GRID_BASE: 1200,  // Map summary grid starts
  MAP_GRID_STAGGER: 50, // Per-card stagger within grid
};
```

Each section uses `fill-mode-backwards` with the corresponding `animationDelay` to create a waterfall reveal from top to bottom.

### Vote page map grid entrance

On first mount, the vote page applies `fade-in` with stagger delays (`MAP_STAGGER_DELAY_MS = 50ms` per card) to the map grid. A `isFirstMountRef` flag ensures the stagger only applies on initial load -- subsequent re-renders (from subscription updates) skip the entrance animation.

### Multiplayer elimination reveal

During the reveal phase, eliminated maps receive staggered `transitionDelay` values on both the grayscale CSS transition and the X icon `animationDelay`. The stagger index is computed by `useMapAnimations.getStaggerIndex()` based on the order in `revealData.eliminatedMapIds`, with a per-card delay of `ELIMINATION_STAGGER_DELAY_MS = 150ms`.

---

## Key Files

| File | Role |
|------|------|
| `src/index.css` | Custom keyframes in `@theme` block (`border-flash`, `stamp-in`, `timer-pulse`, `winner-pulse`) |
| `src/lib/animation.ts` | Shared animation constants (`MAP_STAGGER_DELAY_MS`) |
| `src/hooks/useMapAnimations.ts` | JS hook for ABBA ban detection and elimination stagger indices |
| `src/hooks/useRevealPhase.ts` | Phase state machine driving reveal animation timing |
| `src/components/session/VoteMapCard.tsx` | Map card with ban, elimination, survivor, and winner animations |
| `src/components/session/TurnFlashOverlay.tsx` | Full-viewport green border glow on turn transition |
| `src/components/session/ABBAProgressTracker.tsx` | Progress tracker with step color transitions |
| `src/components/session/SessionPausedOverlay.tsx` | Paused overlay (z-40) with fade entrance |
| `src/components/session/DisconnectedOverlay.tsx` | Disconnected overlay (z-[45]) with fade entrance |
| `src/routes/vote.$token.tsx` | Vote page: banner crossfade, timer pulse, map grid stagger |
| `src/routes/results.$sessionId.tsx` | Results page: choreographed celebration sequence |
| `src/routes/lobby.$token.tsx` | Lobby page: map preview stagger entrance |
