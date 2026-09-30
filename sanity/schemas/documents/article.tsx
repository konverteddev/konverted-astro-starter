import { defineArrayMember, defineField, defineType } from "sanity";
import { SANITY_BLOG_INDEX_URI } from "../../constants";
import { uniqueReferenceArray } from "../../utils";
import { createAgentMarkdownField } from "../fields/create-agent-markdown-field";
import { createRichTextField } from "../fields/create-rich-text";
import { createSeoField } from "../fields/create-seo-field";
import { createUriField } from "../fields/create-uri-field";

const uniqueCategories = uniqueReferenceArray({
  arrayKey: "categories",
  message: "Each category can only be selected once. Remove duplicate selections.",
});

export const article = defineType({
  __experimental_formPreviewTitle: false,
  name: "article",
  type: "document",
  title: "Article",
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
      validation: (R) => R.required(),
    }),
    createUriField({
      group: "page",
      source: "title",
      // Auto-slug under the blog index, whose own URI is pinned to the same constant.
      slugify: ({ slug }) => `${SANITY_BLOG_INDEX_URI}/${slug}`,
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
      name: "categories",
      type: "array",
      title: "Categories",
      description: "The categories of the article.",
      group: "content",
      of: [
        defineArrayMember({
          type: "reference",
          title: "Category",
          to: [{ type: "articleCategory", validation: (R) => R.required() }],
          options: { filter: uniqueCategories.filter },
        }),
      ],
      validation: (R) => uniqueCategories.validation(R),
    }),
    defineField({
      name: "publishedAt",
      type: "date",
      title: "Published At",
      validation: (R) => R.required(),
      group: "content",
    }),
    defineField({
      name: "author",
      type: "reference",
      title: "Author",
      description: "The byline. Opens as a panel over the article, and has a page of its own at its URI.",
      to: [{ type: "person" }],
      group: "content",
    }),
    defineField({
      name: "image",
      type: "image",
      title: "Image",
      options: {
        hotspot: true,
        collapsed: false,
        collapsible: false,
        accept: "image/*",
      },
      validation: (R) => R.required(),
      group: "content",
    }),
    // An article is prose, not an assembled page: one rich text body instead of a page builder.
    createRichTextField({
      group: "content",
      name: "content",
      title: "Content",
      variant: "full",
      description: "The article body. Reading time is computed from this automatically.",
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
    select: {
      title: "title",
      publishedAt: "publishedAt",
      author: "author.name",
      image: "image",
    },
    prepare({ title, publishedAt, author, image }) {
      return {
        title,
        subtitle: `${publishedAt} by ${author}`,
        media: image,
      };
    },
  },
});
