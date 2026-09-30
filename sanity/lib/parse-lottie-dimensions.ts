/**
 * Reads Lottie / Bodymovin JSON `w` and `h` so we can reserve space and avoid layout shift.
 * Does not require a Lottie runtime — only JSON.parse.
 */
export function parseLottieJsonDimensions(json: unknown): { width: number; height: number } | null {
  if (!json || typeof json !== "object") {
    return null;
  }

  const o = json as Record<string, unknown>;
  const w = o.w;
  const h = o.h;

  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
    return { width: Math.round(w), height: Math.round(h) };
  }

  return null;
}

/** Bodymovin JSON only; binary `.lottie` is not read here, so export `.json` or set dimensions manually. */
export function parseLottieAssetDimensionsFromBuffer(buffer: ArrayBuffer): {
  width: number;
  height: number;
} | null {
  let text: string;

  try {
    text = new TextDecoder("utf-8").decode(buffer);
  } catch {
    return null;
  }

  const trimmed = text.trimStart();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    const json: unknown = JSON.parse(text);

    return parseLottieJsonDimensions(json);
  } catch {
    return null;
  }
}
