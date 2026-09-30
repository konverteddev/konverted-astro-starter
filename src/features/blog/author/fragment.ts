import { richText } from "~/features/rich-text/fragment";
import { link } from "~/features/sanity/link/fragment";
import { image } from "~/features/sanity/media/fragment";

/**
 * Everything `AuthorProfile.astro` draws, shared by the panel and the author's own page. Callers
 * interpolate `RichTextFunctions`, which carries the link and image functions this needs.
 */
export const AuthorFragment = `
  _id,
  _type,
  name,
  role,
  "uri": coalesce(uri.current, ""),
  "image": ${image("image")},
  "bio": ${richText("bio")},
  "links": links[]{"key": _key, ...${link("@")}},
`;
