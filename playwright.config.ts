import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.DAYBREAK_TEST_URL ?? "http://localhost:8081",
    viewport: { width: 390, height: 844 },
    launchOptions: { channel: "msedge" },
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
