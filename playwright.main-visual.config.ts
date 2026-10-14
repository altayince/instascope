import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// This suite compares two real builds, never a reconstructed CSS ancestry.
process.env.MAIN_VISUAL_REFERENCE_URL = "http://127.0.0.1:3101";

export default defineConfig({
  ...base,
  testMatch: "**/main-visual.spec.ts",
  testIgnore: [],
  outputDir: "test-results/main-visual",
  use: { ...base.use, timezoneId: "UTC", locale: "en-US" },
  webServer: [
    ...(Array.isArray(base.webServer) ? base.webServer : [base.webServer!]),
    {
      command: "node scripts/serve-main-visual-reference.mjs",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
    },
  ],
});
