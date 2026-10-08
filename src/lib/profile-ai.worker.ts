import * as ort from "onnxruntime-web/wasm";
import { profileTensor, profilePixels } from "./profile-ai-pixels";
import {
  PROFILE_SCALE,
  profileTiles,
  readProfileTile,
  writeProfileTile,
} from "./profile-ai-tiles";

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
    const tiles = profileTiles(width, height);
    if (pixels.length !== width * height * 4)
      throw new Error("Invalid source pixels");
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
    const restored = new Uint8ClampedArray(
      width * height * PROFILE_SCALE ** 2 * 4,
    );
    for (const [index, tile] of tiles.entries()) {
      self.postMessage({
        progress: `AI upscaling · tile ${index + 1} of ${tiles.length}`,
      });
      const input = new ort.Tensor(
        "float32",
        profileTensor(
          readProfileTile(pixels, width, height, tile),
          tile.width,
          tile.height,
        ),
        [1, 3, tile.height, tile.width],
      );
      const result = await session.run({ input });
      try {
        const output = result.output;
        if (
          output.type !== "float32" ||
          output.dims.join(",") !==
            [
              1,
              3,
              tile.height * PROFILE_SCALE,
              tile.width * PROFILE_SCALE,
            ].join(",")
        )
          throw new Error("Invalid AI output");
        writeProfileTile(
          restored,
          width,
          tile,
          profilePixels(
            output.data as Float32Array,
            tile.width * PROFILE_SCALE,
            tile.height * PROFILE_SCALE,
          ),
        );
      } finally {
        input.dispose();
        for (const output of Object.values(result)) output.dispose();
      }
    }
    self.postMessage(
      {
        pixels: restored,
        width: width * PROFILE_SCALE,
        height: height * PROFILE_SCALE,
      },
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
