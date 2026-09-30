---
name: agent-markdown
description: Use when adding or changing a page-builder section (or its sectionContent fields), or editing the agent-Markdown serializer/query, to keep the Markdown served to AI agents (content negotiation) in sync with the content model. Do NOT use for unrelated runtime UI or non-section schema work.
---

# Agent Markdown

Public pages and articles serve a Markdown version to AI agents via content negotiation (see `docs/features/agent-markdown.md`). The Markdown is a **stored, editable field** (`agentMarkdown.content`, in the document's **Agents** tab via `createAgentMarkdownField`): an editor clicks **Generate** to run the serializer and write the result into the field, and the serve route returns that stored field verbatim (it no longer serializes per request). The serializer is **section-agnostic by convention**, but a section with bespoke content fields can drift out of the Markdown silently. Because generation is stored, a serializer change reaches agents only after each affected page is **regenerated and published**.

## Core Rules

- The **default** renderers read only the guaranteed page-builder factory fields: `appRichText` (`createRichTextField`), `appMedia` (`createMediaField`), and `appLink` (`createLinkField`). `headline` and `caption` are this template's plain (non-factory) section fields, handled in the PROJECT block layered on top of those defaults.
- A section with a **bespoke content field** (a custom name such as `quote`, `stats`, or an `images[]` array) is invisible to agents until you add it to **both** seams: the projection `AgentMarkdownSectionContentFragment` (`src/features/agents/query.ts`) and the ordered `sectionRenderers` list (`src/features/agents/markdown.ts`).
- Renaming a field away from the factory default (e.g. off `appRichText`) silently drops it from the Markdown. Prefer the defaults.
- Non-image media (video, Lottie, Rive) is not serialized today; only its `caption` carries over.

## Trigger Conditions

Adding or renaming a page-builder section or its `sectionContent` fields; or editing `src/features/agents/markdown.ts` or the `AgentMarkdownSectionContentFragment` / `AgentMarkdownRichTextFragment` in `src/features/agents/query.ts`.

## Execution Checklist

1. List the new or changed section's `sectionContent` field names.
2. If the section uses only the factory fields (`appRichText` / `appMedia` / `appLink`) plus this template's `headline` / `caption`, there is nothing to do; those already serialize.
3. For each bespoke field that should reach agents: add an alias to `AgentMarkdownSectionContentFragment` and a renderer in the PROJECT block of `sectionRenderers` (sections are read as a loose bag of aliases, so there is no type to maintain).
4. Run `npm run sanity:typegen`, then `npm run check`.

## Scope Guidance

- Handed off to from **scaffolding-plop** (new section) and **sanity** (section field changes).
- Pair with **sanity** for the GROQ projection and **seo-aeo-best-practices** for what agents should be shown.

## Non-Goals

- The HTML rendering of sections (that is **astro**).
- llms.txt, the site-wide index (see `docs/features/llms-txt.md`).

## Done Criteria

- Every `sectionContent` field that should reach agents is projected and rendered, or intentionally left out.
- `npm run sanity:typegen` and `npm run check` pass.

## Reference Files

- `docs/features/agent-markdown.md`: feature overview, caching, and the serialization contract.
- `src/features/feed/html.ts`: the RSS feed's HTML serializer reads the same `frag::agentRichText` projection, so a rich text block added there needs a renderer in both (see `docs/features/rss-feed.md`).
- `src/features/agents/markdown.ts` (the serializer) and `src/features/agents/query.ts` (`AgentMarkdownSectionContentFragment`, `AgentMarkdownContentQuery`).
