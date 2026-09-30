# Git Hooks

This project uses [Lefthook](https://github.com/evilmartians/lefthook) for Git hooks. Rules live in `lefthook.yml`.

## Pre-commit Behavior

Staged files are checked with Biome to enforce formatting and lint quality, and fixes are staged back. Staged `.ts`, `.tsx`, and `.astro` files also trigger `astro check`, which typechecks the project (`.astro` and `.ts` together) in one pass.

## Commit-msg Behavior

The commit message is checked against Conventional Commits by commitlint. Rules live in `commitlint.config.mjs`; the reasoning, plus the type and scope vocabulary in use, lives in the `conventional-commits` skill.

## Setup

Hooks are installed automatically during:

```bash
npm install
```
