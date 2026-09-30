import { defineField, defineType } from "sanity";

// Written only by the contact form endpoint; the fields mirror what that form asks. Editors read submissions here, never author them.
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
      name: "company",
      type: "string",
    }),
    defineField({
      name: "companySize",
      type: "string",
    }),
    defineField({
      name: "sellsOnMarketplaces",
      type: "boolean",
    }),
    defineField({
      name: "offersDigitalServices",
      type: "boolean",
    }),
    defineField({
      name: "marketingConsent",
      type: "boolean",
      description: "Whether the box to receive other communications was ticked at submit.",
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
