import { readFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const bytes = await readFile("public/profile-ai/realesr-general-x4v3.onnx");
if (
  createHash("sha256").update(bytes).digest("hex") !==
  "a946f7a9397021b9b6b7e71df3d2821b04cc09ff244423b7ca79cb191ce4a00e"
)
  throw new Error("Profile AI model integrity mismatch");
const runtime = JSON.parse(
  await readFile("node_modules/onnxruntime-web/package.json", "utf8"),
);
if (runtime.version !== "1.30.0")
  throw new Error(
    "Review the profile AI runtime asset version before upgrading",
  );
const destination = "public/profile-ai/runtime/1.30.0";
await mkdir(destination, { recursive: true });
for (const file of [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
])
  await copyFile(
    `node_modules/onnxruntime-web/dist/${file}`,
    `${destination}/${file}`,
  );
await copyFile(
  "public/profile-ai/ONNXRUNTIME-LICENSE.txt",
  `${destination}/LICENSE.txt`,
);
console.log(
  "Verified profile AI model and prepared same-origin runtime assets",
);
