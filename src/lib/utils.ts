import { SCREENS } from "~/styles/screens";

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Live query for the desktop/mobile split; callers add their own 'change' listener.
export const desktopQuery = (breakpoint = SCREENS.lg) => window.matchMedia(`(min-width: ${breakpoint})`);

export const canHoverQuery = () => window.matchMedia("(hover: hover)");

// True for a mouse hover or a keyboard focus; false for a touch tap (which fires both pointerover and focusin).
export const isRealHover = (event: Event): boolean => {
  if (event instanceof PointerEvent) {
    return event.pointerType === "mouse";
  }

  if (event instanceof FocusEvent) {
    return event.target instanceof Element && event.target.matches(":focus-visible");
  }

  return true;
};
