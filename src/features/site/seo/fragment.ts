import { ImageFn, type ImageFragmentResult, image } from "~/features/sanity/media/fragment";

// "follow" rather than "nofollow": a noindex page still passes internal link equity through to the
// pages it links to, and every noindex page here links back into the indexable site.
export const SeoMetadataFragment = `
  title,
  description,
  "image": ${image("image")},
  "robots": select(noIndex => "noindex,follow", true => undefined),
`;

export type SeoMetadataFragmentResult = {
  title: string;
  description: string;
  image: ImageFragmentResult;
  robots?: string;
};

export const FaviconFragment = `
  "iconLight": ${image("iconLight")},
  "iconDark": ${image("iconDark")}
`;

export type FaviconFragmentResult = {
  iconLight?: ImageFragmentResult | null;
  iconDark?: ImageFragmentResult | null;
};

/** Interpolate at the head of any query using `SeoMetadataFragment`, which calls `frag::image`. */
export const SeoFunctions = ImageFn;
