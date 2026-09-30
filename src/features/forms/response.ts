/** A rejected parse answers with the whole map, not one sentence, so the browser can report it inline. */
export type FormFailure = { error?: string; fieldErrors?: Record<string, string | undefined> };

export type FormResponse = { ok: true } | ({ ok: false } & FormFailure);

export function formOk() {
  return Response.json({ ok: true } satisfies FormResponse);
}

export function formFailed(status: number, failure: FormFailure) {
  return Response.json({ ok: false, ...failure } satisfies FormResponse, { status });
}
