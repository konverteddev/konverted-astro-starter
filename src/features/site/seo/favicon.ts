import type { ImageFragmentResult } from "~/features/sanity/media/fragment";
import { builder, getImageDimensions } from "~/features/sanity/media/image/utils";
import type { FaviconFragmentResult } from "~/features/site/seo/fragment";

/**
 * Google supports one favicon per hostname and documents nothing about `media`, so this fixed same-origin
 * path is the stable URL it crawls; a raw CDN URL moves every time an editor swaps the asset.
 */
export const FAVICON_ROUTE_PATH = "/favicon.ico";

/** Two of these ship in every page head and browsers draw them at 16-32px, so keep them small. */
export const FAVICON_LINK_PX = 64;

/** Google recommends larger than 48x48px and renders the icon at several sizes, hence a multiple of 48. */
export const FAVICON_ROUTE_PX = 192;

/** Sanity has no ICO output, so PNG bytes are served under `.ico`; clients honor `Content-Type` over the extension. */
export const FAVICON_MIME = "image/png";

/** Exact square crop. The favicon field disables hotspot, so this is always a centered crop. */
export function getFaviconImageSrc(image: ImageFragmentResult, size: number = FAVICON_LINK_PX): string {
  const imageDimensions = getImageDimensions(image, { width: size, height: size });

  return builder
    .withOptions({
      width: imageDimensions.width,
      height: imageDimensions.height,
      fit: "crop",
      format: "png",
      quality: 85,
    })
    .image(image)
    .url();
}

/** The first variant the editor filled in. Light is tried first for field order, not because it is preferred. */
export function resolveFaviconAsset(favicon: FaviconFragmentResult | null | undefined): ImageFragmentResult | undefined {
  return [favicon?.iconLight, favicon?.iconDark].find((image): image is ImageFragmentResult => image?._id != null);
}
