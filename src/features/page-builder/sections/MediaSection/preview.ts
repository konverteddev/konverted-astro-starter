import type { ComponentProps } from "astro/types";
import { definePreview } from "~/features/page-builder/section-preview";
import type Media from "./Media.astro";

export const preview = definePreview<ComponentProps<typeof Media>>({
  props: (media) => ({ media: media.editorial(16 / 9), caption: "A caption sits under the media." }),
});
