import { defineQuery } from "groq";
import { LinkFragment } from "~/features/sanity/link/fragment";
import { SANITY_SINGLETON_SITE_ID } from "~/sanity/constants";

export const SiteAnnouncementQ = defineQuery(`*[_type == "${SANITY_SINGLETON_SITE_ID}"][0]{
  announcement{
    "enabled": coalesce(enabled, false),
    "theme": coalesce(theme, "dark"),
    text,
    "link": appLink{${LinkFragment}}
  }
}`);
