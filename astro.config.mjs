import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import sanity from "@sanity/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";
import { loadEnv } from "vite";
import { isFirstPartyOnly } from "./scripts/build/first-party-only.mjs";

const {
  PUBLIC_SITE_URL,
  PUBLIC_SANITY_PROJECT_ID,
  PUBLIC_SANITY_DATASET,
  PUBLIC_SANITY_API_VERSION,
  PUBLIC_SANITY_STUDIO_BASE_PATH,
  // Server-only secret (no PUBLIC_ prefix, so Astro never ships it to the browser).
  // Read/preview token; required for draft-mode live preview and authenticated reads.
  SANITY_API_VIEW_TOKEN,
} = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");

// Public route the embedded Studio mounts at; shared by the integration and robots.
const studioBasePath = PUBLIC_SANITY_STUDIO_BASE_PATH || "/studio";

// Normalized, not rejected: a trailing slash is a typo, not a reason to fail a deploy. The warning is so it gets fixed.
const siteUrl = PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

if (PUBLIC_SITE_URL && siteUrl !== PUBLIC_SITE_URL.trim()) {
  console.warn(`[astro.config] PUBLIC_SITE_URL has a trailing slash; using "${siteUrl}". Drop the slash in your env.`);
}

// A compile-time constant rather than a host deployment id: what makes cached HTML stale is the code changing.
const buildId = `build_${Date.now().toString(36)}`;

// Baked in at config load. Fail-soft: a clone with no env builds with no redirects instead of crashing.
async function fetchRedirects() {
  if (!PUBLIC_SANITY_PROJECT_ID || !PUBLIC_SANITY_DATASET) {
    return {};
  }
  // Redirects are site-wide configuration, so they live on the `siteSettings` document.
  const query = `*[_type == "siteSettings"][0].redirects[defined(coalesce(from, @->from)) && defined(coalesce(to, @->to))]{
    "from": coalesce(from, @->from),
    "to": coalesce(to, @->to),
    "statusCode": coalesce(statusCode, @->statusCode, 301)
  }`;
  const apiVersion = PUBLIC_SANITY_API_VERSION || "2025-02-19";
  const url = new URL(`https://${PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v${apiVersion}/data/query/${PUBLIC_SANITY_DATASET}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  try {
    const res = await fetch(url, {
      headers: SANITY_API_VIEW_TOKEN ? { Authorization: `Bearer ${SANITY_API_VIEW_TOKEN}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {};
    }
    const { result } = await res.json();
    return Object.fromEntries(
      (result ?? []).map(({ from, to, statusCode }) => [from, { destination: to, status: statusCode === 302 ? 302 : 301 }])
    );
  } catch {
    console.warn("[astro.config] Could not fetch redirects from Sanity; building without them.");
    return {};
  }
}

