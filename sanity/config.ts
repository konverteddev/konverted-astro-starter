/**
 * The single place `sanity/` reads runtime configuration, kept self-contained so the folder ports.
 * Every `process.env.*` candidate is written out verbatim: bundlers replace that exact text at build.
 */

type Env = Record<string, string | undefined>;

// Cast through `unknown`: a host that types `import.meta.env` narrowly still has to index into it here.
const viteEnv = (import.meta.env ?? {}) as unknown as Env;

/** A guarded `process.env` read; the literal member expression lives at the call site, see above. */
function node(read: () => string | undefined): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

/** The first candidate carrying a value, so a host only has to satisfy one of the spellings. */
function firstOf(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((value) => typeof value === "string" && value !== "");
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`[sanity/config] Missing required configuration "${name}". Set it or edit sanity/config.ts.`);
  }

  return value;
}

const projectId = firstOf(
  viteEnv.PUBLIC_SANITY_PROJECT_ID,
  node(() => process.env.NEXT_PUBLIC_SANITY_PROJECT_ID),
  node(() => process.env.PUBLIC_SANITY_PROJECT_ID),
  node(() => process.env.SANITY_STUDIO_PROJECT_ID),
  node(() => process.env.SANITY_PROJECT_ID)
);

const dataset = firstOf(
  viteEnv.PUBLIC_SANITY_DATASET,
  node(() => process.env.NEXT_PUBLIC_SANITY_DATASET),
  node(() => process.env.PUBLIC_SANITY_DATASET),
  node(() => process.env.SANITY_STUDIO_DATASET),
  node(() => process.env.SANITY_DATASET)
);

const appUrl = firstOf(
  viteEnv.PUBLIC_SITE_URL,
  node(() => process.env.NEXT_PUBLIC_SITE_URL),
  node(() => process.env.NEXT_PUBLIC_URL),
  node(() => process.env.PUBLIC_SITE_URL),
  node(() => process.env.SANITY_STUDIO_SITE_URL)
);

const apiVersion = firstOf(
  viteEnv.PUBLIC_SANITY_API_VERSION,
  node(() => process.env.NEXT_PUBLIC_SANITY_API_VERSION),
  node(() => process.env.PUBLIC_SANITY_API_VERSION),
  node(() => process.env.SANITY_STUDIO_API_VERSION)
);

/** Public base path the Studio is mounted at (e.g. `/studio`). */
const studioBasePath =
  firstOf(
    viteEnv.PUBLIC_SANITY_STUDIO_BASE_PATH,
    node(() => process.env.NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH),
    node(() => process.env.PUBLIC_SANITY_STUDIO_BASE_PATH),
    node(() => process.env.SANITY_STUDIO_BASE_PATH)
  ) ?? "/studio";

/** A second path the Studio answers on, for a host that mounts it at a fixed route before page routes. */
const studioMountPath = firstOf(
  viteEnv.PUBLIC_SANITY_STUDIO_MOUNT_PATH,
  node(() => process.env.NEXT_PUBLIC_SANITY_STUDIO_MOUNT_PATH),
  node(() => process.env.PUBLIC_SANITY_STUDIO_MOUNT_PATH)
);

export const sanityConfig = {
  /** Sanity project + dataset the Studio and CLI operate on. */
  projectId: required("SANITY_PROJECT_ID", projectId),
  dataset: required("SANITY_DATASET", dataset),

  /** Absolute site URL. Document actions join it to a path, so a trailing slash is stripped here. */
  appUrl: required("SITE_URL", appUrl).trim().replace(/\/+$/, ""),

  /** Sanity API version (YYYY-MM-DD). Used by Studio clients and document type lists. */
  apiVersion: apiVersion ?? "2025-02-19",

  /** Used for reserved-path checks and presentation detection. */
  studioBasePath,

  /** Paths a routed document may not claim: the host serves the Studio there, so the page would never be reached. */
  reservedStudioPaths: [studioBasePath, studioMountPath].filter((path): path is string => Boolean(path)),

  /** Host endpoints the Studio calls. `draftMode*` join `appUrl`; the rest are same-origin. */
  endpoints: {
    draftModeEnable: "/api/draft-mode/enable",
    draftModeDisable: "/api/draft-mode/disable",
    seoScreenshot: "/api/seo-screenshot",
    generateLlmsTxt: "/api/agents/llms-txt",
    generatePageMarkdown: "/api/agents/page-markdown",
    imageAltText: "/api/agents/image-alt-text",
  },
};
