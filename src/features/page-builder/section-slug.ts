// Its own module so `scripts/section-thumbs/capture.ts` can import it: the preview registry next
// door reaches for `import.meta.glob`, which only exists inside Vite.

/** `MediaSection` to `media-section`: the section's route segment and thumbnail filename. */
export function toSectionSlug(folder: string) {
  return folder
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}
