import type { ComponentProps } from "astro/types";
import { definePreview } from "~/features/page-builder/section-preview";
import type Headline from "./Headline.astro";

// The section is a screen tall by design, so the frame follows rather than cropping the read in half.
export const preview = definePreview<ComponentProps<typeof Headline>>({
  height: 1080,
  props: { headline: "A statement the page\nreads word by word" },
});
