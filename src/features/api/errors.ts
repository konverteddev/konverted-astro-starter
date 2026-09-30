/**
 * Uniform machine-readable error body for API endpoints: `error`, a stable `code` slug, an optional `hint`.
 * Documented in the OpenAPI description (`~/features/api/openapi`).
 */
export type ApiErrorBody = {
  error: string;
  code: string;
  hint?: string;
};

export function apiErrorResponse(status: number, body: ApiErrorBody): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
