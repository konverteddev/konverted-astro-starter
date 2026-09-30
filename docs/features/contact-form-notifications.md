# Contact Form Notifications

This starter can send notification emails for contact form submissions using Resend.

## Behavior

- The form POSTs `FormData` to `/api/contact-form` (`src/pages/api/contact-form.ts`); its validation plumbing is shared with every form on the site, see [Forms](./forms.md).
- Submissions are persisted to Sanity first (`contactFormSubmission`).
- Email notifications are best-effort and non-blocking.
- If email sending fails, the submission still succeeds and the error is logged server-side.

## Configuration

Set these environment variables in your deployment:

```env
RESEND_API_KEY=your-resend-api-key
RESEND_EMAIL_FROM=notifications@your-domain.com
```

Both are optional at runtime. If either is missing, no notification email is sent.

## Recipients in Sanity

Recipients are managed in the Settings singleton (**Settings → Email Notifications**):

- `siteSettings.contactFormNotificationEmails`

The endpoint fetches recipients from `contactFormNotificationEmails` after storing the submission.

## Implementation Notes

- Endpoint: `src/pages/api/contact-form.ts` (field + spam validation, Sanity create with `SANITY_API_EDIT_TOKEN`, then Resend)
- Field rules: `src/features/page-builder/sections/ContactFormSection/validate-contact-form.ts`, imported by both the custom element and the endpoint. The form is `novalidate` and the element reports these rules inline, so an empty or malformed field never reaches the endpoint; the endpoint re-runs them because a client can be bypassed.
- Form UI: `src/features/page-builder/sections/ContactFormSection/ContactFormSection.astro` + the `ContactFormElement` custom element colocated beside it (`ContactFormElement.ts`), which submits via fetch and adds the spam-prevention timing metadata; without JS the form still POSTs natively
- Uses a typed query + generated type from `sanity/types.ts`
