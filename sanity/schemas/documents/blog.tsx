import { defineField, defineType } from "sanity";
import { SANITY_BLOG_INDEX_URI } from "../../constants";
import { createAgentMarkdownField } from "../fields/create-agent-markdown-field";
import { createRichTextField } from "../fields/create-rich-text";
import { createSeoField } from "../fields/create-seo-field";
import { createUriField } from "../fields/create-uri-field";

/**
 * The blog index singleton: always its heading, intro and the full list, so no page builder.
 * Its URI is pinned to the articles route rather than authored.
 */
export const blog = defineType({
  __experimental_formPreviewTitle: false,
  name: "blog",
  type: "document",
  title: "Blog",
  icon: () => <>📰</>,
  groups: [
    { name: "page", title: "Page", icon: () => <>📄</>, default: true },
    { name: "content", title: "Content", icon: () => <>🍱</> },
    { name: "seo", title: "SEO", icon: () => <>🔍</> },
    { name: "agents", title: "Agents", icon: () => <>🤖</> },
  ],
  fields: [
    defineField({
      group: "page",
      name: "title",
      type: "string",
      title: "Title",
      description: "Navigation and breadcrumb label. The visible page heading is “Heading” in the Content tab.",
      initialValue: "Blog",
      validation: (R) => R.required(),
    }),
    createUriField({
      group: "page",
      source: "title",
      readOnly: true,
      initialPath: SANITY_BLOG_INDEX_URI,
      description: `Fixed at ${SANITY_BLOG_INDEX_URI}: articles slug under it, and every routed document with a URI is listed in the sitemap.`,
      validation: (R) => R.required(),
    }),
    defineField({
      group: "page",
      name: "passwordProtected",
      type: "boolean",
      title: "Password protect",
      description:
        "When “Protect entire site” is off, only this URL requires Basic Auth (same BASIC_AUTH_* env credentials as site-wide). When site-wide protection is on, this is redundant. Takes effect on Publish (not on save), within about five minutes.",
      initialValue: false,
      options: { layout: "switch" },
    }),
    defineField({
      group: "page",
      name: "showHeader",
      type: "boolean",
      title: "Show site header",
      description: "Renders the site header (navigation) on this page.",
      initialValue: true,
      options: { layout: "switch" },
    }),
    defineField({
      group: "page",
      name: "showFooter",
      type: "boolean",
      title: "Show site footer",
      description: "Renders the site footer on this page.",
      initialValue: true,
      options: { layout: "switch" },
    }),
    defineField({
      group: "content",
      name: "heading",
      type: "string",
      title: "Heading",
      description: "The H1 above the article list.",
      validation: (R) => R.required(),
    }),
    createRichTextField({
      group: "content",
      name: "intro",
      title: "Intro",
      description: "Copy shown under the heading, above the list. Every article is listed below it automatically, newest first.",
    }),
    createSeoField({
      group: "seo",
    }),
    createAgentMarkdownField({
      group: "agents",
    }),
  ],
  preview: {
    select: { title: "title", heading: "heading" },
    prepare({ title, heading }) {
      return {
        title: title ?? "Blog",
        subtitle: heading ?? SANITY_BLOG_INDEX_URI,
      };
    },
  },
});
