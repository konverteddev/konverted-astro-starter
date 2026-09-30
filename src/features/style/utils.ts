// biome-ignore-all lint/style/noRestrictedImports: this is the seam the ban points at.
import { extendTailwindMerge } from "tailwind-merge";

function isValidTextSize(cn: string) {
  // The fluid type-scale prefixes, so `text-body-10` and friends are recognised as font-size utilities.
  return ["title", "subtitle", "body", "caption", "cta", "eyebrow", "headline"].some((val) => cn.startsWith(val));
}

// @see https://github.com/dcastil/tailwind-merge/blob/main/docs/configuration.md#theme
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [isValidTextSize],
    },
  },
});

type ClassValue = string | number | false | null | undefined | ClassValue[];

function flatten(values: ClassValue[], out: string[]): string[] {
  for (const value of values) {
    if (!value && value !== 0) {
      continue;
    }

    if (Array.isArray(value)) {
      flatten(value, out);
    } else {
      out.push(String(value));
    }
  }

  return out;
}

/** tailwind-merge, so caller classes reliably override component defaults. Use this over `class:list` when merging a `class` prop. */
export function cx(...inputs: ClassValue[]): string {
  return twMerge(flatten(inputs, []).join(" "));
}
