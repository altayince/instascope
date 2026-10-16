import { spawn } from "node:child_process";
import { resolve } from "node:path";

// Run the reference branch's own static server against its independent build.
const directory = process.env.MAIN_VISUAL_REFERENCE_DIR;
if (!directory)
  throw new Error("MAIN_VISUAL_REFERENCE_DIR must identify the main checkout.");
const child = spawn(
  process.execPath,
  [resolve(directory, "scripts/serve.mjs")],
  {
    cwd: resolve(directory),
    env: { ...process.env, PORT: "3101" },
    stdio: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  throw error;
});
child.on("exit", (code) => process.exit(code ?? 1));
