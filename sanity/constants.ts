export const TEMPLATE_IDS = {
  pageSingleton: "pageSingletonTemplate",
} as const;

/** Singleton IDs as string literals (typegen resolves only literals, not member access); derive `SINGLETON_IDS` from these. */
export const SANITY_SINGLETON_SITE_ID = "site";
export const SANITY_SINGLETON_SITE_SETTINGS_ID = "siteSettings";
export const SANITY_SINGLETON_HOMEPAGE_ID = "homepage";
export const SANITY_SINGLETON_BLOG_ID = "blog";

/** Path the blog index singleton is served at. Articles slug under it (`/blog/<slug>`). */
export const SANITY_BLOG_INDEX_URI = "/blog";

/** Path people slug under (`/blog/authors/<slug>`). Nested under the blog so one prefix covers an article and the author panels it opens over itself. */
export const SANITY_AUTHOR_PATH_PREFIX = "/blog/authors";

/** Path new legal pages slug under (`/legal/<slug>`). A default, not a route: the catch-all serves whatever URI the document ends up with. */
export const SANITY_LEGAL_PATH_PREFIX = "/legal";

export const SINGLETON_IDS = {
  site: SANITY_SINGLETON_SITE_ID,
  siteSettings: SANITY_SINGLETON_SITE_SETTINGS_ID,
  homepage: SANITY_SINGLETON_HOMEPAGE_ID,
  blog: SANITY_SINGLETON_BLOG_ID,
  // PLOP: Add Singleton ID
} as const;

/** Singleton URIs, used for `initialValueTemplate` when creating/opening singleton pages. */
export const SINGLETON_ROUTES = {
  [SINGLETON_IDS.homepage]: "/",
  [SINGLETON_IDS.blog]: SANITY_BLOG_INDEX_URI,
  // PLOP: Add Singleton Route
} as const;

/** Submission schema types; only delete and discardChanges are allowed in the Studio. */
export const API_ONLY_DOCUMENTS = {
  contactFormSubmission: "contactFormSubmission",
} as const;

/** Scratch types for Agent Actions to type-check against: never in the structure, a template, or edited by hand. */
export const AGENT_SCRATCH_DOCUMENTS = {
  imageAltText: "imageAltText",
} as const;

/** Agent Actions are only available on the experimental "vX" API version. */
export const SANITY_AGENT_API_VERSION = "vX" as const;

/** Run `npm run sanity:schema-deploy` after schema changes or the agent works off a stale copy. */
export const SANITY_AGENT_SCHEMA_ID = "_.schemas.default" as const;

/** Routed non-singleton `_type` names; use these literal bindings in `defineQuery` interpolations (typegen won't resolve member access). Site's `_type` is `SANITY_SINGLETON_SITE_ID`, also its cache tag. */
export const SANITY_PAGE_DOCUMENT_TYPE = "page" as const;
export const SANITY_ARTICLE_DOCUMENT_TYPE = "article" as const;
export const SANITY_ARTICLE_CATEGORY_DOCUMENT_TYPE = "articleCategory" as const;
export const SANITY_PERSON_DOCUMENT_TYPE = "person" as const;
export const SANITY_LEGAL_PAGE_DOCUMENT_TYPE = "legalPage" as const;
