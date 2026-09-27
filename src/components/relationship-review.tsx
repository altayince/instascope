"use client";
import { useMemo, useState } from "react";
import { AccountList } from "./account-list";
import { Unavailable } from "./connection-insights";
import {
  filterRequests,
  utcDate,
  type AgeFilter,
} from "@/lib/analysis/insights";
import { relationshipReview } from "@/lib/analysis/review";
import type { Analysis } from "@/lib/analysis/relationships";
import type { Account, Dataset } from "@/lib/instagram/types";

type ReviewGroup =
  | "oneWay"
  | "following"
  | "oldest"
  | "newest"
  | "pending"
  | "unfollowed"
  | "mutuals"
  | "selected";
const groupLabels: { id: ReviewGroup; label: string }[] = [
  { id: "oneWay", label: "One-way follows" },
  { id: "following", label: "All following" },
  { id: "oldest", label: "Oldest recorded follows" },
  { id: "newest", label: "Newest recorded follows" },
  { id: "pending", label: "Pending requests" },
  { id: "unfollowed", label: "You unfollowed" },
  { id: "mutuals", label: "Mutuals" },
  { id: "selected", label: "Review list" },
];
const groupDescriptions: Record<ReviewGroup, string> = {
  oneWay:
    "You follow these accounts, but they do not appear in this export’s followers list. That is context, not a recommendation to unfollow.",
  following:
    "Every account in your following list, including dated and undated connections.",
  oldest:
    "Dated current follows, oldest recorded date first. There is no quality score or age cutoff; undated follows remain in All following.",
  newest:
    "The same dated current follows, newest recorded date first. These are export dates, not a live activity feed.",
  pending:
    "Sent requests recorded as pending in this export. Instagram may have changed since then; review profiles manually.",
  unfollowed:
    "Accounts you unfollowed according to this export’s recent history. This does not identify people who unfollowed you.",
  mutuals:
    "Accounts you follow that also appear in your followers list. Being mutual does not imply any action is needed.",
  selected:
    "One account per username, even when it appears in several groups. Open profiles for context and make any decisions yourself on Instagram.",
};

export function RelationshipReview({
  dataset,
  analysis,
}: {
  dataset: Dataset;
  analysis: Analysis;
}) {
  const review = useMemo(
    () => relationshipReview(dataset, analysis),
    [dataset, analysis],
  );
  const [group, setGroup] = useState<ReviewGroup>("oneWay");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [referenceDate, setReferenceDate] = useState(() =>
    new Date(dataset.metadata.parsedAt).toISOString().slice(0, 10),
  );
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [followYear, setFollowYear] = useState("all");
  const followYears = useMemo(
    () =>
      [
        ...new Set(
          review.datedFollowing.map((entry) =>
            utcDate(entry.timestamp!).slice(0, 4),
          ),
        ),
      ].sort((a, b) => b.localeCompare(a)),
    [review],
  );
  const datedFollowing =
    followYear === "all"
      ? review.datedFollowing
      : review.datedFollowing.filter((entry) =>
          utcDate(entry.timestamp!).startsWith(followYear),
        );
  const unavailable =
    group === "pending"
      ? review.pending.status !== "available"
        ? review.pending
        : null
      : group === "unfollowed" && review.history.status !== "available"
        ? review.history
        : null;
  const counts: Record<ReviewGroup, number | string> = {
    oneWay: analysis.notFollowingBack.length,
    following: analysis.following.length,
    oldest: review.datedFollowing.length,
    newest: review.datedFollowing.length,
    pending:
      review.pending.status === "available"
        ? review.pendingAccounts.length
        : review.pending.status === "missing"
          ? "Not included"
          : "Could not read",
    unfollowed:
      review.history.status === "available"
        ? review.unfollowedAccounts.length
        : review.history.status === "missing"
          ? "Not included"
          : "Could not read",
    mutuals: analysis.mutuals.length,
    selected: selected.size,
  };
  const accounts: Record<ReviewGroup, Account[]> = {
    oneWay: analysis.notFollowingBack,
    following: analysis.following,
    oldest: datedFollowing,
    newest: datedFollowing,
    pending: filterRequests(review.pendingAccounts, referenceDate, ageFilter),
    unfollowed: review.unfollowedAccounts,
    mutuals: analysis.mutuals,
    selected: review.selectionScope.filter((entry) =>
      selected.has(entry.username),
    ),
  };
  const dateLabel =
    group === "pending"
      ? "Request recorded"
      : group === "unfollowed"
        ? "Unfollow recorded"
        : "Follow recorded";
  const initialSort =
    group === "oldest" || group === "pending"
      ? "oldest"
      : group === "newest" || group === "unfollowed"
        ? "newest"
        : "az";
  return (
    <section className="relationship-review" aria-label="Relationship Review">
      <p className="notice">
        Choose a signal, build one private review list, then decide what to do
        yourself. InstaScope never changes your Instagram account.
      </p>
      <div className="review-groups" role="group" aria-label="Review signals">
        {groupLabels.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={group === id}
            onClick={() => setGroup(id)}
          >
            <span>{label}</span>
            <strong>{counts[id]}</strong>
          </button>
        ))}
      </div>
      <div className="list-heading">
        <h3>{groupLabels.find(({ id }) => id === group)!.label}</h3>
        <p>{groupDescriptions[group]}</p>
      </div>
      {(group === "oldest" || group === "newest") && (
        <label className="review-year">
          Recorded follow year
          <select
            value={followYear}
            onChange={(event) => setFollowYear(event.target.value)}
          >
            <option value="all">All recorded years</option>
            {followYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      )}
      {group === "pending" && review.pending.status === "available" && (
        <div className="insight-controls">
          <label>
            Age reference date (UTC)
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => setReferenceDate(event.target.value)}
            />
          </label>
          <label>
            Request age
            <select
              aria-label="Request age"
              value={ageFilter}
              onChange={(event) =>
                setAgeFilter(event.target.value as AgeFilter)
              }
            >
              <option value="all">All recorded requests</option>
              <option value="30">30+ days</option>
              <option value="90">90+ days</option>
              <option value="365">365+ days</option>
              <option value="unknown">Age unavailable</option>
            </select>
          </label>
          <p>
            Age uses recorded dates and the date you choose, not confirmation
            that a request is still pending today.
          </p>
        </div>
      )}
      {group === "unfollowed" && review.history.status === "available" && (
        <p className="list-caption">
          One row per account. If the export records more than one unfollow
          event, the latest recorded date is shown here; the standalone history
          keeps every distinct event.
        </p>
      )}
      {unavailable ? (
        <Unavailable list={unavailable} />
      ) : (
        <AccountList
          key={group}
          accounts={accounts[group]}
          selectionScope={review.selectionScope}
          selectedUsernames={selected}
          onSelectionChange={setSelected}
          context={review.context}
          selectable
          demo={dataset.metadata.demo}
          dateLabel={group === "selected" ? "" : dateLabel}
          ageReference={group === "pending" ? referenceDate : undefined}
          initialSort={initialSort}
          showDate={group !== "selected"}
          sortDates={group !== "selected"}
        />
      )}
    </section>
  );
}