// https://astro.build/config
export default defineConfig({
  // Canonical deployed URL (from PUBLIC_SITE_URL); exposed to components at build time as `Astro.site`.
  site: siteUrl,
  // Always SSR: draft mode reads the Presentation cookie, the Studio is embedded, and `/api/*` plus middleware are live.
  output: "server",
  adapter: vercel(),
  // The cache lives entirely in the app and never reaches a host CDN, so the revalidate webhook can reach every copy.
  cache: {
    provider: {
      name: "route-cache",
      entrypoint: new URL("./src/lib/route-cache/provider.ts", import.meta.url),
    },
  },
  redirects: await fetchRedirects(),
  devToolbar: { enabled: false },
  // Secrets come only from `astro:env/server`, so importing one in client code is a build error and can never leak.
  env: {
    schema: {
      // `url: true` fails the build on a non-absolute URL; a trailing slash is not an error, `src/lib/env.ts` strips it.
      PUBLIC_SITE_URL: envField.string({ context: "client", access: "public", url: true }),
      PUBLIC_SANITY_PROJECT_ID: envField.string({ context: "client", access: "public" }),
      PUBLIC_SANITY_DATASET: envField.string({ context: "client", access: "public" }),
      PUBLIC_SANITY_API_VERSION: envField.string({ context: "client", access: "public", default: "2025-02-19" }),
      PUBLIC_SANITY_STUDIO_BASE_PATH: envField.string({ context: "client", access: "public", default: "/studio" }),
      // Umami analytics website id; tracking is disabled when unset.
      PUBLIC_UMAMI_WEBSITE_ID: envField.string({ context: "client", access: "public", optional: true, default: "" }),

      // Required secrets fail the build; the rest stay optional and their features check at use time.
      SANITY_API_VIEW_TOKEN: envField.string({ context: "server", access: "secret", min: 1 }),
      SANITY_API_EDIT_TOKEN: envField.string({ context: "server", access: "secret", min: 1 }),
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      RESEND_EMAIL_FROM: envField.string({ context: "server", access: "secret", optional: true }),
      BASIC_AUTH_USERNAME: envField.string({ context: "server", access: "secret", optional: true }),
      BASIC_AUTH_PASSWORD: envField.string({ context: "server", access: "secret", optional: true }),
      // Optional: unset means /api/revalidate answers 500 and cache invalidation stays manual.
      SANITY_REVALIDATE_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // Runtime-read, not public: a public var is inlined at build, which `vercel deploy --prebuilt` would bake to false locally.
      ROUTE_CACHE_VERCEL_RUNTIME: envField.boolean({ context: "server", access: "secret", default: false }),
    },
    // Validate required secrets at build/dev-start (not just runtime), so a missing one fails fast.
    validateSecrets: true,
  },
  integrations: [
    // Provides `sanity:client` for page fetches; embeds the Studio at /studio.
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID,
      dataset: PUBLIC_SANITY_DATASET,
      apiVersion: PUBLIC_SANITY_API_VERSION || "2025-02-19",
      useCdn: false, // raw baseline; src/sanity/lib/client.ts turns it on for published reads
      // Safe to bake in: no client island imports `sanity:client`, so the token never reaches the browser.
      token: SANITY_API_VIEW_TOKEN || undefined,
      // Browser routing so the stega overlay's intent links resolve when a draft page is opened standalone.
      studioBasePath,
      studioRouterHistory: "browser",
      stega: { studioUrl: studioBasePath },
    }),
    react(), // renderer for the embedded Sanity Studio
  ],
  vite: {
    plugins: [tailwindcss()],
    define: { __ROUTE_CACHE_BUILD_ID__: JSON.stringify(buildId) },
    environments: {
      client: {
        build: {
          rollupOptions: {
            output: {
              // Astro emits no modulepreload for what an entry imports, so one unnamed group folds shared `src/lib` modules into a shell chunk.
              codeSplitting: {
                groups: [
                  {
                    name: "shell",
                    minShareCount: 2,
                    maxModuleSize: 12_000,
                    test: (id) =>
                      id.includes("vite/preload-helper") ||
                      (/[\\/]src[\\/]lib[\\/]/.test(id) &&
                        isFirstPartyOnly(id.split("?")[0], {
                          root: process.cwd(),
                          aliases: { "~/sanity/": "sanity/", "~/": "src/" },
                        })),
                  },
                ],
              },
            },
          },
        },
      },
    },
    // A dep discovered after startup rewrites .vite/deps and 504s an open /studio tab, so the initial scan must find all of them.
    optimizeDeps: {
      // `entries` REPLACES Astro's own globs, so app source has to be listed or every client dep is left to runtime discovery.
      entries: ["sanity.config.ts", "src/**/*.{astro,jsx,tsx,vue,svelte,html}"],
      // Injected by <ClientRouter />, so no scan can reach them. Leave the Studio's own deps to the scan.
      include: [
        "astro/virtual-modules/transitions-router.js",
        "astro/virtual-modules/transitions-types.js",
        "astro/virtual-modules/transitions-events.js",
        "astro/virtual-modules/transitions-swap-functions.js",
        // `zod` is dev-only: the scan never finds the forms' schema chunk, so it 504s at submit.
        "zod",
        // Reached only through raw .tsx, so the scan misses it and its CJS lodash deps crash visual editing unbundled.
        "@sanity/visual-editing/react",
        // Pinned: only non-draft pages render the element, so losing the chunk 504s LenisElement after exiting draft preview.
        "lenis",
      ],
    },
  },
});
