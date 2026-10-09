"use client";
import { useMemo, useState } from "react";
import type { Dataset } from "@/lib/instagram/types";
import { analyze } from "@/lib/analysis/relationships";
import {
  mutualOrigins,
  mutualOriginSummary,
  mutualOriginLabels,
  MUTUAL_ORIGIN_CAVEAT,
  type MutualOrigin,
} from "@/lib/analysis/mutual-origins";
import { AccountList } from "./account-list";
export function MutualOrigins({ dataset }: { dataset: Dataset }) {
  const [origin, setOrigin] = useState<MutualOrigin | "all">("all");
  const records = useMemo(() => mutualOrigins(dataset), [dataset]);
  const summary = useMemo(() => mutualOriginSummary(records), [records]);
  const accounts = useMemo(() => analyze(dataset).mutuals, [dataset]);
  const context = useMemo(
    () =>
      new Map(
        records.map((r) => {
          const date = (value: number | undefined) =>
            value === undefined
              ? "Date unavailable"
              : new Date(value * 1000).toLocaleDateString("en-US", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                });
          return [
            r.username,
            [
              `Follower date: ${date(r.followerTimestamp)}`,
              `Following date: ${date(r.followingTimestamp)}`,
              `Recorded first: ${mutualOriginLabels[r.origin]}`,
            ],
          ];
        }),
      ),
    [records],
  );
  const selected = new Set(
    records
      .filter((r) => origin === "all" || r.origin === origin)
      .map((r) => r.username),
  );
  return (
    <section className="mutual-origins" aria-label="Mutual Origins">
      <h3 id="mutual-origins" tabIndex={-1}>
        Who followed first?
      </h3>
      <p>
        Compare both sides&apos; recorded dates for current mutuals. An earlier
        date suggests who was recorded first, not social intent or the
        first-ever follow.
      </p>
      <p className="notice">
        {summary.theyFirstPercent === null
          ? "No mutuals have two usable dates."
          : `Among ${summary.dated.toLocaleString("en-US")} mutuals with usable dates, ${summary.theyFirstPercent}% have an earlier recorded follower date.`}{" "}
        Unknown dates are excluded from the percentage.
      </p>
      <div
        className="category-tabs"
        role="group"
        aria-label="Recorded origin filters"
      >
        <button
          aria-pressed={origin === "all"}
          onClick={() => setOrigin("all")}
        >
          All mutuals <strong>{records.length}</strong>
        </button>
        {Object.entries(mutualOriginLabels).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={origin === key}
            onClick={() => setOrigin(key as MutualOrigin)}
          >
            {label} <strong>{summary.counts[key as MutualOrigin]}</strong>
          </button>
        ))}
      </div>
      <p>{MUTUAL_ORIGIN_CAVEAT}</p>
      <AccountList
        key={origin}
        accounts={accounts.filter((a) => selected.has(a.username))}
        context={context}
        showDate={false}
        demo={dataset.metadata.demo}
      />
    </section>
  );
}
