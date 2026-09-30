import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SUBMISSION_TIME, MIN_SUBMISSION_TIME } from "./constants";
import { detectSpam } from "./utils";

test("detectSpam: filled honeypot is spam", () => {
  assert.equal(detectSpam({ honeypotValue: "https://spam.example" }), "Invalid submission");
  assert.equal(detectSpam({ honeypotValue: "   " }), null, "whitespace-only honeypot is not spam");
});

test("detectSpam: submission timing bounds", () => {
  assert.equal(detectSpam({ submissionTime: MIN_SUBMISSION_TIME - 1 }), "Please take your time filling out the form");
  assert.equal(detectSpam({ submissionTime: MAX_SUBMISSION_TIME + 1 }), "Form session expired. Please refresh and try again");
  assert.equal(detectSpam({ submissionTime: MIN_SUBMISSION_TIME + 500 }), null);
});

test("detectSpam: FormData string values work (the transport used by the contact form)", () => {
  assert.equal(detectSpam({ honeypotValue: "", submissionTime: "800" }), "Please take your time filling out the form");
  assert.equal(detectSpam({ honeypotValue: "", submissionTime: String(MIN_SUBMISSION_TIME + 1) }), null);
});

test("detectSpam: missing values are no signal, not spam", () => {
  assert.equal(detectSpam({}), null);
  assert.equal(detectSpam({ honeypotValue: null, submissionTime: null }), null);
  assert.equal(detectSpam({ submissionTime: "" }), null);
  assert.equal(detectSpam({ submissionTime: "not-a-number" }), null);
});

test("detectSpam: custom bounds override the defaults", () => {
  assert.equal(detectSpam({ submissionTime: 100 }, { minSubmissionTime: 50 }), null);
  assert.equal(
    detectSpam({ submissionTime: 100 }, { minSubmissionTime: 10, maxSubmissionTime: 50 }),
    "Form session expired. Please refresh and try again"
  );
});
