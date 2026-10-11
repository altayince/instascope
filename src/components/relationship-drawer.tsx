"use client";
import { useEffect, useId, useRef, useState } from "react";
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
import "./relationship-drawer.css";

export function RelationshipDrawer({
  account,
  dataset,
  returnFocus,
  onClose,
}: {
  account: Account;
  dataset: Dataset;
  returnFocus: HTMLElement;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const continueEditing = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<"close" | "timeline" | null>(null);
  const id = useId();
  const demo = !!dataset.metadata.demo;
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
          : "Private details from your export, processed in this browser."}
      </p>
      <div className="relationship-drawer-content">
        <TimelineAccount
          dataset={dataset}
          username={account.username}
          presentation="drawer"
        />
        <ReviewMemoryEditor
          username={account.username}
          onDirtyChange={setDirty}
        />
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
        <InsightLink
          href={timelineHref}
          onNavigate={(event) => {
            if (dirty) {
              event.preventDefault();
              setPending("timeline");
            } else if (window.location.pathname === "/relationship-timeline/") {
              event.preventDefault();
              openTimeline();
            }
          }}
        >
          Open full Relationship Timeline
        </InsightLink>
      </footer>
    </dialog>
  );
}
