# Forms

Every public form on the site is the same three pieces: one definition, one custom element, one
endpoint. The definition is shared by all three, so a rule written once shows up in the markup, in
the browser and on the server without being restated anywhere. The contact form section
(`src/features/page-builder/sections/ContactFormSection/`) is the worked example: it renders one
field of every control type against this exact plumbing.

## One definition per form

`defineForm(schema)` (`src/features/forms/validate.ts`) takes one Zod object schema and returns the
object the rest of the form is built from:

```ts
export const contactForm = defineForm(ContactFormSchema);
```

| Member              | Used by      | What it does                                                |
| ------------------- | ------------ | ----------------------------------------------------------- |
| `field(name)`       | the markup   | `{ name, required }`, spread onto a field component          |
| `check(formData)`   | element, API | reads a `FormData` and parses it in one call                 |
| `read` / `validate` | tests        | the two halves of `check`, for asserting on plain values     |

The field names come from `schema.shape`, so the schema is the only place they are written down and no
second list can fall behind it. `field(name)` is typed against that shape: a name the schema does not
have is a compile error.

`required` is derived too, not declared: `defineForm` parses a blank submission once and marks every
field the schema refuses to go without, whatever the rule that refuses it. Spread `field()` onto the
control and the `required` attribute and the label's asterisk both follow the schema, so neither can be
forgotten or left behind by a rule change.

Keep the top level an object. `.refine()` / `.superRefine()` are fine (Zod keeps the shape), but a
top-level `.transform()` erases it and the type will reject it.

### Fields that answer with more than one value

A checkbox group submits its name once per checked box, so its schema field is an array; everything
else submits once and stays a string. `defineForm` works out which is which from the schema and reads
those fields with `getAll` instead of `get`. Declare the arity and the rest follows:

```ts
const ContactFormSchema = z.object({
  topic: z.enum(["general", "project", "support"], "Choose a topic"),   // dropdown or radio: one answer
  services: z.array(z.string()).min(1, "Pick at least one service"),    // checkbox group: any number
  consent: z.literal("on", "Accept the privacy policy to continue"),    // a single checkbox
});
```

Reading a group with `get` would submit only its first checked box, so the inference is covered by a
table test in `validate.test.ts`; extend it if you add a schema shape it does not already list.

An unselected radio group reads as `""`, not as `undefined`, so an optional one must say so in string
terms: `z.enum([...]).or(z.literal(""))` (the contact form's `budget` field). Plain `.optional()`
would keep rejecting the blank, and the derived asterisk would (correctly) call the field required.

```astro
const { field } = contactForm;

<FormInput {...field('firstName')} label="First Name" autocomplete="given-name" />
<FormInput {...field('email')} label="Email" type="email" autocomplete="email" />
```

The asterisk is markup, not part of the label text: `FormField.astro` renders it in an `aria-hidden`
span (the control's own `required` is what a screen reader reads) and `fieldLabel()` adds it to the
placeholder, which has to say the same thing.

## The controls

`src/components/Form/` holds them; the contact form section renders every one of them live.

| Component          | For                                                                    |
| ------------------ | ---------------------------------------------------------------------- |
| `FormInput`        | one line of text; `submit` makes it the inline one-field variant        |
| `FormTextarea`     | a multi-line text field                                                 |
| `FormDropdown`     | a native select                                                         |
| `FormDate`         | a native date input                                                     |
| `FormPhone`        | a dial code and a number, submitted as two fields                       |
| `FormCheckbox`     | a single checkbox answering for itself (consent, a preference)          |
| `FormChoiceGroup`  | `radio` for one answer or `checkbox` for any number                     |

`FormField` is the shared shell for the boxed fields; `FormChoice` is the shared option row behind the
checkbox and both group types. What ties them to the validation layer is markup, not a registry: a
`[data-field]` container holding a `[data-field-error]` slot named after the field. `setFieldErrors`
walks those, so a control built outside this list is reported like the rest as long as it says so.

A group's `aria-invalid` goes on the group, not on each option, and a `required` checkbox group carries
the asterisk on its legend rather than `required` on every box (which would demand all of them).

## The element

`FormElement` (`src/features/forms/form-element.ts`) is the behaviour every form shares, so a form's
own element only names its rules:

```ts
export class ContactFormElement extends FormElement {
  protected successMessage = "Thank you! Your message has been sent successfully.";

  protected async loadRules() {
    return (await import("./validate-contact-form")).contactForm;
  }
}
```

It handles:

- **Validation on submit, inline.** The element sets `noValidate` on its form (native bubbles cannot
  be styled), so without JS the browser's own validation still runs. On submit the schema is parsed in
  the browser and **every** field it rejects is flagged at once, on its own control, with the first one
  focused. Only a clean parse costs a round trip.
- **Live correction.** Once a submit has raised errors, each keystroke re-parses so a field clears as
  it is fixed. Nothing is flagged before the first submit.
- **The schema chunk.** Zod is heavy, so a form's definition is its own chunk, fetched by a submit
  and never with the page. Nothing else pulls it in: focusing or filling the form fetches nothing.
- Timing metadata for [Spam Prevention](./spam-prevention.md), the fetch, the pending/done progress
  reported inside `SubmitButton` (via `~/features/forms/submit-state`), the reset, and the
  `[data-form-message]` line.

The seams for a form that needs something special are `successMessage` and `onSuccess()`. Needing more
than those means the behaviour belongs in `FormElement`, where every form gets it.

## The endpoint

Endpoints run `check()` again, because a client can always be bypassed, and answer in the shape
`FormElement` knows how to report (`src/features/forms/response.ts`):

```ts
const validation = contactForm.check(formData);

if (!validation.ok) {
  return formFailed(400, { fieldErrors: validation.fieldErrors, error: validation.formError });
}
```

A rejected parse comes back as the whole `fieldErrors` map, not one sentence. That is what keeps the
report inline when the browser never got its own copy of the schema: the fields still light up
individually instead of a lone message appearing under the button. The `error` string carries what no
field can show: spam, delivery, an unreadable body, and `validation.formError`.

`formError` is the message from a rule that spans fields (`.refine` on the object). It has no control
to sit under, so it goes to the `[data-form-message]` line on both sides. Dropping it would reject a
submission with nothing on screen to explain why, which is the one outcome a form must never produce:
whenever nothing lands on a field, `FormElement` falls back to the message line.

Because the browser-side schema is only ever reached through a dynamic import from a `.ts` element,
Vite's dev scan cannot find it, so `zod` is listed in `optimizeDeps.include` in `astro.config.mjs`.
That is dev-server pre-bundling only and has no effect on what ships: without it the chunk 504s in dev
and every submit silently falls through to the server, which is how this was found.

Public form endpoints stay out of `/openapi.json` on purpose; see [OpenAPI document](./openapi.md).

## Adding a form

1. Write the schema and `export const myForm = defineForm(MySchema)`.
2. Compose the fields from `src/components/Form/`, spreading `field('name')` onto each control.
3. Subclass `FormElement`, returning the definition from `loadRules()`.
4. Add the endpoint under `src/pages/api/`, answering with `formOk()` / `formFailed()`, and pass
   `fieldErrors` **and** `formError` through on a rejected parse.
5. Register the tag in `HTMLElementTagNameMap` (`src/env.d.ts`).
