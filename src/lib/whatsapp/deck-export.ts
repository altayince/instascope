import { zipSync } from "fflate";
import type { WhatsAppStory } from "./story-types";

export const MAX_DECK_CARDS = 12;
export const MAX_CARD_PNG_BYTES = 8 * 1024 * 1024;
export const MAX_DECK_PNG_BYTES = 32 * 1024 * 1024;

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Deck export cancelled.", "AbortError");
}

function validPortraitPng(bytes: Uint8Array): boolean {
  const magic = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 33 ||
    !magic.every((value, index) => bytes[index] === value)
  )
    return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return (
    view.getUint32(8) === 13 &&
    view.getUint32(12) === 0x49484452 &&
    view.getUint32(16) === 1080 &&
    view.getUint32(20) === 1920
  );
}

/** Sequential, bounded local encoding; no upload, storage or private filenames. */
export async function createWhatsAppDeckArchive(
  stories: readonly WhatsAppStory[],
  renderPng: (story: WhatsAppStory) => Promise<Blob>,
  options: {
    demo?: boolean;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
  } = {},
): Promise<{ blob: Blob; filename: string }> {
  checkCancelled(options.signal);
  if (stories.length < 1 || stories.length > MAX_DECK_CARDS)
    throw new Error(
      "This deck cannot be exported. Download individual cards instead.",
    );
  const selection = [...stories];
  const ids = new Set<string>();
  for (const story of selection) {
    if (
      !/^[a-z]+(?:-[a-z]+)*$/.test(story.id) ||
      story.id.length > 48 ||
      ids.has(story.id)
    )
      throw new Error(
        "This deck cannot be exported. Download individual cards instead.",
      );
    ids.add(story.id);
  }
  const files: Record<string, Uint8Array> = {};
  let totalBytes = 0;
  options.onProgress?.(0, selection.length);
  for (let index = 0; index < selection.length; index++) {
    checkCancelled(options.signal);
    const story = selection[index];
    const image = await renderPng(story);
    checkCancelled(options.signal);
    if (
      image.type !== "image/png" ||
      image.size > MAX_CARD_PNG_BYTES ||
      totalBytes + image.size > MAX_DECK_PNG_BYTES
    )
      throw new Error(
        "This deck is too large to export safely. Download individual cards instead.",
      );
    const bytes = new Uint8Array(await image.arrayBuffer());
    checkCancelled(options.signal);
    if (!validPortraitPng(bytes))
      throw new Error(
        "A card image could not be prepared. Download individual cards instead.",
      );
    totalBytes += bytes.length;
    files[`${String(index + 1).padStart(2, "0")}-${story.id}.png`] = bytes;
    options.onProgress?.(index + 1, selection.length);
  }
  checkCancelled(options.signal);
  // PNGs are already compressed. A fixed local-calendar ZIP date is generic,
  // deterministic metadata and carries no source dates or personal identifiers.
  const archive = zipSync(files, { level: 0, mtime: new Date(1980, 0, 1) });
  checkCancelled(options.signal);
  return {
    blob: new Blob([new Uint8Array(archive)], { type: "application/zip" }),
    filename: options.demo
      ? "instascope-whatsapp-demo-deck.zip"
      : "instascope-whatsapp-wrapped-deck.zip",
  };
}
