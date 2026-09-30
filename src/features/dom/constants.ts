/** Each Tailwind breakpoint to its screen size. Keep in sync with the Tailwind config. */
export const screens = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
} as const;

export type Screen = keyof typeof screens;
