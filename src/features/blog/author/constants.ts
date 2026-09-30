import { SANITY_AUTHOR_PATH_PREFIX } from "~/sanity/constants";

/** The crop every portrait is served at, so the panel and the author's own page frame the same headshot the same way. */
export const PORTRAIT_ASPECT_RATIO = 7 / 8;

/** Names the panel off the profile's own heading, which is the only title it has. */
export const AUTHOR_DIALOG_TITLE_ID = "author-dialog-title";

/** Marks the links the panel answers. Every one is still a real href to the page it is a view of. */
export const AUTHOR_LINK_ATTR = "data-author-link";

/** True for one author's own URL (`/blog/authors/<name>`), false for the prefix it lives under and for the partial below it. */
export function isAuthorPath(pathname: string): boolean {
  const rest = pathname.startsWith(`${SANITY_AUTHOR_PATH_PREFIX}/`) ? pathname.slice(SANITY_AUTHOR_PATH_PREFIX.length + 1) : "";

  return rest.length > 0 && !rest.includes("/");
}

/** The panel fetches this rather than the full page, so opening one costs kilobytes instead of a document. */
export function authorPartialPath(pathname: string): string {
  return `${pathname}/modal`;
}
