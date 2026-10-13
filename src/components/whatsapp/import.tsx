"use client";

import { useRef, useState } from "react";
import { WHATSAPP_FORMATS, type WhatsAppFormatId } from "@/lib/whatsapp";
import { ActionButton } from "@/components/actions";
import { useWhatsApp } from "./provider";
import { useBrowserReady } from "@/components/use-browser-ready";

export function WhatsAppImport({ onImported }: { onImported?: () => void }) {
  const { format, setFormat, busy, error, importFiles, startDemo, dataset } =
    useWhatsApp();
  const picker = useRef<HTMLInputElement>(null);
  const ready = useBrowserReady();
  const [dragging, setDragging] = useState(false);
  const selected = WHATSAPP_FORMATS.find((item) => item.id === format);
  async function read(files: readonly File[]) {
    if (!files.length) return;
    const success = await importFiles(files);
    if (picker.current) picker.current.value = "";
    if (success) onImported?.();
  }
  return (
    <section
      className="wa-import"
      id="wa-import"
      aria-labelledby="wa-import-title"
    >
      <div className="wa-import-intro">
        <span className="wa-eyebrow">START WITH YOUR EXPORT</span>
        <h2 id="wa-import-title" tabIndex={-1}>
          Bring your chat. <em>Keep it yours.</em>
        </h2>
        <p>
          Open one WhatsApp chat export as a .txt file, or a ZIP containing one
          chat text file. The reading and analysis happen in your browser.
        </p>
        <details className="wa-export-help">
          <summary>How to prepare your chat export</summary>
          <ol>
            <li>
              Use WhatsApp&apos;s Export chat option for the conversation you
              want to explore.
            </li>
            <li>
              Choose <strong>Without media</strong> and save the .txt file or
              ZIP to your device.
            </li>
            <li>
              Check a timestamp in the file, choose the matching format here,
              then open it.
            </li>
          </ol>
          <p>
            Supported formats use numeric dates with four-digit years and dash
            or bracket timestamp wrappers. Two-digit years and other localized
            date layouts are not supported in this first version.
          </p>
        </details>
        <p className="wa-local-note">
          <span aria-hidden="true">◉</span> No login. No cloud upload. No saved
          copy.
        </p>
      </div>
      <div
        className={`wa-import-panel${dragging ? " is-dragging" : ""}`}
        aria-busy={busy}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void read(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="wa-upload-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <path
              d="M10 9h28v23H24l-9 7v-7h-5V9Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M17 17h14M17 23h10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <label htmlFor="wa-format">Export date/time format</label>
        <select
          id="wa-format"
          value={format}
          disabled={!ready || busy}
          onChange={(event) =>
            setFormat(event.target.value as WhatsAppFormatId | "")
          }
          aria-describedby="wa-format-help"
        >
          <option value="">Choose a format…</option>
          {WHATSAPP_FORMATS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <p className="wa-format-example" id="wa-format-help">
          {selected ? (
            <>
              Example timestamp: <code>{selected.sample}</code>
            </>
          ) : (
            "We do not guess the date order or timezone. Choose the format you see in your export."
          )}
        </p>
        <input
          ref={picker}
          type="file"
          accept=".txt,.zip,text/plain,application/zip"
          aria-label="Upload WhatsApp chat export"
          hidden
          disabled={!ready || busy}
          onChange={(event) => void read(Array.from(event.target.files ?? []))}
        />
        <ActionButton
          variant="primary"
          disabled={!ready || busy || !format}
          onClick={() => picker.current?.click()}
        >
          {busy
            ? "Reading chat locally…"
            : dataset
              ? "Open another chat export"
              : "Open chat export"}
          <span aria-hidden="true">{busy ? "◌" : "↑"}</span>
        </ActionButton>
        <p className="wa-import-types">
          .txt up to 20 MB · .zip up to 1 GB · one chat
          <br />
          Or drop your file here after choosing its format.
        </p>
        <div className="wa-import-feedback" aria-live="polite">
          {busy && (
            <p role="status">
              Reading and analyzing on this device. Please keep this tab open.
            </p>
          )}
          {error && (
            <p className="wa-error" role="alert">
              {error}
              {dataset && " Your current chat is still available."}
            </p>
          )}
        </div>
        <div className="wa-import-divider">
          <span>JUST LOOKING?</span>
        </div>
        <ActionButton
          variant="tertiary"
          disabled={!ready || busy}
          onClick={() => {
            startDemo();
            onImported?.();
          }}
        >
          Try the fictional demo <span aria-hidden="true">→</span>
        </ActionButton>
      </div>
    </section>
  );
}
