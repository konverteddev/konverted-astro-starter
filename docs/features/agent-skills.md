# Agent Skills

This repository includes AI guidance to keep changes scoped and consistent.

## Main Entry Points

- **`AGENTS.md`** (repo root): workflow, project map, global conventions, and a **short index** of skills. Read this first.
- **`.agents/skills/<name>/SKILL.md`**: **full** instructions for that domain (rules, handoffs, checklists, Reference Files). Not redundant with `AGENTS.md`: the skill is the source of detail; `AGENTS.md` points you there.
- **`.mcp.json`** (repo root): project-scoped MCP servers agents can use at runtime (browser-driven testing, Astro docs). See [MCP Servers](./mcp-servers.md).

For substantive work, follow **Skill Preflight** in `AGENTS.md`, then open the matching skill file(s) under `.agents/skills/` before editing.

The current skill index lives in `AGENTS.md` (the **Skills** section) and is not duplicated here; the folders under `.agents/skills/` are the source of truth. The set covers, among others, the project's core domains (`astro`, `sanity`, `tailwind`, `custom-elements`, `server`), scaffolding (`scaffolding-plop`), removing a shipped feature from the code and the dataset (`trim-features`), the agent surfaces (`agent-markdown`), analytics (`umami-analytics`), motion (the `gsap-*` family), and process skills (`code-style`, `comments`, `docs-maintenance`).

## Standard `SKILL.md` shape

Each skill under `.agents/skills/<name>/SKILL.md` follows the same section order:

1. YAML frontmatter (`name`, `description`)
2. `# Title`
3. `## Core Rules`
4. `## Trigger Conditions`
5. `## Execution Checklist`
6. `## Scope Guidance` (handoffs, boundaries, optional tables)
7. `## Non-Goals`
8. `## Done Criteria`
9. `## Reference Files` (paths under `references/`, in-repo files, or external links; or a note if none)

Some skills add `## Detailed conventions` (for example `code-style`) after Reference Files when the body is long.

## Keeping everything in sync

### Order of truth

When something disagrees, follow this order: **current code** wins, then **`.agents/skills/*/SKILL.md`** (and `references/`), then **`AGENTS.md`** summaries, then **`docs/`** prose. Update downstream layers when you change upstream behavior or contracts.

### What goes where (avoid copy-paste drift)

| Layer                 | Keep it                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **`AGENTS.md`**       | Workflow (Skill Preflight, completion checklist), project map, a **few** global one-liners, and **one line per skill**, not full rules. |
| **`.agents/skills/`** | Everything agents need to **execute** in that domain: commands, boundaries, handoffs, Reference Files.                                  |
| **`docs/`**           | Human onboarding, feature explanations, contributor guides. Use the **`docs-maintenance`** skill's scope mapping when doc paths change. |

Do **not** paste long conventions into `AGENTS.md`; link to the skill instead. Do **not** duplicate full skill text in `docs/` unless a page is explicitly for humans (then summarize and link to `.agents/skills/...`).

### By kind of change

- **Product or code behavior changes**: update code first, then **`docs/`** where contributors or operators need to know (per **`docs-maintenance`**). If the change alters **how agents should work** (new command, new boundary), update the relevant **`SKILL.md`** and, if needed, the **one-line** entry in **`AGENTS.md`**.
- **Convention-only change** (style, comment policy): update **`code-style`**, **`comments`**, or the relevant **`SKILL.md`** first; adjust **`AGENTS.md`** only if a global convention bullet is now wrong.
- **New or renamed skill**: follow **[When adding or renaming a skill](#when-adding-or-renaming-a-skill)** so **`AGENTS.md`** and the new folder stay aligned.
- **Docs-only fix** (typos, clarity): edit **`docs/`** only; no skill change unless you are correcting **agent** instructions.

### Habits that help

- In PRs that touch behavior, add a line in the description: **"Docs: ..."** / **"Skills: ..."** / **"AGENTS: ..."** when applicable.
- When you notice **two places** saying the same thing and they diverge, **delete duplication**: keep detail in **`SKILL.md`**, keep **`AGENTS.md`** thin.

## When adding or renaming a skill

Update **both** of these in the same change so the index stays aligned:

- `.agents/skills/<name>/SKILL.md` (and `references/` when needed)
- `AGENTS.md`, the **Skills** section (short one-line summary per skill)

## Notes

- Use the skill matching the task domain
- For conflicts between docs and implementation, repository code is the source of truth
