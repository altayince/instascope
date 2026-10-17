import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFacebook } from "../../src/lib/facebook/browser";
import { importFacebook } from "../../src/lib/facebook/import";
import { syntheticFacebookZip } from "../helpers/facebook-export";

class LocalWorker {
  static instances: LocalWorker[] = [];
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    LocalWorker.instances.push(this);
  }
}
const file = () =>
  new File([Uint8Array.from(syntheticFacebookZip("json"))], "fictional.zip");
const worker = () => LocalWorker.instances.at(-1)!;
beforeEach(() => {
  LocalWorker.instances = [];
  vi.stubGlobal("Worker", LocalWorker);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("passes a File without UI-thread reads and terminates after receiving the normalized result", async () => {
  const source = file();
  const read = vi.spyOn(source, "arrayBuffer");
  const result = readFacebook(source);
  expect(worker().postMessage).toHaveBeenCalledWith({ file: source });
  expect(read).not.toHaveBeenCalled();
  const dataset = await importFacebook(source);
  worker().onmessage?.({ data: { dataset } } as MessageEvent);
  expect(await result).toEqual(dataset);
  expect(worker().terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels, ignores late results and does not expose the abort reason", async () => {
  const controller = new AbortController();
  const result = readFacebook(file(), controller.signal);
  const rejected = expect(result).rejects.toThrow(
    "Import cancelled. Choose a ZIP to start again.",
  );
  controller.abort("SYNTHETIC_PRIVATE_REASON");
  worker().onmessage?.({ data: { dataset: {} } } as MessageEvent);
  await rejected;
  expect(worker().terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not start a worker for a pre-aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(readFacebook(file(), controller.signal)).rejects.toThrow(
    /cancelled/,
  );
  expect(LocalWorker.instances).toHaveLength(0);
});
it("terminates on deadline and reports only generic guidance", async () => {
  const result = readFacebook(file());
  const rejected = expect(result).rejects.toThrow(/local reader stopped/);
  await vi.advanceTimersByTimeAsync(120000);
  await rejected;
  expect(worker().terminate).toHaveBeenCalledOnce();
});
it.each(["onerror", "onmessageerror"] as const)(
  "recovers from %s without forwarding a private exception",
  async (event) => {
    const result = readFacebook(file());
    const rejected = expect(result).rejects.toThrow(/local reader stopped/);
    worker()[event]?.();
    await rejected;
    expect(worker().terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  },
);
