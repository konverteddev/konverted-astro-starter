/** Tiny dimensions for preview posters (LQIP-style); long edge capped, aspect preserved. */
export function muxPosterDimensionsForPreview(aspectRatio: number, maxEdge: number) {
  if (aspectRatio >= 1) {
    const width = maxEdge;
    const height = Math.max(1, Math.round(maxEdge / aspectRatio));
    return { width, height };
  }

  const height = maxEdge;
  const width = Math.max(1, Math.round(maxEdge * aspectRatio));
  return { width, height };
}

export type AnimatedPosterOptions = {
  start?: number;
  end?: number;
  format?: "webp" | "gif";
};

/** Mux caps animated.{webp,gif} at 640px on either edge. */
const ANIMATED_POSTER_MAX_EDGE = 640;
/** Mux's animated endpoint accepts up to 30 fps; pin to the max for the smoothest preview. */
const ANIMATED_POSTER_FPS = 30;

export function buildPosterUrl({
  playbackId,
  width,
  height,
  animated,
  time = 1,
  fitMode = "preserve",
}: {
  playbackId: string;
  time?: number;
  width?: number;
  height?: number;
  animated?: AnimatedPosterOptions;
  fitMode?: "preserve" | "stretch" | "crop" | "smartcrop" | "pad";
}) {
  if (animated) {
    const format = animated.format ?? "webp";
    const params: string[] = [];

    if (animated.start != null) {
      params.push(`start=${animated.start}`);
    }

    if (animated.end != null) {
      params.push(`end=${animated.end}`);
    }

    params.push(`fps=${ANIMATED_POSTER_FPS}`);

    // Send only the long edge: a mismatched width+height stretches, so let Mux compute the other from the source aspect.
    const w = width ?? 0;
    const h = height ?? 0;

    if (w > 0 || h > 0) {
      if (w >= h) {
        params.push(`width=${Math.min(w, ANIMATED_POSTER_MAX_EDGE)}`);
      } else {
        params.push(`height=${Math.min(h, ANIMATED_POSTER_MAX_EDGE)}`);
      }
    }

    return `https://image.mux.com/${playbackId}/animated.${format}${params.length ? `?${params.join("&")}` : ""}`;
  }

  let base = `https://image.mux.com/${playbackId}/thumbnail.webp?time=${time}&fit_mode=${fitMode}`;

  if (width) {
    base += `&width=${width}`;
  }

  if (height) {
    base += `&height=${height}`;
  }

  return base;
}
