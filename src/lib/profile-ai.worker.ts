import * as ort from "onnxruntime-web/wasm";
import { profileTensor, profilePixels } from "./profile-ai-pixels";

self.onmessage = async (
  event: MessageEvent<{
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
  }>,
) => {
  let session: ort.InferenceSession | undefined;
  try {
    const { pixels, width, height } = event.data;
    const input = profileTensor(pixels, width, height);
    self.postMessage({ progress: "Loading the AI model…" });
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = `${self.location.origin}/profile-ai/runtime/1.30.0/`;
    const response = await fetch("/profile-ai/realesr-general-x4v3.onnx", {
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("Model unavailable");
    const model = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", model));
    const hash = Array.from(digest, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (
      hash !==
      "a946f7a9397021b9b6b7e71df3d2821b04cc09ff244423b7ca79cb191ce4a00e"
    )
      throw new Error("Model integrity mismatch");
    session = await ort.InferenceSession.create(model, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    self.postMessage({ progress: "Restoring the photo with AI…" });
    const result = await session.run({
      input: new ort.Tensor("float32", input, [1, 3, height, width]),
    });
    const output = result.output;
    if (
      output.type !== "float32" ||
      output.dims.join(",") !== [1, 3, height * 4, width * 4].join(",")
    )
      throw new Error("Invalid AI output");
    const restored = profilePixels(
      output.data as Float32Array,
      width * 4,
      height * 4,
    );
    self.postMessage(
      { pixels: restored, width: width * 4, height: height * 4 },
      { transfer: [restored.buffer] },
    );
  } catch {
    self.postMessage({
      error:
        "AI enhancement is unavailable. The original photo is still available.",
    });
  } finally {
    await session?.release();
  }
};
