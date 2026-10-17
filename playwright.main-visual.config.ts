import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Compare independent production and preview builds, including the entire shell.
process.env.MAIN_VISUAL_REFERENCE_URL = "http://127.0.0.1:3101";

export default defineConfig({
  ...base,
  testMatch: "**/main-visual.spec.ts",
  testIgnore: [],
  projects: [
    ...base.projects!,
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ].flatMap((project) =>
    (["light", "dark"] as const).map((theme) => ({
      ...project,
      name: `${project.name}-${theme}`,
      metadata: { theme },
      use: {
        ...project.use,
        storageState: {
          cookies: [],
          origins: ["http://127.0.0.1:3000", "http://127.0.0.1:3101"].map(
            (origin) => ({
              origin,
              localStorage: [{ name: "instascope-theme", value: theme }],
            }),
          ),
        },
      },
    })),
  ),
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
