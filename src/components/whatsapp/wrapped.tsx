"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { WhatsAppAnalysis, WhatsAppDataset } from "@/lib/whatsapp";
import {
  buildWhatsAppStories,
  type WhatsAppStory,
} from "@/lib/whatsapp/stories";
import { download } from "@/lib/download";
import { ActionButton } from "@/components/actions";
import { drawWhatsAppStory, whatsappStoryThemes } from "./wrapped-canvas";

export function WhatsAppWrapped({
  dataset,
  analysis,
}: {
  dataset: WhatsAppDataset;
  analysis: WhatsAppAnalysis;
}) {
  const stories = useMemo(
    () => buildWhatsAppStories(analysis, dataset),
    [analysis, dataset],
  );
  const [selected, setSelected] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [sharing, setSharing] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = Math.min(selected, Math.max(0, stories.length - 1));
  const story = stories[index];
  const demo = dataset.metadata.source === "demo";
  const [prepared, setPrepared] = useState<{
    story: WhatsAppStory;
    file?: File;
    error?: string;
  }>();
  const file = prepared?.story === story ? prepared.file : undefined;
  const exportError = prepared?.story === story ? prepared.error : undefined;

  // Encode before a tap so native sharing retains the device's user activation.
  useEffect(() => {
    let cancelled = false;
    if (!story) return;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        drawWhatsAppStory(canvas, story, demo);
        const encoded = canvas.toDataURL("image/png").split(",")[1];
        if (!encoded) throw new Error("Image encoding unavailable");
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
  }, [story, demo]);

  function select(next: number) {
    if (sharing) return;
    setSelected(Math.max(0, Math.min(stories.length - 1, next)));
    setFeedback("");
  }

  async function exportCard(native: boolean) {
    if (!file || sharing) return;
    if (
      !native ||
      !navigator.share ||
      !navigator.canShare?.({ files: [file] })
    ) {
      download(file, file.name);
      setFeedback(
        native
          ? "Your PNG was downloaded. Add it to a Story or Status from your photos."
          : "Your 1080 × 1920 PNG is downloaded.",
      );
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ files: [file], title: "My chat, in numbers" });
      setFeedback("Your card was handed to your device's share menu.");
    } catch (cause) {
      setFeedback(
        cause instanceof Error && cause.name === "AbortError"
          ? "Sharing cancelled. Your card is still ready."
          : "Sharing did not finish. Download the PNG and share it from your photos.",
      );
    } finally {
      setSharing(false);
    }
  }

  if (!story) {
    return <p role="status">No message cards are available for this export.</p>;
  }
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
          className="wa-story"
          tabIndex={0}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${stories.length}: ${story.name}`}
          aria-describedby="wa-deck-hint"
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
            const origin = touch.current;
            const point = event.changedTouches[0];
            touch.current = null;
            if (!origin || !point) return;
            const x = point.clientX - origin.x;
            const y = point.clientY - origin.y;
            if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y) * 1.5)
              select(index + (x < 0 ? 1 : -1));
          }}
        >
          <div
            className={`wa-story-art wa-story-art-${story.motif}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
            <i />
          </div>
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
            <strong
              className={story.id === "first-date" ? "wa-story-date" : ""}
            >
              {story.value}
            </strong>
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
          <p className="wa-story-note">{story.note}</p>
          <div className="wa-story-footer">
            <strong>Made with WhatsAppScope</strong>
            <span>A local tool by InstaScope</span>
          </div>
        </div>
        <div className="wa-deck-navigation">
          <ActionButton
            disabled={index === 0 || sharing}
            onClick={() => select(index - 1)}
            aria-label="Previous card"
          >
            ← Previous
          </ActionButton>
          <span aria-live="polite">
            {index + 1} / {stories.length}
          </span>
          <ActionButton
            disabled={index === stories.length - 1 || sharing}
            onClick={() => select(index + 1)}
            aria-label="Next card"
          >
            Next →
          </ActionButton>
        </div>
        <p className="wa-hint" id="wa-deck-hint">
          Swipe or use the arrow keys to move between cards.
        </p>
      </div>
      <div className="wa-deck-tools">
        <span className="wa-eyebrow">A LITTLE PERSPECTIVE, READY TO SHARE</span>
        <h2>
          Your chat. <em>Your story.</em>
        </h2>
        <p>
          A deck of facts from your export, made for a phone screen. Choose a
          card and save it as a full-size PNG.
        </p>
        <div className="wa-share-safety">
          <span aria-hidden="true">◉</span>
          <div>
            <strong>Personal names stay out.</strong>
            <p>
              Cards use aggregate counts and recorded dates. Participant names
              are anonymized. Message text and link URLs never appear.
            </p>
          </div>
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
              disabled={sharing}
              onClick={() => select(position)}
            >
              {String(position + 1).padStart(2, "0")} <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className="wa-export-actions">
          <ActionButton
            variant="primary"
            disabled={!file || sharing}
            onClick={() => void exportCard(false)}
          >
            Download PNG <span aria-hidden="true">↓</span>
          </ActionButton>
          <ActionButton
            disabled={!file || sharing}
            onClick={() => void exportCard(true)}
          >
            {sharing ? "Opening share menu…" : "Share card"}
          </ActionButton>
        </div>
        <p className="wa-hint">1080 × 1920 pixels · PNG · Prepared locally</p>
        <p className="wa-export-status" role="status">
          {exportError ||
            feedback ||
            (!file
              ? "Preparing this card's image…"
              : "Ready to save or share this card.")}
        </p>
        <p className="wa-hint">
          Share card opens your device&apos;s share menu where available.
          Otherwise, it downloads the PNG for you to share from your photos.
        </p>
      </div>
    </section>
  );
}
