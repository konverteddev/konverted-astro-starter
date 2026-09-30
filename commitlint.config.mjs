/**
 * Enforces the commit format in the `conventional-commits` skill; wired to the `commit-msg` hook.
 * Only the rules where this repo differs from `@commitlint/config-conventional` are restated below.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Keep subjects scannable in `git log --oneline`. The default allows 100.
    "header-max-length": [2, "always", 72],

    // `lower-case`, not `kebab-case`: that rejects a scope whose first word carries a digit (`a11y`, `i18n`, `oauth2`).
    "scope-case": [2, "always", "lower-case"],

    // Without the blank line git folds the body into the subject, so this is correctness, not style.
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};
