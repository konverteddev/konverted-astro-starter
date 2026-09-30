import { defineField } from "sanity";

export const headlineSection = defineField({
  type: "object",
  name: "headlineSection",
  title: "Headline",
  icon: () => <>🗣️</>,
  fields: [
    defineField({
      name: "headline",
      type: "text",
      // A text, not a string: the line break an editor types is copy, and the renderer keeps it.
      rows: 2,
      title: "Headline",
      description: "One statement, held on a screen of its own. Break the line where the phrase should turn.",
      validation: (R) => R.required(),
    }),
  ],
  preview: {
    select: {
      title: "headline",
    },
    prepare({ title }) {
      return {
        title: title ?? "Headline",
        subtitle: "Headline",
      };
    },
  },
});
