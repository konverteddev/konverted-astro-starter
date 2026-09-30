/**
 * The layout switches every section shares. Adding one is three edits, never per-section: the Sanity
 * field, the `SECTION_SETTINGS` slice, and `sectionLayout` to turn it into classes.
 */

/** The settings slice every section query selects. Interpolated into `defineQuery` template literals. */
export const SECTION_SETTINGS = `"settings": sectionSettings{
      "hash": coalesce(sectionHash.current, _key),
      fullBleed,
    }`;

export type SectionLayoutSettings = {
  fullBleed?: boolean | null;
};

/** The classes a section's root carries: capped to the content column, or full bleed with the page margin kept. */
export function sectionLayout(settings?: SectionLayoutSettings | null) {
  if (settings?.fullBleed) {
    return "w-full px-(--page-gutter)";
  }

  return "mx-auto w-full max-w-(--page-width) px-(--page-gutter)";
}
