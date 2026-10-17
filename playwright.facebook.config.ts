import { defineConfig } from "@playwright/test";
import base from "./playwright.whatsapp.config";
export default defineConfig({
  ...base,
  testMatch: ["**/facebook.spec.ts"],
  outputDir: "test-results/facebook",
});
