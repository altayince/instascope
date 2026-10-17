import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** Focused shared appearance checks, including iPhone WebKit. */
export default defineConfig({
  ...base,
  testMatch: ["**/themes.spec.ts", "**/profile-hydration.spec.ts"],
  testIgnore: [],
  projects: [
    ...base.projects!,
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
  outputDir: "test-results/themes",
});
