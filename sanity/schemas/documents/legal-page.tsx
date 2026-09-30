import { defineField, defineType } from "sanity";
import { SANITY_LEGAL_PATH_PREFIX } from "../../constants";
import { createAgentMarkdownField } from "../fields/create-agent-markdown-field";
import { createRichTextField } from "../fields/create-rich-text";
import { createSeoField } from "../fields/create-seo-field";
import { createUriField } from "../fields/create-uri-field";

/**
 * A policy document, served by the same catch-all as `page` and resolved by URI alone.
 * Prose rather than an assembled page: one rich text body, no page builder.
 */
export const legalPage = defineType({
  __experimental_formPreviewTitle: false,
  name: "legalPage",
  type: "document",
  title: "Legal Page",
  icon: () => <>⚖️</>,
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
      description: "The page heading, and the label a link to this page infers.",
      validation: (R) => R.required(),
    }),
    createUriField({
      group: "page",
      source: "title",
      // Auto-slug under `/legal`, then editable: the catch-all serves whatever URI is set, so the prefix is a default.
      slugify: ({ slug }) => `${SANITY_LEGAL_PATH_PREFIX}/${slug}`,
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
    createRichTextField({
      group: "content",
      name: "content",
      title: "Content",
      variant: "full",
      description: "The policy body.",
      validation: (R) => R.required(),
    }),
    createSeoField({
      group: "seo",
    }),
    createAgentMarkdownField({
      group: "agents",
    }),
  ],
  preview: {
    select: { title: "title", uri: "uri.current" },
    prepare({ title, uri }) {
      return { title, subtitle: uri };
    },
  },
});
