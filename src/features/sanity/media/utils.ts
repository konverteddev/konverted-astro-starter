import { type Screen, screens } from "~/features/dom/constants";
import { parseResponsiveValues } from "~/features/dom/utils";

export function parseAspectRatio(ratio: string | number) {
  if (typeof ratio === "number") {
    return ratio;
  }

  const [w = 1, h = 1] = ratio.split(/[:/]/).map(Number);
  return w / h;
}

export function createResponsiveRatios(aspectRatio: string | number) {
  const ratio = parseResponsiveValues(String(aspectRatio));
  const breakpoints = Object.keys(screens) as [Screen];

  const result: Record<string, string> = {};

  const defaultValue = parseAspectRatio(ratio.DEFAULT?.value);
  result["--mx-ratio-DEFAULT"] = String(defaultValue);

  // We want to inherit the previous value if a screen is missing.
  let previousValue = defaultValue;

  for (const breakpoint of breakpoints) {
    const currentValue = parseAspectRatio(ratio[breakpoint]?.value || previousValue);
    result[`--mx-ratio-${breakpoint}`] = String(currentValue);
    previousValue = currentValue;
  }

  return {
    styles: result,
    className: [
      "aspect-[var(--mx-ratio)]",
      "[--mx-ratio:var(--mx-ratio-DEFAULT)]",
      "sm:[--mx-ratio:var(--mx-ratio-sm)]",
      "md:[--mx-ratio:var(--mx-ratio-md)]",
      "lg:[--mx-ratio:var(--mx-ratio-lg)]",
      "xl:[--mx-ratio:var(--mx-ratio-xl)]",
      "2xl:[--mx-ratio:var(--mx-ratio-2xl)]",
    ],
  };
}
