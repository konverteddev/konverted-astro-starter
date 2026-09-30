import { defineCliConfig } from "sanity/cli";
import { sanityConfig } from "./sanity/config";

export default defineCliConfig({
  api: {
    projectId: sanityConfig.projectId,
    dataset: sanityConfig.dataset,
  },
  typegen: {
    // Page .astro files excluded: frontmatter's top-level `return` trips typegen's TS parser,
    // and no queries are defined there (they live in src/sanity, src/features, and src/pages/api).
    path: ["./src/**/*.{ts,tsx,astro}", "!./src/pages/**/*.astro", "./sanity/**/*.{ts,tsx}", "./sanity.config.ts"],
    schema: "./sanity-schema.json",
    // Committed so the starter typechecks before the first `npm run sanity:typegen` run.
    generates: "./sanity/types.ts",
    overloadClientMethods: false,
  },
});
