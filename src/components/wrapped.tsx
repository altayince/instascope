"use client";
import { useState } from "react";
import type { Analysis, compareSnapshots } from "@/lib/analysis/relationships";
import { download } from "@/lib/download";
import { track } from "@/lib/analytics";
import type { Dataset } from "@/lib/instagram/types";
import { timelineCardStats } from "@/lib/analysis/insights";
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
  const [message, setMessage] = useState("");
  const [card, setCard] = useState<"circle" | "timeline">("circle");
  const isTimeline = card === "timeline";
  const stats = isTimeline
    ? timelineCardStats(dataset)
    : ([
        ["Followers", analysis.followers.length],
        ["Following", analysis.following.length],
        ["Mutuals", analysis.mutuals.length],
        ["Not following back", analysis.notFollowingBack.length],
        ["Fans · you don’t follow back", analysis.fans.length],
        [
          "Follower / following ratio",
          analysis.ratio === null ? "—" : analysis.ratio.toFixed(2),
        ],
      ] as const);
  const title = isTimeline
    ? ["My follows.", "Through time."]
    : ["My circle.", "In perspective."];
  const caption = isTimeline
    ? "Dates of follows present in this export; not net growth."
    : "From my uploaded Instagram export";
  async function imageBlob(): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image export is unavailable in this browser.");
    ctx.fillStyle = "#202c28";
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#d8f5a4";
    ctx.beginPath();
    ctx.arc(1000, 100, 310, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#faf8f0";
    ctx.font = "32px Arial";
    ctx.fillText("MY INSTAGRAM SNAPSHOT", 88, 150);
    ctx.font = "bold 112px Arial";
    ctx.fillText(title[0], 80, 310);
    ctx.fillText(title[1], 80, 440);
    stats.forEach(([label, value], i) => {
      const x = 85 + (i % 2) * 505,
        y = 690 + Math.floor(i / 2) * 300;
      ctx.fillStyle = "#d8f5a4";
      ctx.font = "bold 92px Arial";
      ctx.fillText(
        typeof value === "number" ? value.toLocaleString("en-US") : value,
        x,
        y,
        440,
      );
      ctx.fillStyle = "#faf8f0";
      ctx.font = "27px Arial";
      ctx.fillText(label, x, y + 55, 440);
    });
    if (comparison && !isTimeline) {
      ctx.font = "32px Arial";
      ctx.fillText(
        `Between snapshots: ${comparison.followerDelta >= 0 ? "+" : ""}${comparison.followerDelta} followers`,
        85,
        1550,
      );
    }
    ctx.font = "30px Arial";
    ctx.fillStyle = "#faf8f0";
    ctx.fillText(caption, 85, 1720, 910);
    ctx.font = "bold 38px Arial";
    ctx.fillText("◎ Made with InstaScope", 85, 1810);
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
      const blob = await imageBlob(),
        file = new File(
          [blob],
          isTimeline ? "instascope-timeline.png" : "instascope-wrapped.png",
          {
            type: "image/png",
          },
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
            : "Your card is downloaded. Ready to share.",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        setMessage(error.message);
    }
  }
  return (
    <section className="wrapped-section">
      <div className="wrapped-card">
        <span className="eyebrow">MY INSTAGRAM SNAPSHOT</span>
        <h2>
          {title[0]}
          <br />
          <em>{title[1]}</em>
        </h2>
        <div className="wrapped-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <strong>
                {typeof value === "number"
                  ? value.toLocaleString("en-US")
                  : value}
              </strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {comparison && !isTimeline && (
          <p>
            Between snapshots: {comparison.followerDelta >= 0 ? "+" : ""}
            {comparison.followerDelta} followers
          </p>
        )}
        {isTimeline && (
          <p>{caption} Ties for top year show the earliest year.</p>
        )}
        <small>◎ Made with InstaScope</small>
      </div>
      <div className="wrapped-actions">
        <div
          className="category-tabs"
          role="group"
          aria-label="Wrapped card style"
        >
          <button
            aria-pressed={!isTimeline}
            onClick={() => {
              setCard("circle");
              setMessage("");
            }}
          >
            My circle
          </button>
          <button
            aria-pressed={isTimeline}
            onClick={() => {
              setCard("timeline");
              setMessage("");
            }}
          >
            My following dates
          </button>
        </div>
        <span className="eyebrow">MADE TO SHARE</span>
        <h2>
          A story worth
          <br />a screenshot.
        </h2>
        <p>
          Your actual numbers. No individual usernames. A full-size 1080 × 1920
          PNG for your next story.
        </p>
        <button
          className="button primary"
          onClick={() => void exportCard(false)}
        >
          Download my Wrapped ↓
        </button>
        <button
          className="button secondary"
          onClick={() => void exportCard(true)}
        >
          Share my card ↗
        </button>
        <p role="status">{message}</p>
      </div>
    </section>
  );
}
