import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";

import { router } from './router'
import App from './App'
import { initSentry } from './lib/sentry'

import './index.css'

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL environment variable. " +
    "Please set it in your .env.local file or environment."
  );
}

// Initialize Sentry before render
initSentry(router);

// User-facing handler for unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;

  // ConvexError is already handled in UI via toast.
  // Use error.name (preserved after minification) instead of constructor.name.
  if (error?.name === "ConvexError") return;

  // Chunk load failures — prompt reload
  if (error?.message?.match(/Loading chunk|dynamically imported module/)) {
    toast.error("App update available", {
      description: "Please refresh the page to get the latest version.",
      action: { label: "Refresh", onClick: () => window.location.reload() },
      duration: Infinity,
    });
  }
});

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById('root')!, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error("Uncaught error:", error, errorInfo.componentStack);
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
)
