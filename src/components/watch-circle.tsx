"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Dataset } from "@/lib/instagram/types";
import { account, isDeletedInstagramAccount } from "@/lib/instagram/normalize";
import { watchCircle } from "@/lib/analysis/watch-circle";
import { timelineAccountIndex } from "@/lib/analysis/timeline-context";
import {
  relationshipStateLabels,
  type RelationshipHistoryIndex,
} from "@/lib/analysis/relationship-history";
import {
  DEMO_WATCH_EXPORT_DATE,
  demoWatchSnapshots,
} from "@/lib/demo-review-memory";
import { validExportDate } from "@/lib/snapshot-storage";
import { formatSnapshotDate } from "@/lib/snapshot-vault";
import { vaultStorageMessage } from "@/lib/vault-storage";
import { useData } from "./data-provider";
import { useReviewMemory } from "./review-memory-provider";
import { useVaultHistoryIndex } from "./use-vault-history";
import { RelationshipDrawer } from "./relationship-drawer";
import { ActionButton } from "./actions";
import { AccountCsvDownload } from "./account-csv-download";
import { useVisibleProductSurface } from "./use-product-event";
import "./watch-circle.css";

export function WatchCircle({ dataset }: { dataset: Dataset }) {
  const surface = useVisibleProductSurface("watch_circle_opened");
  const { currentExportDate } = useData();
  const fictional = useMemo(
    () => (dataset.metadata.demo ? demoWatchSnapshots() : undefined),
    [dataset],
  );
  const history = useVaultHistoryIndex(fictional);
  // Unmount on every Vault revision: deleted/replaced context cannot reappear
  // even if an old backup later restores the same snapshot identity/date.
  return (
    <WatchCircleContents
      key={`${history.signature}:${currentExportDate ?? ""}`}
      dataset={dataset}
      history={history}
      surface={surface}
    />
  );
}

