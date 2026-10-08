// Local-only synthetic benchmark; no images are sent to an inference service.
// Run after npm install and Playwright browser installation. Outputs are ignored.
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, webkit, devices } from "@playwright/test";
import sharp from "sharp";
import ts from "typescript";
import { monitorBrowserMemory } from "./profile-ai-memory.mjs";

const folder = ".tools/profile-ai-benchmark";
await mkdir(folder, { recursive: true });
const fixtures = [
  { name: "portrait-150", file: "portrait.svg", width: 150, height: 150 },
  { name: "portrait-320", file: "portrait.svg", width: 320, height: 320 },
  { name: "logo", file: "logo.svg", width: 48, height: 32 },
];
const responses = new Map();
for (const fixture of fixtures) {
  const source = await sharp(`tests/fixtures/profile/${fixture.file}`)
    .resize(fixture.width, fixture.height)
    .png()
    .toBuffer();
  responses.set(`/source/${fixture.name}.png`, ["image/png", source]);
  await writeFile(`${folder}/${fixture.name}-source.png`, source);
}
const model = await readFile("public/profile-ai/realesr-general-x4v3.onnx");
if (
  createHash("sha256").update(model).digest("hex") !==
  "a946f7a9397021b9b6b7e71df3d2821b04cc09ff244423b7ca79cb191ce4a00e"
)
  throw new Error("Unreviewed model");
responses.set("/profile-ai/realesr-general-x4v3.onnx", [
  "application/octet-stream",
  model,
]);
responses.set("/ort.mjs", [
  "text/javascript",
  await readFile("node_modules/onnxruntime-web/dist/ort.wasm.min.mjs"),
]);
for (const file of [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
])
  responses.set(`/profile-ai/runtime/1.30.0/${file}`, [
    file.endsWith("wasm") ? "application/wasm" : "text/javascript",
    await readFile(`node_modules/onnxruntime-web/dist/${file}`),
  ]);
