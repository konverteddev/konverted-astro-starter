import { defineField } from "sanity";
import { createRichTextField } from "../fields/create-rich-text";

export const textSection = defineField({
  type: "object",
  name: "textSection",
  title: "Text",
  icon: () => <>📝</>,
  fields: [
    defineField({
      name: "headline",
      type: "string",
      title: "Headline",
      description: "Page-level heading rendered as the H1. Set it when this section opens the page (e.g. Privacy Policy).",
    }),
    createRichTextField({
      variant: "full",
      title: "Text",
      validation: (R) => R.required(),
    }),
  ],
  preview: {
    select: {
      title: "headline",
    },
    prepare({ title }) {
      return {
        title: title ?? "Text",
        subtitle: "Text",
      };
    },
  },
});
