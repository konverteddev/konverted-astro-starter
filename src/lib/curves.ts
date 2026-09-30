// The bezier control points the site's motion shares, plus the `cubic-bezier()` strings built from them.
// One source for both, so two animations of the same move cannot drift apart. Import-free on purpose.

/** The browser's own `ease`, for a plain fade. */
export const CSS_CURVE = "0.25, 0.1, 0.25, 1";
/** The reveal: fast away, long settle, so a line lands rather than arrives. */
export const REVEAL_CURVE = "0.23, 1, 0.32, 1";
/** Its mirror, for copy leaving. */
export const EXIT_CURVE = "0.7, 0, 0.84, 0";

export const CSS_EASING = `cubic-bezier(${CSS_CURVE})`;
export const REVEAL_EASING = `cubic-bezier(${REVEAL_CURVE})`;
export const EXIT_EASING = `cubic-bezier(${EXIT_CURVE})`;
