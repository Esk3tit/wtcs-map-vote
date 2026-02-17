---
title: Use cn() for Conditional Class Merging
category: ui-patterns
tags: [tailwind, styling, cn, best-practice]
created: 2026-02-17
problem_type: style
severity: minor
components: [ui, tailwind]
---

# Use cn() for Conditional Class Merging

## Problem

Template literal ternaries for conditional Tailwind classes are verbose and harder to scan:

```tsx
<div
  className={`h-2 w-2 rounded-full ${
    isActive ? "bg-green-500" : "bg-muted"
  }`}
/>
<span
  className={`text-xs font-medium ${
    isActive ? "text-green-500" : "text-muted-foreground"
  }`}
>
```

## Solution

Use `cn()` from `@/lib/utils` (wraps `clsx` + `tailwind-merge`):

```tsx
import { cn } from "@/lib/utils";

<div
  className={cn(
    "h-2 w-2 rounded-full",
    isActive ? "bg-green-500" : "bg-muted"
  )}
/>
<span
  className={cn(
    "text-xs font-medium",
    isActive ? "text-green-500" : "text-muted-foreground"
  )}
>
```

## Why

- Separates base classes from conditional classes visually
- `tailwind-merge` resolves class conflicts automatically (e.g., `bg-red-500` overrides `bg-blue-500`)
- Scales cleanly when adding more conditional classes:

```tsx
// Multiple conditions stay readable
className={cn(
  "h-2 w-2 rounded-full",
  isActive && "bg-green-500",
  isDisabled && "opacity-50",
  !isActive && !isDisabled && "bg-muted"
)}
```

## When to Use

- Any conditional class merging with ternaries or boolean flags
- Components accepting a `className` prop (merge with internal classes)
- Anywhere you'd use template literals for dynamic Tailwind classes

## When Not Needed

- Static class strings with no conditions — plain `className="..."` is fine
