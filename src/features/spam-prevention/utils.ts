import { MAX_SUBMISSION_TIME, MIN_SUBMISSION_TIME } from "~/features/spam-prevention/constants";

export type SpamPayload = {
  honeypotValue?: unknown;
  submissionTime?: unknown;
};

export type DetectSpamOptions = {
  /**
   * Minimum time (in milliseconds) before a form submission is considered legitimate.
   * @default MIN_SUBMISSION_TIME
   */
  minSubmissionTime?: number;

  /** Maximum milliseconds a submission may take and still be considered human. */
  maxSubmissionTime?: number;
};

/** Missing payload fields are "no signal", not spam, so a caller can run this without client metadata. */
export function detectSpam(payload: SpamPayload, options: DetectSpamOptions = {}): string | null {
  const { minSubmissionTime = MIN_SUBMISSION_TIME, maxSubmissionTime = MAX_SUBMISSION_TIME } = options;

  const { honeypotValue, submissionTime } = payload;

  if (typeof honeypotValue === "string" && honeypotValue.trim() !== "") {
    console.warn("Spam detected: Honeypot field filled", { honeypotValue });
    return "Invalid submission";
  }

  if (submissionTime !== undefined && submissionTime !== null && submissionTime !== "") {
    const timeTaken = Number(submissionTime);

    if (!Number.isNaN(timeTaken)) {
      if (timeTaken < minSubmissionTime) {
        console.warn("Spam detected: Form submitted too quickly", { timeTaken });
        return "Please take your time filling out the form";
      }

      if (timeTaken > maxSubmissionTime) {
        console.warn("Spam detected: Form submission expired", { timeTaken });
        return "Form session expired. Please refresh and try again";
      }
    }
  }

  return null;
}
