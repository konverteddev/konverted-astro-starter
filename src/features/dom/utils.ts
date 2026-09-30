import { type Screen, screens } from "./constants";

function parseRem(size: string) {
  return Number.parseFloat(size.replace("rem", ""));
}

/**
 * Parse a Tailwind className into its responsive values.
 * @example parseResponsiveValues("1 sm:4 lg:2") // { DEFAULT: {value:1}, sm: {value:4, resolvedWidth:"40rem"}, ... }
 */
export function parseResponsiveValues(className: string) {
  const res = {} as Record<Screen | "DEFAULT", { value: string; resolvedWidth?: string }>;

  const bpRegexPattern = Object.keys(screens).join("|");
  const bpRegex = new RegExp(`^(${bpRegexPattern}):(.+)$`);

  const parts = className.split(/\s+/);
  for (const part of parts) {
    const match = part.match(bpRegex);

    if (match) {
      const [, size, value] = match;

      if (value && size) {
        res[size as Screen] = { value, resolvedWidth: screens[size as Screen] };
      }
    } else {
      res.DEFAULT = { value: part };
    }
  }

  // Sort largest-first to mimic how the browser applies media query styles.
  const sortedEntries = Object.entries(res).sort(([, { resolvedWidth: sizeA }], [, { resolvedWidth: sizeB }]) => {
    if (!sizeA && !sizeB) {
      return 0;
    }

    if (!sizeA) {
      return 1;
    }

    if (!sizeB) {
      return -1;
    }

    return parseRem(sizeB) - parseRem(sizeA);
  });

  return Object.fromEntries(sortedEntries) as typeof res;
}
