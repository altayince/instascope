"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { WhatsAppAnalysis, WhatsAppDataset } from "@/lib/whatsapp";
import { buildWhatsAppStories, whatsappNumber } from "@/lib/whatsapp/stories";
import type {
  WhatsAppStory,
  WhatsAppStoryEntry,
} from "@/lib/whatsapp/story-types";
import { createWhatsAppDeckArchive } from "@/lib/whatsapp/deck-export";
import { download } from "@/lib/download";
import { ActionButton } from "@/components/actions";
import { drawWhatsAppStory, whatsappStoryThemes } from "./wrapped-canvas";

const percent = (share: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(share);

function EntryText({ entries }: { entries: readonly WhatsAppStoryEntry[] }) {
  return (
    <ul>
      {entries.map((entry, index) => (
        <li key={`${entry.label}-${index}`}>
          {entry.label}: {entry.display}
          {entry.share === undefined ? "" : ` (${percent(entry.share)})`}
        </li>
      ))}
    </ul>
  );
}

/** Accessible equivalents use only the same anonymous model as the artwork. */
function StoryGraphicText({ story }: { story: WhatsAppStory }) {
  switch (story.kind) {
    case "hero":
      return (
        <p>
          {story.data.firstDate} to {story.data.lastDate} ·{" "}
          {whatsappNumber(story.data.calendarSpanDays)} calendar days covered.
        </p>
      );
    case "split":
    case "ranking":
      return (
        <>
          <EntryText entries={story.data.entries} />
          {story.data.hiddenParticipants > 0 && (
            <p>
              Top {whatsappNumber(story.data.entries.length)} shown;{" "}
              {whatsappNumber(story.data.hiddenParticipants)} additional labels
              not displayed. {whatsappNumber(story.data.total)}{" "}
              {story.data.unit} in total.
            </p>
          )}
          {story.data.leaderTieCount > 1 && (
            <p>
              {whatsappNumber(story.data.leaderTieCount)} labels tie at the
              maximum.
            </p>
          )}
        </>
      );
    case "distribution":
      return <EntryText entries={story.data.entries} />;
    case "timeline":
      return (
        <>
          <p>
            Selected recorded dates: {story.data.from} to {story.data.to}.
          </p>
          {story.data.streakDays !== null && (
            <p>
              {whatsappNumber(story.data.streakDays)} consecutive active dates.
            </p>
          )}
          <ul>
            {story.data.dates.map((date) => (
              <li key={date.date}>
                {date.date}: {whatsappNumber(date.value)} messages
              </li>
            ))}
          </ul>
          {story.data.tiedDates > 1 && (
            <p>
              {whatsappNumber(story.data.tiedDates)} dates tie at the maximum.
            </p>
          )}
        </>
      );
    case "rhythm":
      return (
        <>
          <EntryText entries={story.data.buckets} />
          <EntryText entries={story.data.entries} />
          <p>
            {whatsappNumber(story.data.rapidCount)} rapid transitions;{" "}
            {percent(story.data.rapidShare)} of{" "}
            {whatsappNumber(story.data.transitionCount)} observed transitions.
          </p>
        </>
      );
    case "patterns":
      return (
        <>
          <EntryText entries={story.data.distribution} />
          <p>
            {whatsappNumber(story.data.ties)} maximizing recorded burst windows;{" "}
            {whatsappNumber(story.data.runs)} runs. Longest run:{" "}
            {story.data.longestRun === null
              ? "Unavailable"
              : whatsappNumber(story.data.longestRun)}
            .
          </p>
        </>
      );
    case "media":
      return (
        <>
          <ul>
            {story.data.categories.map((item) => (
              <li key={item.kind}>
                {item.label}: {whatsappNumber(item.count)}
              </li>
            ))}
          </ul>
          {story.data.hiddenCategories > 0 && (
            <p>
              {whatsappNumber(story.data.remainingMedia)} more media markers
              across {whatsappNumber(story.data.hiddenCategories)} other
              categories.
            </p>
          )}
          {story.data.emojiAvailable ? (
            <ul>
              {story.data.emoji.map((item) => (
                <li key={item.symbol}>
                  {item.symbol}: {whatsappNumber(item.count)} occurrences
                </li>
              ))}
            </ul>
          ) : (
            <p>Supported emoji counts: Unavailable.</p>
          )}
        </>
      );
    case "word":
      return (
        <ul>
          {story.data.words.map((item) => (
            <li key={item.word}>
              {item.word}: {whatsappNumber(item.count)} occurrences
            </li>
          ))}
        </ul>
      );
    case "closing":
      return (
        <p>
          {whatsappNumber(story.data.cardCount)} cards ·{" "}
          {whatsappNumber(story.data.messages)} messages ·{" "}
          {whatsappNumber(story.data.activeDates)} active dates ·{" "}
          {whatsappNumber(story.data.participants)} anonymous participant
          labels.
        </p>
      );
  }
}

/** Keep asynchronous Blob encoding for sequential full-deck ZIP generation. */
function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG encoding unavailable")),
        "image/png",
      );
    } catch {
      reject(new Error("PNG encoding unavailable"));
    }
  });
}

