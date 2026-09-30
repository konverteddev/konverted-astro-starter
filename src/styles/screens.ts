// TS mirror of the Tailwind `--breakpoint-*` tokens in ./tailwind.css. Keep the two in sync.
export const SCREENS = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
} as const;

export type Screen = keyof typeof SCREENS;
