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
    // Edge-runtime for Convex tests, jsdom for React tests
    environmentMatchGlobs: [
      ["convex/**", "edge-runtime"],
      ["src/**", "jsdom"],
    ],
    // Required for convex-test to work
    server: { deps: { inline: ["convex-test"] } },
    // GitHub Actions integration
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions"]
      : ["dot"],
    // Coverage with Istanbul (v8 doesn't work with edge-runtime)
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["convex/**/*.ts"],
      exclude: [
        "convex/_generated/**",
        "convex/**/*.test.ts",
        "convex/test.*.ts",
      ],
      // TODO: Enable thresholds once Phase 6 testing is complete (WAR-13 to WAR-22)
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 70,
      //   statements: 80,
      // },
    },
  },
});
