import { defineField } from "sanity";
import { AgentMarkdownInput } from "../../inputs/generate-text-input";

export function createAgentMarkdownField({ group }: { group?: string } = {}) {
  return defineField({
    name: "agentMarkdown",
    type: "object",
    title: "Agent Markdown",
    description:
      "A Markdown version of this page served to AI agents that request it (Accept: text/markdown). Draft it from the page's content with one click, then publish. It is served as-is and does not update on its own, so regenerate when the page changes.",
    group,
    options: {
      collapsed: false,
      collapsible: false,
    },
    fields: [
      defineField({
        name: "enabled",
        type: "boolean",
        title: "Serve Markdown to agents",
        description:
          "When on, the published Markdown below is served to AI agents that request this page with an Accept: text/markdown header. Turn off to keep this page HTML-only. Noindex and password-protected pages are never served as Markdown.",
        initialValue: true,
        options: { layout: "switch" },
      }),
      defineField({
        name: "content",
        type: "text",
        rows: 20,
        title: "Content",
        description:
          "Markdown served to agents. Click Generate to draft it from this page's current content, then edit and publish. Nothing is served until you publish, and it does not refresh on its own, so regenerate after you change the page.",
        components: { input: AgentMarkdownInput },
      }),
    ],
  });
}
