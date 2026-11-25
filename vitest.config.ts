import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // testes *.db.test.ts usam o banco real: rode com `npm run test:db`
    exclude: process.env.RUN_DB_TESTS
      ? ["node_modules/**"]
      : ["node_modules/**", "src/**/*.db.test.ts"],
  },
});
