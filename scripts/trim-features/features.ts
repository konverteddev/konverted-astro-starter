/**
 * What each removable feature is made of.
 *
 * Pure data. Every path, anchor and package name here is checked against the real tree by
 * `manifest.test.ts`, so a rename that moves a registry fails the test suite instead of surfacing as
 * a half-trimmed repo months later. Adding a feature is a matter of adding an entry, not of writing
 * code: `edits.ts` already knows how to perform every kind of removal listed below.
 *
 * The starter is a superset on purpose, so nothing here runs unless someone asks for it.
 */

import type { Edit, FileEdits } from "./edits";

export type Feature = {
  /** Stable id, used by `--feature`. Sections are namespaced (`section:media`). */
  id: string;
  title: string;
  summary: string;
  /**
   * The day this feature joined the starter, as `YYYY-MM-DD`. A project cut before it never had it,
   * so a file there with the same name is the project's own rather than this feature.
   */
  since: string;
  /** Features that cannot survive this one's removal, auto-selected with a printed note. */
  implies?: string[];
  /** Files and directories this feature owns outright. */
  paths: string[];
  /** Registry surgery, grouped by file. Each edit is asserted to match exactly once. */
  edits: FileEdits[];
  /** npm packages nothing else uses. */
  dependencies?: string[];
  /** Env vars to drop from the config schema, `src/lib/env.ts` and `.env.example`. */
  env?: string[];
  /** Sanity `_type`s to purge. They go in one transaction, so no order is needed. */
  documentTypes?: string[];
  /** `<name>SectionField` array-member types stored on `pageBuilder.sectionsArray`. */
  sectionTypes?: string[];
  /** `docs/**.md` files to delete. Links to them are pruned from the doc indexes automatically. */
  docs?: string[];
  /** `.agents/skills/<name>` folders to delete. */
  skills?: string[];
  /**
   * Paths nothing ships uses once this feature is gone, but which it does not own outright.
   *
   * A shared layer only one feature happened to use. Declared rather than discovered: the knip sweep
   * only names a file nothing at all imports, so a module kept alive by its own colocated test is
   * invisible to it. Whether these go is a judgement, so they are reported, never deleted.
   */
  orphans?: string[];
  /** Shared code with no Sanity surface at all, so there is nothing for a purge to delete. */
  codeOnly?: true;
  /** What the trim deliberately leaves behind for a human, printed in the closing report. */
  notes?: string[];
  /** Prose names for it, so docs and skills that still describe it after a trim can be listed. */
  mentions?: string[];
};

/** The first import of the starter: every feature that shipped with it has this `since`. */
const FIRST_CUT = "2026-07-16";

/**
 * Env vars are declared once per feature and expanded here, because every one of them is wired into
 * the same three places: the `runtimeEnv` map, its `server` or `client` schema, and `.env.example`.
 */
function envEdits(vars: string[]): FileEdits[] {
  return [
    { file: "src/lib/env.ts", edits: vars.map((name): Edit => ({ kind: "dropExport", id: name })) },
    {
      file: "astro.config.mjs",
      edits: vars.map((name): Edit => ({ kind: "dropObjectProperty", anchor: "schema", key: name })),
    },
  ];
}

/**
 * The blog, and with it the authors it bylines.
 *
 * The two are one removal in both directions, not two: an article's byline is a required part of the
 * article route and of its JSON-LD, and a person only exists as an article's author. This script
 * removes rather than rewires, so "blog without bylines" would mean rewriting the article route
 * rather than unwiring a registry. `implies` therefore points both ways.
 */
