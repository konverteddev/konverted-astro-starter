import type { UmamiEventData, UmamiPayload, UmamiSessionData } from "~/features/umami/types";
import { IS_CLIENT } from "~/features/utils/constants";

function getUmami() {
  if (!IS_CLIENT || typeof window.umami === "undefined") {
    return undefined;
  }

  return window.umami;
}

/** Track a page view, custom payload, or event. No-op when Umami script is not loaded (e.g. SSR). */
export function track(): void;
export function track(payload: UmamiPayload): void;
export function track(mergePayload: (props: UmamiPayload) => UmamiPayload): void;
export function track(eventName: string): void;
export function track(eventName: string, data: UmamiEventData): void;
export function track(
  eventOrPayload?: string | UmamiPayload | ((props: UmamiPayload) => UmamiPayload),
  data?: UmamiEventData
): void {
  const umami = getUmami();

  if (!umami) {
    return;
  }

  if (data !== undefined && typeof eventOrPayload === "string") {
    umami.track(eventOrPayload, data);
    return;
  }

  if (typeof eventOrPayload === "string") {
    umami.track(eventOrPayload);
    return;
  }

  if (typeof eventOrPayload === "function") {
    umami.track(eventOrPayload);
    return;
  }

  if (eventOrPayload !== undefined) {
    umami.track(eventOrPayload);
    return;
  }

  umami.track();
}

/** Identify the current session (user ID and/or session data). No-op when Umami is not loaded. */
export function identify(uniqueId: string): void;
export function identify(uniqueId: string, data: UmamiSessionData): void;
export function identify(data: UmamiSessionData): void;
export function identify(uniqueIdOrData: string | UmamiSessionData, data?: UmamiSessionData): void {
  const umami = getUmami();

  if (!umami) {
    return;
  }

  if (data !== undefined && typeof uniqueIdOrData === "string") {
    umami.identify(uniqueIdOrData, data);
    return;
  }

  if (typeof uniqueIdOrData === "string") {
    umami.identify(uniqueIdOrData);
    return;
  }

  umami.identify(uniqueIdOrData);
}
