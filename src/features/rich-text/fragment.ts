// PLOP: Add Import
import type { PortableTextProps } from "astro-portabletext/types";
import { LinkFn, link } from "~/features/sanity/link/fragment";
import { MediaFunctions, media } from "~/features/sanity/media/fragment";
import { MediaBlockFragment } from "./blocks/media-block/fragment";

export const RichTextFn = `fn frag::richText($value) = $value[]{
  ...,
  ${MediaBlockFragment},
  // PLOP: Add Export
  markDefs[] {
    ...,
    _type == "linkField" => ${link("@")},
  },
  children[] {
    ...,
    _type == "inlineMediaField" => {
      "media": ${media("media")},
    },
  }
};`;

export const richText = (path: string) => `frag::richText(${path})`;

/** Interpolate once at the head of any query calling `richText`. */
export const RichTextFunctions = `${LinkFn}\n${MediaFunctions}\n${RichTextFn}`;

export type RichTextFragmentResult = PortableTextProps["value"];
