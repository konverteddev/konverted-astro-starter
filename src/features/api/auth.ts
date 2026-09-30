import { PUBLIC_SANITY_API_VERSION, PUBLIC_SANITY_PROJECT_ID } from "~/lib/env";
import { type AuthorizeOptions, authorizeStudioRequest as authorize } from "./studio-auth";

/** The Studio route gate, bound to this project. See `studio-auth.ts` and docs/features/studio-api-auth.md. */
export function authorizeStudioRequest(request: Request, options?: AuthorizeOptions) {
  return authorize(request, { projectId: PUBLIC_SANITY_PROJECT_ID, apiVersion: PUBLIC_SANITY_API_VERSION }, options);
}
