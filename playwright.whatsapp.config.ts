import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** Enabled dev-build review, including an emulated iPhone WebKit project. */
export default defineConfig({
  ...base,
  testMatch: [
    "**/whatsapp.spec.ts",
    "**/whatsapp-filters.spec.ts",
    "**/whatsapp-rhythm.spec.ts",
    "**/whatsapp-content.spec.ts",
    "**/whatsapp-wrapped-v2.spec.ts",
    "**/whatsapp-chat-vault.spec.ts",
    "**/whatsapp-chat-compare.spec.ts",
    "**/whatsapp-group-mode.spec.ts",
    "**/whatsapp-release-hardening.spec.ts",
    "**/whatsapp-analytics.spec.ts",
    "**/whatsapp-production-release.spec.ts",
    "**/whatsapp-landing.spec.ts",
  ],
  outputDir: "test-results/whatsapp",
  projects: [
    ...base.projects!,
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});
