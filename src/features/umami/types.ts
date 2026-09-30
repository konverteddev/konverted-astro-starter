/** Known props the Umami tracker can send in a custom payload. */
export type UmamiPayload = {
  website: string;
  url?: string;
  title?: string;
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  [key: string]: string | number | boolean | undefined;
};

/** Umami limits: numbers max precision 4, strings max length 500, objects max 50 properties. */
export type UmamiEventData = Record<string, string | number | boolean>;

/** Session data for identify(). Same value constraints as event data. */
export type UmamiSessionData = Record<string, string | number | boolean>;

type TrackFn = {
  (): void;
  (payload: UmamiPayload): void;
  (mergePayload: (props: UmamiPayload) => UmamiPayload): void;
  (eventName: string): void;
  (eventName: string, data: UmamiEventData): void;
};

type IdentifyFn = {
  (uniqueId: string): void;
  (uniqueId: string, data: UmamiSessionData): void;
  (data: UmamiSessionData): void;
};

export type UmamiTracker = {
  /** Track current page view, custom payload, or event. */
  track: TrackFn;
  /** Assign ID and/or session data to current session. */
  identify: IdentifyFn;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}
