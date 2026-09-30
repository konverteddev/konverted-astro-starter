import { defineQuery } from "groq";
import { FaviconFragment, SeoFunctions, SeoMetadataFragment } from "~/features/site/seo/fragment";
import { SANITY_SINGLETON_SITE_ID, SANITY_SINGLETON_SITE_SETTINGS_ID } from "~/sanity/constants";

// The favicon is site-wide configuration, so it comes from the `siteSettings` singleton; everything
// else here (name, SEO defaults, social profiles) is copy and comes from the Site document.
export const SiteQuery = defineQuery(`${SeoFunctions}
*[_type == "${SANITY_SINGLETON_SITE_ID}"][0]{
  name,
  "socialProfiles": contacts[appLink.type == "external"].appLink.external,
  seoMetadata{${SeoMetadataFragment}},
  "favicon": *[_type == "${SANITY_SINGLETON_SITE_SETTINGS_ID}"][0].favicon{${FaviconFragment}}
}`);
