import { defineField, defineType } from "sanity";

/**
 * Scratch type for the alt text agent: Transform is schema-aware and cannot target the system `sanity.imageAsset`.
 * Generated here with `noWrite`, read off the response, and patched onto the asset by the route.
 */
export const imageAltText = defineType({
  name: "imageAltText",
  type: "document",
  title: "Image alt text (internal)",
  icon: () => <>♿</>,
  fields: [
    defineField({
      name: "altText",
      type: "string",
      title: "Alternative text",
      description: "Generation target only. The value is returned to the caller, never written here.",
    }),
  ],
});
