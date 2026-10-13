import { afterEach, describe, expect, it, vi } from "vitest";
import { readWhatsApp } from "../../src/lib/whatsapp/browser";
import { createWhatsAppDemo } from "../../src/lib/whatsapp/demo";
import { WhatsAppImportError } from "../../src/lib/whatsapp/errors";
import { WHATSAPP_LIMITS } from "../../src/lib/whatsapp/limits";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(public url: URL) {
    FakeWorker.instances.push(this);
  }
}

const chat = () =>
  new File(["14/03/2025, 09:00 - Synthetic: Hello"], "synthetic.txt");
const worker = () => FakeWorker.instances.at(-1)!;
const setup = () => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.useFakeTimers();
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("local WhatsApp worker lifecycle", () => {
  it("passes the File and explicit format without reading on the UI thread, then terminates", async () => {
    setup();
    const file = chat();
    const read = vi.spyOn(file, "arrayBuffer");
    const result = readWhatsApp([file], "dmy-24h");
    expect(worker().postMessage).toHaveBeenCalledWith({
      files: [file],
      format: "dmy-24h",
    });
    expect(worker().url.pathname).toContain("parser.worker.ts");
    expect(read).not.toHaveBeenCalled();
    const dataset = createWhatsAppDemo();
    worker().onmessage?.({ data: { dataset } } as MessageEvent);
    expect(await result).toEqual(dataset);
    expect(worker().terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps domain error codes/messages and terminates after rejection", async () => {
    setup();
    const result = readWhatsApp([chat()], "dmy-24h");
    const rejection = expect(result).rejects.toMatchObject({
      code: "format",
      message: "Choose the matching supported format.",
    });
    worker().onmessage?.({
      data: {
        error: {
          code: "format",
          message: "Choose the matching supported format.",
        },
      },
    } as MessageEvent);
    await rejection;
    expect(worker().terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out bounded processing and terminates its worker", async () => {
    setup();
    const result = readWhatsApp([chat()], "dmy-24h");
    const rejection = expect(result).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(WHATSAPP_LIMITS.workerTimeoutMs);
    await rejection;
    expect(worker().terminate).toHaveBeenCalledOnce();
  });

  it("aborts pending reading, releases the worker and timer, and ignores late results", async () => {
    setup();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = readWhatsApp([chat()], "dmy-24h", controller.signal);
    const rejection = expect(result).rejects.toMatchObject({
      code: "cancelled",
      message: "Chat reading was cancelled. Choose a file to start again.",
    });
    controller.abort(new Error("PRIVATE REASON"));
    await rejection;
    expect(worker().terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    worker().onmessage?.({
      data: { dataset: createWhatsAppDemo() },
    } as MessageEvent);
    worker().onerror?.();
    expect(worker().terminate).toHaveBeenCalledOnce();
  });

  it("rejects a pre-aborted signal without spawning or cloning a worker", async () => {
    setup();
    const controller = new AbortController();
    controller.abort("PRIVATE REASON");
    await expect(
      readWhatsApp([chat()], "dmy-24h", controller.signal),
    ).rejects.toMatchObject({
      code: "cancelled",
      message: "Chat reading was cancelled. Choose a file to start again.",
    });
    expect(FakeWorker.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes the abort listener after normal completion", async () => {
    setup();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = readWhatsApp([chat()], "dmy-24h", controller.signal);
    worker().onmessage?.({
      data: { dataset: createWhatsAppDemo() },
    } as MessageEvent);
    await result;
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    controller.abort();
    expect(worker().terminate).toHaveBeenCalledOnce();
  });

  it("terminates if cancellation happens during worker construction", async () => {
    setup();
    const controller = new AbortController();
    vi.stubGlobal(
      "Worker",
      class extends FakeWorker {
        constructor(url: URL) {
          super(url);
          controller.abort();
        }
      },
    );
    await expect(
      readWhatsApp([chat()], "dmy-24h", controller.signal),
    ).rejects.toMatchObject({ code: "cancelled" });
    expect(worker().postMessage).not.toHaveBeenCalled();
    expect(worker().terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["onerror", "onmessageerror"] as const)(
    "sanitizes %s and terminates",
    async (event) => {
      setup();
      const result = readWhatsApp([chat()], "dmy-24h");
      const rejection =
        expect(result).rejects.toBeInstanceOf(WhatsAppImportError);
      worker()[event]?.();
      await rejection;
      expect(worker().terminate).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("rejects an unavailable worker with static nonpersonal copy", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("PRIVATE PATH");
        }
      },
    );
    await expect(readWhatsApp([chat()], "dmy-24h")).rejects.toMatchObject({
      code: "worker",
      message:
        "The local chat reader could not start. Refresh the page or use a browser with Web Worker support.",
    });
  });

  it("terminates after the File cannot be cloned to the worker", async () => {
    setup();
    vi.stubGlobal(
      "Worker",
      class extends FakeWorker {
        postMessage = vi.fn(() => {
          throw new Error("PRIVATE DATA");
        });
      },
    );
    await expect(readWhatsApp([chat()], "dmy-24h")).rejects.toMatchObject({
      code: "worker",
      message:
        "The local chat reader could not receive this file. Refresh the page and try again.",
    });
    expect(worker().terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("validates selection and format before spawning a worker", async () => {
    setup();
    await expect(readWhatsApp([], "dmy-24h")).rejects.toMatchObject({
      code: "selection",
    });
    await expect(
      readWhatsApp([chat()], "unknown" as "dmy-24h"),
    ).rejects.toMatchObject({ code: "format" });
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
