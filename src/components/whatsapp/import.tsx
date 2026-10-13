"use client";

import { useRef, useState } from "react";
import { WHATSAPP_FORMATS, type WhatsAppFormatId } from "@/lib/whatsapp";
import { ActionButton } from "@/components/actions";
import { useWhatsApp } from "./provider";
import { useBrowserReady } from "@/components/use-browser-ready";
import { WhatsAppFormatEvidence } from "./doctor";
import { whatsappNumber } from "@/lib/whatsapp/stories";

export function WhatsAppImport({ onImported }: { onImported?: () => void }) {
  const {
    format,
    setFormat,
    busy,
    phase,
    inspection,
    error,
    importFiles,
    confirmImport,
    cancelImport,
    startDemo,
    dataset,
  } = useWhatsApp();
  const picker = useRef<HTMLInputElement>(null);
  const ready = useBrowserReady();
  const [dragging, setDragging] = useState(false);
  const selected = WHATSAPP_FORMATS.find((item) => item.id === format);
  const detection = inspection?.detection;
  async function read(files: readonly File[]) {
    if (!files.length) return;
    await importFiles(files);
    if (picker.current) picker.current.value = "";
  }
  async function confirm() {
    if (await confirmImport()) onImported?.();
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
              Open the file here. Review its locally detected format, choose the
              date order if needed, and confirm before analysis.
            </li>
          </ol>
          <p>
            Supported formats use numeric dates, dash or bracket timestamp
            wrappers, and 24-hour clocks or English AM/PM. Slash dates may use
            two- or four-digit years; two-digit years mean 2000–2099. Named
            months and translated AM/PM are not supported.
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
        {inspection && detection && (
          <section
            className="wa-format-detection"
            aria-labelledby="wa-detection-title"
            aria-live="polite"
          >
            <h3 id="wa-detection-title">Detected export format</h3>
            <span className="wa-panel-badge">
              {detection.status === "supported"
                ? "Supported"
                : detection.status === "ambiguous"
                  ? "Needs user selection"
                  : "Unsupported"}
            </span>
            <p>
              {detection.confidence === "exact"
                ? "One supported format matches the timestamp records. Review it and confirm before analysis."
                : detection.confidence === "needs-selection"
                  ? "More than one date order fits these timestamps. Choose the order used in your export; we will not guess."
                  : "These records do not fit one supported format. No new chat was imported. Try a fresh chat TXT export."}
            </p>
            <WhatsAppFormatEvidence detection={detection} />
            <p className="wa-hint">
              {whatsappNumber(detection.unsupportedLookingRecords)}{" "}
              unsupported-looking records ·{" "}
              {whatsappNumber(detection.preambleLines)} preamble lines ·{" "}
              {whatsappNumber(inspection.ignoredCompanionFiles)} ignored non-TXT
              ZIP files
            </p>
            {detection.yearWidths.includes(2) && (
              <p className="wa-hint">
                Two-digit years mean 2000–2099. Export clocks have no timezone.
              </p>
            )}
          </section>
        )}
        <label htmlFor="wa-format">Export date/time format</label>
        <select
          id="wa-format"
          value={format}
          disabled={!ready || busy}
          onChange={(event) =>
            setFormat(event.target.value as WhatsAppFormatId | "")
          }
          aria-describedby="wa-format-help"
          aria-required={Boolean(detection)}
        >
          <option value="">Choose a format…</option>
          {WHATSAPP_FORMATS.map((item) => (
            <option
              key={item.id}
              value={item.id}
              disabled={Boolean(
                detection && !detection.candidateFormats.includes(item.id),
              )}
            >
              {item.label}
            </option>
          ))}
        </select>
        <p className="wa-format-example" id="wa-format-help">
          {selected ? (
            <>
              Example timestamp: <code>{selected.sample}</code>
            </>
          ) : detection?.status === "unsupported" ? (
            "No new chat has been imported. Choose another export with a supported timestamp layout."
          ) : detection ? (
            "Choose the date order used in this export. Ambiguous dates are never guessed."
          ) : (
            "Open your export to detect its format locally, or choose a format manually. We do not guess date order or timezone."
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
          disabled={!ready || busy}
          onClick={() => picker.current?.click()}
        >
          {busy
            ? phase === "detecting"
              ? "Checking format locally…"
              : "Reading chat locally…"
            : dataset
              ? "Open another chat export"
              : "Open chat export"}
          <span aria-hidden="true">{busy ? "◌" : "↑"}</span>
        </ActionButton>
        <p className="wa-import-types">
          .txt up to 20 MB · .zip up to 1 GB · one chat
          <br />
          Or drop your file here. Confirm its format before analysis.
        </p>
        {detection && (
          <ActionButton
            variant="primary"
            disabled={
              !ready || busy || !format || detection.status === "unsupported"
            }
            onClick={() => void confirm()}
          >
            Confirm format and open chat
          </ActionButton>
        )}
        {(busy || inspection) && (
          <ActionButton variant="tertiary" onClick={cancelImport}>
            Cancel import
          </ActionButton>
        )}
        <div className="wa-import-feedback" aria-live="polite">
          {busy && (
            <p role="status">
              {phase === "detecting"
                ? "Checking the export structure on this device. Please keep this tab open."
                : "Reading and analyzing on this device. Please keep this tab open."}
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
