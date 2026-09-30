import { z } from "zod";

/**
 * One Zod schema per form, parsed in the browser to save a round trip and again at the endpoint,
 * because a client can always be bypassed. Keep free of server-only imports.
 */
export type FormFieldErrors = Partial<Record<string, string>>;

export type FormValidation<Data> = { ok: true; data: Data } | { ok: false; fieldErrors: FormFieldErrors; formError?: string };

type FormSchema = z.ZodObject<Record<string, z.ZodType>>;

/** A checkbox group is read with `getAll`; the check recurses through unions, which keeps the optional radio idiom a string field. */
type ArityIssue = { code?: string; errors?: ArityIssue[][] };

function rejectsArrayOnType(issues: ArityIssue[]): boolean {
  return issues.some(
    ({ code, errors }) =>
      code === "invalid_type" ||
      code === "invalid_value" ||
      (code === "invalid_union" && (errors ?? []).every((branch) => rejectsArrayOnType(branch)))
  );
}

function takesManyValues(field: z.ZodType) {
  const result = field.safeParse([]);

  return result.success || !rejectsArrayOnType(result.error.issues as ArityIssue[]);
}

function readValues(formData: FormData, names: readonly string[], many: ReadonlySet<string>) {
  return Object.fromEntries(
    names.map((name) => [name, many.has(name) ? formData.getAll(name).map(String) : String(formData.get(name) ?? "")])
  );
}

function parse<Schema extends FormSchema>(schema: Schema, names: readonly string[], values: unknown) {
  const result = schema.safeParse(values);

  if (result.success) {
    return { ok: true, data: result.data } satisfies FormValidation<z.output<Schema>>;
  }

  const tree = z.treeifyError(result.error) as {
    errors?: string[];
    properties?: Record<string, { errors: string[] } | undefined>;
  };
  const fieldErrors: FormFieldErrors = {};

  for (const name of names) {
    const message = tree.properties?.[name]?.errors[0];

    if (message) {
      fieldErrors[name] = message;
    }
  }

  // An object-level `.refine` has no control to sit under, and dropping it would reject with nothing on screen.
  return { ok: false, fieldErrors, formError: tree.errors?.[0] } satisfies FormValidation<z.output<Schema>>;
}

/** The schema is the only place fields are named, so the markup, the element and the endpoint cannot drift out of step. */
export function defineForm<Schema extends FormSchema>(schema: Schema) {
  const names = Object.keys(schema.shape);
  const many = new Set(
    Object.entries(schema.shape)
      .filter(([, field]) => takesManyValues(field))
      .map(([name]) => name)
  );
  // One blank parse answers "which fields does this schema refuse to go without" for the whole form.
  const blank = parse(schema, names, Object.fromEntries(names.map((name) => [name, many.has(name) ? [] : ""])));
  const required = new Set(blank.ok ? [] : names.filter((name) => blank.fieldErrors[name]));

  return {
    field: (name: keyof Schema["shape"] & string) => ({ name, required: required.has(name) }),
    read: (formData: FormData) => readValues(formData, names, many) as z.input<Schema>,
    validate: (values: unknown) => parse(schema, names, values),
    check: (formData: FormData) => parse(schema, names, readValues(formData, names, many)),
  };
}
