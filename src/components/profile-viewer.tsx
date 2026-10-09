"use client";
/* eslint-disable @next/next/no-img-element -- Public images are isolated from the static Next image optimizer. */
import { useEffect, useRef, useState } from "react";
import { normalizeUsername } from "@/lib/instagram/normalize";
import { track } from "@/lib/analytics";
import {
  profileMessages,
  profileErrorMessage,
  verifiedPublicImageUrl,
  profileRetryDelay,
} from "@/lib/profile-lookup";
import { enhancePublicPhoto } from "@/lib/profile-enhancement";
import { PROFILE_SAMPLE_URL } from "@/lib/profile-sample";
const endpoint = process.env.NEXT_PUBLIC_PROFILE_ENDPOINT;
export function ProfileViewer() {
  const [input, setInput] = useState(""),
    [image, setImage] = useState(""),
    [username, setUsername] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loadingPhoto, setLoadingPhoto] = useState(false),
    [retryUntil, setRetryUntil] = useState(0),
    [remaining, setRemaining] = useState(0),
    [retryHint, setRetryHint] = useState(""),
    [dimensions, setDimensions] = useState({ width: 0, height: 0 }),
    [enhanced, setEnhanced] = useState<{
      url: string;
      width: number;
      height: number;
    } | null>(null),
    [enhancedActive, setEnhancedActive] = useState(false),
    [enhancing, setEnhancing] = useState(false),
    [enhancementError, setEnhancementError] = useState(""),
    [enhancementProgress, setEnhancementProgress] = useState(""),
    [zoom, setZoom] = useState(1),
    [circle, setCircle] = useState(false);
  const [sample, setSample] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const enhancementRequest = useRef<AbortController | null>(null);
  const succeededImage = useRef("");
  const loading = busy || loadingPhoto;
  useEffect(() => {
    if (!retryUntil) return;
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [retryUntil]);
  useEffect(
    () => () => {
      if (enhanced) URL.revokeObjectURL(enhanced.url);
    },
    [enhanced],
  );
  useEffect(() => () => enhancementRequest.current?.abort(), []);
  useEffect(() => {
    if (!loadingPhoto) return;
    const timer = setTimeout(() => {
      setLoadingPhoto(false);
      setImage("");
      setError(
        sample
          ? "The local sample could not load. Please try again."
          : "The public photo took too long to load. Try opening the profile.",
      );
      if (!sample) track("profile_failed");
    }, 12000);
    return () => clearTimeout(timer);
  }, [loadingPhoto, sample]);
  function resetPreview() {
    enhancementRequest.current?.abort();
    setEnhancing(false);
    setEnhanced(null);
    setEnhancedActive(false);
    setEnhancementError("");
    setDimensions({ width: 0, height: 0 });
    setImage("");
    setLoadingPhoto(false);
    setUsername("");
    setError("");
    setZoom(1);
    setCircle(false);
    succeededImage.current = "";
  }
  function toggleSample() {
    if (loading || enhancing) return;
    resetPreview();
    setSample(!sample);
    if (!sample) {
      setImage(PROFILE_SAMPLE_URL);
      setLoadingPhoto(true);
    }
  }
  function lookupError(response: Response, code: unknown) {
    setError(profileErrorMessage(code, response.status));
    if (response.status === 429) {
      const seconds = profileRetryDelay(
        code,
        response.headers.get("retry-after"),
      );
      setRetryUntil(Date.now() + seconds * 1000);
      setRemaining(seconds);
      setRetryHint(
        code === "service_rate_limited"
          ? "Shared browser limit: one lookup every 10 seconds. Other visitors share this allowance."
          : code === "service_budget_limited"
            ? "Shared browser budget: up to 10 lookups per minute per service location."
            : code === "service_daily_limited"
              ? "The daily allowance is shared across the service."
              : code === "instagram_rate_limited"
                ? "Instagram controls this limit."
                : "Request limit: up to 10 lookups per minute.",
      );
    }
    track("profile_failed");
  }
  async function enhance() {
    if (!image || enhancing) return;
    if (enhanced) {
      setEnhancedActive(true);
      return;
    }
    const controller = new AbortController();
    enhancementRequest.current = controller;
    setEnhancing(true);
    setEnhancementError("");
    setEnhancementProgress("Loading the source photo…");
    // Allow the loading state to paint before local image processing starts.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const result = await enhancePublicPhoto(
        image,
        controller.signal,
        setEnhancementProgress,
      );
      if (controller.signal.aborted) URL.revokeObjectURL(result.url);
      else {
        setEnhanced(result);
        setEnhancedActive(true);
      }
    } catch {
      if (!controller.signal.aborted)
        setEnhancementError(
          "AI enhancement is unavailable for this photo. The original is still available.",
        );
    } finally {
      if (!controller.signal.aborted) setEnhancing(false);
    }
  }
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (loading || Date.now() < retryUntil) return;
    setSample(false);
    enhancementRequest.current?.abort();
    setEnhancing(false);
    setEnhanced(null);
    setEnhancedActive(false);
    setEnhancementError("");
    setDimensions({ width: 0, height: 0 });
    setRetryUntil(0);
    setRemaining(0);
    setRetryHint("");
    setImage("");
    succeededImage.current = "";
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
        lookupError(
          response,
          response.status === 404 || response.ok
            ? "service_not_configured"
            : undefined,
        );
        return;
      }
      const data: unknown = await response.json();
      if (!response.ok) {
        const code =
          data && typeof data === "object" && "code" in data
            ? data.code
            : undefined;
        lookupError(response, code);
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
      setLoadingPhoto(true);
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
    <section id="tool" className="profile-viewer" aria-busy={loading}>
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
            disabled={loading}
          />
          <button
            className="button primary"
            disabled={loading || remaining > 0}
          >
            {loading ? (
              <>
                <span className="profile-spinner" aria-hidden="true" /> Looking
                for photo…
              </>
            ) : remaining > 0 ? (
              `Try again in ${remaining}s`
            ) : (
              "View public photo"
            )}
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
      <button
        type="button"
        className="button secondary"
        disabled={loading || enhancing}
        onClick={toggleSample}
      >
        {sample ? "Exit sample" : "Try with sample photo"}
      </button>
      {sample && (
        <p className="notice" role="status">
          Sample image · No Instagram lookup performed.
        </p>
      )}
      {loading && (
        <div className="profile-loading" role="status">
          <span className="profile-loading-orbit" aria-hidden="true">
            <span className="profile-spinner" />
          </span>
          <div>
            <strong>
              {sample
                ? "Loading the local sample"
                : loadingPhoto
                  ? "Loading your photo"
                  : "Finding the public photo"}
            </strong>
            <p>
              {sample
                ? "A synthetic illustration loaded from this site."
                : "This usually takes a few seconds. No Instagram login needed."}
            </p>
          </div>
        </div>
      )}
      {error && (
        <p className={retryHint ? "profile-limit" : "error"} role="alert">
          {error}
          {retryHint && (
            <>
              <br />
              {remaining > 0
                ? `Please try again in ${remaining} seconds.`
                : "You can try again now."}{" "}
              <span className="profile-limit-note">({retryHint})</span>
            </>
          )}
        </p>
      )}
      {!sample && username && (
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
              src={enhancedActive && enhanced ? enhanced.url : image}
              alt={
                sample
                  ? "Synthetic sample portrait, not a real person"
                  : `Public profile photo for ${username}`
              }
              referrerPolicy="no-referrer"
              style={{ transform: `scale(${zoom})` }}
              onLoad={(event) => {
                setLoadingPhoto(false);
                if (!enhancedActive) {
                  setDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                  if (!sample && succeededImage.current !== image) {
                    succeededImage.current = image;
                    track("profile_succeeded");
                  }
                }
              }}
              onError={() => {
                setLoadingPhoto(false);
                if (enhancedActive) {
                  setEnhancedActive(false);
                  setEnhancementError(
                    "The enhanced preview could not load. Showing the original photo.",
                  );
                  return;
                }
                setImage("");
                setError(
                  sample
                    ? "The local sample could not load. Please try again."
                    : "The public photo is no longer available. Try opening the profile.",
                );
                if (!sample) track("profile_failed");
              }}
            />
          </div>
          <p>
            {sample ? (
              "This synthetic illustration demonstrates the viewer; it is not a real person or evidence of photographic restoration quality. Enlarging the preview alone does not add detail."
            ) : (
              <>
                Enlarging the preview does not add detail. Image quality depends
                on the photo Instagram makes publicly available.
              </>
            )}
          </p>
          {dimensions.width > 0 && (
            <div className="photo-enhancement">
              <p>
                {enhancedActive && enhanced
                  ? `AI-upscaled · ${enhanced.width} × ${enhanced.height}`
                  : `${sample ? "Original sample" : "Original public photo"} · ${dimensions.width} × ${dimensions.height}`}
              </p>
              <div className="photo-controls">
                <button
                  type="button"
                  aria-pressed={!enhancedActive}
                  onClick={() => setEnhancedActive(false)}
                >
                  Original
                </button>
                <button
                  type="button"
                  aria-pressed={enhancedActive}
                  title={
                    Math.max(dimensions.width, dimensions.height) > 1024
                      ? "This source photo is already larger than the enhancement size limit."
                      : undefined
                  }
                  disabled={
                    enhancing ||
                    Math.max(dimensions.width, dimensions.height) > 1024
                  }
                  onClick={() => void enhance()}
                >
                  {enhancing ? "Upscaling…" : "AI upscale 4×"}
                </button>
                {enhancedActive && enhanced && (
                  <a
                    className="text-link"
                    href={enhanced.url}
                    download={`instascope-${sample ? "sample" : username}-ai-${enhanced.width}x${enhanced.height}.png`}
                  >
                    Save upscaled PNG
                  </a>
                )}
              </div>
              <p>
                General-purpose AI upscaling runs in your browser and keeps the
                model&apos;s actual 4× output size. Face-specific restoration is
                not available. Small faces may remain soft. Details are
                AI-estimated and can change facial features; this is not
                Instagram&apos;s original HD photo or an authentic
                higher-resolution original. The first use downloads about 19 MB
                of model and runtime files. Processing may take longer on
                phones.
              </p>
              {enhancing && (
                <>
                  <p role="status">{enhancementProgress}</p>
                  <button
                    type="button"
                    onClick={() => {
                      enhancementRequest.current?.abort();
                      setEnhancing(false);
                    }}
                  >
                    Cancel enhancement
                  </button>
                </>
              )}
              {enhancementError && <p role="status">{enhancementError}</p>}
            </div>
          )}
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
              onClick={async () => {
                try {
                  if (!preview.current?.requestFullscreen)
                    throw new Error("Fullscreen unavailable");
                  await preview.current.requestFullscreen();
                } catch {
                  setError("Fullscreen is not available in this browser.");
                }
              }}
            >
              Fullscreen
            </button>
          </div>
        </>
      )}
    </section>
  );
}
