/** The control's own styling, shared by every field: the shell owns the box, the control owns the text. */
export const FIELD_CONTROL_CLASS =
  "w-full min-w-0 flex-1 bg-transparent text-body-10 text-form-ink leading-none outline-none " +
  "placeholder:text-form-muted focus:placeholder:text-transparent " +
  "disabled:cursor-not-allowed disabled:text-form-muted/60";

/** `relative` so the adornment still paints over a control stretched across the box to widen its hit area. */
export const FIELD_ADORNMENT_CLASS = "pointer-events-none relative ml-auto size-16 text-form-muted";

/** The chip the floating label and every error message are set in; the token carries `line-height: 1`. */
export const FIELD_CHIP_CLASS = "font-pixel-square text-eyebrow uppercase";

/** The same chip sat on the field's own border line, so it needs the surface behind it. */
export const FIELD_BORDER_CHIP_CLASS = `${FIELD_CHIP_CLASS} absolute bg-white px-4`;
