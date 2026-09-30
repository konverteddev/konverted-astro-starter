import { sequence } from "astro:middleware";
import type { MiddlewareHandler } from "astro";
import { rewriteToAgentMarkdown } from "~/features/agents/markdown-rewrite";
import { DRAFT_SESSION_COOKIE, verifyDraftSession } from "~/features/auth/draft-session";
import { isExcludedPath } from "~/features/auth/excluded-paths";
import { gateAlways, gateByCms } from "~/features/auth/gates";
import { isSectionPreviewPath, SECTION_PREVIEW_ROBOTS } from "~/features/page-builder/section-preview-path";
import { PUBLIC_SANITY_STUDIO_BASE_PATH, SANITY_API_VIEW_TOKEN } from "~/lib/env";

// Runtime gates: CMS-managed HTTP Basic Auth and agent content negotiation. The order is the contract;
// each step's logic lives in its feature module.

/** No CSP or frame restrictions: the Presentation tool loads the site in an iframe. */
const securityHeaders: MiddlewareHandler = async (context, next) => {
  const response = await next();

  if (isSectionPreviewPath(context.url.pathname)) {
    response.headers.set("X-Robots-Tag", SECTION_PREVIEW_ROBOTS);
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
};

/** A Studio preview session is only one the draft-mode enable route signed; the preview cookies alone are forgeable. */
const draftSession: MiddlewareHandler = async (context, next) => {
  context.locals.draftSession =
    !context.isPrerendered && (await verifyDraftSession(SANITY_API_VIEW_TOKEN, context.cookies.get(DRAFT_SESSION_COOKIE)?.value));
  return next();
};

const runtimeGates: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname;

  if (isExcludedPath(pathname, PUBLIC_SANITY_STUDIO_BASE_PATH)) {
    return next();
  }

  // Ahead of every bypass below: neither the CMS toggles nor a preview cookie opens the specimen.
  if (isSectionPreviewPath(pathname)) {
    return gateAlways(context, next, "The section preview");
  }

  // A signed Studio preview session: Basic Auth must not run, and drafts must not reach the cache.
  if (context.locals.draftSession) {
    context.cache.set(false);
    return next();
  }

  // Ahead of the gate but deferring to it: a page Basic Auth covers is never rewritten to Markdown.
  const markdown = await rewriteToAgentMarkdown(context, pathname);

  if (markdown) {
    return markdown;
  }

  return gateByCms(context, next, pathname);
};

export const onRequest = sequence(securityHeaders, draftSession, runtimeGates);
