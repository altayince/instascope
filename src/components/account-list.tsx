"use client";
import { useMemo, useState } from "react";
import type { Account, Dataset } from "@/lib/instagram/types";
import {
  isDeletedInstagramAccount,
  usableInstagramProfileHref,
} from "@/lib/instagram/normalize";
import { download } from "@/lib/download";
import { requestAge } from "@/lib/analysis/insights";
import { RelationshipDrawer } from "./relationship-drawer";
export function AccountList({
  accounts,
  selectable = false,
  selectionScope = accounts,
  dateLabel = "",
  ageReference,
  initialSort = "az",
  countLabel = "accounts",
  demo = false,
  selectedUsernames,
  onSelectionChange,
  context,
  showDate = true,
  sortDates = true,
  dateDirection,
  relationshipDataset,
}: {
  accounts: Account[];
  selectable?: boolean;
  selectionScope?: Account[];
  dateLabel?: string;
  ageReference?: string;
  initialSort?: "az" | "oldest" | "newest";
  countLabel?: "accounts" | "records";
  demo?: boolean;
  selectedUsernames?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  context?: ReadonlyMap<string, string[]>;
  showDate?: boolean;
  sortDates?: boolean;
  dateDirection?: "followers" | "following";
  relationshipDataset?: Dataset;
}) {
  const [opened, setOpened] = useState<{
    account: Account;
    dataset: Dataset;
    trigger: HTMLElement;
  } | null>(null);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState(initialSort),
    [page, setPage] = useState(0),
    [onlySelected, setOnlySelected] = useState(false);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const selected = selectedUsernames ?? localSelected;
  function changeSelection(update: (previous: Set<string>) => Set<string>) {
    const next = update(selected);
    if (onSelectionChange) onSelectionChange(next);
    else setLocalSelected(next);
  }
  const activeSelection = useMemo(
    () =>
      new Set(
        selectionScope
          .filter((a) => selected.has(a.username))
          .map((a) => a.username),
      ),
    [selectionScope, selected],
  );
  const filtered = useMemo(
    () =>
      accounts
        .filter(
          (a) =>
            a.username.includes(query.trim().toLowerCase().replace(/^@/, "")) &&
            (!onlySelected || activeSelection.has(a.username)),
        )
        .sort((a, b) => {
          if (sort === "az") return a.username.localeCompare(b.username);
          if (a.timestamp === undefined)
            return b.timestamp === undefined
              ? a.username.localeCompare(b.username)
              : 1;
          if (b.timestamp === undefined) return -1;
          return sort === "oldest"
            ? a.timestamp - b.timestamp
            : b.timestamp - a.timestamp;
        }),
    [accounts, query, sort, onlySelected, activeSelection],
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 50) - 1),
  );
  const visible = filtered.slice(currentPage * 50, (currentPage + 1) * 50);
  function toggle(username: string) {
    changeSelection((previous) => {
      const next = new Set(previous);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }
  function isDeleted(entry: Account) {
    return !demo && isDeletedInstagramAccount(entry.username);
  }
  function profileHref(entry: Account) {
    return demo ? null : usableInstagramProfileHref(entry);
  }
  function displayName(entry: Account) {
    return isDeleted(entry) ? "Deleted account" : `@${entry.username}`;
  }
  function details(a: Account, local: boolean) {
    return (
      <>
        {!local && profileHref(a) ? (
          <a
            className="account-username"
            href={profileHref(a)!}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            <strong>{displayName(a)}</strong>
          </a>
        ) : (
          <strong>{displayName(a)}</strong>
        )}
        {showDate && (
          <small>
            {dateLabel && `${dateLabel}: `}
            {a.timestamp
              ? new Date(a.timestamp * 1000).toLocaleDateString("en-US", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                })
              : "Date unavailable"}
          </small>
        )}
        {context?.get(a.username)?.length ? (
          <span className="account-signals">
            {context.get(a.username)!.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </span>
        ) : null}
        {ageReference !== undefined && (
          <small>
            {requestAge(a.timestamp, ageReference) === null
              ? a.timestamp === undefined
                ? "Age unavailable"
                : "Age unavailable for this reference date"
              : `${requestAge(a.timestamp, ageReference)} days since recorded request`}
          </small>
        )}
      </>
    );
  }
  return (
    <div className="account-list">
      <div className="list-controls">
        <label className="search-label">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search your connections"
            aria-label="Search accounts"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
        {sortDates && (
          <select
            aria-label="Sort accounts"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setPage(0);
            }}
          >
            <option value="az">Username A–Z</option>
            <option value="newest">
              {dateDirection === "followers"
                ? "Newest recorded followers"
                : dateLabel
                  ? "Newest recorded date"
                  : "Recently followed"}
            </option>
            <option value="oldest">
              {dateDirection === "followers"
                ? "Oldest recorded followers"
                : dateLabel
                  ? "Oldest recorded date"
                  : "Oldest follows"}
            </option>
          </select>
        )}
      </div>
      {selectable && (
        <div className="selection-bar">
          <span>{activeSelection.size} selected</span>
          <button
            onClick={() =>
              changeSelection(
                (previous) =>
                  new Set([...previous, ...visible.map((a) => a.username)]),
              )
            }
          >
            Select this page
          </button>
          <button onClick={() => changeSelection(() => new Set())}>
            Clear selection
          </button>
          <label>
            <input
              type="checkbox"
              checked={onlySelected}
              onChange={(event) => {
                setOnlySelected(event.target.checked);
                setPage(0);
              }}
            />{" "}
            Selected only
          </label>
          <button
            disabled={!activeSelection.size}
            onClick={() =>
              download(
                new Blob(
                  [
                    "username,profile_url\n" +
                      selectionScope
                        .filter((a) => activeSelection.has(a.username))
                        .map((a) => `${a.username},${profileHref(a) ?? ""}`)
                        .join("\n"),
                  ],
                  { type: "text/csv;charset=utf-8" },
                ),
                demo
                  ? "instascope-demo-review-list.csv"
                  : "instascope-review-list.csv",
              )
            }
          >
            Export selected CSV
          </button>
        </div>
      )}
      <p className="list-caption">
        {filtered.length.toLocaleString("en-US")}{" "}
        {filtered.length === 1
          ? countLabel === "accounts"
            ? "account"
            : "record"
          : countLabel}{" "}
        {selectable &&
          (demo
            ? "· Fictional accounts for demo review only"
            : "· Review manually on Instagram")}
      </p>
      {!filtered.length ? (
        <div className="empty-state">
          {accounts.length
            ? "No accounts match this view. Try another filter or search."
            : "No account records in this view. Choose another category, or import an export containing these records."}
        </div>
      ) : (
        <ul className="accounts">
          {visible.map((a) => (
            <li key={`${a.username}:${a.timestamp ?? "unknown"}`}>
              {selectable && (
                <input
                  type="checkbox"
                  aria-label={`Select ${isDeleted(a) ? "Deleted account" : a.username}`}
                  checked={activeSelection.has(a.username)}
                  onChange={() => toggle(a.username)}
                />
              )}
              {relationshipDataset ? (
                <button
                  type="button"
                  className="account-open"
                  aria-label={`Inspect relationship with ${displayName(a)}`}
                  aria-haspopup="dialog"
                  onClick={(event) =>
                    setOpened({
                      account: a,
                      dataset: relationshipDataset,
                      trigger: event.currentTarget,
                    })
                  }
                >
                  <span className="avatar" aria-hidden="true">
                    {isDeleted(a) ? "DA" : a.username.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="account-body">{details(a, true)}</span>
                  <span className="account-inspect-hint" aria-hidden="true">
                    Details
                  </span>
                </button>
              ) : (
                <>
                  <span className="avatar" aria-hidden="true">
                    {isDeleted(a) ? "DA" : a.username.slice(0, 2).toUpperCase()}
                  </span>
                  <div>{details(a, false)}</div>
                </>
              )}
              {demo ? (
                <span className="demo-profile">Fictional profile</span>
              ) : profileHref(a) ? (
                <a
                  className="account-profile"
                  href={profileHref(a)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  aria-label={`Open ${a.username} on Instagram`}
                >
                  View profile
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {filtered.length > 50 && (
        <div className="pagination">
          <button
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {Math.ceil(filtered.length / 50)}
          </span>
          <button
            disabled={(currentPage + 1) * 50 >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
      {opened && opened.dataset === relationshipDataset && (
        <RelationshipDrawer
          account={opened.account}
          dataset={opened.dataset}
          returnFocus={opened.trigger}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
