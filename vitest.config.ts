import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // GitHub Actions integration
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions"]
      : ["dot"],
    // Coverage with Istanbul (v8 doesn't work with edge-runtime)
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["convex/**/*.ts"],
      exclude: [
        "convex/_generated/**",
        "convex/**/*.test.ts",
        "convex/test.*.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 70,
        statements: 70,
      },
    },
    // Use projects instead of deprecated environmentMatchGlobs
    projects: [
      {
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        test: {
          name: "react",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
    ],
  },
});
