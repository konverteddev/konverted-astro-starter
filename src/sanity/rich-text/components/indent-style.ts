// The indentField mark applies at block level rather than inline: the block's text-indent comes
// from the mark's widthPercent, and split lines after the first reset it in CSS.
export function getIndentStyle(markDefs: Array<{ _type: string; widthPercent?: unknown }> | undefined) {
  const mark = markDefs?.find((def) => def._type === "indentField");

  if (!mark || typeof mark.widthPercent !== "number") {
    return undefined;
  }

  return { textIndent: `${mark.widthPercent}%` };
}
