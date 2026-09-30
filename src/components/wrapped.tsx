"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Analysis, compareSnapshots } from "@/lib/analysis/relationships";
import { buildStories, type Story } from "@/lib/analysis/stories";
import { download } from "@/lib/download";
import { track } from "@/lib/analytics";
import type { Dataset } from "@/lib/instagram/types";
import { drawWrappedStory } from "./wrapped-canvas";
import { storyStyles } from "./wrapped-style";

type Comparison = ReturnType<typeof compareSnapshots> | null;

export function Wrapped({
  analysis,
  comparison,
  dataset,
}: {
  analysis: Analysis;
  comparison: Comparison;
  dataset: Dataset;
}) {
  const stories = useMemo(
    () => buildStories(analysis, dataset, comparison),
    [analysis, dataset, comparison],
  );
  const [selected, setSelected] = useState<Story["id"]>("circle");
  const [message, setMessage] = useState("");
  const story = stories.find((item) => item.id === selected) ?? stories[0];
  const isDemo = !!dataset.metadata.demo;

  const index = stories.indexOf(story);
  const style = storyStyles[story.id];
  const barMaximum = Math.max(
    0,
    ...(story.bars?.map((bar) => bar.value) ?? []),
  );
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [prepared, setPrepared] = useState<{
    story: Story;
    demo: boolean;
    file?: File;
    error?: string;
  }>();
  const [sharing, setSharing] = useState(false);
  const file =
    prepared?.story === story && prepared.demo === isDemo
      ? prepared.file
      : undefined;
  const imageError = prepared?.story === story ? prepared.error : undefined;

  // Prepare only the current image before the click so sharing keeps user
  // activation. Encode eagerly instead of waiting for canvas idle callbacks.
  // No archive data leaves this browser.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        drawWrappedStory(canvas, story, isDemo);
        const encoded = canvas.toDataURL("image/png").split(",")[1];
        if (!encoded) throw new Error("Image encoding unavailable");
        const bytes = Uint8Array.from(atob(encoded), (character) =>
          character.charCodeAt(0),
        );
        const basename = story.id === "circle" ? "wrapped" : story.id;
        setPrepared({
          story,
          demo: isDemo,
          file: new File(
            [bytes],
            `instascope-${isDemo ? "demo-" : ""}${basename}.png`,
            { type: "image/png" },
          ),
        });
      } catch {
        // Keep the text preview usable on browsers without canvas support.
        setPrepared({
          story,
          demo: isDemo,
          error: "Image export is unavailable in this browser.",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [story, isDemo]);

  function select(next: number) {
    if (sharing) return;
    setSelected(stories[Math.max(0, Math.min(stories.length - 1, next))].id);
    setMessage("");
  }

  async function exportCard(share: boolean) {
    if (!file || sharing) return;
    if (
      !share ||
      !navigator.share ||
      !navigator.canShare?.({ files: [file] })
    ) {
      download(file, file.name);
      track("wrapped_downloaded");
      setMessage(
        share
          ? "Your PNG was downloaded. Add it to Instagram Stories or WhatsApp Status from your photos."
          : "Your story card is downloaded. Ready to share.",
      );
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ files: [file], title: "My Instagram Wrapped" });
      track("wrapped_shared");
      setMessage("Card handed to your device's share menu.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Sharing cancelled. Your card is still here."
          : "Sharing did not finish. Use Download my Wrapped to save this card instead.",
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <section
      className="wrapped-section"
      aria-label="Instagram relationship stories"
    >
      <div className="wrapped-stage">
        <div className="wrapped-progress" aria-hidden="true">
          {stories.map((item, i) => (
            <span key={item.id} className={i <= index ? "is-seen" : ""} />
          ))}
        </div>
        <div
          className="wrapped-card"
          aria-label="Wrapped story preview"
          tabIndex={0}
          aria-describedby="wrapped-navigation-hint"
          style={
            {
              "--story-bg": style.background,
              "--story-ink": style.ink,
              "--story-accent": style.accent,
            } as CSSProperties
          }
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              select(index + (event.key === "ArrowRight" ? 1 : -1));
            }
          }}
          onTouchStart={(event) => {
            const point = event.touches[0];
            touch.current = { x: point.clientX, y: point.clientY };
          }}
          onTouchCancel={() => {
            touch.current = null;
          }}
          onTouchEnd={(event) => {
            if (!touch.current) return;
            const point = event.changedTouches[0];
            const dx = point.clientX - touch.current.x;
            const dy = point.clientY - touch.current.y;
            touch.current = null;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
              select(index + (dx < 0 ? 1 : -1));
          }}
        >
          <div
            className={`wrapped-art wrapped-art-${style.motif}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="eyebrow">
            {isDemo && (
              <span>
                DEMO DATA · FICTIONAL EXAMPLE
                <br />
              </span>
            )}
            {story.label}
          </span>
          <h2>{story.title}</h2>
          <p className="wrapped-lead">{story.lead}</p>
          <div className="wrapped-hero">
            <strong>{story.heroValue}</strong>
            <span>{story.heroLabel}</span>
          </div>
          {story.bars && (
            <div className="wrapped-bars" aria-label="Relative counts">
              {story.bars.map((bar) => (
                <div key={bar.label}>
                  <span>{bar.label}</span>
                  <i
                    aria-hidden="true"
                    style={{
                      width: `${barMaximum ? (bar.value / barMaximum) * 100 : 0}%`,
                    }}
                  />
                  <span className="wrapped-sr-only">{bar.value}</span>
                </div>
              ))}
            </div>
          )}
          <div className="wrapped-facts">
            {story.facts.map((fact) => (
              <div key={fact.label}>
                <strong>{fact.value}</strong>
                <span>{fact.label}</span>
              </div>
            ))}
          </div>
          <p className="wrapped-note">{story.note}</p>
          <small>
            ◎ Made with InstaScope <span>instascope.me</span>
          </small>
        </div>
        <div className="wrapped-controls">
          <button
            onClick={() => select(index - 1)}
            disabled={index === 0 || sharing}
            aria-label="Previous story"
          >
            ←
          </button>
          <p className="wrapped-position" aria-live="polite">
            {index + 1} / {stories.length} · {story.name}
          </p>
          <button
            onClick={() => select(index + 1)}
            disabled={index === stories.length - 1 || sharing}
            aria-label="Next story"
          >
            →
          </button>
        </div>
        <p id="wrapped-navigation-hint" className="wrapped-hint">
          Swipe a card, use the arrows, or choose a story.
        </p>
      </div>
      <div className="wrapped-actions">
        <span className="eyebrow">YOUR CIRCLE HAS STORIES</span>
        <h2>This one belongs on your Story.</h2>
        <p>
          {isDemo ? "Fictional example cards." : "Your actual aggregate facts."}{" "}
          Find your era. Meet your social orbit. See what the total hides. Every
          card is a 1080 × 1920 story, made privately in your browser. No
          usernames or private-list counts on shared cards.
        </p>
        <div
          className="wrapped-story-picker"
          role="group"
          aria-label="Wrapped stories"
        >
          {stories.map((item) => (
            <button
              key={item.id}
              aria-pressed={story.id === item.id}
              disabled={sharing}
              onClick={() => select(stories.indexOf(item))}
            >
              {item.name}
            </button>
          ))}
        </div>
        <button
          className="button primary"
          disabled={!file || sharing}
          onClick={() => void exportCard(false)}
        >
          Download my Wrapped
        </button>
        <button
          className="button secondary"
          disabled={!file || sharing}
          onClick={() => void exportCard(true)}
        >
          Share my card
        </button>
        <p className="wrapped-share-help">
          Share my card opens your device’s share menu. Choose Instagram or
          WhatsApp if offered, then Story or Status in the app. Otherwise, save
          the PNG and add it from your photos.
        </p>
        {!comparison && (
          <p>
            Compare two exports in Compare snapshots to unlock the new-chapter
            and plot-twist cards.
          </p>
        )}
        <p role="status">
          {imageError ||
            message ||
            (!file
              ? "Preparing your story image…"
              : "Your card is ready. Choose where it goes.")}
        </p>
      </div>
    </section>
  );
}
