---
name: seo-aeo-best-practices
description: SEO and AEO best practices for metadata, Open Graph, sitemaps, robots.txt, hreflang, JSON-LD structured data, EEAT, and content optimized for search engines and AI answer surfaces. Use this skill when implementing page SEO, technical SEO, schema markup, international SEO, AI-overview readiness, or improving content for Google, ChatGPT, Perplexity, and similar assistants.
---

# SEO & AEO Best Practices

Principles for optimizing content for both traditional search engines (SEO) and AI-powered answer engines (AEO). Includes Google's EEAT guidelines and structured data implementation.

## When to Apply

Reference these guidelines when:

- Implementing metadata and Open Graph tags
- Creating sitemaps and robots.txt
- Adding JSON-LD structured data
- Optimizing content for featured snippets
- Preparing content for AI assistants (ChatGPT, Perplexity, etc.)
- Evaluating content quality using EEAT principles

## Scope in this repository

- **sanity** — SEO fields, GROQ projections, and Studio copy for titles/descriptions; this skill defines **what** to aim for in search/AEO surfaces.
- **astro**: head/meta tags, layout defaults, JSON-LD in routes (see `src/sanity/seo.ts`); pair when implementing metadata and markup.
- **docs-maintenance** — Update `docs/` when SEO behavior, env vars, or sitemap/robots routes change.
- **modern-web-guidance**: overlap on heading hierarchy and landmarks (its `accessibility` guide) for both SEO and a11y.

Also listed in root **`AGENTS.md`** and **`docs/features/agent-skills.md`**.

## Core Concepts

### SEO (Search Engine Optimization)

Optimizing content to rank well in traditional search results (Google, Bing).

### AEO (Answer Engine Optimization)

Optimizing content to be selected as authoritative answers by AI systems.

### EEAT (Experience, Expertise, Authoritativeness, Trustworthiness)

Google's framework for evaluating content quality.

## References

Start with the one reference that matches the task, such as technical SEO, structured data, EEAT, or AI-answer readiness. See `references/` for detailed guidance:

- `references/eeat-principles.md` — EEAT implementation and author schema
- `references/structured-data.md` — JSON-LD patterns (Article, FAQ, Breadcrumb, Product)
- `references/technical-seo.md` — Technical SEO checklist (metadata, sitemaps, hreflang, robots.txt)
- `references/aeo-considerations.md` — AI/AEO considerations (AI Overviews, crawler management)
