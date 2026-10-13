import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** Enabled dev-build review, including an emulated iPhone WebKit project. */
export default defineConfig({
  ...base,
  testMatch: "**/whatsapp.spec.ts",
  outputDir: "test-results/whatsapp",
  projects: [
    ...base.projects!,
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});
