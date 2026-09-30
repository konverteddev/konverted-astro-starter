import { defineField, defineType } from "sanity";
import { isHomepageDocument } from "../../utils";
import { createAgentMarkdownField } from "../fields/create-agent-markdown-field";
import { createPageBuilderField } from "../fields/create-page-builder";
import { createSeoField } from "../fields/create-seo-field";
import { createUriField } from "../fields/create-uri-field";

export const page = defineType({
  __experimental_formPreviewTitle: false,
  name: "page",
  type: "document",
  title: "Page",
  icon: () => <>📄</>,
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
      hidden: ({ parent }) => isHomepageDocument(parent),
      validation: (R) =>
        R.custom((value, context) => {
          if (isHomepageDocument(context.document)) {
            return true;
          }

          return typeof value === "string" && value.length > 0 ? true : "Required";
        }),
    }),
    createUriField({
      group: "page",
      source: "title",
      readOnly: ({ parent }) => isHomepageDocument(parent),
      validation: (R) => [
        R.required(),
        R.custom((value: { current?: string } | undefined, context) => {
          if (!isHomepageDocument(context.document)) {
            return true;
          }

          if (value?.current === "/") {
            return true;
          }

          return 'The homepage URI must be "/".';
        }),
      ],
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
    createPageBuilderField({
      group: "content",
    }),
    createSeoField({
      group: "seo",
    }),
    createAgentMarkdownField({
      group: "agents",
    }),
  ],
});