export function WhatsAppWrapped({
  dataset,
  analysis,
}: {
  dataset: WhatsAppDataset;
  analysis: WhatsAppAnalysis;
}) {
  const [includeWords, setIncludeWords] = useState(false);
  const stories = useMemo(
    () => buildWhatsAppStories(analysis, dataset, { includeWords }),
    [analysis, dataset, includeWords],
  );
  const [selectedId, setSelectedId] = useState("conversation");
  const [feedback, setFeedback] = useState("");
  const [sharing, setSharing] = useState(false);
  const [deckProgress, setDeckProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [paintedStory, setPaintedStory] = useState<WhatsAppStory>();
  const [prepared, setPrepared] = useState<{
    story: WhatsAppStory;
    file?: File;
    error?: string;
  }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const actionBusy = useRef(false);
  const activeArchive = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const foundIndex = stories.findIndex((item) => item.id === selectedId);
  const index = Math.max(0, foundIndex);
  const story = stories[index];
  const demo = dataset.metadata.source === "demo";
  const file = prepared?.story === story ? prepared.file : undefined;
  const exportError = prepared?.story === story ? prepared.error : undefined;
  const painted = paintedStory === story;
  const busy = sharing || deckProgress !== null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeArchive.current?.abort();
    };
  }, []);

  // Preview and download share one bitmap. Prepare a File before the tap so
  // navigator.share retains the device's transient user activation.
  // Like Instagram Wrapped, encode individual cards eagerly rather than wait
  // for the asynchronous canvas Blob callback to make the controls ready.
  useEffect(() => {
    let cancelled = false;
    if (!story) return;
    queueMicrotask(() => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        if (story.kind === "word" && !includeWords)
          throw new Error("Words not enabled");
        drawWhatsAppStory(canvas, story, demo);
        setPaintedStory(story);
        const encoded = canvas.toDataURL("image/png").split(",")[1];
        if (!encoded) throw new Error("PNG encoding unavailable");
        const bytes = Uint8Array.from(atob(encoded), (character) =>
          character.charCodeAt(0),
        );
        setPrepared({
          story,
          file: new File(
            [bytes],
            `whatsappscope-${demo ? "demo-" : ""}${story.id}.png`,
            { type: "image/png" },
          ),
        });
      } catch {
        setPrepared({
          story,
          error:
            "PNG export is unavailable in this browser. Your cards remain readable here.",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [story, demo, includeWords]);

  function select(next: number) {
    if (actionBusy.current) return;
    const nextStory = stories[Math.max(0, Math.min(stories.length - 1, next))];
    if (nextStory) setSelectedId(nextStory.id);
    setFeedback("");
  }

  async function exportCard(native: boolean) {
    if (
      !file ||
      actionBusy.current ||
      (story?.kind === "word" && !includeWords)
    )
      return;
    let canShare = false;
    try {
      canShare =
        native &&
        typeof navigator.share === "function" &&
        Boolean(navigator.canShare?.({ files: [file] }));
    } catch {
      /* Download remains available. */
    }
    if (!canShare) {
      try {
        download(file, file.name);
        setFeedback(
          native
            ? "Your PNG was downloaded. Add it to a Story or Status from your photos."
            : "Your 1080 × 1920 PNG is downloaded.",
        );
      } catch {
        setFeedback(
          "PNG download could not start. Your card is still ready; try again or use Share card where supported.",
        );
      }
      return;
    }
    actionBusy.current = true;
    setSharing(true);
    try {
      await navigator.share({ files: [file], title: "My WhatsApp Wrapped" });
      if (mounted.current)
        setFeedback("Your card was handed to your device's share menu.");
    } catch (cause) {
      if (mounted.current)
        setFeedback(
          cause instanceof Error && cause.name === "AbortError"
            ? "Sharing cancelled. Your card is still ready."
            : "Sharing did not finish. Download the PNG and share it from your photos.",
        );
    } finally {
      actionBusy.current = false;
      if (mounted.current) setSharing(false);
    }
  }

  async function exportDeck() {
    if (!stories.length || actionBusy.current) return;
    actionBusy.current = true;
    const controller = new AbortController();
    activeArchive.current = controller;
    setFeedback("");
    setDeckProgress({ completed: 0, total: stories.length });
    const canvas = document.createElement("canvas");
    try {
      const archive = await createWhatsAppDeckArchive(
        stories,
        async (item) => {
          drawWhatsAppStory(canvas, item, demo);
          return encodePng(canvas);
        },
        {
          demo,
          includeWords,
          signal: controller.signal,
          onProgress: (completed, total) => {
            if (mounted.current && !controller.signal.aborted)
              setDeckProgress({ completed, total });
          },
        },
      );
      if (!mounted.current || controller.signal.aborted) return;
      download(archive.blob, archive.filename);
      setFeedback(
        `Your full deck is downloaded: ${stories.length} portrait PNGs in one ZIP.`,
      );
    } catch {
      if (mounted.current && !controller.signal.aborted)
        setFeedback(
          "Full-deck export could not finish. Try downloading individual PNG cards.",
        );
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      if (activeArchive.current === controller) activeArchive.current = null;
      actionBusy.current = false;
      if (mounted.current) setDeckProgress(null);
    }
  }

  if (!story)
    return <p role="status">No message cards are available for this export.</p>;
  const theme = whatsappStoryThemes[story.theme];
  return (
    <section className="wa-wrapped" aria-label="WhatsApp Wrapped">
      <div className="wa-deck-stage">
        <div className="wa-deck-progress" aria-hidden="true">
          {stories.map((item, position) => (
            <span
              key={item.id}
              className={position <= index ? "is-seen" : ""}
            />
          ))}
        </div>
        <div
          className="wa-story wa-story-v2"
          tabIndex={0}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${stories.length}: ${story.name}`}
          aria-describedby="wa-deck-hint"
          data-story-id={story.id}
          data-story-kind={story.kind}
          data-story-mode={story.mode}
          style={
            {
              "--story-bg": theme.background,
              "--story-ink": theme.ink,
              "--story-accent": theme.accent,
            } as CSSProperties
          }
          onKeyDown={(event) => {
            if (
              ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              select(
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? stories.length - 1
                    : index + (event.key === "ArrowRight" ? 1 : -1),
              );
            }
          }}
          onTouchStart={(event) => {
            const point = event.touches[0];
            if (point) touch.current = { x: point.clientX, y: point.clientY };
          }}
          onTouchCancel={() => {
            touch.current = null;
          }}
          onTouchEnd={(event) => {
            const origin = touch.current,
              point = event.changedTouches[0];
            touch.current = null;
            if (!origin || !point) return;
            const x = point.clientX - origin.x,
              y = point.clientY - origin.y;
            if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y) * 1.5)
              select(index + (x < 0 ? 1 : -1));
          }}
        >
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            hidden={!painted}
            aria-hidden="true"
            data-testid="wa-story-canvas"
          />
          <div
            className={`wa-story-text ${painted ? "is-readable-only" : "is-fallback"}`}
          >
            <div className="wa-story-brand">
              <strong>WhatsAppScope / Wrapped</strong>
              <span>
                {demo ? "Fictional demo data" : "From your supplied export"}
              </span>
            </div>
            <div className="wa-story-heading">
              <span className="wa-eyebrow">{story.label}</span>
              <h2>{story.title}</h2>
              <p>{story.lead}</p>
            </div>
            <div className="wa-story-value">
              <strong>{story.value}</strong>
              <span>{story.valueLabel}</span>
            </div>
            <div className="wa-story-facts">
              {story.facts.map((fact) => (
                <div key={fact.label}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </div>
              ))}
            </div>
            <StoryGraphicText story={story} />
            <p className="wa-story-note">{story.note}</p>
            <p>Made with WhatsAppScope · A local tool by InstaScope</p>
          </div>
        </div>
        <div className="wa-deck-navigation">
          <ActionButton
            disabled={index === 0 || busy}
            onClick={() => select(index - 1)}
            aria-label="Previous card"
          >
            ← Previous
          </ActionButton>
          <span
            className="wa-deck-position"
            aria-live="polite"
            aria-atomic="true"
          >
            {index + 1} / {stories.length} · {story.name}
          </span>
          <ActionButton
            disabled={index === stories.length - 1 || busy}
            onClick={() => select(index + 1)}
            aria-label="Next card"
          >
            Next →
          </ActionButton>
        </div>
        <p className="wa-hint" id="wa-deck-hint">
          Swipe or use the arrow keys to move between cards. Home and End jump
          to the first and last card.
        </p>
      </div>
      <div className="wa-deck-tools">
        <span className="wa-eyebrow">YOUR CHAT, READY FOR A STORY</span>
        <h2>
          Your chat. <em>Your story.</em>
        </h2>
        <p>
          A deck of recorded facts, made on this device. Save one card or keep
          the whole set as portrait PNGs.
        </p>
        <div className="wa-share-safety">
          <span aria-hidden="true">◉</span>
          <div>
            <strong>Personal labels stay anonymous.</strong>
            <p>
              Cards use Participant 1, Participant 2 and so on. Raw messages,
              URLs, filenames and phone numbers stay out of the artwork.
            </p>
          </div>
        </div>
        <div className="wa-word-choice">
          <label>
            <input
              type="checkbox"
              checked={includeWords}
              disabled={busy}
              aria-describedby="wa-word-choice-note"
              onChange={(event) => {
                if (actionBusy.current) return;
                const enabled = event.currentTarget.checked;
                setIncludeWords(enabled);
                setSelectedId(enabled ? "words" : "conversation");
                setFeedback("");
              }}
            />
            <span>Include word-based insights in Wrapped</span>
          </label>
          <p className="wa-hint" id="wa-word-choice-note">
            Off by default. These aggregates are generated locally from message
            text. An exported PNG may reveal derived words. This choice is kept
            only in this view and resets with a new export.
          </p>
          {includeWords && !stories.some((item) => item.kind === "word") && (
            <p className="wa-hint">
              No words meet the evidence and privacy rules for a word-based
              card.
            </p>
          )}
        </div>
        <div
          className="wa-story-picker"
          role="group"
          aria-label="Choose a Wrapped card"
        >
          {stories.map((item, position) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={position === index}
              disabled={busy}
              onClick={() => select(position)}
            >
              {String(position + 1).padStart(2, "0")} <span>{item.name}</span>
            </button>
          ))}
        </div>
        <details className="wa-story-calculation" key={story.id}>
          <summary>How this is calculated</summary>
          <p>
            <strong>{story.calculation.classification}</strong>
          </p>
          <p>{story.calculation.definition}</p>
          {story.calculation.threshold && (
            <p>Evidence rule: {story.calculation.threshold}</p>
          )}
          <p>{story.calculation.limitations}</p>
        </details>
        <div className="wa-export-actions">
          <ActionButton
            variant="primary"
            disabled={!file || busy}
            onClick={() => void exportCard(false)}
          >
            Download PNG <span aria-hidden="true">↓</span>
          </ActionButton>
          <ActionButton
            disabled={!file || busy}
            onClick={() => void exportCard(true)}
          >
            {sharing ? "Opening share menu…" : "Share card"}
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => void exportDeck()}>
            Export full deck
          </ActionButton>
        </div>
        <p className="wa-hint">1080 × 1920 pixels · PNG · Prepared locally</p>
        <p
          className="wa-export-status"
          role="status"
          data-testid="wa-export-status"
          data-deck-progress={deckProgress?.completed}
          data-deck-total={deckProgress?.total}
        >
          {deckProgress
            ? `Preparing deck: ${deckProgress.completed} / ${deckProgress.total} cards…`
            : exportError ||
              feedback ||
              (!file
                ? "Preparing this card's image…"
                : "Ready to save or share this card.")}
        </p>
        <p className="wa-hint">
          Share card opens your device&apos;s share menu where supported, or
          downloads the PNG. Export full deck creates a local ZIP; nothing is
          uploaded.
        </p>
      </div>
    </section>
  );
}
