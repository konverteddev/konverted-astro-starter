import { defineField } from "sanity";
import { createRichTextField } from "../fields/create-rich-text";

export const contactFormSection = defineField({
  type: "object",
  name: "contactFormSection",
  title: "Contact Form",
  icon: () => <>📧</>,
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
      variant: "simple",
    }),
  ],
  preview: {
    select: {
      headline: "headline",
    },
    prepare({ headline }) {
      return {
        title: headline,
        subtitle: "Contact Form",
      };
    },
  },
});
