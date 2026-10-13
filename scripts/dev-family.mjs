import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_PREVIEW: "true",
      NEXT_PUBLIC_WHATSAPP_ENABLED: "true",
    },
  },
);
child.on("error", (error) => {
  throw error;
});
child.on("exit", (code) => process.exit(code ?? 1));
