import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { toast } from "sonner";

import { PostHogProvider } from "@posthog/react";

import { router } from '@/router'
import App from '@/App'
import { Sentry, initSentry } from '@/lib/sentry'
import { initPostHog } from '@/lib/posthog'
import { initWebVitals } from '@/lib/vitals'

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

// Initialize PostHog analytics (no-op if key missing)
const posthogClient = initPostHog();

// Initialize Web Vitals reporting (metrics → PostHog + dev console)
initWebVitals(posthogClient);

// User-facing handler for unhandled promise rejections
function handleUnhandledRejection(event: PromiseRejectionEvent) {
  const error = event.reason;

  // ConvexError is already handled in UI via toast.
  // Use error.name (preserved after minification) instead of constructor.name.
  if (error instanceof Error && error.name === "ConvexError") return;

  // Chunk load failures — prompt reload
  if (error?.message?.match(/Loading chunk|dynamically imported module/)) {
    toast.error("App update available", {
      description: "Please refresh the page to get the latest version.",
      action: { label: "Refresh", onClick: () => window.location.reload() },
      duration: Infinity,
    });
  }
}

window.addEventListener("unhandledrejection", handleUnhandledRejection);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  });
}

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
      {posthogClient ? (
        <PostHogProvider client={posthogClient}>
          <App />
        </PostHogProvider>
      ) : (
        <App />
      )}
    </ConvexAuthProvider>
  </StrictMode>,
)
