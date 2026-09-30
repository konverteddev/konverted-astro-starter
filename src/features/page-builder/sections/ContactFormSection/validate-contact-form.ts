import { z } from "zod";
import { defineForm } from "~/features/forms/validate";

const MAX_NAME_LENGTH = 100;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;

export const CONTACT_TOPICS = [
  { value: "general", label: "General inquiry" },
  { value: "project", label: "New project" },
  { value: "support", label: "Support" },
] as const;

export const CONTACT_BUDGETS = [
  { value: "under-10k", label: "Under $10k" },
  { value: "10k-50k", label: "$10k to $50k" },
  { value: "over-50k", label: "Over $50k" },
] as const;

export const CONTACT_SERVICES = [
  { value: "design", label: "Design" },
  { value: "development", label: "Development" },
  { value: "content", label: "Content" },
  { value: "seo", label: "SEO" },
] as const;

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map(({ value }) => value) as [T[number]["value"], ...T[number]["value"][]];

/** One field of every control type on purpose: this form is the worked example (see docs/features/forms.md). */
const ContactFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(MAX_NAME_LENGTH, `First name must be ${MAX_NAME_LENGTH} characters or fewer`),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(MAX_NAME_LENGTH, `Last name must be ${MAX_NAME_LENGTH} characters or fewer`),
  email: z.string().trim().min(1, "Email is required").pipe(z.email("Invalid email address")),
  // FormPhone submits the number and its dial code as two fields, so nothing has to unpick one string.
  phoneDialCode: z.string().trim(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9 ()-]*$/, "Phone can only contain digits and separators")
    .max(20, "Phone must be 20 characters or fewer"),
  topic: z.enum(values(CONTACT_TOPICS), "Choose a topic"),
  startDate: z
    .string()
    .trim()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  budget: z.enum(values(CONTACT_BUDGETS)).or(z.literal("")),
  services: z.array(z.enum(values(CONTACT_SERVICES))).min(1, "Pick at least one service"),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .pipe(
      z
        .string()
        .min(MIN_MESSAGE_LENGTH, `Message must be at least ${MIN_MESSAGE_LENGTH} characters`)
        .max(MAX_MESSAGE_LENGTH, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
    ),
  consent: z.literal("on", "Accept the privacy policy to continue"),
});

export type ContactFormValues = z.output<typeof ContactFormSchema>;

export const contactForm = defineForm(ContactFormSchema);
