// Reading time for an article body. Pure: takes the Portable Text blocks the page already fetched,
// so nothing is stored on the document and the number can never drift from the content.

/** Average adult reading speed for web prose. */
const WORDS_PER_MINUTE = 200;

// `_type` on both shapes, so a span with no `text` still matches structurally instead of being rejected.
type ReadingTimeSpan = { _type?: string | null; text?: string | null } | null;

export type ReadingTimeBlock = {
  _type?: string | null;
  children?: ReadingTimeSpan[] | null;
} | null;

/** Words in the body. Only `block` nodes carry prose, so media blocks and other custom types are skipped. */
export function countWords(blocks?: ReadingTimeBlock[] | null): number {
  if (!blocks?.length) {
    return 0;
  }

  let words = 0;

  for (const block of blocks) {
    if (block?._type !== "block") {
      continue;
    }

    for (const child of block.children ?? []) {
      const text = child?.text?.trim();

      if (text) {
        words += text.split(/\s+/).length;
      }
    }
  }

  return words;
}

/** Whole minutes to read the body, rounded up. Returns 0 for an empty body so callers can skip the label. */
export function readingTimeMinutes(blocks?: ReadingTimeBlock[] | null): number {
  const words = countWords(blocks);

  return words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Reader-facing label, or an empty string when there is nothing to read. */
export function formatReadingTime(blocks?: ReadingTimeBlock[] | null): string {
  const minutes = readingTimeMinutes(blocks);

  return minutes === 0 ? "" : `${minutes} min read`;
}
