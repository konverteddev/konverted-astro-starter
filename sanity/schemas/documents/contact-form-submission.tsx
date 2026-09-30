import { defineField, defineType } from "sanity";

// Written only by the contact form endpoint; the fields mirror what that form asks (one of every
// control type, as the worked form example). Editors read submissions here, never author them.
export const contactFormSubmission = defineType({
  __experimental_formPreviewTitle: false,
  name: "contactFormSubmission",
  type: "document",
  readOnly: true,
  icon: () => <>📧</>,
  fields: [
    defineField({
      name: "firstName",
      type: "string",
    }),
    defineField({
      name: "lastName",
      type: "string",
    }),
    defineField({
      name: "email",
      type: "string",
    }),
    defineField({
      name: "phone",
      type: "string",
      description: "Dial code and number, as submitted.",
    }),
    defineField({
      name: "topic",
      type: "string",
    }),
    defineField({
      name: "startDate",
      title: "Preferred start date",
      type: "string",
    }),
    defineField({
      name: "budget",
      type: "string",
    }),
    defineField({
      name: "services",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "message",
      type: "text",
      rows: 5,
    }),
    defineField({
      name: "consent",
      type: "boolean",
      description: "Whether the privacy policy box was ticked at submit.",
    }),
  ],
  preview: {
    select: {
      email: "email",
      createdAt: "_createdAt",
    },
    prepare: ({ email, createdAt }) => {
      return {
        title: email,
        subtitle: createdAt,
      };
    },
  },
});
