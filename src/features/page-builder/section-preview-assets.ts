// The static stand-ins every section preview fills a CMS slot with. Its own module so the test can
// read the contract without the preview registry next door, which reaches for Vite's `import.meta.glob`.

/** Files served from `public/placeholders/`. A replacement keeps the same path and shape. */
export const PREVIEW_ASSETS = {
  editorial: { url: "/placeholders/editorial.jpg", width: 1920, height: 1080 },
  icon: { url: "/placeholders/icon.svg", width: 320, height: 320 },
} as const;

export type PreviewAssetName = keyof typeof PREVIEW_ASSETS;

export const PREVIEW_ASSET_NAMES = Object.keys(PREVIEW_ASSETS) as PreviewAssetName[];
