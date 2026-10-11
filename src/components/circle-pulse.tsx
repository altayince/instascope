"use client";
import { useMemo, useState } from "react";
import {
  circlePulse,
  validateCirclePulseRange,
  type CirclePulseResult,
} from "@/lib/analysis/circle-pulse";
import { relationshipStateLabels } from "@/lib/analysis/relationship-history";
import {
  account as profileAccount,
  isDeletedInstagramAccount,
} from "@/lib/instagram/normalize";
import { formatSnapshotDate, type VaultSnapshot } from "@/lib/snapshot-vault";
import { ActionButton } from "./actions";
import { useData } from "./data-provider";
import { useCirclePulse } from "./use-circle-pulse";
import { RelationshipDrawer } from "./relationship-drawer";

const number = (value: number) => value.toLocaleString("en-US");
const percent = (value?: number) =>
  value === undefined ? "No baseline" : `${value.toFixed(1)}%`;
type Group = "stable" | "reappeared" | "changes" | "retention";
type Range = { signature: string; startId: string; endId: string };

export function CirclePulse({
  fictional,
}: {
  fictional?: readonly VaultSnapshot[];
}) {
  const { vault, corruptSnapshots } = useData();
  const { model, busy, error, signature, load } = useCirclePulse(fictional);
  const count = fictional?.length ?? vault.length;
  const [draft, setDraft] = useState<Range | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [rangeError, setRangeError] = useState("");
  const selected = useMemo(
    () =>
      model && range?.signature === signature
        ? circlePulse(model.index, range)
        : model,
    [model, range, signature],
  );
  const snapshots = model?.index.snapshots ?? [];
  const startId =
    draft?.signature === signature
      ? draft.startId
      : (snapshots[0]?.snapshotId ?? "");
  const endId =
    draft?.signature === signature
      ? draft.endId
      : (snapshots.at(-1)?.snapshotId ?? "");
  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!model) return;
    try {
      validateCirclePulseRange(model.index, { startId, endId });
      setRange({ signature, startId, endId });
      setRangeError("");
    } catch (error) {
      setRangeError(
        error instanceof Error
          ? error.message
          : "Choose at least two snapshots in chronological order.",
      );
    }
  }
  return (
    <section
      id="circle-pulse"
      className="circle-pulse"
      aria-labelledby="circle-pulse-heading"
    >
      <p className="eyebrow">SAVED HISTORY INSIGHTS</p>
      <h2 id="circle-pulse-heading" tabIndex={-1}>
        Circle Pulse
      </h2>
      <p>
        What stayed present, what changed and what was observed again across
        your saved snapshots.
      </p>
      <p className="muted">
        Saved Vault only; your active export is not included.{" "}
        {fictional
          ? "These fictional snapshots represent one example account."
          : "Make sure the selected snapshots belong to the same Instagram account. InstaScope cannot verify account identity."}
      </p>
      {!fictional && count < 2 && corruptSnapshots > 0 && (
        <p className="muted">
          {corruptSnapshots} unreadable saved record(s) skipped; none were
          treated as empty snapshots.
        </p>
      )}
      {count < 2 ? (
        <p className="empty-state">
          Save at least two readable snapshots to explore Circle Pulse.
          Reappeared accounts need at least three.
        </p>
      ) : !model ? (
        <div role="status">
          {busy
            ? "Reading saved snapshots locally…"
            : error || "Saved history is not available yet."}
          {error && (
            <ActionButton onClick={() => void load().catch(() => {})}>
              Retry Circle Pulse
            </ActionButton>
          )}
        </div>
      ) : (
        <>
          <form
            className="pulse-range"
            onSubmit={apply}
            aria-label="Circle Pulse snapshot range"
          >
            <label>
              Start snapshot
              <select
                value={startId}
                onChange={(e) =>
                  setDraft({ signature, startId: e.target.value, endId })
                }
              >
                {snapshots.map((s) => (
                  <option value={s.snapshotId} key={s.snapshotId}>
                    {formatSnapshotDate(s.exportDate)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              End snapshot
              <select
                value={endId}
                onChange={(e) =>
                  setDraft({ signature, startId, endId: e.target.value })
                }
              >
                {snapshots.map((s) => (
                  <option value={s.snapshotId} key={s.snapshotId}>
                    {formatSnapshotDate(s.exportDate)}
                  </option>
                ))}
              </select>
            </label>
            <ActionButton type="submit">Apply range</ActionButton>
            <ActionButton
              variant="tertiary"
              type="button"
              onClick={() => {
                setRange(null);
                setDraft(null);
                setRangeError("");
              }}
            >
              All readable snapshots
            </ActionButton>
          </form>
          {rangeError && <p role="alert">{rangeError}</p>}
          {selected && (
            <PulseResults
              key={`${signature}:${range?.startId}:${range?.endId}`}
              model={selected}
              demo={!!fictional}
            />
          )}
        </>
      )}
    </section>
  );
}

function PulseResults({
  model,
  demo,
}: {
  model: CirclePulseResult;
  demo: boolean;
}) {
  const { summary } = model;
  const [group, setGroup] = useState<Group>("stable");
  const [filter, setFilter] = useState("mutual");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);
  const [inspection, setInspection] = useState<{
    username: string;
    trigger: HTMLElement;
  } | null>(null);
  const accounts = useMemo(
    () =>
      [...model.accounts.values()]
        .filter((a) => {
          if (
            !a.username.includes(query.trim().toLowerCase().replace(/^@/, ""))
          )
            return false;
          if (group === "stable")
            return filter === "followers"
              ? a.observedFollowerSnapshots === summary.snapshotCount
              : filter === "following"
                ? a.observedFollowingSnapshots === summary.snapshotCount
                : a.stableState === "mutual";
          if (group === "reappeared") return a.reappeared;
          if (group === "changes")
            return filter === "none"
              ? a.stateChanges === 0
              : filter === "one"
                ? a.stateChanges === 1
                : (a.stateChanges ?? 0) >= 2;
          const first = model.index.snapshots[0],
            last = model.index.snapshots.at(-1)!;
          const following = filter.startsWith("following");
          const older = following ? first.following : first.followers;
          const newer = following ? last.following : last.followers;
          return (
            older.has(a.username) &&
            newer.has(a.username) === filter.endsWith("retained")
          );
        })
        .sort((a, b) =>
          group === "changes"
            ? (b.stateChanges ?? 0) - (a.stateChanges ?? 0) ||
              a.username.localeCompare(b.username)
            : a.username.localeCompare(b.username),
        ),
    [model, summary.snapshotCount, query, group, filter],
  );
  const stateGroups = useMemo(() => {
    const counts = { none: 0, one: 0, multiple: 0 };
    for (const account of model.accounts.values()) {
      if (account.stateChanges === 0) counts.none++;
      else if (account.stateChanges === 1) counts.one++;
      else if ((account.stateChanges ?? 0) >= 2) counts.multiple++;
    }
    return counts;
  }, [model]);
  if (summary.snapshotCount < 2)
    return (
      <p>
        Fewer than two readable snapshots remain. Unreadable records are
        skipped, never treated as empty snapshots.
      </p>
    );
  const interval = summary.latestInterval;
  const choices: Record<Group, [string, string][]> = {
    stable: [
      ["mutual", "Stable mutuals"],
      ["followers", "Stable followers"],
      ["following", "Stable following"],
    ],
    reappeared: [],
    changes: [
      ["multiple", "2+ observed state changes"],
      ["one", "1 observed state change"],
      ["none", "No observed state changes"],
    ],
    retention: [
      ["followers-retained", "Followers still present"],
      ["followers-missing", "Followers missing in latest"],
      ["following-retained", "Following still present"],
      ["following-missing", "Following missing in latest"],
    ],
  };
  function choose(value: Group) {
    setGroup(value);
    setFilter(choices[value][0]?.[0] ?? "");
    setLimit(25);
    setQuery("");
  }
  return (
    <>
      <p className="pulse-selected-range" role="status">
        {formatSnapshotDate(summary.firstDate!)} →{" "}
        {formatSnapshotDate(summary.latestDate!)} · {summary.snapshotCount}{" "}
        readable {demo ? "fictional " : ""}snapshots
      </p>
      {summary.skippedSnapshots > 0 && (
        <p className="muted">
          {summary.skippedSnapshots} unreadable saved record(s) skipped; none
          were treated as empty snapshots.
        </p>
      )}
      <dl className="pulse-facts" aria-label="Circle Pulse key facts">
        <div data-pulse-fact="stable-mutuals">
          <dt>Stable mutuals</dt>
          <dd>{number(summary.stableMutuals)}</dd>
        </div>
        <div data-pulse-fact="reappeared">
          <dt>Reappeared accounts</dt>
          <dd>
            {summary.reappearedAccounts === undefined
              ? "Needs 3 snapshots"
              : number(summary.reappearedAccounts)}
          </dd>
        </div>
        <div data-pulse-fact="changed">
          <dt>Accounts with state changes</dt>
          <dd>{number(summary.changedAccounts!)}</dd>
        </div>
        <div data-pulse-fact="retention">
          <dt>First-to-latest follower retention</dt>
          <dd>{percent(summary.followerRetention?.percentage)}</dd>
        </div>
      </dl>
      {interval && (
        <section className="pulse-interval" aria-label="Latest interval">
          <h3>Latest interval</h3>
          <p>
            Observed between {formatSnapshotDate(interval.olderDate)} and{" "}
            {formatSnapshotDate(interval.newerDate)} snapshots
          </p>
          <dl className="pulse-interval-facts">
            {[
              ["New followers", interval.newFollowers],
              ["Missing followers", interval.missingFollowers],
              ["New following", interval.newFollowing],
              ["Missing following", interval.missingFollowing],
              ["New mutuals", interval.newMutuals],
              ["Missing mutuals", interval.missingMutuals],
              ["State changes", interval.stateChanges],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{number(value as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Snapshot differences do not establish exactly when or why a change
            happened.
          </p>
        </section>
      )}
      <div
        className="category-tabs"
        role="group"
        aria-label="Circle Pulse details"
      >
        {(
          [
            ["stable", "Stable core"],
            ["reappeared", "Reappeared"],
            ["changes", "Most state changes"],
            ["retention", "Retention details"],
          ] as [Group, string][]
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={group === value}
            onClick={() => choose(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pulse-detail" aria-label="Circle Pulse accounts">
        {group === "stable" && (
          <p>
            Followers: {number(summary.stableFollowers)} · Following:{" "}
            {number(summary.stableFollowing)} · Mutuals:{" "}
            {number(summary.stableMutuals)} present in every selected readable
            snapshot. Observations do not prove uninterrupted relationships.
          </p>
        )}
        {group === "reappeared" && (
          <p>
            {summary.reappearedAccounts === undefined
              ? "Choose at least three readable snapshots to detect reappearance."
              : "Observed again after being absent from at least one saved snapshot. This does not establish an event or its cause."}
          </p>
        )}
        {group === "changes" && (
          <p>
            No changes: {number(stateGroups.none)} · One change:{" "}
            {number(stateGroups.one)} · Two or more:{" "}
            {number(stateGroups.multiple)}. Counts compare adjacent readable
            snapshots, including Absent.
          </p>
        )}
        {group === "retention" && (
          <div className="pulse-retention">
            {(
              [
                ["Followers", summary.followerRetention],
                ["Following", summary.followingRetention],
              ] as const
            ).map(
              ([label, retention]) =>
                retention && (
                  <p key={label}>
                    <strong>
                      {label}: {percent(retention.percentage)}
                    </strong>{" "}
                    · {number(retention.retained)} of {number(retention.total)}{" "}
                    from {formatSnapshotDate(summary.firstDate!)} are present in{" "}
                    {formatSnapshotDate(summary.latestDate!)}.
                    {retention.total === 0
                      ? " No usernames in the first snapshot; a percentage is unavailable."
                      : " This can include accounts absent in an intermediate snapshot."}
                  </p>
                ),
            )}
          </div>
        )}
        {choices[group].length > 0 && (
          <label className="pulse-filter">
            Account group
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(25);
              }}
            >
              {choices[group].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="pulse-search">
          Search saved usernames
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(25);
            }}
            maxLength={200}
          />
        </label>
        <p className="muted">
          {number(accounts.length)} matching accounts
          {accounts.length > limit ? ` · showing ${limit}` : ""}
        </p>
        {accounts.length ? (
          <ul className="pulse-accounts">
            {accounts.slice(0, limit).map((account) => (
              <li key={account.username}>
                <div>
                  <button
                    className="pulse-account-name"
                    aria-haspopup="dialog"
                    type="button"
                    onClick={(event) =>
                      setInspection({
                        username: account.username,
                        trigger: event.currentTarget,
                      })
                    }
                  >
                    {!demo && isDeletedInstagramAccount(account.username)
                      ? "Deleted account"
                      : `@${account.username}`}
                  </button>
                  <p>
                    {relationshipStateLabels[account.latestState]} in latest
                    saved snapshot · {account.stateChanges} observed state
                    changes
                  </p>
                  {group === "reappeared" && (
                    <p>
                      First present: {formatSnapshotDate(account.firstPresent!)}{" "}
                      · Latest present:{" "}
                      {formatSnapshotDate(account.latestPresent!)}
                      {account.absentIntervals
                        .filter(
                          (gap) =>
                            gap.previousPresentDate && gap.nextPresentDate,
                        )
                        .map((gap) => (
                          <span key={gap.firstAbsentDate}>
                            {" "}
                            · Absent: {formatSnapshotDate(gap.firstAbsentDate)}
                            {gap.lastAbsentDate !== gap.firstAbsentDate
                              ? ` – ${formatSnapshotDate(gap.lastAbsentDate)}`
                              : ""}
                          </span>
                        ))}
                    </p>
                  )}
                </div>
                <span className="muted">
                  {account.observedSnapshots} of {summary.snapshotCount}{" "}
                  snapshots
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">No accounts match this selected group and search.</p>
        )}
        {accounts.length > limit && (
          <ActionButton
            type="button"
            onClick={() => setLimit((value) => value + 25)}
          >
            Show 25 more accounts
          </ActionButton>
        )}
      </div>
      {inspection && (
        <RelationshipDrawer
          account={profileAccount(inspection.username)!}
          savedHistory={model.index}
          demo={demo}
          returnFocus={inspection.trigger}
          onClose={() => setInspection(null)}
        />
      )}
    </>
  );
}
