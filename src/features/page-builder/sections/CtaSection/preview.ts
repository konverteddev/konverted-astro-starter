import type { ComponentProps } from "astro/types";
import { definePreview } from "~/features/page-builder/section-preview";
import { sampleCta, sampleRichText } from "~/features/page-builder/section-preview-samples";
import type Cta from "./Cta.astro";

export const preview = definePreview<ComponentProps<typeof Cta>>({
  props: {
    headline: "Lorem ipsum dolor\nsit amet",
    text: sampleRichText(
      "cta-text",
      "Lorem ipsum dolor sit amet consectetur. At congue vitae leo et gravida scelerisque at, dapibus lectus aliquam neque diam."
    ),
    cta: sampleCta("Button Text Here"),
  },
});
