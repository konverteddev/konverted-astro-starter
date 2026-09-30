// Neutral values a section fixture reaches for so the specimens read as one set. Placeholder copy
// only, never real client content. See docs/features/section-previews.md

import type { LinkFragmentResult } from "~/features/sanity/link/fragment";

export const sampleLink: LinkFragmentResult = {
  type: "external",
  href: "/",
  text: "Button Text Here",
  canDownload: false,
  openInNewTab: false,
};

export function sampleCta(text: string): LinkFragmentResult {
  return { ...sampleLink, text };
}

export const sampleHeadline = "Lorem ipsum\ndolor sit amet";

export const sampleText =
  "Lorem ipsum dolor sit amet consectetur. At congue vitae leo et gravida scelerisque at. Dapibus lectus aliquam neque diam diam lectus facilisis.";

/** Portable text as the CMS stores it, so the rich text renderer is exercised rather than bypassed. */
export function sampleRichText(key: string, body: string) {
  return [
    {
      _type: "block",
      _key: key,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `${key}-body`, text: body, marks: [] }],
    },
  ];
}