for (const file of [
  "profile-ai.worker",
  "profile-ai-pixels",
  "profile-ai-tiles",
]) {
  const source = await readFile(`src/lib/${file}.ts`, "utf8");
  const js = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace('"onnxruntime-web/wasm"', '"/ort.mjs"')
    .replace('"./profile-ai-pixels"', '"/profile-ai-pixels.mjs"')
    .replace('"./profile-ai-tiles"', '"/profile-ai-tiles.mjs"');
  responses.set(`/${file}.mjs`, ["text/javascript", js]);
}
// Research reference only: run the entire 320px image to check halo seams.
// Production retains the smaller per-tile bounds.
responses.set("/reference-pixels.mjs", [
  "text/javascript",
  responses
    .get("/profile-ai-pixels.mjs")[1]
    .replaceAll("> 270", "> 1024")
    .replaceAll("> 1080", "> 4096"),
]);
responses.set("/reference-worker.mjs", [
  "text/javascript",
  responses
    .get("/profile-ai.worker.mjs")[1]
    .replace('"/profile-ai-pixels.mjs"', '"/reference-pixels.mjs"')
    .replace(
      "const tiles = profileTiles(width, height);",
      "const tiles = [{x:0,y:0,left:0,top:0,width,height,coreWidth:width,coreHeight:height}];",
    ),
]);
responses.set("/instrumented-worker.mjs", [
  "text/javascript",
  `
const memories = [], NativeMemory = WebAssembly.Memory;
WebAssembly.Memory = class extends NativeMemory { constructor(...args) { super(...args); memories.push(this); } };
const pending = []; self.onmessage = (event) => pending.push(event);
const send = self.postMessage.bind(self), started = performance.now(); let inferenceStarted;
self.postMessage = (message, ...args) => {
  if (message.progress?.startsWith('AI upscaling') && !inferenceStarted) inferenceStarted = performance.now();
  if (message.pixels) message.metrics = { totalMs: performance.now() - started, inferenceMs: performance.now() - inferenceStarted,
    wasmHeapBytes: memories.reduce((sum, memory) => sum + memory.buffer.byteLength, 0) };
  send(message, ...args);
};
await import('/profile-ai.worker.mjs');
for (const event of pending) self.onmessage(event);`,
]);
responses.set("/reference-instrumented.mjs", [
  "text/javascript",
  responses
    .get("/instrumented-worker.mjs")[1]
    .replace("/profile-ai.worker.mjs", "/reference-worker.mjs"),
]);
responses.set("/", [
  "text/html",
  "<!doctype html><title>Local synthetic AI benchmark</title><p>Browser-local synthetic fixtures only</p>",
]);
const server = http.createServer((request, response) => {
  const resource = responses.get(request.url);
  if (!resource) return response.writeHead(404).end();
  response.setHeader("Content-Type", resource[0]);
  response.end(resource[1]);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
try {
  for (const [name, engine, settings] of [
    ["chromium-desktop", chromium, { viewport: { width: 1280, height: 900 } }],
    ["chromium-mobile-emulated", chromium, devices["Pixel 7"]],
    ["webkit-iphone-emulated", webkit, devices["iPhone 13"]],
  ]) {
    const browserServer = await engine.launchServer();
    const browser = await engine.connect(browserServer.wsEndpoint());
    try {
      const page = await browser.newPage(settings);
      await page.goto(origin);
      const cases = [...fixtures];
      if (name === "chromium-desktop")
        cases.push({ ...fixtures[1], reference: true });
      for (const fixture of cases) {
        const stopMemory = monitorBrowserMemory(browserServer.process().pid);
        const result = await page
          .evaluate(async (fixture) => {
            const image = new Image();
            image.src = `/source/${fixture.name}.png`;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            ).data;
            return new Promise((resolve) => {
              const worker = new Worker(
                fixture.reference
                  ? "/reference-instrumented.mjs"
                  : "/instrumented-worker.mjs",
                {
                  type: "module",
                },
              );
              const timer = setTimeout(() => {
                worker.terminate();
                resolve({ error: "180s deadline" });
              }, 180000);
              const finish = (result) => {
                clearTimeout(timer);
                worker.terminate();
                resolve(result);
              };
              worker.onerror = () => finish({ error: "Worker failed" });
              worker.onmessage = ({ data }) => {
                if (data.error) finish({ error: data.error });
                else if (data.pixels) {
                  canvas.width = data.width;
                  canvas.height = data.height;
                  context.putImageData(
                    new ImageData(data.pixels, data.width, data.height),
                    0,
                    0,
                  );
                  finish({
                    ...data.metrics,
                    width: data.width,
                    height: data.height,
                    png: canvas.toDataURL("image/png"),
                  });
                }
              };
              worker.postMessage(
                { pixels, width: canvas.width, height: canvas.height },
                [pixels.buffer],
              );
            });
          }, fixture)
          .catch((error) => ({ error: String(error) }));
        result.observedBrowserPeakBytes = await stopMemory();
        if (result.png) {
          const output = Buffer.from(result.png.split(",")[1], "base64");
          if (fixture.reference) {
            const tiled = await sharp(
              await readFile(`${folder}/${name}-${fixture.name}-upscaled.png`),
            )
              .raw()
              .toBuffer();
            const full = await sharp(output).raw().toBuffer();
            let total = 0,
              maximum = 0;
            for (let i = 0; i < full.length; i++) {
              const difference = Math.abs(full[i] - tiled[i]);
              total += difference;
              maximum = Math.max(maximum, difference);
            }
            result.tileParity = {
              meanAbsolutePixelDifference: total / full.length,
              maximumPixelDifference: maximum,
            };
            if (maximum > 1 || total / full.length > 0.02)
              throw new Error("Tile seams differ from full-frame model output");
          }
          await writeFile(
            `${folder}/${name}-${fixture.name}${fixture.reference ? "-reference" : ""}-upscaled.png`,
            output,
          );
          delete result.png;
          if (
            result.width !== fixture.width * 4 ||
            result.height !== fixture.height * 4
          )
            throw new Error("Incorrect output size");
          const source = responses.get(`/source/${fixture.name}.png`)[1];
          const left = await sharp(source)
            .resize(320, 320, { fit: "contain", background: "#fff" })
            .png()
            .toBuffer();
          const right = await sharp(output)
            .resize(320, 320, { fit: "contain", background: "#fff" })
            .png()
            .toBuffer();
          await sharp({
            create: {
              width: 640,
              height: 320,
              channels: 4,
              background: "#fff",
            },
          })
            .composite([{ input: left }, { input: right, left: 320, top: 0 }])
            .png()
            .toFile(
              `${folder}/${name}-${fixture.name}${fixture.reference ? "-reference" : ""}-comparison.png`,
            );
        }
        const measurement = {
          browser: name,
          fixture: fixture.name,
          reference: !!fixture.reference,
          ...result,
        };
        results.push(measurement);
        console.log(JSON.stringify(measurement));
      }
    } finally {
      await browser.close();
      await browserServer.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(
  `${folder}/results.json`,
  JSON.stringify(
    {
      modelBytes: model.length,
      note: "WASM heap allocation is a lower bound, not total browser peak memory. Local downloads; emulation is not physical iOS/Android timing.",
      results,
    },
    null,
    2,
  ),
);
if (results.some((result) => result.error)) process.exitCode = 1;
