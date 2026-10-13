"use client";

import {
  WHATSAPP_FORMATS,
  type WhatsAppDataset,
  type WhatsAppEventKind,
  type WhatsAppFormatDetection,
  type WhatsAppFormatId,
} from "@/lib/whatsapp";
import { whatsappNumber } from "@/lib/whatsapp/stories";

const dateOrders = {
  dmy: "Day / month / year",
  mdy: "Month / day / year",
  ymd: "Year-month-day",
} as const;
const eventLabels: Record<WhatsAppEventKind, string> = {
  image: "Image omitted",
  video: "Video omitted",
  audio: "Voice / audio omitted",
  sticker: "Sticker omitted",
  gif: "GIF omitted",
  document: "Document omitted",
  unspecified: "Unspecified media omitted",
  call: "Call marker",
  "deleted-message": "Deleted-message marker",
  location: "Location-share marker",
};

/** Fixed labels and counts only. Never render source rows or participant labels. */
export function WhatsAppFormatEvidence({
  detection,
  selectedFormat,
}: {
  detection: WhatsAppFormatDetection;
  selectedFormat?: WhatsAppFormatId;
}) {
  const formats = selectedFormat
    ? WHATSAPP_FORMATS.filter((item) => item.id === selectedFormat)
    : WHATSAPP_FORMATS.filter((item) =>
        detection.candidateFormats.includes(item.id),
      );
  const orders = [...new Set(formats.map((item) => item.dateOrder))];
  return (
    <dl className="wa-format-facts">
      <div>
        <dt>Timestamp wrapper</dt>
        <dd>
          {detection.wrappers.length
            ? detection.wrappers
                .map((wrapper) =>
                  wrapper === "ios" ? "iPhone brackets" : "Android dash",
                )
                .join(" · ")
            : "Not recognized"}
        </dd>
      </div>
      <div>
        <dt>{selectedFormat ? "Confirmed date order" : "Date order"}</dt>
        <dd>
          {orders.length
            ? orders.map((order) => dateOrders[order]).join(" or ")
            : "Not recognized"}
        </dd>
      </div>
      <div>
        <dt>Year width</dt>
        <dd>
          {detection.yearWidths.length
            ? detection.yearWidths.map((width) => `${width}-digit`).join(" · ")
            : "Not recognized"}
        </dd>
      </div>
      <div>
        <dt>Clock style</dt>
        <dd>
          {detection.clockStyles.length
            ? detection.clockStyles
                .map((clock) => (clock === "12h" ? "12-hour AM/PM" : "24-hour"))
                .join(" · ")
            : "Not recognized"}
        </dd>
      </div>
      <div>
        <dt>Source time precision</dt>
        <dd>
          {detection.timestampPrecision === "mixed"
            ? "Minutes and seconds (mixed)"
            : detection.timestampPrecision === "second"
              ? "Seconds included"
              : detection.timestampPrecision === "minute"
                ? "Minutes; seconds unavailable"
                : "Not recognized"}
        </dd>
      </div>
      <div>
        <dt>Timestamp-shaped records inspected</dt>
        <dd>{whatsappNumber(detection.headerCount)}</dd>
      </div>
    </dl>
  );
}

export function WhatsAppDoctor({ dataset }: { dataset: WhatsAppDataset }) {
  const report = dataset.metadata.doctor;
  const demo = dataset.metadata.source === "demo";
  return (
    <section className="wa-doctor wa-panel" aria-labelledby="wa-doctor-title">
      <div className="wa-doctor-heading">
        <div>
          <span className="wa-eyebrow">SOURCE COVERAGE</span>
          <h2 id="wa-doctor-title">Chat Export Doctor</h2>
        </div>
        <span className="wa-panel-badge">
          {report.status === "supported" ? "Supported" : "Partially supported"}
        </span>
      </div>
      <p>
        {demo
          ? "Structural coverage for the fictional demo, not evidence from your own export."
          : "What this local export lets us read. Only format facts and counts appear here; no message samples or participant names."}
      </p>
      <WhatsAppFormatEvidence
        detection={report.detection}
        selectedFormat={report.selectedFormat}
      />
      {report.detection.yearWidths.includes(2) && (
        <p className="wa-hint">
          Two-digit years use one explicit rule: 00–99 means 2000–2099. The
          original year width is retained; no timezone is inferred.
        </p>
      )}
      <dl className="wa-format-facts wa-doctor-coverage">
        <div>
          <dt>Participant labels found</dt>
          <dd>{whatsappNumber(report.participantLabels)}</dd>
        </div>
        <div>
          <dt>Unsupported-looking records</dt>
          <dd>{whatsappNumber(report.detection.unsupportedLookingRecords)}</dd>
        </div>
        <div>
          <dt>Unclassified marker-like records</dt>
          <dd>{whatsappNumber(report.unclassifiedMarkerRecords)}</dd>
        </div>
        <div>
          <dt>Ignored preamble lines</dt>
          <dd>{whatsappNumber(report.detection.preambleLines)}</dd>
        </div>
        <div>
          <dt>Ignored non-TXT ZIP files</dt>
          <dd>{whatsappNumber(report.ignoredCompanionFiles)}</dd>
        </div>
      </dl>
      {report.unclassifiedMarkerRecords > 0 && (
        <p className="wa-hint">
          Some records resemble event markers but do not match a supported
          complete record. They remain unclassified; their contents are not
          shown here.
        </p>
      )}
      <div className="wa-doctor-details">
        <div>
          <h3>Recognized event types</h3>
          {report.eventTypes.length ? (
            <ul>
              {report.eventTypes.map(({ kind, count }) => (
                <li key={kind}>
                  {eventLabels[kind]}: <strong>{whatsappNumber(count)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No supported whole-record event markers were recognized.</p>
          )}
        </div>
        <div>
          <h3>Recognized localized markers</h3>
          {report.localizedMarkers.length ? (
            <ul>
              {report.localizedMarkers.map(({ locale, kind, count }) => (
                <li key={`${locale}-${kind}`}>
                  {locale === "de" ? "German" : "English"} · {eventLabels[kind]}
                  : <strong>{whatsappNumber(count)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No supported localized event markers were recognized.</p>
          )}
        </div>
      </div>
      <details className="wa-doctor-limitations">
        <summary>Source limitations</summary>
        <ul>
          {report.sourceLimitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
