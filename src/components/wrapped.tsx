"use client";
import { useMemo, useState } from "react";
import type { Analysis, compareSnapshots } from "@/lib/analysis/relationships";
import { buildStories, type Story } from "@/lib/analysis/stories";
import { download } from "@/lib/download";
import { track } from "@/lib/analytics";
import type { Dataset } from "@/lib/instagram/types";
import { drawWrappedStory } from "./wrapped-canvas";

type Comparison = ReturnType<typeof compareSnapshots> | null;
const storyNames: Record<Story["id"], string> = {
  circle: "My circle",
  timeline: "My following dates",
  archaeology: "Instagram archaeology",
  changes: "Since my last snapshot",
};

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

  async function imageBlob(): Promise<Blob> {
    const canvas = document.createElement("canvas");
    drawWrappedStory(canvas, story, isDemo);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                new Error(
                  "Could not create the image. Try a different browser.",
                ),
              ),
        "image/png",
      ),
    );
  }

  async function exportCard(share: boolean) {
    try {
      const blob = await imageBlob();
      const basename = story.id === "circle" ? "wrapped" : story.id;
      const file = new File(
        [blob],
        `instascope-${isDemo ? "demo-" : ""}${basename}.png`,
        { type: "image/png" },
      );
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Instagram Wrapped" });
        track("wrapped_shared");
        setMessage("Shared.");
      } else {
        download(blob, file.name);
        track("wrapped_downloaded");
        setMessage(
          share
            ? "Sharing isn’t available here, so your PNG was downloaded."
            : "Your story card is downloaded. Ready to share.",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        setMessage(error.message);
    }
  }

  return (
    <section
      className="wrapped-section"
      aria-label="Instagram relationship stories"
    >
      <div className="wrapped-card" aria-label="Wrapped story preview">
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
        <div className="wrapped-facts">
          {story.facts.map((fact) => (
            <div key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>
        <p className="wrapped-note">{story.note}</p>
        <small>◎ Made with InstaScope</small>
      </div>
      <div className="wrapped-actions">
        <span className="eyebrow">A STORY PACK FROM YOUR EXPORT</span>
        <h2>One clear idea per card.</h2>
        <p>
          {isDemo ? "Fictional example cards." : "Your actual aggregate facts."}{" "}
          Browse what your data supports, then download a 1080 × 1920 PNG. No
          individual usernames appear on the cards.
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
              onClick={() => {
                setSelected(item.id);
                setMessage("");
              }}
            >
              {storyNames[item.id]}
            </button>
          ))}
        </div>
        <p className="wrapped-position">
          Story {stories.findIndex((item) => item.id === story.id) + 1} of{" "}
          {stories.length} · {storyNames[story.id]}
        </p>
        <button
          className="button primary"
          onClick={() => void exportCard(false)}
        >
          Download my Wrapped
        </button>
        <button
          className="button secondary"
          onClick={() => void exportCard(true)}
        >
          Share my card
        </button>
        <p role="status">{message}</p>
      </div>
    </section>
  );
}
