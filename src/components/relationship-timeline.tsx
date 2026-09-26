"use client";
import { useMemo, useState } from "react";
import type { Dataset } from "@/lib/instagram/types";
import { relationshipTimeline, utcDate } from "@/lib/analysis/insights";
import { AccountList } from "./account-list";

export function RelationshipTimeline({ dataset }: { dataset: Dataset }) {
  const [granularity, setGranularity] = useState<"year" | "month">("year");
  const [direction, setDirection] = useState<"following" | "followers">(
    "following",
  );
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(0);
  const timeline = useMemo(
    () => relationshipTimeline(dataset, granularity),
    [dataset, granularity],
  );
  const periods = timeline.periods.filter((p) => p[direction] > 0);
  const peak = periods.reduce((max, p) => Math.max(max, p[direction]), 1);
  const visible = periods.slice(page * 24, (page + 1) * 24);
  const accounts = useMemo(
    () =>
      dataset[direction].filter(
        (a) =>
          !period ||
          (period === "unknown"
            ? a.timestamp === undefined
            : a.timestamp !== undefined &&
              utcDate(a.timestamp).startsWith(period)),
      ),
    [dataset, direction, period],
  );
  const missing = dataset[direction].length - timeline.coverage[direction];
  return (
    <section aria-label="Relationship date timeline">
      <div className="list-heading">
        <h3>The dates in your circle</h3>
        <p>
          Counts group dated relationships still present in this export. They
          are not historical follower totals or net growth. Removed
          relationships are absent; use two snapshots to compare totals.
        </p>
      </div>
      <div className="insight-controls">
        <label>
          Relationship direction
          <select
            aria-label="Relationship direction"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as typeof direction);
              setPeriod("");
              setPage(0);
            }}
          >
            <option value="following">Accounts you follow</option>
            <option value="followers">Accounts that follow you</option>
          </select>
        </label>
        <label>
          Group dates by
          <select
            aria-label="Group dates by"
            value={granularity}
            onChange={(e) => {
              setGranularity(e.target.value as typeof granularity);
              setPeriod("");
              setPage(0);
            }}
          >
            <option value="year">Year</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>
      <p className="notice">
        {timeline.coverage[direction]} of {dataset[direction].length}{" "}
        relationships have a recorded date; {missing} dates unavailable. All
        date groups use UTC.
      </p>
      {periods.length ? (
        <div
          className="timeline-chart"
          role="group"
          aria-label="Dated relationships by period"
        >
          {visible.map((p) => (
            <button
              key={p.period}
              className="timeline-row"
              aria-pressed={period === p.period}
              aria-label={`${p.period}: ${p[direction]} dated relationships`}
              onClick={() => setPeriod(period === p.period ? "" : p.period)}
            >
              <span>{p.period}</span>
              <span className="timeline-bar" aria-hidden="true">
                <span style={{ width: `${(p[direction] / peak) * 100}%` }} />
              </span>
              <strong>{p[direction]}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          No recorded dates for this direction. JSON exports can include
          timestamps; HTML dates are not interpreted.
        </div>
      )}
      {periods.length > 24 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            Earlier periods
          </button>
          <span>
            {page + 1} / {Math.ceil(periods.length / 24)}
          </span>
          <button
            disabled={(page + 1) * 24 >= periods.length}
            onClick={() => setPage(page + 1)}
          >
            Later periods
          </button>
        </div>
      )}
      <div className="category-tabs">
        <button aria-pressed={!period} onClick={() => setPeriod("")}>
          All dates
        </button>
        <button
          aria-pressed={period === "unknown"}
          onClick={() => setPeriod("unknown")}
        >
          Date unavailable ({missing})
        </button>
      </div>
      <h3>
        {period === "unknown"
          ? "Relationships without dates"
          : period
            ? `Recorded in ${period}`
            : "All relationships in this direction"}
      </h3>
      <AccountList
        key={`${direction}:${period}`}
        accounts={accounts}
        dateLabel="Relationship recorded"
        initialSort="oldest"
      />
    </section>
  );
}
