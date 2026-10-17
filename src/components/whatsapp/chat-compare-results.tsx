"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ActionButton } from "@/components/actions";
import type { ChatVaultSnapshot } from "@/lib/whatsapp/chat-vault";
import type {
  ChatVaultComparisonResult,
  ChatComparisonMetric,
  ChatComparisonDistribution,
  ChatComparisonBucket,
} from "@/lib/whatsapp/chat-vault-compare";
import { deriveConversationPulse } from "@/lib/whatsapp/conversation-pulse";
import { whatsappNumber } from "@/lib/whatsapp/stories";
import {
  chatComparisonShare,
  chatComparisonValue,
} from "./chat-compare-format";
import {
  chatVaultCoverageLabel,
  chatVaultSavedLabel,
} from "./chat-vault-labels";

type Comparison = Extract<ChatVaultComparisonResult, { ok: true }>;
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function SnapshotContext({
  snapshot,
  label,
}: {
  snapshot: ChatVaultSnapshot;
  label: string;
}) {
  return (
    <article className="wa-panel">
      <h3>{label}</h3>
      <p>{chatVaultCoverageLabel(snapshot)}</p>
      <p>
        {whatsappNumber(snapshot.totals.messages)} messages ·{" "}
        {whatsappNumber(snapshot.totals.participants)} participant labels
      </p>
      <p>
        Saved{" "}
        <time dateTime={new Date(snapshot.createdAt).toISOString()}>
          {chatVaultSavedLabel(snapshot)}
        </time>
      </p>
      <p className="wa-hint">
        {snapshot.coverage.sourceSupport === "supported"
          ? "Supported"
          : "Partially supported"}{" "}
        source structure · {snapshot.coverage.precision} precision
      </p>
    </article>
  );
}

