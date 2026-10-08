// Research only. No model download, distribution or product integration.
// Supply the reviewed local artifact documented in docs/PROFILE_AI_AUDIT.md.
// Only the repository's fictional portrait fixture is processed.
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, webkit, devices } from "@playwright/test";
import sharp from "sharp";
import { monitorBrowserMemory } from "./profile-ai-memory.mjs";

const modelPath = process.argv[2];
if (!modelPath)
  throw new Error(
    "Usage: node scripts/prototype-face-restoration.mjs LOCAL_GFPGAN_ONNX",
  );
const model = await readFile(modelPath);
if (
  createHash("sha256").update(model).digest("hex") !==
  "15c36ba1a8304e077a9d99954427eac3fb604bb790636dd5e34e72cdeb0830d8"
)
  throw new Error("Unreviewed research artifact");
const folder = ".tools/face-restoration-prototype";
await mkdir(folder, { recursive: true });
const portrait = await sharp("tests/fixtures/profile/portrait.svg")
  .resize(150, 150)
  .png()
  .toBuffer();
await writeFile(`${folder}/source.png`, portrait);
const resources = new Map([
  [
    "/",
    [
      "text/html",
      "<!doctype html><title>Local fictional-face prototype</title>",
    ],
  ],
  ["/source.png", ["image/png", portrait]],
  ["/model.onnx", ["application/octet-stream", model]],
  [
    "/ort.mjs",
    [
      "text/javascript",
      await readFile("node_modules/onnxruntime-web/dist/ort.wasm.min.mjs"),
    ],
  ],
]);
for (const file of [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
])
  resources.set(`/runtime/${file}`, [
    file.endsWith("wasm") ? "application/wasm" : "text/javascript",
    await readFile(`node_modules/onnxruntime-web/dist/${file}`),
  ]);
resources.set("/worker.mjs", [
  "text/javascript",
  `
import * as ort from '/ort.mjs';
const memories = [], NativeMemory = WebAssembly.Memory;
WebAssembly.Memory = class extends NativeMemory { constructor(...args) { super(...args); memories.push(this); } };
self.onmessage = async ({data}) => { let session;
try {
  ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmPaths = '/runtime/';
  const started = performance.now(); const bytes = await (await fetch('/model.onnx')).arrayBuffer();
  session = await ort.InferenceSession.create(bytes, {executionProviders:['wasm'], graphOptimizationLevel:'all'});
  const loaded = performance.now(); const input = new ort.Tensor('float32', data, [1,3,512,512]);
  const result = await session.run({input}); const output = result.output;
  if (output.type !== 'float32' || output.dims.join(',') !== '1,3,512,512') throw new Error('Unexpected model output');
  self.postMessage({output:output.data, inferenceMs:performance.now()-loaded, loadMs:loaded-started,
    wasmHeapBytes:memories.reduce((sum,memory)=>sum+memory.buffer.byteLength,0)}, [output.data.buffer]);
} catch (error) { self.postMessage({error:String(error)}); } finally { await session?.release(); }
};`,
]);
const server = http.createServer((request, response) => {
  const resource = resources.get(request.url);
  if (!resource) return response.writeHead(404).end();
  response.setHeader("Content-Type", resource[0]);
  response.end(resource[1]);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const results = [];
try {
  for (const [name, engine, settings] of [
    ["chromium", chromium, { viewport: { width: 1280, height: 900 } }],
    ["webkit-iphone-emulated", webkit, devices["iPhone 13"]],
  ]) {
    const browserServer = await engine.launchServer();
    const browser = await engine.connect(browserServer.wsEndpoint());
    try {
      const page = await browser.newPage(settings);
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const stopMemory = monitorBrowserMemory(browserServer.process().pid);
      const result = await page
        .evaluate(async () => {
          const image = new Image();
          image.src = "/source.png";
          await image.decode();
          // Known synthetic landmarks only. Real images need an actual detector,
          // landmark confidence, no-face handling and inverse compositing.
          const source = [
            [126, 140],
            [194, 140],
            [160, 175],
            [142, 200],
            [179, 200],
          ].map(([x, y]) => [(x * 150) / 320, (y * 150) / 320]);
          const target = [
            [192.98138, 239.94708],
            [318.90277, 240.1936],
            [256.63416, 314.01935],
            [201.26117, 371.41043],
            [313.08905, 371.15118],
          ];
          const center = (points) =>
            points.reduce(
              (sum, p) => [
                sum[0] + p[0] / points.length,
                sum[1] + p[1] / points.length,
              ],
              [0, 0],
            );
          const [sx, sy] = center(source),
            [tx, ty] = center(target);
          let denominator = 0,
            a = 0,
            b = 0;
          for (let i = 0; i < source.length; i++) {
            const x = source[i][0] - sx,
              y = source[i][1] - sy,
              u = target[i][0] - tx,
              v = target[i][1] - ty;
            denominator += x * x + y * y;
            a += x * u + y * v;
            b += x * v - y * u;
          }
          a /= denominator;
          b /= denominator;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 512;
          const context = canvas.getContext("2d");
          context.fillStyle = "#fff";
          context.fillRect(0, 0, 512, 512);
          context.setTransform(
            a,
            b,
            -b,
            a,
            tx - a * sx + b * sy,
            ty - b * sx - a * sy,
          );
          context.drawImage(image, 0, 0);
          context.resetTransform();
          const aligned = canvas.toDataURL("image/png"),
            rgba = context.getImageData(0, 0, 512, 512).data;
          const input = new Float32Array(512 * 512 * 3);
          for (let i = 0; i < 512 * 512; i++)
            for (let ch = 0; ch < 3; ch++)
              input[ch * 512 * 512 + i] = rgba[i * 4 + ch] / 127.5 - 1;
          return new Promise((resolve) => {
            const worker = new Worker("/worker.mjs", { type: "module" });
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
              if (data.error) return finish(data);
              const pixels = new Uint8ClampedArray(512 * 512 * 4);
              for (let i = 0; i < 512 * 512; i++) {
                for (let ch = 0; ch < 3; ch++) {
                  const value = data.output[ch * 512 * 512 + i];
                  if (!Number.isFinite(value))
                    return finish({ error: "Nonfinite output" });
                  pixels[i * 4 + ch] = (value + 1) * 127.5;
                }
                pixels[i * 4 + 3] = 255;
              }
              context.putImageData(new ImageData(pixels, 512, 512), 0, 0);
              delete data.output;
              finish({
                ...data,
                aligned,
                png: canvas.toDataURL("image/png"),
                width: 512,
                height: 512,
              });
            };
            worker.postMessage(input, [input.buffer]);
          });
        })
        .catch((error) => ({ error: String(error) }));
      result.observedBrowserPeakBytes = await stopMemory();
      for (const field of ["aligned", "png"])
        if (result[field]) {
          await writeFile(
            `${folder}/${name}-${field}.png`,
            Buffer.from(result[field].split(",")[1], "base64"),
          );
          delete result[field];
        }
      results.push({ browser: name, ...result });
      console.log(JSON.stringify(results.at(-1)));
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
      note: "Synthetic aligned illustration, not photographic quality evidence. Local download, emulated iPhone, WASM heap lower bound only.",
      results,
    },
    null,
    2,
  ),
);
if (results.some((result) => result.error)) process.exitCode = 1;
