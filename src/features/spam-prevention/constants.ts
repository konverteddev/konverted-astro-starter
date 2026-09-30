/** Legit-sounding name ("website") instead of "honeypot" to avoid bot detection. */
export const HONEYPOT_FIELD_NAME = "website";

/** Field name for submission timing metadata. */
export const SUBMISSION_TIME_FIELD_NAME = "_submissionTime";

/** Min ms before a submission is legitimate; faster is likely automated. */
export const MIN_SUBMISSION_TIME = 2000;

/** Max ms for a submission to be valid; guards bots that wait indefinitely. */
export const MAX_SUBMISSION_TIME = 1000 * 60 * 30; // 30 minutes
