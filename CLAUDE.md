# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this codebase.

## Project Overview

WTCS Map Vote - A React application for map voting functionality.

## Tech Stack

- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 4 with CSS variables
- **UI Components:** shadcn/ui (base-vega style) with Base UI primitives
- **Icons:** Lucide React
- **Package Manager:** Bun

## Commands

- `bun dev` - Start development server
- `bun run build` - Type-check and build for production
- `bun run lint` - Run ESLint
- `bun run preview` - Preview production build

## Project Structure

```
src/
├── components/
│   └── ui/          # shadcn/ui components (do not edit directly)
├── lib/
│   └── utils.ts     # Utility functions (cn helper)
├── App.tsx          # Root component
├── main.tsx         # Entry point
└── index.css        # Global styles and Tailwind
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
- shadcn/ui components are in `src/components/ui/` - add new components with `bunx shadcn@latest add <component>`

### Styling

- Use Tailwind CSS utility classes
- Use `cn()` helper from `@/lib/utils` for conditional class merging
- CSS variables are defined in `src/index.css`
