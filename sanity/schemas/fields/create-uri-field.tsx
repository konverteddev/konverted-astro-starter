import * as changeCase from "change-case";
import { defineField, type SlugOptions, type SlugRule, type SlugValue, type ValidationBuilder } from "sanity";
import { sanityConfig } from "../../config";
import { SANITY_BLOG_INDEX_URI, SINGLETON_IDS } from "../../constants";
import { composeValidation } from "../../utils";

function normalizeSitePath(path: string) {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "/") {
    return "/";
  }

  return trimmed.replace(/\/+$/, "") || "/";
}

/** Slug `current` may be `path` or `/path` — align with a leading slash when comparing. */
function comparableUriPath(value: string): string {
  const t = value.trim();
  if (t === "" || t === "/") {
    return "/";
  }

  return normalizeSitePath(t.startsWith("/") ? t : `/${t}`);
}

function sanitizeDocId(docId: string) {
  return docId.replace("drafts.", "");
}

const reservedPathValidation: ValidationBuilder<SlugRule> = (R) =>
  R.custom((value: SlugValue | undefined, context) => {
    const current = value?.current?.trim();
    if (!current) {
      return true;
    }

    const uriP = comparableUriPath(current);
    // Every path the host serves the Studio on, so a page is never authored where it would not be reached.
    const studioPath = sanityConfig.reservedStudioPaths.find((path) => comparableUriPath(path) === uriP);

    if (studioPath) {
      return `This URI is reserved for Sanity Studio (${comparableUriPath(studioPath)}). Choose a different path.`;
    }

    // The blog index is its own singleton on its own route; a second document here would never be served.
    const docId = typeof context.document?._id === "string" ? sanitizeDocId(context.document._id) : null;

    if (uriP === comparableUriPath(SANITY_BLOG_INDEX_URI) && docId !== SINGLETON_IDS.blog) {
      return `This URI is reserved for the Blog index (${SANITY_BLOG_INDEX_URI}). Choose a different path.`;
    }

    return true;
  });

export function createUriField({
  group,
  options,
  source,
  slugify,
  name = "uri",
  title = "URI",
  description = "The URI of the document.",
  hidden,
  readOnly,
  initialPath,
  validation: externalValidation,
}: {
  group?: string;
  options?: Omit<SlugOptions, "slugify" | "source">;
  source: string;
  slugify?: (args: { originalInput: string; slug: string; parentId: string }) => string;
  name?: string;
  title?: string;
  description?: string;
  hidden?: (props: { parent: { [key: string]: unknown } }) => boolean;
  readOnly?: boolean | ((props: { parent: { [key: string]: unknown } }) => boolean);
  /** Prefills the slug, for documents whose path is fixed (a singleton route) rather than derived from `source`. Pair with `readOnly`. */
  initialPath?: string;
  validation?: ValidationBuilder<SlugRule, SlugValue>;
}) {
  return defineField({
    type: "slug",
    name,
    title,
    group,
    description,
    hidden,
    readOnly,
    initialValue: initialPath ? { current: initialPath } : undefined,
    validation: (rule) => composeValidation(reservedPathValidation, externalValidation)(rule),
    options: {
      ...options,
      source,
      slugify: (input, _, { parent }) => {
        // @ts-expect-error The ID should exist.
        const parentId = parent?._id ? sanitizeDocId(parent._id) : null;
        const slug = changeCase.kebabCase(input);

        if (!parentId) {
          return "";
        }

        if (slugify) {
          return slugify({ slug, parentId, originalInput: input });
        }

        if (parentId === SINGLETON_IDS.homepage) {
          return "/";
        }

        return `/${changeCase.kebabCase(input)}`;
      },
    },
  });
}