const blog: Feature = {
  id: "blog",
  since: FIRST_CUT,
  title: "Blog",
  summary: "The blog index, articles, categories and the author profiles that byline them.",
  mentions: ["RSS feed"],
  implies: ["authors"],
  paths: [
    "src/pages/blog",
    "src/pages/feed.xml.ts",
    "src/features/blog",
    "src/features/feed",
    "sanity/schemas/documents/article.tsx",
    "sanity/schemas/documents/article-category.tsx",
    "sanity/schemas/documents/blog.tsx",
  ],
  edits: [
    {
      file: "sanity/schemas/index.ts",
      edits: [
        { kind: "dropImport", id: "article" },
        { kind: "dropImport", id: "articleCategory" },
        { kind: "dropImport", id: "blog" },
        { kind: "dropArrayElement", arrayName: "schemaTypes", id: "article" },
        { kind: "dropArrayElement", arrayName: "schemaTypes", id: "articleCategory" },
        { kind: "dropArrayElement", arrayName: "schemaTypes", id: "blog" },
      ],
    },
    {
      file: "sanity/constants.ts",
      edits: [
        { kind: "dropVariableStatement", name: "SANITY_SINGLETON_BLOG_ID" },
        { kind: "dropVariableStatement", name: "SANITY_BLOG_INDEX_URI" },
        { kind: "dropVariableStatement", name: "SANITY_ARTICLE_DOCUMENT_TYPE" },
        { kind: "dropVariableStatement", name: "SANITY_ARTICLE_CATEGORY_DOCUMENT_TYPE" },
        { kind: "dropObjectProperty", anchor: "SINGLETON_IDS", key: "blog" },
        { kind: "dropObjectProperty", anchor: "SINGLETON_ROUTES", key: "blog" },
      ],
    },
    { file: "sanity/structure.tsx", edits: [{ kind: "dropCallInArray", anchor: "items", title: "Blog" }] },
    {
      file: "sanity/templates.tsx",
      edits: [{ kind: "dropStringFromArray", anchor: "SCHEMA_TYPES_SINGLETON_VIA_DESK_ONLY", value: "blog" }],
    },
    {
      file: "sanity/schemas/fields/create-uri-field.tsx",
      edits: [
        { kind: "dropImport", id: "SANITY_BLOG_INDEX_URI" },
        // Cosmetic: the sentence above a guard that is going anyway.
        { kind: "dropLines", contains: "The blog index is its own singleton on its own route", optional: true },
        {
          kind: "replaceText",
          label: "remove the reserved-path guard for the blog index",
          find: `const docId = typeof context.document?._id === "string" ? sanitizeDocId(context.document._id) : null;

    if (uriP === comparableUriPath(SANITY_BLOG_INDEX_URI) && docId !== SINGLETON_IDS.blog) {
      return \`This URI is reserved for the Blog index (\${SANITY_BLOG_INDEX_URI}). Choose a different path.\`;
    }`,
          with: "",
        },
      ],
    },
    {
      file: "sanity/schemas/fields/create-link.tsx",
      edits: [
        { kind: "dropObjectFromArray", anchor: "to", property: "type", value: "article" },
        { kind: "dropObjectFromArray", anchor: "to", property: "type", value: "blog" },
      ],
    },
    {
      file: "src/pages/sitemap.xml.ts",
      edits: [
        { kind: "dropStringFromArray", anchor: "tags", value: "article" },
        { kind: "dropStringFromArray", anchor: "tags", value: "blog" },
      ],
    },
    {
      file: "src/features/agents/query.ts",
      edits: [
        { kind: "dropImport", id: "SANITY_ARTICLE_DOCUMENT_TYPE" },
        { kind: "dropImport", id: "SANITY_SINGLETON_BLOG_ID" },
        { kind: "dropVariableStatement", name: "AgentMarkdownArticleListFragment" },
        {
          kind: "replaceText",
          label: "drop article and blog from the llms.txt inventory type list",
          find: `"\${SANITY_ARTICLE_DOCUMENT_TYPE}", "\${SANITY_PERSON_DOCUMENT_TYPE}", "\${SANITY_SINGLETON_BLOG_ID}"]`,
          with: "]",
        },
        {
          kind: "replaceText",
          label: "drop the article category projection from the llms.txt inventory",
          // Anchored on the line above it: the same projection appears in the agent Markdown query,
          // and whitespace-tolerant matching would otherwise find both.
          find: `"publishedAt": publishedAt,
    "categories": categories[]->name`,
          with: `"publishedAt": publishedAt`,
        },
        {
          kind: "replaceText",
          label: "drop the article byline and categories from the agent Markdown projection",
          find: `  "author": author->name,
  "categories": categories[]->name,
`,
          with: "",
        },
        {
          kind: "replaceText",
          label: "drop the blog index branch from the agent Markdown projection",
          find: `,
  _type == "\${SANITY_SINGLETON_BLOG_ID}" => {\${AgentMarkdownArticleListFragment}
  }`,
          with: "",
        },
      ],
    },
    {
      file: "src/sanity/queries.ts",
      edits: [
        { kind: "dropImport", id: "AuthorFragment" },
        { kind: "dropImport", id: "SANITY_ARTICLE_DOCUMENT_TYPE" },
        { kind: "dropImport", id: "SANITY_BLOG_INDEX_URI" },
        { kind: "dropImport", id: "SANITY_PERSON_DOCUMENT_TYPE" },
        { kind: "dropImport", id: "SANITY_SINGLETON_BLOG_ID" },
        { kind: "dropVariableStatement", name: "ArticlePageQ" },
        { kind: "dropVariableStatement", name: "BlogPageQ" },
        { kind: "dropVariableStatement", name: "AuthorPageQ" },
      ],
    },
    {
      file: "src/features/agents/not-found-markdown.ts",
      edits: [{ kind: "dropObjectFromArray", anchor: "NOT_FOUND_LINKS", property: "path", value: "/blog" }],
    },
    {
      file: "src/pages/api/agents/llms-txt.ts",
      edits: [
        {
          kind: "replaceText",
          label: "stop labelling entries as articles",
          find: `type: page._type === "article" ? "article" : "page",`,
          with: `type: "page",`,
        },
        {
          kind: "replaceText",
          label: "drop the category list from each llms.txt entry",
          find: `
          categories: page.categories?.filter((category): category is string => Boolean(category)) ?? undefined,`,
          with: "",
        },
        {
          kind: "replaceText",
          label: "drop categories from the entry shape described to the model",
          find: `each has type, title, url, and optional description, publishedAt, categories`,
          with: `each has type, title, url, and optional description, publishedAt`,
        },
        {
          kind: "replaceText",
          label: "drop the article-specific grouping guidance from the prompt",
          find: ` A good default is "## Pages" for entries with type "page" and "## Articles" for entries with type "article"; rename or merge them if it reads better.`,
          with: "",
        },
        {
          kind: "replaceText",
          label: "drop the blog example from the orientation guidance",
          find: ` (for example: the blog index for discovery, individual articles for deep dives)`,
          with: "",
        },
      ],
    },
    {
      file: "src/features/site/seo/structured-data.ts",
      edits: [
        { kind: "dropVariableStatement", name: "BlogInput" },
        { kind: "dropVariableStatement", name: "BlogPostingInput" },
        { kind: "dropVariableStatement", name: "blogLd" },
        { kind: "dropVariableStatement", name: "blogPostingLd" },
      ],
    },
    {
      file: "src/features/site/seo/structured-data.test.ts",
      edits: [
        { kind: "dropImport", id: "blogLd" },
        { kind: "dropImport", id: "blogPostingLd" },
        { kind: "dropCallStatement", fn: "test", titleContains: "blogLd" },
        { kind: "dropCallStatement", fn: "test", titleContains: "blogPostingLd", count: 3 },
      ],
    },
    {
      file: "src/features/auth/excluded-paths.ts",
      requires: "src/features/feed",
      edits: [
        { kind: "dropImport", id: "FEED_PATH" },
        { kind: "dropLines", contains: "The feed carries whole article bodies", optional: true },
        {
          kind: "replaceText",
          label: "stop excusing the feed from the dot-path skip",
          find: `if (pathname === FEED_PATH) {
    return false;
  }`,
          with: "",
        },
      ],
    },
    {
      file: "src/features/auth/excluded-paths.test.ts",
      requires: "src/features/feed",
      edits: [
        { kind: "dropImport", id: "FEED_PATH" },
        { kind: "dropCallStatement", fn: "test", titleContains: "the feed despite its extension" },
      ],
    },
    {
      file: "src/features/agents/markdown-rewrite.ts",
      requires: "src/features/feed",
      edits: [
        { kind: "dropImport", id: "FEED_PATH" },
        {
          kind: "replaceText",
          label: "stop excusing the feed from Markdown content negotiation",
          find: `context.request.method !== "GET" || pathname === FEED_PATH || !prefersMarkdown`,
          with: `context.request.method !== "GET" || !prefersMarkdown`,
        },
      ],
    },
    {
      file: "src/features/agents/llms-txt-resources.ts",
      requires: "src/features/feed",
      edits: [{ kind: "dropLines", contains: "[RSS feed](" }],
    },
    {
      file: "src/features/agents/llms-txt-resources.test.ts",
      requires: "src/features/feed",
      edits: [{ kind: "dropLines", contains: "feed\\.xml" }],
    },
  ],
  dependencies: [],
  documentTypes: ["article", "articleCategory", "blog"],
  docs: ["docs/features/rss-feed.md"],
  notes: [
    "`sanity/schemas/documents/page.tsx` and the Site singleton may still link to blog URLs in their copy.",
    "`features/agents/markdown.ts` keeps its article-list renderer: it is inert once the query stops projecting `articles`, and removing it is a serializer decision rather than a registry one.",
  ],
};

