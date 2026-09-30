---
name: conventional-commits
description: Commit message format for this repo: Conventional Commits (`type(scope): subject`), the type and scope vocabulary the history already uses, imperative lowercase subjects under 72 characters, and bodies that explain why. Covers the one failure mode that breaks it (a large multi-concern change dropping the prefix) and PR titles, which become the subject on a squash merge. Enforced by a `commit-msg` hook running commitlint against `commitlint.config.mjs`. Use before writing or amending any commit message, and before opening or retitling a PR.
---

# Conventional commits

Every commit subject is `type(scope): summary`. This is not a new rule: 44 of the 52 commits in this
history already have that shape. It is written down here because the eight that do not are recent,
and an unwritten convention drifts.

The shape is now enforced: a `commit-msg` hook runs commitlint and rejects a message that does not
fit. This skill covers both that, and the parts of a good message no hook can judge.

## Core Rules

- The subject is `type(scope): summary`. Lowercase type, scope in parentheses, colon, one space, then a lowercase imperative summary with no trailing period.
- Imperative mood, phrased as an instruction to the codebase: `add`, `drop`, `move`, `correct`, `pin`. Never `added`, `adds`, or `fixing`.
- One line, at most 72 characters, enforced (the median here is 58). Everything else goes in the body.
- Types in use: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`. The rest of the standard set (`test`, `build`, `ci`, `style`, `revert`) is available but unused so far. Do not invent types.
- The scope names the area and must match what the repo calls it, with one canonical spelling per area. Lowercase is enforced; the choice of word is not. Check the log before coining a variant of a scope that already exists.
- Scope is optional in the spec but preferred here. Omit it only when a change genuinely spans the whole repo (`chore: update deps`).
- **A large or cross-cutting change is not an exemption.** Pick the dominant type, or split the commit. Every non-conventional subject in this history is a big change that dropped the prefix rather than choosing one.
- PR titles follow the same format. A squash merge turns the PR title into the commit subject, trailing `(#10)` and all.
- The body explains why the change was needed and what it implies, after one blank line (enforced). Wrap prose at 80; the enforced hard limit is 100 so a long URL cannot block a commit. A body is not optional for anything non-trivial: this repo has a strong body culture and it is worth keeping.
- Breaking change: `!` before the colon (`feat(sanity)!: ...`) plus a `BREAKING CHANGE:` footer describing the migration.
- Never add tool or model attribution to a message: no `Co-Authored-By` for an assistant, no generated-with footer, no mention of the model in subject or body.

## Trigger Conditions

Apply before writing a commit message, amending one, rewording during a rebase, or opening or
retitling a pull request. Also before squashing, since the squash subject is what survives.

## Execution Checklist

1. Choose the type from what the change does, not from how large it is: new capability (`feat`), wrong behavior corrected (`fix`), no behavior change (`refactor`), speed (`perf`), docs or skills (`docs`), tooling, deps, or config (`chore`).
2. Choose the scope from the area touched, reusing a spelling already in the log: `git log --format='%s' | grep -oE '^[a-z]+\([a-z0-9.-]+\)' | sort -u`.
3. Write the summary imperative and lowercase, under 72 characters.
4. Write a body explaining why, wrapped at 80, unless the change is genuinely self-evident.
5. If the change covers two unrelated concerns, split it rather than reaching for a vaguer type.
6. Commit. The hook rejects a malformed message with the failing rule named, so read what it says rather than reaching for `--no-verify`.

## Scope Guidance

- This skill owns commit subjects, commit bodies, and PR titles.
- Keeping documentation in step with the change you are committing: **docs-maintenance**.
- It does not own branch naming, and it does not feed a release tool. This repo carries no versioning or tagging automation, so the format is for a readable history, not for computing a version.

## Non-Goals

- Inventing a type or scope outside the vocabulary already in the log.
- Dropping the prefix because a change felt too large to label.
- Packing the explanation into the subject instead of writing a body.
- Attribution trailers for tools or models.
- Reaching for `--no-verify` when the hook rejects a message.

## Done Criteria

- Subject matches `type(scope): summary`: lowercase, imperative, no trailing period, under ~72 characters.
- Type and scope both come from the vocabulary in use.
- Anything non-trivial carries a body explaining why, prose wrapped at 80.
- A PR that will be squash-merged has a title in the same format.

## Reference Files

- `git log --format='%s'`: the live vocabulary, and the fastest way to confirm an existing scope spelling before inventing one.
- `commitlint.config.mjs`: the enforced rules. It restates only what differs from `@commitlint/config-conventional`, so read that preset alongside it.
- `lefthook.yml`: `pre-commit` (Biome on staged files, `astro check`) and `commit-msg` (commitlint). Adding a hook type needs `npx lefthook install` to write `.git/hooks/commit-msg`.
- <https://www.conventionalcommits.org/en/v1.0.0/>: the upstream spec.

## Detailed conventions

### What the hook enforces

The `commit-msg` hook runs commitlint against `commitlint.config.mjs`. A message that fails is
rejected before the commit is created.

| Rule | Effect |
| --- | --- |
| `type-enum` | One of the eleven standard types. An invented type is rejected. |
| `type-case`, `type-empty` | A type must be present and lowercase. |
| `scope-case` | Scope lowercase. `page-builder`, `a11y` and `i18n` pass; `IDE` and `pageBuilder` do not. |
| `subject-empty` | A summary must follow the colon. |
| `subject-case` | The summary may not start sentence-case, start-case, PascalCase, or UPPER. |
| `subject-full-stop` | No trailing period. |
| `header-max-length` | 72 characters, counting `type(scope): `. |
| `body-leading-blank`, `footer-leading-blank` | A blank line before the body and before footers, or git folds them into the subject. |
| `body-max-line-length`, `footer-max-line-length` | 100 characters per line. |

Only the rules where this repo differs from `@commitlint/config-conventional` are written in the
config. The rest are that preset's defaults, so read the preset before assuming a rule is missing.

### What the hook cannot check

The hook checks shape. Everything that makes a message useful is still on you:

- **Imperative mood.** No rule distinguishes `add` from `added`.
- **The correct type.** `refactor` on a change that altered behavior passes the hook and is still wrong.
- **A body that explains why.** The hook measures line length, not whether the reasoning is there.
- **Wrapping prose at 80.** The enforced limit is 100 so that a long URL or a pasted line cannot block a commit. 80 stays the convention for prose.

`--no-verify` is not a fix. A message that will not fit the format usually belongs to a commit that
is doing two things.

### Choosing the type

| Type | Use when | From this history |
| --- | --- | --- |
| `feat` | The product gains a capability | `feat(forms): validate the contact form fields client-side` |
| `fix` | Behavior was wrong and now is not | `fix(dev): scan src for deps so the Studio stops 504ing on re-optimize` |
| `refactor` | Structure changed, behavior did not | `refactor(icons): scope the icon set into a component folder` |
| `perf` | The point of the change is speed | `perf(forms): load the validation schema on demand` |
| `docs` | Documentation, README, or a skill | `docs(skills): add the dev-server skill` |
| `chore` | Deps, scripts, config, tooling | `chore(deps): update lenis to 1.3.26` |

`refactor` vs `perf` is decided by intent: if the change would still be worth making with no speed
win, it is a `refactor`.

### Scopes in use

Recurring: `seo`, `scroll`, `forms`, `skills`, `sanity`, `page-builder`, `env`, `deps`, `cache`.
Also seen once each: `shell`, `seed`, `scripts`, `icons`, `hooks`, `dev`, `deploy`, `build`, `blog`,
`auth`, `agents`, `a11y`, `license`.

A scope is an area of the product, usually a folder under `src/features/` or `src/pages/`, or a
tooling area (`deps`, `scripts`, `hooks`, `skills`). Prefer an existing one over a precise new one.

### The failure mode

Every non-conventional subject in this history is a big change:

```
Split site-wide settings into their own singleton
Add shell measurement tokens for header, page width and gutter
```

The size is exactly why they needed a type. The last one touches the token layer and rewrites its
consumers with no behavior change, and `shell` is already the scope this repo uses for the page's
outer chrome, so it should have been:

```
refactor(shell): read layout measurements from shared tokens
```

When a change really does resist one label, that is a signal it should have been two commits.
