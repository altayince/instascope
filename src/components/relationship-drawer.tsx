"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Account, Dataset } from "@/lib/instagram/types";
import {
  isDeletedInstagramAccount,
  usableInstagramProfileHref,
} from "@/lib/instagram/normalize";
import {
  RELATIONSHIP_INSPECTION_EVENT,
  TimelineAccount,
} from "./timeline-account";
import { ActionButton, InsightLink } from "./actions";
import { ReviewMemoryEditor } from "./review-memory-editor";
import { AccountHistoryDetails } from "./account-history-details";
import { SavedHistorySummary } from "./saved-history-summary";
import {
  accountHistory,
  relationshipStateLabels,
  type RelationshipHistoryIndex,
} from "@/lib/analysis/relationship-history";
import { formatSnapshotDate } from "@/lib/snapshot-vault";
import "./relationship-drawer.css";

type DrawerProps = {
  account: Account;
  returnFocus: HTMLElement;
  onClose: () => void;
} & (
  | { dataset: Dataset; savedHistory?: never; demo?: never }
  | { dataset?: never; savedHistory: RelationshipHistoryIndex; demo: boolean }
);

export function RelationshipDrawer({
  account,
  dataset,
  savedHistory,
  demo: fictional,
  returnFocus,
  onClose,
}: DrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const continueEditing = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<"close" | "timeline" | null>(null);
  const id = useId();
  const demo = dataset ? !!dataset.metadata.demo : fictional;
  const deleted = !demo && isDeletedInstagramAccount(account.username);
  const name = deleted ? "Deleted account" : `@${account.username}`;
  const href = demo ? null : usableInstagramProfileHref(account);
  const timelineHref = `/relationship-timeline/#account=${encodeURIComponent(account.username)}`;
  function openTimeline() {
    if (window.location.pathname === "/relationship-timeline/") {
      window.location.hash = `account=${encodeURIComponent(account.username)}`;
      onClose();
      window.dispatchEvent(
        new CustomEvent(RELATIONSHIP_INSPECTION_EVENT, {
          detail: account.username,
        }),
      );
    } else {
      router.push(timelineHref);
      onClose();
    }
  }
  function requestClose() {
    if (dirty) setPending("close");
    else onClose();
  }
  function keepEditing() {
    setPending(null);
    dialog.current?.querySelector("textarea")?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (pending) continueEditing.current?.focus({ preventScroll: true });
  }, [pending]);
  useEffect(() => {
    const element = dialog.current!;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    element.showModal();
    root.style.overflow = "hidden";
    return () => {
      element.close();
      root.style.overflow = overflow;
      const target =
        returnFocus.isConnected && !returnFocus.matches(":disabled")
          ? returnFocus
          : document.getElementById("main");
      target?.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={dialog}
      className="relationship-drawer"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (pending) keepEditing();
        else requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "a[href], button, input, select, textarea, summary, [tabindex]",
          ),
        ].filter((element) => {
          const closed = element.closest("details:not([open])");
          return (
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden" &&
            (!closed ||
              closed.querySelector(":scope > summary")?.contains(element))
          );
        });
        // WebKit can skip links in its native Tab order. Advance explicitly so
        // keyboard focus cannot leave the modal before reaching its last link.
        event.preventDefault();
        if (!controls.length) {
          event.currentTarget.focus();
        } else {
          const current = controls.indexOf(
            document.activeElement as HTMLElement,
          );
          const next =
            current < 0
              ? event.shiftKey
                ? controls.length - 1
                : 0
              : (current + (event.shiftKey ? -1 : 1) + controls.length) %
                controls.length;
          controls[next].focus();
        }
      }}
    >
      <header className="relationship-drawer-header">
        <div>
          <p className="eyebrow">Relationship details</p>
          <h2 id={`${id}-title`}>{name}</h2>
        </div>
        <ActionButton
          variant="tertiary"
          className="drawer-close"
          type="button"
          autoFocus
          onClick={requestClose}
          aria-label="Close relationship details"
        >
          Close
        </ActionButton>
      </header>
      <p id={`${id}-description`} className="relationship-drawer-description">
        {demo
          ? "Demo data · Fictional example."
          : dataset
            ? "Private details from your export, processed in this browser."
            : "Saved snapshot observations, processed in this browser. This view does not use the active export."}
      </p>
      <div className="relationship-drawer-content">
        {dataset ? (
          <>
            <TimelineAccount
              dataset={dataset}
              username={account.username}
              presentation="drawer"
            />
            <ReviewMemoryEditor
              username={account.username}
              onDirtyChange={setDirty}
            />
          </>
        ) : (
          <SavedOnlyInspector
            username={account.username}
            history={savedHistory}
          />
        )}
      </div>
      {pending && (
        <div className="review-memory-discard" role="alert">
          <strong>Discard the unsaved note?</strong>
          <p>
            Your saved review memory stays unchanged. Save the note before
            leaving if you want to keep these edits.
          </p>
          <div className="review-memory-actions">
            <button
              ref={continueEditing}
              className="button secondary"
              type="button"
              onClick={keepEditing}
            >
              Continue editing
            </button>
            <ActionButton
              type="button"
              variant="danger"
              onClick={() =>
                pending === "timeline" ? openTimeline() : onClose()
              }
            >
              {pending === "timeline"
                ? "Discard note and continue"
                : "Discard note and close"}
            </ActionButton>
          </div>
        </div>
      )}
      <footer className="relationship-drawer-actions">
        {href && (
          <a
            className="insight-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Open Instagram profile <span aria-hidden="true">›</span>
          </a>
        )}
        {dataset ? (
          <InsightLink
            href={timelineHref}
            onNavigate={(event) => {
              if (dirty) {
                event.preventDefault();
                setPending("timeline");
              } else if (
                window.location.pathname === "/relationship-timeline/"
              ) {
                event.preventDefault();
                openTimeline();
              }
            }}
          >
            Open full Relationship Timeline
          </InsightLink>
        ) : (
          <InsightLink
            href={
              demo
                ? "/snapshot-vault/?demo=true#circle-pulse"
                : "/snapshot-vault/#circle-pulse"
            }
            onNavigate={() => onClose()}
          >
            Back to Circle Pulse
          </InsightLink>
        )}
      </footer>
    </dialog>
  );
}

function SavedOnlyInspector({
  username,
  history,
}: {
  username: string;
  history: RelationshipHistoryIndex;
}) {
  const points = useMemo(
    () => accountHistory(username, history),
    [username, history],
  );
  const latest = points.at(-1);
  return (
    <section
      className="drawer-inspector"
      aria-label="Saved snapshot relationship observations"
    >
      <h3>Saved snapshot observations</h3>
      {history.corrupt > 0 && (
        <p role="status">
          {history.corrupt} unreadable saved record
          {history.corrupt === 1 ? " was" : "s were"} skipped. They are not
          treated as absent observations.
        </p>
      )}
      {!latest ? (
        <p>No readable saved snapshots in this range.</p>
      ) : (
        <>
          <p>
            Selected saved range: {formatSnapshotDate(points[0].exportDate)} to{" "}
            {formatSnapshotDate(latest.exportDate)}.
          </p>
          <dl className="relationship-summary">
            <div>
              <dt>Latest selected saved state</dt>
              <dd>{relationshipStateLabels[latest.state]}</dd>
            </div>
          </dl>
          <SavedHistorySummary points={points} />
          <AccountHistoryDetails points={points} />
          <p>
            Saved snapshots do not contain recorded follower/following dates or
            optional export categories. Your active export and private Review
            Memory are separate.
          </p>
        </>
      )}
    </section>
  );
}