/** Author profiles. See `blog`: the two imply each other, because the byline is part of the article route. */
const authors: Feature = {
  id: "authors",
  since: FIRST_CUT,
  title: "Authors",
  summary: "Person documents, the author profile page and the panel an article's byline opens.",
  implies: ["blog"],
  paths: ["sanity/schemas/documents/person.tsx"],
  edits: [
    {
      file: "sanity/schemas/index.ts",
      edits: [
        { kind: "dropImport", id: "person" },
        { kind: "dropArrayElement", arrayName: "schemaTypes", id: "person" },
      ],
    },
    {
      file: "sanity/constants.ts",
      edits: [
        { kind: "dropVariableStatement", name: "SANITY_PERSON_DOCUMENT_TYPE" },
        { kind: "dropVariableStatement", name: "SANITY_AUTHOR_PATH_PREFIX" },
      ],
    },
    {
      file: "src/pages/sitemap.xml.ts",
      edits: [{ kind: "dropStringFromArray", anchor: "tags", value: "person" }],
    },
    {
      file: "src/features/agents/query.ts",
      edits: [
        { kind: "dropImport", id: "SANITY_PERSON_DOCUMENT_TYPE" },
        {
          kind: "replaceText",
          // Spans its leading comma to stay disjoint from the blog branch below, comment and all.
          label: "drop the person bio branch from the agent Markdown projection",
          find: `,
  // A person's body is their bio, under a different field name.
  _type == "\${SANITY_PERSON_DOCUMENT_TYPE}" => {
    "content": \${agentRichText("bio")},
  }`,
          with: "",
        },
      ],
    },
    { file: "src/env.d.ts", edits: [{ kind: "dropLines", contains: '"author-dialog": import(' }] },
    { file: "sanity/structure.tsx", edits: [{ kind: "dropCallInArray", anchor: "items", title: "Authors" }] },
    {
      file: "src/features/site/seo/structured-data.ts",
      edits: [
        { kind: "dropVariableStatement", name: "ProfilePageInput" },
        { kind: "dropVariableStatement", name: "PersonInput" },
        { kind: "dropVariableStatement", name: "profilePageLd" },
        { kind: "dropVariableStatement", name: "personLd" },
      ],
    },
    {
      file: "src/features/site/seo/structured-data.test.ts",
      edits: [
        { kind: "dropImport", id: "personLd" },
        { kind: "dropImport", id: "profilePageLd" },
        { kind: "dropCallStatement", fn: "test", titleContains: "profilePageLd" },
        { kind: "dropCallStatement", fn: "test", titleContains: "personLd" },
      ],
    },
  ],
  documentTypes: ["person"],
};

