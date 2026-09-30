import { defineQuery } from "groq";
import { LinkFn, link } from "~/features/sanity/link/fragment";
import { SANITY_SINGLETON_SITE_ID } from "~/sanity/constants";

export const SiteHeaderQ = defineQuery(`${LinkFn}
*[_type == "${SANITY_SINGLETON_SITE_ID}"][0]{
  header{
    links[]{"key": _key, ...${link("@")}}
  }
}`);