function WatchCircleContents({
  dataset,
  history,
  surface,
}: {
  dataset: Dataset;
  history: ReturnType<typeof useVaultHistoryIndex>;
  surface: ReturnType<typeof useVisibleProductSurface>;
}) {
  const id = useId();
  const memory = useReviewMemory();
  const { vault, currentExportDate, corruptSnapshots } = useData();
  const demo = !!dataset.metadata.demo;
  const { load: loadHistory } = history;
  const active = useMemo(() => timelineAccountIndex(dataset), [dataset]);
  const [datedSource, setDate] = useState({
    dataset,
    value: demo ? DEMO_WATCH_EXPORT_DATE : (currentExportDate ?? ""),
  });
  const exportDate =
    datedSource.dataset === dataset
      ? datedSource.value
      : (currentExportDate ?? "");
  const [confirmedSource, setConfirmed] = useState<Dataset | null>(null);
  const confirmed = demo || confirmedSource === dataset;
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    dataset: Dataset;
    revision: number;
    date: string;
    index: RelationshipHistoryIndex;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listWindow, setListWindow] = useState({ dataset, limit: 50 });
  const visibleLimit = listWindow.dataset === dataset ? listWindow.limit : 50;
  const [opened, setOpened] = useState<{
    username: string;
    dataset: Dataset;
    trigger: HTMLElement;
  } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!demo) return;
    let current = true;
    loadHistory()
      .then((index) => {
        if (current)
          setLoaded({
            dataset,
            revision: 0,
            date: DEMO_WATCH_EXPORT_DATE,
            index,
          });
      })
      .catch((reason) => {
        if (current) setError(vaultStorageMessage(reason));
      });
    return () => {
      current = false;
    };
  }, [dataset, demo, loadHistory]);
  const valid =
    loaded?.dataset === dataset &&
    loaded.revision === revision &&
    loaded.date === exportDate &&
    confirmed;
  const model = useMemo(
    () =>
      watchCircle(
        memory.records.values(),
        active,
        valid && loaded
          ? { history: loaded.index, currentDate: exportDate, confirmed }
          : undefined,
      ),
    [memory.records, active, valid, loaded, exportDate, confirmed],
  );
  async function loadComparison() {
    setError("");
    if (!confirmed || !validExportDate(exportDate)) {
      setError(
        "Enter the active export date and confirm the same account first.",
      );
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const index = await loadHistory();
      // The analysis guard applies here too, independently of the button state.
      watchCircle(memory.records.values(), active, {
        history: index,
        currentDate: exportDate,
        confirmed,
      });
      if (alive.current)
        setLoaded({ dataset, revision, date: exportDate, index });
    } catch (reason) {
      if (alive.current) setError(vaultStorageMessage(reason));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const display = (name: string) =>
    isDeletedInstagramAccount(name) ? "Deleted account" : `@${name}`;
  const skipped = model.skippedSnapshots || (!demo ? corruptSnapshots : 0);
  return (
    <section
      ref={surface}
      className="watch-circle"
      aria-labelledby={`${id}-title`}
    >
      <div className="dashboard-section-heading">
        <span className="eyebrow">WATCH CIRCLE</span>
        <h2 className="dashboard-section-title" id={`${id}-title`}>
          Watch Circle
        </h2>
        <p>
          Accounts you explicitly chose to watch. Observations, never live
          alerts.
        </p>
      </div>
      {demo && (
        <p className="notice">
          Demo data · Fictional review memory. The Dec 15, 2024 Watch comparison
          point is a separate teaching fixture, not a saved local Vault
          snapshot.
        </p>
      )}
      {!memory.ready ? (
        <p role="status">Opening local review memory…</p>
      ) : (
        <>
          {memory.error && (
            <p role="status">
              {memory.error}{" "}
              <ActionButton
                variant="tertiary"
                onClick={() => void memory.retry()}
              >
                Retry review memory
              </ActionButton>
            </p>
          )}
          {memory.warning && <p role="status">{memory.warning}</p>}
          {!memory.error && !model.observations.length ? (
            <p className="empty-state">
              {memory.corrupt
                ? "No readable watched accounts in the available Review Memory. Unreadable review records were skipped."
                : "No watched accounts yet. Watch accounts from Relationship Drawer to highlight observed changes across future exports."}
            </p>
          ) : (
            model.observations.length > 0 && (
              <>
                <p className="watch-circle-summary" role="status">
                  <strong>
                    {model.observations.length} watched{" "}
                    {model.observations.length === 1 ? "account" : "accounts"}
                  </strong>
                  {model.status === "loaded" ? (
                    model.changedCount ? (
                      <>
                        {" "}
                        · {model.changedCount} observed state{" "}
                        {model.changedCount === 1 ? "change" : "changes"} in the
                        loaded comparison context
                      </>
                    ) : (
                      <>
                        {" "}
                        · no observed state changes in the loaded comparison
                        context
                      </>
                    )
                  ) : (
                    <> · saved-history comparison not loaded</>
                  )}
                </p>
                {!demo && (
                  <details className="watch-comparison-controls">
                    <summary>Load watched comparison</summary>
                    <p>
                      Use only the latest readable saved snapshot strictly
                      earlier than the active export date. You are responsible
                      for confirming both exports belong to the same Instagram
                      account.
                    </p>
                    {!vault.length && !corruptSnapshots && (
                      <p>
                        No saved snapshots yet. Save an export, then return with
                        a newer export from the same account.
                      </p>
                    )}
                    <label>
                      Active export date for Watch Circle
                      <input
                        type="date"
                        value={exportDate}
                        onChange={(event) => {
                          setDate({ dataset, value: event.target.value });
                          setRevision((value) => value + 1);
                          setError("");
                        }}
                      />
                    </label>
                    <label className="snapshot-account-confirmation">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => {
                          setConfirmed(event.target.checked ? dataset : null);
                          setRevision((value) => value + 1);
                          setError("");
                        }}
                      />
                      I confirm the active export and saved snapshots are from
                      the same Instagram account.
                    </label>
                    <ActionButton
                      variant="secondary"
                      disabled={
                        busy ||
                        !confirmed ||
                        !validExportDate(exportDate) ||
                        (!vault.length && !corruptSnapshots)
                      }
                      onClick={() => void loadComparison()}
                    >
                      {busy
                        ? "Reading local comparison…"
                        : "Load Watch comparison"}
                    </ActionButton>
                  </details>
                )}
                {error && <p role="alert">{error}</p>}
                {model.status === "unavailable" && (
                  <p role="status">
                    No earlier readable saved snapshot is available for this
                    export date. No state-change comparison can be established.
                  </p>
                )}
                {!!skipped && (
                  <p role="status">
                    Unreadable saved records were skipped. They are never
                    treated as absent observations; a loaded comparison uses the
                    latest earlier readable snapshot.
                  </p>
                )}
                {model.status === "loaded" && (
                  <p className="list-caption">
                    Latest earlier readable{" "}
                    {demo ? "fictional comparison point" : "saved snapshot"}:{" "}
                    {formatSnapshotDate(model.previousSnapshotDate!)} · Active
                    export: {formatSnapshotDate(model.currentDate!)}
                  </p>
                )}
                <details className="watch-observations">
                  <summary>Review watched accounts</summary>
                  <AccountCsvDownload
                    accounts={model.observations.map((entry) =>
                      account(entry.username)!,
                    )}
                    demo={demo}
                  />
                  <ul>
                    {model.observations.slice(0, visibleLimit).map((entry) => (
                      <li key={entry.username}>
                        <ActionButton
                          variant="tertiary"
                          className="watch-account-open"
                          type="button"
                          aria-haspopup="dialog"
                          onClick={(event) =>
                            setOpened({
                              username: entry.username,
                              dataset,
                              trigger: event.currentTarget,
                            })
                          }
                        >
                          {display(entry.username)}
                        </ActionButton>
                        <dl>
                          {entry.previousState && (
                            <div>
                              <dt>Previous observed state</dt>
                              <dd>
                                {relationshipStateLabels[entry.previousState]}
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt>Current export state</dt>
                            <dd>
                              {relationshipStateLabels[entry.currentState]}
                            </dd>
                          </div>
                        </dl>
                        {entry.changed !== undefined && (
                          <span className="watch-change-label">
                            {entry.changed
                              ? "Observed state changed"
                              : "Same observed state"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {model.observations.length > 50 && (
                    <div className="watch-list-window">
                      <p className="list-caption" role="status">
                        Showing{" "}
                        {Math.min(visibleLimit, model.observations.length)} of{" "}
                        {model.observations.length} watched accounts.
                      </p>
                      {visibleLimit < model.observations.length && (
                        <ActionButton
                          variant="secondary"
                          type="button"
                          onClick={() =>
                            setListWindow({ dataset, limit: visibleLimit + 50 })
                          }
                        >
                          Show more watched accounts
                        </ActionButton>
                      )}
                    </div>
                  )}
                  <p>
                    Absent means missing from Followers and Following in that
                    export, not proof of an unfollow, deletion or block.
                    Comparison dates bound observations, not exact event times.
                    No causes or uninterrupted relationships are inferred.
                  </p>
                </details>
              </>
            )
          )}
        </>
      )}
      {opened && opened.dataset === dataset && (
        <RelationshipDrawer
          account={account(opened.username)!}
          dataset={dataset}
          returnFocus={opened.trigger}
          onClose={() => setOpened(null)}
        />
      )}
    </section>
  );
}
