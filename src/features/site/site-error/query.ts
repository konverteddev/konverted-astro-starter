import { defineQuery } from "groq";
import { RichTextFunctions, richText } from "~/features/rich-text/fragment";
import { link } from "~/features/sanity/link/fragment";
import { SANITY_SINGLETON_SITE_ID } from "~/sanity/constants";

export const SiteErrorQ = defineQuery(`${RichTextFunctions}
*[_type == "${SANITY_SINGLETON_SITE_ID}"][0]{
  notFound{
    "text": ${richText("appRichText")},
    "link": ${link("appLink")},
    "showHeader": coalesce(showHeader, true),
    "showFooter": coalesce(showFooter, true)
  }
}`);
