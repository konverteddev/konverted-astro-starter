import type { ImageFragmentResult } from "~/features/sanity/media/fragment";
import { type BuilderOptions, builder, getImageDimensions } from "~/features/sanity/media/image/utils";
import { SiteQuery } from "~/features/site/query";
import { getFaviconImageSrc } from "~/features/site/seo/favicon";
import type { FaviconFragmentResult } from "~/features/site/seo/fragment";
import type { SiteQueryResult } from "~/sanity/types";
import { getDraftModeProps } from "./lib/draft-mode";
import { loadQuery } from "./lib/load-query";

// Standard social-card dimensions; the CMS image is cropped to this for og:image/twitter:image.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

type DraftContext = Parameters<typeof getDraftModeProps>[0];

type SeoProps = {
  title?: string | null;
  description?: string | null;
  robots?: string | null;
  image?: ImageFragmentResult | null;
  canonical?: string | null;
};

export function getOgImageSrc(image: ImageFragmentResult, options: BuilderOptions = {}) {
  const { aspectRatio, ...builderOptions } = options;

  const imageDimensions = getImageDimensions(image, { width: OG_WIDTH, height: OG_HEIGHT, aspectRatio });

  return builder
    .withOptions({
      auto: "format",
      quality: 85,
      ...builderOptions,
      fit: "crop",
      width: imageDimensions.width,
      height: imageDimensions.height,
    })
    .image(image)
    .url();
}

/** Editors type intentional line breaks; meta tags and JSON-LD both want one line. */
function singleLine(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

function faviconSrcs(favicon: FaviconFragmentResult | null | undefined) {
  return {
    faviconLight: favicon?.iconLight?._id != null ? getFaviconImageSrc(favicon.iconLight) : undefined,
    faviconDark: favicon?.iconDark?._id != null ? getFaviconImageSrc(favicon.iconDark) : undefined,
  };
}

/** Separate from `seo` so a route can fetch it alongside its own document: nothing here depends on the page. */
export function loadSite(astro: DraftContext) {
  return loadQuery<SiteQueryResult>({ query: SiteQuery, ...getDraftModeProps(astro) });
}

/** The page's own `seoMetadata` wins, falling back to the Site singleton's defaults. */
export function seo(site: SiteQueryResult, props: SeoProps = {}) {
  // The site name is the last resort: an empty <title> is an accessibility and SEO failure.
  const title = props.title ?? site?.seoMetadata?.title ?? site?.name ?? "";
  const description = singleLine(props.description ?? site?.seoMetadata?.description);
  const imageSource = props.image ?? site?.seoMetadata?.image;
  const robots = props.robots ?? site?.seoMetadata?.robots ?? undefined;
  const image = imageSource?._id != null ? getOgImageSrc(imageSource) : undefined;
  const siteImage = site?.seoMetadata?.image;

  return {
    title,
    siteName: site?.name ?? undefined,
    socialProfiles: site?.socialProfiles?.filter((profile): profile is string => Boolean(profile)) ?? [],
    // These nodes describe the site, so they take the Site singleton's description rather than the rendering page's.
    siteDescription: singleLine(site?.seoMetadata?.description),
    siteLogo: siteImage?._id != null ? getOgImageSrc(siteImage) : undefined,
    description,
    robots,
    canonical: props.canonical ?? undefined,
    image,
    imageAlt: title,
    imageWidth: image ? OG_WIDTH : undefined,
    imageHeight: image ? OG_HEIGHT : undefined,
    ...faviconSrcs(site?.favicon),
  };
}
