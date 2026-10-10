"use client";
import { useRef, useState } from "react";
import { useBrowserReady } from "./use-browser-ready";
import { readExport } from "@/lib/instagram/browser";
import { track } from "@/lib/analytics";
import type { Dataset } from "@/lib/instagram/types";
export function Upload({
  onLoad,
  label = "Upload Instagram export",
  onDemo,
}: {
  onLoad: (dataset: Dataset) => void;
  label?: string;
  onDemo?: () => void;
}) {
  const ready = useBrowserReady();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  async function load(files: File[]) {
    if (!files.length || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    track("parser_started");
    try {
      onLoad(await readExport(files));
      track("parser_succeeded");
      track("results_viewed");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not read this export. Try again.",
      );
      track("parser_failed");
    } finally {
      inFlight.current = false;
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div
      className={`upload ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void load(Array.from(event.dataTransfer.files));
      }}
      aria-busy={busy}
    >
      <span className="upload-icon" aria-hidden="true">
        ↑
      </span>
      <h3>
        {busy
          ? "Reading your export locally…"
          : "Your export. Your discoveries."}
      </h3>
      <p>
        Drop your Instagram ZIP here, or select both
        <br className="desktop-break" /> Followers and Following JSON / HTML
        files.
      </p>
      <p>
        Include optional connection categories in the same ZIP or selection to
        explore requests, privacy lists and your unfollow history.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept=".zip,.json,.html,.htm"
        aria-label={label}
        className="file-input"
        disabled={busy || !ready}
        onChange={(event) => void load(Array.from(event.target.files ?? []))}
      />
      <button
        className="button primary"
        disabled={busy || !ready}
        onClick={() => input.current?.click()}
      >
        {busy ? "Processing in your browser…" : label}
      </button>
      {onDemo && (
        <div className="demo-action">
          <span>or</span>
          <button
            className="button secondary"
            disabled={busy || !ready}
            onClick={onDemo}
          >
            Try demo
          </button>
          <p>Fictional data. No file needed.</p>
        </div>
      )}
      <small>
        ZIP up to 2 GB · JSON / HTML up to 20 MB per file · All time export
      </small>
      {busy && (
        <div className="upload-progress" role="status" aria-live="polite">
          <span className="upload-progress-indicator" aria-hidden="true" />
          <div>
            <strong>Preparing your relationship workspace</strong>
            <p>
              Reading and checking relationship files in your browser. Large
              archives can take a few seconds. Your files stay on this device.
            </p>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
