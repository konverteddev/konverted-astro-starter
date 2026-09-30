// Divider hygiene for the desk structure, kept out of `structure.tsx` so it can be tested without a
// StructureBuilder. See `grouped`.

/** A divider is the one structure item that is a plain object rather than a builder. */
export function isDivider(item: unknown): boolean {
  return typeof item === "object" && item !== null && "type" in item && (item as { type?: unknown }).type === "divider";
}

/**
 * Drops the gaps a removed group leaves: no divider first, last, or twice in a row.
 *
 * A divider only means anything with a group either side of it. Removing a feature takes its items
 * out of the list and would otherwise leave the rule that framed them, reading as an empty section.
 * Applied here because the edit that causes it is usually `npm run trim` rather than a person.
 */
export function grouped<Item>(items: Item[]): Item[] {
  const kept: Item[] = [];

  for (const item of items) {
    const previous = kept.at(-1);

    if (isDivider(item) && (previous === undefined || isDivider(previous))) {
      continue;
    }

    kept.push(item);
  }

  while (kept.length > 0 && isDivider(kept.at(-1))) {
    kept.pop();
  }

  return kept;
}
