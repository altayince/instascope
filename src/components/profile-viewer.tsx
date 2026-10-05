"use client";
/* eslint-disable @next/next/no-img-element -- Public images are isolated from the static Next image optimizer. */
import { useRef, useState } from "react";
import { normalizeUsername } from "@/lib/instagram/normalize";
import { track } from "@/lib/analytics";
import {
  profileMessages,
  profileErrorMessage,
  verifiedPublicImageUrl,
} from "@/lib/profile-lookup";
const endpoint = process.env.NEXT_PUBLIC_PROFILE_ENDPOINT;
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
    if (busy) return;
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
    if (!endpoint || !/^\/(?!\/)[a-z0-9/_-]+$/i.test(endpoint)) {
      setError(profileMessages.service_not_configured);
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
          redirect: "error",
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.headers.get("content-type")?.includes("application/json")) {
        setError(
          response.status === 404 || response.ok
            ? profileMessages.service_not_configured
            : profileErrorMessage(undefined, response.status),
        );
        track("profile_failed");
        return;
      }
      const data: unknown = await response.json();
      if (!response.ok) {
        const code =
          data && typeof data === "object" && "code" in data
            ? data.code
            : undefined;
        setError(profileErrorMessage(code, response.status));
        track("profile_failed");
        return;
      }
      const url =
        data &&
        typeof data === "object" &&
        "imageUrl" in data &&
        "username" in data &&
        data.username === normalized
          ? verifiedPublicImageUrl(data.imageUrl)
          : null;
      if (!url) {
        setError("The public photo response could not be verified.");
        track("profile_failed");
        return;
      }
      setImage(url);
      setZoom(1);
    } catch (error) {
      setError(
        error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError")
          ? profileMessages.lookup_timeout
          : profileMessages.service_unavailable,
      );
      track("profile_failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="tool" className="profile-viewer">
      <form
        onSubmit={(event) => void lookup(event)}
        data-profile-endpoint={endpoint || ""}
      >
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
            disabled={busy}
          />
          <button className="button primary" disabled={busy}>
            {busy ? "Looking…" : "View public photo "}
          </button>
        </div>
        <p>
          Only the username you enter is sent for lookup. Archive data is never
          involved.
        </p>
        <p>
          Photos appear only when Instagram provides a public profile page.
          Login restrictions, unavailable accounts and rate limits can prevent
          retrieval.
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
              onLoad={() => track("profile_succeeded")}
              onError={() => {
                setImage("");
                setError(
                  "The public photo is no longer available. Try opening the profile.",
                );
                track("profile_failed");
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
