import { defineField } from "sanity";
import { createLinkField } from "../fields/create-link";
import { createRichTextField } from "../fields/create-rich-text";

export const ctaSection = defineField({
  type: "object",
  name: "ctaSection",
  title: "CTA Section",
  icon: () => <>🔗</>,
  fields: [
    defineField({
      name: "headline",
      type: "text",
      title: "Headline",
      rows: 2,
      validation: (R) => R.required(),
    }),
    createRichTextField({
      title: "Text",
      validation: (R) => R.required(),
    }),
    createLinkField({
      title: "Link",
      validation: (R) => R.required(),
    }),
  ],
  preview: {
    select: {
      headline: "headline",
    },
    prepare: ({ headline }) => {
      return {
        title: headline,
        subtitle: "CTA",
      };
    },
  },
});
