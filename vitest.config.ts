import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
          coverage: {
            enabled: true,
            provider: "v8",
            reporter: ["text", "html", "json", "lcov"],
            include: ["src/**/*.ts"],
            exclude: [
              "src/**/*.d.ts",
              "src/ralph/**",
              "ralph-loop.ts",
              "commitlint.config.js",
            ],
            thresholds: {
              lines: 68,
              functions: 80,
              branches: 75,
              statements: 68,
            },
          },
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
