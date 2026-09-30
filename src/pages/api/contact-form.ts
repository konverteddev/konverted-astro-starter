import type { APIRoute } from "astro";
import { defineQuery } from "groq";
import { Resend } from "resend";
import { formFailed, formOk } from "~/features/forms/response";
import { type ContactFormValues, contactForm } from "~/features/page-builder/sections/ContactFormSection/validate-contact-form";
import { HONEYPOT_FIELD_NAME, SUBMISSION_TIME_FIELD_NAME } from "~/features/spam-prevention/constants";
import { detectSpam } from "~/features/spam-prevention/utils";
import { RESEND_API_KEY, RESEND_EMAIL_FROM } from "~/lib/env";
import { API_ONLY_DOCUMENTS, SANITY_SINGLETON_SITE_SETTINGS_ID } from "~/sanity/constants";
import type { SiteNotificationEmailsQResult } from "~/sanity/types";
import { sanityEditClient } from "../../sanity/lib/client";

// Public contact form submissions (page-builder contact form section); the form posts same-origin.
export const prerender = false;

// Notification recipients are site-wide configuration, so they read the one `siteSettings` document.
const SiteNotificationEmailsQ = defineQuery(`*[_type == "${SANITY_SINGLETON_SITE_SETTINGS_ID}"][0]{
  contactFormNotificationEmails
}`);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** What the endpoint stores and mails: the parsed values, with the two phone fields joined back up. */
function toSubmission({ phoneDialCode, phone, consent, ...values }: ContactFormValues) {
  return {
    ...values,
    phone: phone ? `${phoneDialCode} ${phone}` : "",
    // The value is the checkbox's fixed "on"; what matters for the record is that it was given.
    consent: consent === "on",
  };
}

type Submission = ReturnType<typeof toSubmission>;

async function sendNotification(recipients: string[], subject: string, submission: Submission) {
  if (!RESEND_API_KEY || !RESEND_EMAIL_FROM) {
    return;
  }

  const rows: [string, string][] = [
    ["Name", `${submission.firstName} ${submission.lastName}`],
    ["Email", submission.email],
    ["Phone", submission.phone],
    ["Topic", submission.topic],
    ["Preferred start date", submission.startDate],
    ["Budget", submission.budget],
    ["Services", submission.services.join(", ")],
  ];

  const lines = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<strong>${escapeHtml(label)}</strong>: ${escapeHtml(value)}`)
    .join("<br />\n        ");

  const resend = new Resend(RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: RESEND_EMAIL_FROM,
    to: recipients,
    subject: escapeHtml(subject),
    html: `
      <p>
        ${lines}<br />
        <strong>Message</strong>:<br />
        ${escapeHtml(submission.message).replace(/\n/g, "<br />")}
      </p>
    `,
  });

  if (error) {
    console.error("Resend notification email failed:", error);
  }
}

export const POST: APIRoute = async ({ request }) => {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return formFailed(400, { error: "Invalid form submission." });
  }

  const spamError = detectSpam({
    honeypotValue: formData.get(HONEYPOT_FIELD_NAME),
    submissionTime: formData.get(SUBMISSION_TIME_FIELD_NAME),
  });

  if (spamError) {
    return formFailed(400, { error: spamError });
  }

  // Same rules the form already ran; a bypassed client lands here instead of in the CMS.
  const validation = contactForm.check(formData);

  if (!validation.ok) {
    return formFailed(400, { fieldErrors: validation.fieldErrors, error: validation.formError });
  }

  try {
    const submission = toSubmission(validation.data);

    await sanityEditClient.create(
      { _type: API_ONLY_DOCUMENTS.contactFormSubmission, ...submission },
      { autoGenerateArrayKeys: true }
    );

    try {
      const site = await sanityEditClient.fetch<SiteNotificationEmailsQResult>(SiteNotificationEmailsQ);
      const recipients = site?.contactFormNotificationEmails?.filter(Boolean) ?? [];

      if (recipients.length > 0) {
        const subject = `New contact form submission from ${submission.firstName} ${submission.lastName}`;
        await sendNotification(recipients, subject, submission);
      }
    } catch (error) {
      console.error("Resend notification failed:", error);
    }

    return formOk();
  } catch (error) {
    console.error("Failed to submit contact form:", error);

    return formFailed(500, { error: "Failed to submit form. Please try again later." });
  }
};
