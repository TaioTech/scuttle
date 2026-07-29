import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Everything under test is pure logic with no DOM: the simulation, the
    // board generation, and the collision maths. The renderer and the loop are
    // deliberately the only parts that touch a browser, and they hold no rules.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