/** Legal pages: prose documents served by the same catch-all route as a page. */
const legalPages: Feature = {
  id: "legal-pages",
  since: FIRST_CUT,
  title: "Legal pages",
  summary: "The `legalPage` document type and the prose route that renders it.",
  paths: ["src/features/legal", "sanity/schemas/documents/legal-page.tsx"],
  edits: [
    {
      file: "sanity/schemas/index.ts",
      edits: [
        { kind: "dropImport", id: "legalPage" },
        { kind: "dropArrayElement", arrayName: "schemaTypes", id: "legalPage" },
      ],
    },
    {
      file: "sanity/constants.ts",
      edits: [
        { kind: "dropVariableStatement", name: "SANITY_LEGAL_PAGE_DOCUMENT_TYPE" },
        { kind: "dropVariableStatement", name: "SANITY_LEGAL_PATH_PREFIX" },
      ],
    },
    { file: "sanity/structure.tsx", edits: [{ kind: "dropCallInArray", anchor: "items", title: "Legal" }] },
    {
      file: "sanity/schemas/fields/create-link.tsx",
      edits: [{ kind: "dropObjectFromArray", anchor: "to", property: "type", value: "legalPage" }],
    },
    {
      file: "src/pages/sitemap.xml.ts",
      edits: [{ kind: "dropStringFromArray", anchor: "tags", value: "legalPage" }],
    },
    {
      file: "src/features/agents/query.ts",
      edits: [
        { kind: "dropImport", id: "SANITY_LEGAL_PAGE_DOCUMENT_TYPE" },
        {
          kind: "replaceText",
          label: "drop legalPage from the llms.txt inventory type list",
          find: `"\${SANITY_PAGE_DOCUMENT_TYPE}", "\${SANITY_LEGAL_PAGE_DOCUMENT_TYPE}"`,
          with: `"\${SANITY_PAGE_DOCUMENT_TYPE}"`,
        },
      ],
    },
    {
      file: "src/sanity/queries.ts",
      edits: [
        { kind: "dropImport", id: "SANITY_LEGAL_PAGE_DOCUMENT_TYPE" },
        {
          kind: "replaceText",
          label: "narrow the catch-all query to `page`",
          find: `_type in ["\${SANITY_PAGE_DOCUMENT_TYPE}", "\${SANITY_LEGAL_PAGE_DOCUMENT_TYPE}"]`,
          with: `_type == "\${SANITY_PAGE_DOCUMENT_TYPE}"`,
        },
        {
          kind: "replaceText",
          label: "drop the legal-page prose projection",
          find: `    _type == "\${SANITY_LEGAL_PAGE_DOCUMENT_TYPE}" => {
      "content": \${richText("content")},
    },
`,
          with: "",
        },
        {
          kind: "replaceText",
          label: "drop the two-type comment above the catch-all query",
          optional: true,
          find: `// Both catch-all types resolve here: \`page\` assembles a page builder, \`legalPage\` is prose in one field.
`,
          with: `// A document's URI is the only thing that decides where it is served.
`,
        },
      ],
    },
    {
      file: "src/pages/[...uri].astro",
      edits: [
        { kind: "dropImport", id: "LegalPage" },
        {
          kind: "replaceText",
          label: "render the page builder unconditionally",
          find: `{page._type === 'legalPage' ? <LegalPage page={page} /> : <PageSections docId={page._id} pageSections={pageSections} />}`,
          with: `<PageSections docId={page._id} pageSections={pageSections} />`,
        },
      ],
    },
  ],
  documentTypes: ["legalPage"],
  notes: ["Legal copy is often linked from the footer in the Site singleton; those links become dangling references."],
};

