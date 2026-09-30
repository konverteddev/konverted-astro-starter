import { defineArrayMember, defineField, defineType } from "sanity";
import { AltTextInput } from "../../inputs/alt-text-input";
import { LlmsTxtInput } from "../../inputs/generate-text-input";
import { RedirectsDeployInput } from "../../inputs/redeploy-input";

/**
 * Configuration rather than copy: how the site is served, set once and rarely revisited.
 * Its counterpart is `site`, which holds what gets written and rewritten.
 */
export const siteSettings = defineType({
  __experimental_formPreviewTitle: false,
  name: "siteSettings",
  type: "document",
  title: "Settings",
  icon: () => <>⚙️</>,
  groups: [
    { name: "general", title: "General", icon: () => <>⚙️</>, default: true },
    { name: "security", title: "Security", icon: () => <>🔐</> },
    { name: "agents", title: "Agents", icon: () => <>🤖</> },
    { name: "emailNotifications", title: "Email Notifications", icon: () => <>✉️</> },
  ],
  fields: [
    defineField({
      group: "general",
      name: "redirects",
      type: "array",
      title: "Redirects",
      description:
        "Define site-wide redirects here. For security and performance they are applied at build time, so publish your changes and then use the Redeploy button below to make them live.",
      of: [{ type: "redirect" }],
      components: { input: RedirectsDeployInput },
      // Redirects must have unique `from` values.
      validation: (R) => {
        return R.custom((redirects) => {
          if (!redirects) {
            return true;
          }

          const seen = new Set();
          for (const item of redirects) {
            // @ts-expect-error The prop is part of the redirect schema.
            const from = item?.from;

            if (!from) {
              continue;
            }

            if (seen.has(from)) {
              return `Duplicate redirect detected for "${from}".`;
            }

            seen.add(from);
          }

          return true;
        });
      },
    }),
    defineField({
      group: "general",
      name: "favicon",
      type: "object",
      title: "Favicon",
      description:
        "Tab icons per system color scheme. Each image is cropped to a square when served. Upload one asset to use everywhere, or two when you need different art for light vs dark browser chrome.",
      fields: [
        defineField({
          name: "iconLight",
          type: "image",
          title: "Light scheme",
          description:
            "Used when the system prefers light mode (or as the only icon if dark is empty). Non-square images are cropped to a centered square.",
          options: {
            hotspot: false,
          },
        }),
        defineField({
          name: "iconDark",
          type: "image",
          title: "Dark scheme",
          description:
            "Used when the system prefers dark mode (optional if one icon works in both). Non-square images are cropped to a centered square.",
          options: {
            hotspot: false,
          },
        }),
      ],
    }),
    defineField({
      group: "security",
      name: "basicAuth",
      type: "object",
      title: "HTTP Basic Auth",
      description:
        "Toggles only. Set BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD in your deployment environment (not in the CMS).",
      fields: [
        defineField({
          name: "siteWideEnabled",
          type: "boolean",
          title: "Protect entire site",
          description:
            "When enabled, every page (except Studio and API routes) requires Basic Auth using env credentials. When off, only individual pages or articles with “Password protect” are gated. Takes effect on Publish (not on save), within about five minutes.",
          initialValue: false,
          options: { layout: "switch" },
        }),
      ],
    }),
    // Each machine-readable surface is its own object, so `mcp` or `agentsTxt` can be added without reshaping this one.
    defineField({
      group: "agents",
      name: "llms",
      type: "object",
      title: "llms.txt",
      description:
        "Configures the /llms.txt file (format: llmstxt.org): a curated map of this site for AI assistants. Draft it with Sanity AI from your content, then publish to serve it.",
      fields: [
        defineField({
          name: "enabled",
          type: "boolean",
          title: "Serve /llms.txt",
          description: "When on, the published content below is served at /llms.txt. Turn off to return 404 there.",
          initialValue: true,
          options: { layout: "switch" },
        }),
        defineField({
          name: "guidance",
          type: "text",
          rows: 3,
          title: "Generation guidance",
          description:
            "Optional. Steer the AI when generating: tone, audience, what to emphasize or leave out. Leave empty for a neutral summary.",
        }),
        defineField({
          name: "content",
          type: "text",
          rows: 18,
          title: "Content",
          description:
            "Markdown served at /llms.txt. Click Generate to draft it with Sanity AI from your site content, then edit and publish.",
          components: { input: LlmsTxtInput },
        }),
      ],
    }),
    defineField({
      group: "agents",
      name: "altText",
      type: "object",
      title: "Automatic alt text",
      description:
        "Describes uploaded images with Sanity AI and stores the result as the asset's alternative text, which is what every document using that image renders. Editors can always rewrite it in the media browser.",
      components: { input: AltTextInput },
      fields: [
        defineField({
          name: "enabled",
          type: "boolean",
          title: "Describe new uploads",
          description:
            "When on, an image uploaded without alternative text is described automatically. Off by default: each description spends AI credits. Backfill below works either way.",
          initialValue: false,
          options: { layout: "switch" },
        }),
        defineField({
          name: "guidance",
          type: "text",
          rows: 3,
          title: "Description guidance",
          description:
            "Optional. Steer the AI: vocabulary to prefer, how much detail to give, what to leave out. Overrides the built-in style rules. Leave empty for the default concise style.",
        }),
      ],
      options: {
        collapsed: false,
        collapsible: false,
      },
    }),
    defineField({
      group: "emailNotifications",
      name: "contactFormNotificationEmails",
      type: "array",
      title: "Contact Form Notifications",
      description: "Emails to notify when the contact form is submitted.",
      of: [
        defineArrayMember({
          type: "string",
          validation: (R) => R.required().email(),
        }),
      ],
    }),
  ],
});
