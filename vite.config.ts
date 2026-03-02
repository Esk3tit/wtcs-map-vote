import path from "path"
import { execSync } from "child_process"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "vite"

const commitSha = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim()
  } catch {
    return "unknown"
  }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    // Sentry must be last — uploads source maps after build
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: commitSha,
      },
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
      reactComponentAnnotation: {
        enabled: true,
      },
      disable: !process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
  ],
  define: {
    "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(commitSha),
  },
  build: {
    sourcemap: "hidden",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