/**
 * The shared form layer: validation, spam prevention, and the controls a form is built from.
 *
 * Not the contact form, which is its own feature and is only the first thing to use this. Whether
 * this goes is a judgement about the forms a project plans to build, so it is a feature to pick
 * rather than something a contact form removal takes with it.
 */
const forms: Feature = {
  id: "forms",
  since: FIRST_CUT,
  title: "Form layer",
  summary: "Shared form validation, spam prevention, and the field components a form is built from.",
  mentions: ["form layer"],
  codeOnly: true,
  // One way only: a project can drop the contact form and keep the layer to build its own forms,
  // but the contact form is built out of this and cannot outlive it.
  implies: ["contact-form"],
  paths: [
    "src/features/forms",
    "src/features/spam-prevention",
    "src/components/Form",
    "src/components/SubmitButton.astro",
    "src/components/Spinner.astro",
  ],
  edits: [{ file: "src/env.d.ts", edits: [{ kind: "dropLines", contains: '"form-field": import(' }] }],
  docs: ["docs/features/forms.md", "docs/features/spam-prevention.md"],
  notes: ["`zod` stays: `astro.config.mjs` and the dataset scripts use it too, so it is not this feature's to uninstall."],
};

/** The contact form section, its submissions inbox and the Resend notification path. */
const contactForm: Feature = {
  id: "contact-form",
  since: FIRST_CUT,
  title: "Contact form",
  summary: "The contact form section, the submissions inbox, and the Resend notification emails.",
  mentions: ["contact form", "Resend"],
  implies: ["section:contact-form"],
  paths: ["sanity/schemas/documents/contact-form-submission.tsx", "src/pages/api/contact-form.ts"],
  edits: [
    {
      file: "sanity/schemas/index.ts",
      edits: [
        { kind: "dropImport", id: "contactFormSubmission" },
        { kind: "dropArrayElement", arrayName: "schemaTypes", id: "contactFormSubmission" },
      ],
    },
    {
      file: "sanity/constants.ts",
      edits: [{ kind: "dropObjectProperty", anchor: "API_ONLY_DOCUMENTS", key: "contactFormSubmission" }],
    },
    {
      file: "sanity/structure.tsx",
      edits: [
        { kind: "dropImport", id: "changeCase" },
        { kind: "dropImport", id: "API_ONLY_DOCUMENTS" },
        { kind: "dropCallInArray", anchor: "items", title: "Form Submissions" },
      ],
    },
    {
      file: "sanity/schemas/documents/site-settings.tsx",
      edits: [
        { kind: "dropFieldByName", anchor: "fields", name: "contactFormNotificationEmails" },
        { kind: "dropObjectFromArray", anchor: "groups", property: "name", value: "emailNotifications" },
      ],
    },
    {
      file: ".env.example",
      edits: [
        { kind: "dropLines", contains: "# Resend, for contact form notification emails", optional: true },
        { kind: "dropLines", contains: "RESEND_API_KEY=" },
        { kind: "dropLines", contains: "RESEND_EMAIL_FROM=" },
      ],
    },
    ...envEdits(["RESEND_API_KEY", "RESEND_EMAIL_FROM"]),
    { file: "src/env.d.ts", edits: [{ kind: "dropLines", contains: '"contact-form": import(' }] },
    { file: "README.md", edits: [{ kind: "dropLines", contains: "Contact form with honeypot", optional: true }] },
  ],
  dependencies: ["resend"],
  env: ["RESEND_API_KEY", "RESEND_EMAIL_FROM"],
  documentTypes: ["contactFormSubmission"],
  orphans: ["src/features/forms", "src/features/spam-prevention", "src/components/Form", "src/components/SubmitButton.astro"],
  docs: ["docs/features/contact-form-notifications.md"],
  notes: [
    "`features/forms/`, `features/spam-prevention/` and `components/form/` stay: they are the shared form layer rather than this feature. Nothing else uses them today, so the knip sweep lists them; whether they go is a judgement about the forms you plan to build, not about the contact form.",
  ],
};

