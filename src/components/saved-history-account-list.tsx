"use client";
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type ComponentProps,
} from "react";
import { AccountList } from "./account-list";
import { useData } from "./data-provider";
import { useVaultHistoryIndex } from "./use-vault-history";
import { demoVaultSnapshots } from "@/lib/demo";
import type { Dataset } from "@/lib/instagram/types";
import {
  savedHistoryContext,
  type HistoryContextKind,
} from "@/lib/analysis/relationship-history";
import { validExportDate } from "@/lib/snapshot-storage";
import { vaultStorageMessage } from "@/lib/vault-storage";

export function SavedHistoryAccountList({
  dataset,
  kind,
  listKey,
  ...props
}: ComponentProps<typeof AccountList> & {
  dataset: Dataset;
  kind: HistoryContextKind;
  listKey: string;
}) {
  const { currentExportDate } = useData();
  const fictional = useMemo(
    () => (dataset.metadata.demo ? demoVaultSnapshots() : undefined),
    [dataset],
  );
  const { signature, load } = useVaultHistoryIndex(fictional);
  const [date, setDate] = useState(currentExportDate ?? ""),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [loaded, setLoaded] = useState<{
    dataset: Dataset;
    signature: string;
    date: string;
    kind: HistoryContextKind;
    context: Map<string, string[]>;
    snapshotCount: number;
  } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const valid =
    loaded?.dataset === dataset &&
    loaded.signature === signature &&
    loaded.date === date &&
    loaded.kind === kind &&
    confirmed;
  const merged = new Map(props.context);
  if (valid && loaded)
    for (const [name, labels] of loaded.context)
      merged.set(name, [...(merged.get(name) ?? []), ...labels]);
  async function review() {
    setError("");
    if (!confirmed || !validExportDate(date)) {
      setError(
        "Enter the active export date and confirm the same account first.",
      );
      return;
    }
    setBusy(true);
    try {
      const index = await load();
      const result = savedHistoryContext(
        index,
        (props.selectionScope ?? props.accounts).map((a) => a.username),
        date,
        confirmed,
        kind,
      );
      if (alive.current)
        setLoaded({ dataset, signature, date, kind, ...result });
    } catch (error) {
      if (alive.current) setError(vaultStorageMessage(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <details className="data-notes saved-history-context">
        <summary>Add saved history context</summary>
        <p>
          {dataset.metadata.demo
            ? "Fictional Vault history only. Choose a fictional newer export date to explore context; your real history is not used."
            : "Only readable saved snapshots earlier than the date you enter are used. Import time is not an export date. Context cannot establish intent, exact timing or uninterrupted following."}
        </p>
        <label>
          Active export date{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          {dataset.metadata.demo
            ? "These fictional examples represent the same account."
            : "I confirm the active export and saved snapshots belong to the same Instagram account."}
        </label>
        <button
          type="button"
          disabled={busy || !confirmed || !validExportDate(date)}
          onClick={() => void review()}
        >
          {busy ? "Reading local history…" : "Show saved history context"}
        </button>
        {error && <p role="alert">{error}</p>}
        {valid && loaded && (
          <p role="status">
            {loaded.snapshotCount} earlier readable snapshots reviewed. This is
            observed history, not a recommendation or score.
          </p>
        )}
      </details>
      <AccountList {...props} key={listKey} context={merged} />
    </>
  );
}
