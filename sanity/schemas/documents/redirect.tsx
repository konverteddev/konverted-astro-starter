import { defineField, defineType, type StringRule } from "sanity";

const redirectStatus = {
  301: "301 (Permanent)",
  302: "302 (Temporary)",
};

function redirectPathValidation(otherField: "from" | "to") {
  return (R: StringRule) => {
    return R.required().custom((value: string | undefined, { parent }) => {
      if (!value) {
        return true;
      }

      if (!value.startsWith("/")) {
        return 'Path must start with a "/" (e.g., "/about").';
      }

      if (value === (parent as { from?: string; to?: string } | undefined)?.[otherField]) {
        return 'The "From" and "To" paths cannot be the same.';
      }

      return true;
    });
  };
}

export const redirect = defineType({
  __experimental_formPreviewTitle: false,
  name: "redirect",
  type: "document",
  title: "Redirect",
  icon: () => <>⤮</>,
  fields: [
    defineField({
      name: "from",
      type: "string",
      title: "From",
      description: 'The original path (e.g., "/old-page").',
      validation: redirectPathValidation("to"),
    }),
    defineField({
      name: "to",
      type: "string",
      title: "To",
      description: 'The destination path (e.g., "/new-page").',
      validation: redirectPathValidation("from"),
    }),
    defineField({
      name: "statusCode",
      type: "number",
      title: "Kind",
      validation: (R) => R.required(),
      initialValue: 301,
      options: {
        list: Object.entries(redirectStatus).map(([value, title]) => ({
          title,
          value: Number(value),
        })),
      },
    }),
  ],
  preview: {
    select: {
      to: "to",
      from: "from",
      statusCode: "statusCode",
    },
    prepare: ({ from, to, statusCode }) => {
      return {
        title: `${from} -> ${to}`,
        subtitle: redirectStatus[statusCode as keyof typeof redirectStatus],
      };
    },
  },
});