/** One page-builder section. The preview registry globs each folder, so only the thumbnail manifest needs naming. */
function section(options: {
  id: string;
  name: string;
  title: string;
  summary: string;
  component: string;
  renderer: string;
  schema: string;
  since?: string;
  /** Features that cannot survive this section's removal, for a section something else reaches into. */
  implies?: string[];
  thumbnail?: string;
  extraPaths?: string[];
}): Feature {
  const {
    id,
    name,
    title,
    summary,
    component,
    renderer,
    schema,
    since = FIRST_CUT,
    implies,
    thumbnail,
    extraPaths = [],
  } = options;
  // Keyed by the thumbnail's own filename, so that path is the only source for it.
  const thumbnailKey = thumbnail
    ?.split("/")
    .pop()
    ?.replace(/\.jpg$/, "");

  return {
    id: `section:${id}`,
    title,
    summary,
    since,
    implies,
    paths: [renderer, schema, ...(thumbnail ? [thumbnail] : []), ...extraPaths],
    edits: [
      {
        file: "src/features/page-builder/PageSections.astro",
        edits: [
          { kind: "dropImport", id: component },
          { kind: "dropObjectProperty", anchor: "sections", key: `${name}Field` },
        ],
      },
      {
        file: "sanity/schemas/page-sections/index.ts",
        edits: [
          { kind: "dropImport", id: name },
          { kind: "dropArrayElement", arrayName: "sections", id: name },
        ],
      },
      // A section that does not photograph has no thumbnail and no line in the manifest.
      ...(thumbnailKey
        ? [
            {
              file: "public/page-builder-section-thumbs/manifest.json",
              // Generated: a project that has never run the capture simply has no such file.
              optional: true,
              edits: [{ kind: "dropJsonKey" as const, key: thumbnailKey }],
            },
          ]
        : []),
    ],
    sectionTypes: [`${name}Field`],
  };
}

