import { defineField } from "sanity";
import { SeoImageInput } from "../../inputs/seo-image-input";
import { isHomepageDocument } from "../../utils";

export function createSeoField({ group, name = "seoMetadata" }: { group?: string; name?: string } = {}) {
  return defineField({
    name,
    type: "object",
    title: "SEO Metadata",
    description: "Setup SEO meta data for this document.",
    group,
    options: {
      collapsed: false,
      collapsible: false,
    },
    fields: [
      defineField({
        name: "noIndex",
        type: "boolean",
        title: "No Index",
        description: "Prevent search engines from indexing this page.",
        initialValue: false,
        options: { layout: "switch" },
      }),
      defineField({
        name: "title",
        type: "string",
        title: "SEO Title",
        description: "The title of the page for search engines.",
        hidden: ({ document }) => isHomepageDocument(document),
      }),
      defineField({
        name: "description",
        type: "text",
        title: "Description",
        description: "A brief description of the page for search engines.",
        rows: 3,
        hidden: ({ document }) => isHomepageDocument(document),
      }),
      defineField({
        name: "sourceUrl",
        type: "url",
        title: "Source URL",
        description: "Live URL to screenshot for the share image. Required to use auto-generate.",
        hidden: ({ document }) => isHomepageDocument(document),
      }),
      defineField({
        name: "screenshotWaitSeconds",
        type: "number",
        title: "Screenshot wait (seconds)",
        description:
          "Extra time to wait after page load before capturing. Bump this for sites with intro animations or lazy content.",
        initialValue: 2,
        validation: (R) => R.min(0).max(10).integer(),
        hidden: ({ document }) => isHomepageDocument(document),
      }),
      defineField({
        name: "image",
        type: "image",
        title: "Image",
        description: "An image to represent the page for search engines.",
        options: {
          hotspot: true,
        },
        components: {
          input: SeoImageInput,
        },
        hidden: ({ document }) => isHomepageDocument(document),
      }),
    ],
  });
}
