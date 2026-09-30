import { type Screen, screens } from "~/features/dom/constants";
import { parseResponsiveValues } from "~/features/dom/utils";

function normalizeValue(value: string): string {
  const trimmed = value.trim();

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}px`;
  }

  return trimmed;
}

/**
 * Turns a responsive overflow shorthand ("60 lg:120") into `--parallax-overflow-*` properties plus the
 * per-breakpoint classes that promote them, so the responsive value stays pure CSS.
 */
export function createResponsiveOverflow(overflow: string | number) {
  const overflowString = typeof overflow === "number" ? `${overflow}px` : overflow;
  const parsed = parseResponsiveValues(overflowString);
  const breakpoints = Object.keys(screens) as Screen[];

  const styles: Record<string, string> = {};

  const defaultValue = normalizeValue(parsed.DEFAULT?.value ?? overflowString);
  styles["--parallax-overflow-DEFAULT"] = defaultValue;

  // A missing screen inherits the previous breakpoint, mirroring how Tailwind's min-width variants cascade.
  let previousValue = defaultValue;

  for (const breakpoint of breakpoints) {
    const currentValue = normalizeValue(parsed[breakpoint]?.value || previousValue);
    styles[`--parallax-overflow-${breakpoint}`] = currentValue;
    previousValue = currentValue;
  }

  return {
    styles,
    classes: [
      "[--parallax-overflow:var(--parallax-overflow-DEFAULT)]",
      "sm:[--parallax-overflow:var(--parallax-overflow-sm)]",
      "md:[--parallax-overflow:var(--parallax-overflow-md)]",
      "lg:[--parallax-overflow:var(--parallax-overflow-lg)]",
      "xl:[--parallax-overflow:var(--parallax-overflow-xl)]",
      "2xl:[--parallax-overflow:var(--parallax-overflow-2xl)]",
    ],
  };
}
