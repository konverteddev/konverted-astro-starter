import { z } from "zod";
import { defineForm } from "~/features/forms/validate";

const MAX_NAME_LENGTH = 100;

export const CONTACT_COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-1000", label: "201-1000 employees" },
  { value: "over-1000", label: "Over 1000 employees" },
] as const;

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map(({ value }) => value) as [T[number]["value"], ...T[number]["value"][]];

/** A switch or a checkbox submits its fixed "on" when set and nothing otherwise, so the optional ones read that string or an empty one. */
const optionalSwitch = z.literal("on").or(z.literal(""));

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
  company: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(MAX_NAME_LENGTH, `Company name must be ${MAX_NAME_LENGTH} characters or fewer`),
  companySize: z.enum(values(CONTACT_COMPANY_SIZES), "Select a company size"),
  sellsOnMarketplaces: optionalSwitch,
  offersDigitalServices: optionalSwitch,
  marketingConsent: optionalSwitch,
});

export type ContactFormValues = z.output<typeof ContactFormSchema>;

export const contactForm = defineForm(ContactFormSchema);
