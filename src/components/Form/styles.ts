/** The control's own styling, shared by every field: the shell owns the box, the control owns the text. */
export const FIELD_CONTROL_CLASS =
  "w-full min-w-0 flex-1 bg-transparent text-body-10 text-white leading-none outline-none " +
  "placeholder:text-white/60 focus:placeholder:text-transparent " +
  "disabled:cursor-not-allowed disabled:text-white/40";

/** `relative` so the adornment still paints over a control stretched across the box to widen its hit area. */
export const FIELD_ADORNMENT_CLASS = "pointer-events-none relative ml-auto size-16 text-white/60";

/** The chip the floating label and every error message are set in; the token carries `line-height: 1`. */
export const FIELD_CHIP_CLASS = "font-pixel-square text-eyebrow uppercase";

/** The same chip sat on the field's own border line, so it needs the page surface behind it. */
export const FIELD_BORDER_CHIP_CLASS = `${FIELD_CHIP_CLASS} absolute bg-black px-4`;
