# Spam Prevention

This starter includes a honeypot-based spam prevention system for forms.

## What It Includes

- Hidden honeypot field that bots often fill
- Submission timing metadata added client-side
- Server-side verification as fallback and enforcement

## How It Works

The system combines multiple checks:

1. Honeypot field (`website`) should remain empty. It is rendered directly in the form markup (`ContactFormSection.astro`), visually hidden and `aria-hidden`, so it works without JavaScript.
2. Minimum interaction time before submit (2 seconds): the shared `FormElement` base class records when the form mounted and sets the elapsed time on the `FormData` at submit.
3. Maximum submission age, so a stale form session is rejected.
4. Server-side validation through `detectSpam` in the `/api/contact-form` endpoint.

## Usage

Use the feature from `src/features/spam-prevention/`:

- `constants.ts`: `HONEYPOT_FIELD_NAME`, `SUBMISSION_TIME_FIELD_NAME`, and the timing thresholds
- `utils.ts`: `detectSpam({ honeypotValue, submissionTime })` for server-side validation

Typical flow (see the contact form for the working example):

1. Render a visually hidden input named `HONEYPOT_FIELD_NAME` in your form
2. In the form's custom element, set `SUBMISSION_TIME_FIELD_NAME` on the `FormData` from a mount timestamp before submitting
3. Validate on the server with `detectSpam({ honeypotValue, submissionTime })` before doing anything with the submission; missing values count as "no signal" rather than spam

## What It Blocks

- Bots that fill hidden fields
- Instant submissions
- Expired form sessions
- Basic bypass attempts that skip client checks (the honeypot is enforced server-side regardless)
