/**
 * A write-capable Sanity client for the `scripts/` CLIs.
 *
 * Reads go through the Sanity CLI (`captureSanityCommand`), which uses the machine's `sanity login`
 * and needs no token. Patches and deletes cannot be expressed as CLI commands, so anything that
 * writes documents comes through here instead, on an explicit `SANITY_API_EDIT_TOKEN`.
 *
 * `perspective: "raw"` so drafts are visible and deletable: a purge that only saw the published
 * perspective would leave every `drafts.<id>` behind.
 */

import { createClient, type SanityClient } from "@sanity/client";
import { getSanityEnv } from "../sanity-dataset/lib";

export type EditClientOptions = {
  dataset: string;
  apiVersion?: string;
};

/**
 * Throws with an actionable message rather than returning a half-configured client: a script that
 * gets this far is about to delete documents, so a missing token has to stop it here.
 */
export function createEditClient({ dataset, apiVersion = "2025-02-19" }: EditClientOptions): SanityClient {
  const { SANITY_PROJECT_ID } = getSanityEnv(process.env);
  const token = process.env.SANITY_API_EDIT_TOKEN;

  if (!token) {
    throw new Error("SANITY_API_EDIT_TOKEN is not set. It is required to delete or patch documents.");
  }

  return createClient({
    projectId: SANITY_PROJECT_ID,
    dataset,
    apiVersion,
    token,
    useCdn: false,
    perspective: "raw",
  });
}
