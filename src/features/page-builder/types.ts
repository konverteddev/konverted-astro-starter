/**
 * Props every page-builder section receives. `isFirst` is passed to all of them so a section that
 * can hold the LCP element (currently only the media section) can opt into a priority hint.
 */
export type SectionProps = {
  docId: string;
  sectionKey: string;
  isFirst?: boolean;
};