const sections: Feature[] = [
  section({
    id: "media",
    name: "mediaSection",
    title: "Media section",
    summary: "The page-builder section that renders one image, video, Lottie or Rive asset.",
    component: "MediaSection",
    renderer: "src/features/page-builder/sections/MediaSection",
    schema: "sanity/schemas/page-sections/media-section.tsx",
    thumbnail: "public/page-builder-section-thumbs/media-section.jpg",
  }),
  section({
    id: "cta",
    name: "ctaSection",
    title: "CTA section",
    summary: "The page-builder section that renders a headline and a call-to-action link.",
    component: "CtaSection",
    renderer: "src/features/page-builder/sections/CtaSection",
    schema: "sanity/schemas/page-sections/cta-section.tsx",
    thumbnail: "public/page-builder-section-thumbs/cta-section.jpg",
  }),
  section({
    id: "text",
    name: "textSection",
    title: "Text section",
    summary: "The page-builder section that renders one rich text body.",
    component: "TextSection",
    renderer: "src/features/page-builder/sections/TextSection",
    schema: "sanity/schemas/page-sections/text-section.tsx",
    thumbnail: "public/page-builder-section-thumbs/text-section.jpg",
  }),
  section({
    id: "contact-form",
    name: "contactFormSection",
    title: "Contact form section",
    summary: "The page-builder section that renders the contact form itself.",
    // The endpoint imports the validator colocated here, so it cannot outlive the section.
    implies: ["contact-form"],
    component: "ContactFormSection",
    renderer: "src/features/page-builder/sections/ContactFormSection",
    schema: "sanity/schemas/page-sections/contact-form-section.tsx",
  }),
  section({
    id: "headline",
    name: "headlineSection",
    title: "Headline section",
    summary: "The page-builder section that holds one statement on a screen of its own.",
    component: "HeadlineSection",
    renderer: "src/features/page-builder/sections/HeadlineSection",
    schema: "sanity/schemas/page-sections/headline-section.tsx",
    since: "2026-09-09",
    thumbnail: "public/page-builder-section-thumbs/headline-section.jpg",
  }),
];

/**
 * Document types the starter itself is built on, which no trim removes. Plugin types need no entry:
 * `isSystemType` covers anything namespaced with a dot. A project's own types live in `project.json`.
 */
export const CORE_DOCUMENT_TYPES: readonly string[] = ["imageAltText", "page", "redirect", "site", "siteSettings"];

export const FEATURES: readonly Feature[] = [blog, authors, legalPages, forms, contactForm, ...sections];

/** Where sections live, and what tells one apart from a stray file beside it. */
export const SECTIONS_DIR = "src/features/page-builder/sections";
export const SECTION_FILE = /\.astro$/;
const SECTION_EXTENSION = ".astro";

/**
 * The shapes a path can take on disk. A section is a flat file until it grows a companion, so a
 * project cut from an older starter may hold the flat file where the manifest names the folder.
 */
export function shapesOf(path: string): string[] {
  const rest = path.startsWith(`${SECTIONS_DIR}/`) ? path.slice(SECTIONS_DIR.length + 1) : undefined;

  return rest && !rest.includes("/") && !SECTION_FILE.test(rest) ? [path, `${path}${SECTION_EXTENSION}`] : [path];
}

/** The shapes of `path` that exist: what to delete, and whether anything of it is left. */
export function onDisk(path: string, exists: (path: string) => boolean): string[] {
  return shapesOf(path).filter(exists);
}

/** The section names a feature owns: the first segment under the sections folder, flat or folder. */
export function sectionNamesOf(feature: Feature): string[] {
  return feature.paths
    .filter((path) => path.startsWith(`${SECTIONS_DIR}/`))
    .map((path) => (path.slice(SECTIONS_DIR.length + 1).split("/")[0] ?? "").replace(SECTION_FILE, ""));
}