function MetricTable({
  metrics,
  caption,
}: {
  metrics: ChatComparisonMetric[];
  caption: string;
}) {
  return (
    <table className="wa-compare-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Saved aggregate</th>
          <th scope="col">Earlier</th>
          <th scope="col">Later</th>
          <th scope="col">Difference</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric) => (
          <tr key={metric.key}>
            <th scope="row">
              {metric.label}
              <small>{metric.classification}</small>
            </th>
            <td>{chatComparisonValue(metric.earlier, metric.unit)}</td>
            <td>{chatComparisonValue(metric.later, metric.unit)}</td>
            <td>{chatComparisonValue(metric.delta, metric.unit, true)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function bucketLabel(bucket: ChatComparisonBucket) {
  return `${bucket.label}: earlier ${whatsappNumber(bucket.earlierCount)} (${chatComparisonShare(bucket.earlierShare)}), later ${whatsappNumber(bucket.laterCount)} (${chatComparisonShare(bucket.laterShare)}); difference ${chatComparisonValue(bucket.deltaShare, "share", true)}`;
}

function ShareComparison({
  distribution,
}: {
  distribution: ChatComparisonDistribution;
}) {
  return (
    <section
      className="wa-compare-distribution"
      aria-label={distribution.label}
    >
      <h4>{distribution.label}</h4>
      <p className="wa-hint">
        Earlier denominator: {whatsappNumber(distribution.earlierTotal)}. Later
        denominator: {whatsappNumber(distribution.laterTotal)}. A zero
        denominator means unavailable, not 0%.
      </p>
      <div
        className="wa-compare-share-bars"
        role="img"
        aria-label={`${distribution.label}: earlier and later shares on the same 0–100% scale. Exact values below.`}
      >
        {distribution.buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="wa-compare-share-row"
            title={bucketLabel(bucket)}
          >
            <span>{bucket.label}</span>
            <div>
              <div className="wa-rhythm-delay-track wa-compare-bar is-earlier">
                <i style={{ width: `${(bucket.earlierShare ?? 0) * 100}%` }} />
              </div>
              <div className="wa-rhythm-delay-track wa-compare-bar">
                <i style={{ width: `${(bucket.laterShare ?? 0) * 100}%` }} />
              </div>
            </div>
            <small>
              {chatComparisonShare(bucket.earlierShare)} →{" "}
              {chatComparisonShare(bucket.laterShare)}
            </small>
          </div>
        ))}
      </div>
      <p className="wa-hint">
        Top bar: earlier. Bottom bar: later. Shares are derived from each full
        export, not activity between saves.
      </p>
      <details className="wa-chart-data">
        <summary>Read {distribution.label.toLowerCase()} values</summary>
        <table className="wa-compare-table">
          <caption>{distribution.label}</caption>
          <thead>
            <tr>
              <th scope="col">Bucket</th>
              <th scope="col">Earlier count / share</th>
              <th scope="col">Later count / share</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {distribution.buckets.map((bucket) => (
              <tr key={bucket.key}>
                <th scope="row">{bucket.label}</th>
                <td>
                  {whatsappNumber(bucket.earlierCount)} /{" "}
                  {chatComparisonShare(bucket.earlierShare)}
                </td>
                <td>
                  {whatsappNumber(bucket.laterCount)} /{" "}
                  {chatComparisonShare(bucket.laterShare)}
                </td>
                <td>{chatComparisonValue(bucket.deltaShare, "share", true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function ShareHeatmap({ heatmap }: { heatmap: ChatComparisonBucket[][] }) {
  // Color scaling is presentation only; normalized differences come from domain.
  const maximum = Math.max(
    0,
    ...heatmap.flat().map((cell) => Math.abs(cell.deltaShare ?? 0)),
  );
  return (
    <section aria-label="Weekday and hour share differences">
      <h4>Weekday and hour share differences</h4>
      <p>
        Later minus earlier share of all exported participant messages, in
        percentage points (pp). Recorded clocks only; this is not online
        presence. Stronger shading indicates a larger absolute difference.
      </p>
      <div
        className="wa-heatmap-scroll"
        role="region"
        tabIndex={0}
        aria-label="Scrollable weekday and hour share comparison"
      >
        <table className="wa-heatmap-table">
          <caption>Weekday and hour share differences</caption>
          <thead>
            <tr>
              <th scope="col">Day / hour</th>
              {Array.from({ length: 24 }, (_, hour) => (
                <th scope="col" key={hour}>
                  {String(hour).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.map((row, weekday) => (
              <tr key={days[weekday]}>
                <th scope="row">{days[weekday].slice(0, 3)}</th>
                {row.map((cell) => (
                  <td
                    key={cell.key}
                    title={bucketLabel(cell)}
                    aria-label={bucketLabel(cell)}
                    className={cell.deltaShare ? "is-active" : undefined}
                    style={
                      {
                        "--wa-intensity": maximum
                          ? 0.2 +
                            (0.8 * Math.abs(cell.deltaShare ?? 0)) / maximum
                          : 0,
                      } as CSSProperties
                    }
                  >
                    <span>
                      {cell.deltaShare === null
                        ? "—"
                        : cell.deltaShare === 0
                          ? "0"
                          : cell.deltaShare > 0
                            ? "+"
                            : "−"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="wa-hint">
        + means a higher later share, − lower, 0 unchanged, — unavailable.
        Scroll the table on narrow screens or read every exact value below.
      </p>
      <details className="wa-chart-data wa-heatmap-values wa-compare-heatmap-values">
        <summary>Read weekday and hour comparison values</summary>
        {heatmap.map((row, weekday) => (
          <div key={days[weekday]}>
            <h4>{days[weekday]}</h4>
            <ul>
              {row.map((cell) => (
                <li key={cell.key}>{bucketLabel(cell)}</li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}

export function ChatCompareResults({
  comparison,
  onReset,
}: {
  comparison: Comparison;
  onReset: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, [comparison]);
  const pulse = deriveConversationPulse(comparison);
  const metrics = (group: ChatComparisonMetric["group"]) =>
    comparison.metrics.filter((metric) => metric.group === group);
  return (
    <section className="wa-compare-result" aria-label="Snapshot comparison">
      <div className="wa-results-heading">
        <h2 ref={title} tabIndex={-1}>
          Snapshot comparison
        </h2>
        <ActionButton onClick={onReset}>Choose another pair</ActionButton>
      </div>
      <div className="wa-analysis-grid">
        <SnapshotContext
          snapshot={comparison.earlier}
          label="Earlier snapshot"
        />
        <SnapshotContext snapshot={comparison.later} label="Later snapshot" />
      </div>
      <section
        className="wa-panel wa-compare-context"
        aria-label="Comparison compatibility"
      >
        <h3>
          {comparison.compatibility.status === "comparable"
            ? "Comparable snapshots"
            : "Comparable with limitations"}
        </h3>
        <p>
          {comparison.orderBasis === "coverage-end"
            ? "Ordered by recorded coverage end date."
            : comparison.orderBasis === "saved-time"
              ? "Coverage does not establish an order; ordered by actual save time."
              : "Coverage and save times tie; a stable local ID order is used, without implying chronology."}{" "}
          {comparison.reversed &&
            "The selected order was reversed to display this order."}
        </p>
        {comparison.compatibility.reasons.length > 0 && (
          <ul>
            {comparison.compatibility.reasons.map((reason) => (
              <li key={reason.code}>{reason.message}</li>
            ))}
          </ul>
        )}
        <p>
          These are two full-export aggregates you selected, not a message diff.
          Differences do not establish messages sent between saves, complete
          history, replies, causes or relationship changes. No same-conversation
          association is verified or stored.
        </p>
      </section>
      <section aria-labelledby="wa-conversation-pulse">
        <h3 id="wa-conversation-pulse">Conversation Pulse</h3>
        <p>
          A deterministic summary of meaningful saved-aggregate differences.
          Display thresholds filter noise; they are not statistical confidence
          or a relationship score.
        </p>
        {pulse.items.length === 0 ? (
          <p role="status">{pulse.emptyReason}</p>
        ) : (
          <div className="wa-analysis-grid">
            {pulse.items.map((item) => (
              <article className="wa-panel" key={item.id}>
                <h4>{item.title}</h4>
                <p>{item.summary}</p>
                <p>
                  {chatComparisonValue(item.earlier, item.unit)} →{" "}
                  {chatComparisonValue(item.later, item.unit)} · Difference{" "}
                  {chatComparisonValue(item.delta, item.unit, true)}
                </p>
                <details className="wa-chart-data">
                  <summary>How this is calculated</summary>
                  <p>
                    {item.classification}. Fact: <code>{item.metricKey}</code>.
                  </p>
                  <p>{item.thresholdExplanation}</p>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
      <section
        className="wa-panel wa-compare-context"
        aria-label="Aggregate comparison details"
      >
        <MetricTable
          metrics={metrics("overview")}
          caption="Overview comparison"
        />
        <details className="wa-chart-data wa-compare-details">
          <summary>Activity timing</summary>
          <MetricTable
            metrics={metrics("activity")}
            caption="Recorded activity comparison"
          />
          {comparison.distributions
            .filter((item) => item.key === "hours" || item.key === "weekdays")
            .map((item) => (
              <ShareComparison key={item.key} distribution={item} />
            ))}
          <ShareHeatmap heatmap={comparison.heatmap} />
        </details>
        <details className="wa-chart-data wa-compare-details">
          <summary>Rhythm and dynamics</summary>
          <MetricTable
            metrics={metrics("rhythm")}
            caption="Rhythm comparison"
          />
          {comparison.distributions
            .filter((item) => item.key === "transitions")
            .map((item) => (
              <ShareComparison key={item.key} distribution={item} />
            ))}
          <p>
            Sessions use the existing 30-minute gap rule, long gaps at least six
            recorded hours. Next-sender transitions are not replies or response
            times. Durations have no inferred timezone.
          </p>
        </details>
        <details className="wa-chart-data wa-compare-details">
          <summary>Media and message patterns</summary>
          <MetricTable metrics={metrics("media")} caption="Media comparison" />
          {comparison.distributions
            .filter((item) => item.key === "media")
            .map((item) => (
              <ShareComparison key={item.key} distribution={item} />
            ))}
          <MetricTable
            metrics={metrics("patterns")}
            caption="Message patterns comparison"
          />
          <p>
            Text summaries cover eligible text only. Question marks are literal
            punctuation, not inferred questions. Missing summaries remain
            unavailable; there is no raw text in Chat Vault.
          </p>
        </details>
        <details className="wa-chart-data wa-compare-details">
          <summary>Comparison methodology and limits</summary>
          <p>
            Exact: arithmetic over directly stored counts. Derived:
            deterministic summaries, durations and normalized shares.
            Unavailable: either snapshot lacks a usable value or a denominator
            is zero. An unavailable value is never replaced with zero.
          </p>
          <p>
            Every distribution uses its own full-export denominator. Shares are
            compared in percentage points, not as new-period activity.
            Participant-label counts do not identify people or prove who joined
            or left. Calls are recognized markers only; senderless call events
            remain separate.
          </p>
          <p>
            Coverage is recorded participant-message dates, not complete chat
            history. V1 cannot establish shared message membership or
            reconstruct a period between snapshots. Selection and results remain
            in memory; no comparison association is persisted or sent to
            analytics.
          </p>
        </details>
      </section>
    </section>
  );
}
