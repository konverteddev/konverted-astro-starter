// The specimen a section is photographed from for the Studio's insert menu, and the fixture that
// describes what it should show. See docs/features/section-previews.md

import { PREVIEW_ASSETS, type PreviewAssetName } from "~/features/page-builder/section-preview-assets";
import { toSectionSlug } from "~/features/page-builder/section-slug";
import type { ImageFragmentResult, MediaFragmentResult } from "~/features/sanity/media/fragment";

/** Fills a slot a section would fill from the CMS, from the static files in `public/placeholders/`. */
export type PreviewMedia = {
  /** A wide picture, for a media slot or a backdrop. */
  editorial: (aspectRatio?: number) => MediaFragmentResult;
  /** A square mark, for a logo or a card icon. */
  icon: () => ImageFragmentResult;
};

/** A fixture is a plain object, or a function when it needs a slot filling. */
export type PreviewProps<P> = P | ((media: PreviewMedia) => P);

export type SectionPreview<P = Record<string, never>> = {
  props?: PreviewProps<P>;
  /** Crop height in CSS pixels; the default frames the section as a 3:2 tile. */
  height?: number;
  /** Leaves this section without a thumbnail, so the insert menu falls back to its icon. */
  skip?: string;
};

/** Identity, for the inference: `definePreview<ComponentProps<typeof Cta>>({ ... })`. */
export function definePreview<P>(preview: SectionPreview<P>): SectionPreview<P> {
  return preview;
}

export const PREVIEW_WIDTH = 1440;

export const PREVIEW_HEIGHT = 960;

function asImage(name: PreviewAssetName): ImageFragmentResult {
  const { url, width, height } = PREVIEW_ASSETS[name];

  return { url, dimensions: { width, height, aspectRatio: width / height, _type: "sanity.imageDimensions" } };
}

/** Wraps a placeholder image for a slot that takes a whole media object rather than a bare image. */
export function toPreviewMedia(image: ImageFragmentResult, aspectRatio?: number): MediaFragmentResult {
  return { type: "image", image, aspectRatio: aspectRatio ?? image.dimensions?.aspectRatio ?? null };
}

/** The stand-ins every fixture gets, so a preview never depends on what a dataset happens to hold. */
export const previewMedia: PreviewMedia = {
  icon: () => asImage("icon"),
  editorial: (aspectRatio) => toPreviewMedia(asImage("editorial"), aspectRatio),
};

export function resolvePreviewProps<P>(preview: SectionPreview<P>, media: PreviewMedia = previewMedia): P {
  const { props } = preview;

  if (typeof props === "function") {
    return (props as (media: PreviewMedia) => P)(media);
  }

  return (props ?? {}) as P;
}

export type SectionPreviewEntry = {
  /** The section's folder, e.g. `MediaSection`. */
  folder: string;
  /** The thumbnail's filename stem, e.g. `media-section`. */
  slug: string;
  preview: SectionPreview<Record<string, unknown>>;
  // biome-ignore lint/suspicious/noExplicitAny: an Astro component type is only ever spread into.
  Component: any;
};

const previewModules = import.meta.glob<{ preview: SectionPreview<Record<string, unknown>> }>("./sections/*/preview.ts", {
  eager: true,
});

// The presentational half a section is photographed from: `MediaSection/Media.astro`.
const componentModules = import.meta.glob<{ default: unknown }>("./sections/*/*.astro", { eager: true });

const entries: SectionPreviewEntry[] = Object.entries(previewModules)
  .map(([path, module]) => {
    const folder = path.split("/")[2];
    const half = folder.replace(/Section$/, "");

    return {
      folder,
      slug: toSectionSlug(folder),
      preview: module.preview,
      Component: componentModules[`./sections/${folder}/${half}.astro`]?.default,
    };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

export function sectionPreviews() {
  return entries;
}

export function getSectionPreview(slug: string) {
  return entries.find((entry) => entry.slug === slug);
}