export function findFeature(id: string): Feature | undefined {
  return FEATURES.find((feature) => feature.id === id);
}

/**
 * Whether a feature is still in this tree.
 *
 * A feature is gone once nothing it owns outright is left, which makes its manifest entry inert:
 * none of its anchors can resolve any more. `manifest.test.ts` uses this to stop asserting on a
 * feature that has actually been removed, and the dataset-only purge uses it in reverse, to work out
 * what was trimmed on an earlier run and might still be owed a cleanup.
 *
 * `exists` is injected so this stays pure and the callers keep the filesystem access.
 */
export function isFeaturePresent(feature: Feature, exists: (path: string) => boolean): boolean {
  return feature.paths.some((path) => onDisk(path, exists).length > 0);
}

/**
 * The shared registries this manifest is written around: the files more than one feature edits.
 *
 * They are the evidence that the manifest describes *this* repository. A feature's own files are
 * supposed to disappear, because that is what trimming does, but `sanity/schemas/index.ts` does not
 * vanish from a project that still has a schema. So when a landmark is missing, the tree has been
 * restructured rather than trimmed, and every conclusion drawn from `isFeaturePresent` is a guess.
 */
export function manifestLandmarks(): string[] {
  const counts = new Map<string, number>();

  for (const feature of FEATURES) {
    // A file the manifest tolerates being absent is evidence of nothing.
    const required = feature.edits.filter((entry) => !entry.optional).map((entry) => entry.file);

    for (const file of new Set(required)) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }

  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([file]) => file)
    .sort();
}

/**
 * The landmarks missing from this tree. Empty means the manifest still describes it.
 *
 * This is the difference between "the blog was trimmed" and "this is a different project that moved
 * its schema folder". Both look identical to a per-feature path check, and only one of them makes it
 * safe to infer that a feature's documents are stranded and should be offered up for deletion.
 */
export function findMissingLandmarks(exists: (path: string) => boolean): string[] {
  return manifestLandmarks().filter((file) => !exists(file));
}

/**
 * Selections the manifest can express but the starter cannot survive.
 *
 * Every edit in such a selection resolves perfectly on its own, so the anchor checking passes it: it
 * is the *combination* that is invalid. Without this the trim would apply cleanly and only fail at
 * the quality gates afterwards, leaving a broken tree behind, which is exactly the half-applied
 * outcome the rest of the design exists to prevent.
 */
export function findSelectionConflicts(features: Feature[], sectionsOnDisk: readonly string[]): string[] {
  const conflicts: string[] = [];
  const removed = new Set(features.flatMap(sectionNamesOf));
  const left = sectionsOnDisk.filter((name) => !removed.has(name));

  // The page builder is an enumeration with a non-empty contract: `sections` is what types
  // `SectionName`, so emptying it collapses that to `never` and takes `createPageBuilderField`, the
  // registry and the build with it.
  if (sectionsOnDisk.length > 0 && left.length === 0) {
    conflicts.push(
      "This removes every page-builder section, and the page builder needs at least one: an empty `sections` registry types `SectionName` as `never`, which breaks the Studio and the build. Keep one section, or remove the page builder itself (which the manifest does not model)."
    );
  }

  return conflicts;
}

/**
 * Closes `ids` over `implies`, so picking one half of a coupled pair always removes both. Returns
 * the selection in manifest order, plus the ids that were pulled in rather than chosen, so the flow
 * can say which ones it added and why.
 */
export function resolveSelection(ids: string[]): { features: Feature[]; implied: string[]; unknown: string[] } {
  const unknown = ids.filter((id) => !findFeature(id));
  const selected = new Set(ids.filter((id) => findFeature(id)));
  const implied = new Set<string>();
  const queue = [...selected];

  while (queue.length > 0) {
    const current = queue.shift();
    const feature = current ? findFeature(current) : undefined;

    for (const id of feature?.implies ?? []) {
      if (selected.has(id)) {
        continue;
      }

      selected.add(id);
      implied.add(id);
      queue.push(id);
    }
  }

  return {
    features: FEATURES.filter((feature) => selected.has(feature.id)),
    implied: [...implied],
    unknown,
  };
}
