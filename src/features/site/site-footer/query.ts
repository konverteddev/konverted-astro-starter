import { defineQuery } from "groq";
import { LinkFn, link } from "~/features/sanity/link/fragment";
import { SANITY_SINGLETON_SITE_ID } from "~/sanity/constants";

export const SiteFooterQ = defineQuery(`${LinkFn}
*[_type == "${SANITY_SINGLETON_SITE_ID}"][0]{
  name,
  footer{
    links[]{"key": _key, ...${link("@")}},
    legalLinks[]{"key": _key, ...${link("@")}}
  }
}`);
