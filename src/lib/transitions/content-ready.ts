// Gate for in-page intros: closed while a page transition runs, open once the entering fade has finished.
// The initial load has no transition, so the gate opens immediately; page-transitions.ts drives it.

let pending: { promise: Promise<void>; resolve: () => void } | null = null;

export function closeContentGate() {
  if (pending) {
    return;
  }

  let resolve = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });

  pending = { promise, resolve };
}

export function openContentGate() {
  pending?.resolve();
  pending = null;
}

/** Resolves once the current page's entering transition (if any) has finished. */
export function whenContentReady(): Promise<void> {
  return pending?.promise ?? Promise.resolve();
}
