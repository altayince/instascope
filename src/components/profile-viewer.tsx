"use client";
/* eslint-disable @next/next/no-img-element -- Public images are isolated from the static Next image optimizer. */
import { useRef, useState } from "react";
import { normalizeUsername } from "@/lib/instagram/normalize";
import { track } from "@/lib/analytics";
export function ProfileViewer() {
  const [input, setInput] = useState(""),
    [image, setImage] = useState(""),
    [username, setUsername] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(1),
    [circle, setCircle] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setImage("");
    setError("");
    const normalized = normalizeUsername(input);
    if (!normalized) {
      setError(
        "Enter an Instagram username or a profile URL, not a post or story link.",
      );
      return;
    }
    setUsername(normalized);
    track("profile_search");
    const endpoint = process.env.NEXT_PUBLIC_PROFILE_ENDPOINT;
    if (!endpoint || !/^\/(?!\/)[a-z0-9/_-]+$/i.test(endpoint)) {
      setError(
        "Public photo lookup is not available on this deployment. You can open the public profile on Instagram instead.",
      );
      track("profile_failed");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        `${endpoint}?username=${encodeURIComponent(normalized)}`,
        {
          credentials: "omit",
          referrerPolicy: "no-referrer",
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Too many requests. Wait a minute before trying again."
            : "Instagram is not making a public profile photo available right now. Try again later or open the profile.",
        );
      const data = await response.json();
      const url = new URL(data.imageUrl);
      if (
        url.protocol !== "https:" ||
        !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)
      )
        throw new Error("The public photo response could not be verified.");
      setImage(url.href);
      setZoom(1);
      track("profile_succeeded");
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "The lookup timed out. Please try again later.",
      );
      track("profile_failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile-viewer">
      <form onSubmit={(event) => void lookup(event)}>
        <label htmlFor="profile-input">Instagram username or profile URL</label>
        <div className="profile-input-row">
          <input
            id="profile-input"
            autoComplete="off"
            placeholder="@username"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={200}
            required
          />
          <button className="button primary" disabled={busy}>
            {busy ? "Looking…" : "View public photo "}
          </button>
        </div>
        <p>
          Only the username you enter is sent for lookup. Archive data is never
          involved.
        </p>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {username && (
        <a
          className="text-link"
          href={`https://www.instagram.com/${username}/`}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Open @{username} on Instagram
        </a>
      )}
      {image && (
        <>
          <div
            ref={preview}
            className={`photo-preview ${circle ? "circle" : ""}`}
          >
            <img
              src={image}
              alt={`Public profile photo for ${username}`}
              referrerPolicy="no-referrer"
              style={{ transform: `scale(${zoom})` }}
              onError={() => {
                setImage("");
                setError(
                  "The public photo is no longer available. Try opening the profile.",
                );
              }}
            />
          </div>
          <div className="photo-controls">
            <label>
              Zoom{" "}
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={circle}
                onChange={(event) => setCircle(event.target.checked)}
              />{" "}
              Circular preview
            </label>
            <button
              onClick={() =>
                void preview.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setError("Fullscreen is not available in this browser."),
                  )
              }
            >
              Fullscreen
            </button>
          </div>
        </>
      )}
    </section>
  );
}
