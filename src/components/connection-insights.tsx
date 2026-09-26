"use client";
import { useMemo, useState } from "react";
import type {
  ConnectionKind,
  ConnectionList,
  Dataset,
} from "@/lib/instagram/types";
import { missingConnection } from "@/lib/instagram/connections";
import { filterRequests, type AgeFilter } from "@/lib/analysis/insights";
import { AccountList } from "./account-list";

const privacyLists = {
  closeFriends: [
    "Close friends",
    "Accounts included in your close friends list.",
  ],
  blocked: ["Blocked accounts", "Accounts included in your blocked list."],
  restricted: [
    "Restricted accounts",
    "Accounts included in your restricted list.",
  ],
  hideStoryFrom: [
    "Story hidden from",
    "Accounts included in your hide-story list.",
  ],
} as const;
function readList(dataset: Dataset, kind: ConnectionKind) {
  return dataset.connections?.[kind] ?? missingConnection();
}
function Unavailable({ list }: { list: ConnectionList }) {
  if (list.status === "available") return null;
  return (
    <div className="empty-state" role="status">
      <strong>
        {list.status === "missing"
          ? "Not included"
          : "Could not read this list"}
      </strong>
      <p>{list.message}</p>
    </div>
  );
}
export function PendingRequests({ dataset }: { dataset: Dataset }) {
  const list = readList(dataset, "pendingRequests");
  const [referenceDate, setReferenceDate] = useState(() =>
    new Date(dataset.metadata.parsedAt).toISOString().slice(0, 10),
  );
  const [filter, setFilter] = useState<AgeFilter>("all");
  const filtered = useMemo(
    () => filterRequests(list.accounts, referenceDate, filter),
    [list.accounts, referenceDate, filter],
  );
  return (
    <section aria-label="Pending request review">
      <div className="list-heading">
        <h3>Sent follow requests</h3>
        <p>
          Requests listed as pending in this export. Instagram may have changed
          since the export was created. Review profiles manually.
        </p>
      </div>
      <Unavailable list={list} />
      {list.status === "available" && (
        <>
          <p className="notice">
            {list.accounts.length} requests in this export. Age means calendar
            days since the recorded request date (UTC), not confirmation that it
            is still pending.
          </p>
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
                value={filter}
                onChange={(event) => setFilter(event.target.value as AgeFilter)}
              >
                <option value="all">All requests</option>
                <option value="30">30+ days</option>
                <option value="90">90+ days</option>
                <option value="365">365+ days</option>
                <option value="unknown">Age unavailable</option>
              </select>
            </label>
          </div>
          <p className="list-caption">
            The reference date starts at the import day. Set it to your export
            date to measure age at that time. Dates after it have no calculated
            age.
          </p>
          <AccountList
            accounts={filtered}
            selectionScope={list.accounts}
            selectable
            dateLabel="Request recorded"
            ageReference={referenceDate}
            initialSort="oldest"
          />
        </>
      )}
    </section>
  );
}
export function PrivacyLists({ dataset }: { dataset: Dataset }) {
  const [kind, setKind] = useState<keyof typeof privacyLists>("closeFriends");
  const list = readList(dataset, kind);
  return (
    <section aria-label="Connection privacy dashboard">
      <p className="notice">
        Your private connection lists, as recorded in this export. InstaScope
        does not change Instagram settings. These lists and their counts are
        excluded from Wrapped cards.
      </p>
      <div className="stats-grid privacy-stats">
        {Object.entries(privacyLists).map(([key, [label]]) => {
          const value = readList(dataset, key as ConnectionKind);
          return (
            <button
              key={key}
              className={`stat ${key === kind ? "active" : ""}`}
              aria-pressed={kind === key}
              onClick={() => setKind(key as typeof kind)}
            >
              <span>{label}</span>
              <strong>
                {value.status === "available" ? value.accounts.length : "—"}
              </strong>
              <small>
                {value.status === "available"
                  ? "In this export"
                  : value.status === "missing"
                    ? "Not included"
                    : "Could not read"}
              </small>
            </button>
          );
        })}
      </div>
      <div className="list-heading">
        <h3>{privacyLists[kind][0]}</h3>
        <p>
          {privacyLists[kind][1]} Dates are those supplied by the export; they
          do not establish how long a setting has been continuously active.
        </p>
      </div>
      <Unavailable list={list} />
      {list.status === "available" && (
        <AccountList
          key={kind}
          accounts={list.accounts}
          dateLabel="Recorded date"
        />
      )}
    </section>
  );
}
export function UnfollowHistory({ dataset }: { dataset: Dataset }) {
  const list = readList(dataset, "recentlyUnfollowed");
  return (
    <section aria-label="Your unfollow history">
      <div className="list-heading">
        <h3>Accounts you recently unfollowed</h3>
        <p>
          This is your own action history from Instagram’s recently-unfollowed
          list. It does not identify people who unfollowed you.
        </p>
      </div>
      <p className="notice">
        This list may cover only a limited period. It is not a complete lifetime
        history, and an account may have been followed again. Dates are the
        recorded event dates.
      </p>
      <Unavailable list={list} />
      {list.status === "available" && (
        <AccountList
          accounts={list.accounts}
          dateLabel="Unfollow recorded"
          initialSort="newest"
          countLabel="records"
        />
      )}
    </section>
  );
}
