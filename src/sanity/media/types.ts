// Bridge to the media fragment: the GROQ projection in
// `src/features/sanity/media/fragment.ts` is the source of truth for these shapes.
export type {
  ImageFragmentResult,
  LottieFragmentResult,
  MediaFragmentResult as MediaValue,
  RiveFragmentResult,
  VideoFileFragmentResult,
  VideoFragmentResult,
} from "~/features/sanity/media/fragment";

import type { MediaFragmentResult } from "~/features/sanity/media/fragment";

/** Every media kind the fragment can produce. */
export type MediaType = NonNullable<MediaFragmentResult["type"]>;

/** Per-instance playback overrides; merged over the CMS `videoOptions`. */
export type VideoProps = {
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  noControls?: boolean;
};

export function resolveVideoOptions(media: MediaFragmentResult, overrides: VideoProps = {}) {
  const options = media.videoOptions ?? {};
  return {
    autoPlay: overrides.autoPlay ?? options.autoPlay ?? false,
    loop: overrides.loop ?? options.loop ?? false,
    muted: overrides.muted ?? options.muted ?? overrides.autoPlay ?? options.autoPlay ?? false,
    noControls: overrides.noControls ?? options.noControls ?? false,
  };
}
