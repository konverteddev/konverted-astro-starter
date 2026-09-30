import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { defineForm } from "./validate";

const Schema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  email: z.string().trim().min(1, "Email is required").pipe(z.email("Enter a valid email address")),
  notes: z.string().trim().max(10, "Notes must be 10 characters or fewer"),
  count: z.string().trim().min(2, "Count must be at least 2 characters"),
});

const form = defineForm(Schema);

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }

  return data;
}

describe("defineForm().field", () => {
  it("marks a field required when the schema refuses it blank, whatever the rule that refuses it", () => {
    assert.equal(form.field("title").required, true);
    assert.equal(form.field("email").required, true);
    assert.equal(form.field("count").required, true);
  });

  it("leaves a field the schema accepts blank unmarked", () => {
    assert.equal(form.field("notes").required, false);
  });

  it("carries the name through, so a control cannot be given one without the other", () => {
    assert.deepEqual(form.field("notes"), { name: "notes", required: false });
  });
});

describe("defineForm().read", () => {
  it("reads every field the schema names as a string, so a missing one validates instead of throwing", () => {
    assert.deepEqual(form.read(formData({ title: "Ada" })), { title: "Ada", email: "", notes: "", count: "" });
  });
});

describe("defineForm().check", () => {
  it("flags every field that is wrong at once, not just the first", () => {
    const result = form.check(formData({ notes: "far too long to pass" }));

    assert.equal(result.ok, false);
    assert.deepEqual(result.ok === false && result.fieldErrors, {
      title: "Title is required",
      email: "Email is required",
      notes: "Notes must be 10 characters or fewer",
      count: "Count must be at least 2 characters",
    });
  });

  it("hands back the parsed values when everything passes", () => {
    const result = form.check(formData({ title: " Ada ", email: "ada@example.com", count: "12" }));

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.data, { title: "Ada", email: "ada@example.com", notes: "", count: "12" });
  });
});

// `get` vs `getAll` is inferred from the schema, so a Zod upgrade must fail here rather than halve a checkbox group.
describe("defineForm() field arity", () => {
  const oneOf = (field: z.ZodType) => defineForm(z.object({ x: field })).read(new FormData()).x;

  it("reads a scalar field as a string", () => {
    assert.equal(oneOf(z.string()), "");
    assert.equal(oneOf(z.string().min(1, "r")), "");
    assert.equal(oneOf(z.string().trim().min(1, "r").pipe(z.email("e"))), "");
    assert.equal(oneOf(z.enum(["a", "b"])), "");
    assert.equal(oneOf(z.literal("on", "Accept")), "");
    // The optional radio group idiom: a union is still a scalar when every branch turns an array away.
    assert.equal(oneOf(z.enum(["a", "b"]).or(z.literal(""))), "");
    assert.equal(oneOf(z.literal("").or(z.enum(["a", "b"]))), "");
  });

  it("reads an array field as a list", () => {
    assert.deepEqual(oneOf(z.array(z.string())), []);
    assert.deepEqual(oneOf(z.array(z.string()).min(1, "Pick one")), []);
    assert.deepEqual(oneOf(z.array(z.enum(["a", "b"]))), []);
    assert.deepEqual(oneOf(z.array(z.string()).optional()), []);
  });
});

describe("defineForm() with a checkbox group", () => {
  const Signup = z.object({
    email: z.string().min(1, "Email is required"),
    topics: z.array(z.enum(["cash", "fx", "payments"])).min(1, "Pick at least one topic"),
    extras: z.array(z.string()).optional(),
  });

  const signupForm = defineForm(Signup);

  it("reads a repeated name as every value it was sent, not just the first", () => {
    const data = new FormData();
    data.set("email", "ada@example.com");
    data.append("topics", "cash");
    data.append("topics", "fx");

    assert.deepEqual(signupForm.read(data), { email: "ada@example.com", topics: ["cash", "fx"], extras: [] });
  });

  it("reads an unchecked group as no values rather than as one empty string", () => {
    assert.deepEqual(signupForm.read(new FormData()).topics, []);
  });

  it("validates the group against the array rule", () => {
    const data = new FormData();
    data.set("email", "ada@example.com");

    const result = signupForm.check(data);

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.fieldErrors.topics, "Pick at least one topic");
  });

  it("marks a group required when the schema will not take it empty, and not when it will", () => {
    assert.equal(signupForm.field("topics").required, true);
    assert.equal(signupForm.field("extras").required, false);
  });

  it("accepts a filled group", () => {
    const data = new FormData();
    data.set("email", "ada@example.com");
    data.append("topics", "payments");

    const result = signupForm.check(data);

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.data.topics, ["payments"]);
  });
});

describe("defineForm() with a radio group", () => {
  // A radio group submits once, so it stays a plain string field like any other single-valued control.
  const Plan = z.object({ plan: z.enum(["monthly", "yearly"], "Choose a plan") });
  const planForm = defineForm(Plan);

  it("reads the one selected value", () => {
    const data = new FormData();
    data.set("plan", "yearly");

    assert.deepEqual(planForm.read(data), { plan: "yearly" });
  });

  it("is required, because nothing selected is not one of the options", () => {
    const result = planForm.check(new FormData());

    assert.equal(planForm.field("plan").required, true);
    assert.equal(result.ok === false && result.fieldErrors.plan, "Choose a plan");
  });
});

describe("defineForm() with a rule spanning two fields", () => {
  const Passwords = z
    .object({
      password: z.string().min(1, "Password is required"),
      confirmation: z.string().min(1, "Confirm the password"),
    })
    .refine((values) => values.password === values.confirmation, "The two passwords do not match");

  const passwordForm = defineForm(Passwords);

  it("reports the rule as a form error, since it belongs to no single control", () => {
    const result = passwordForm.check(formData({ password: "hunter2", confirmation: "hunter3" }));

    assert.equal(result.ok, false);
    assert.deepEqual(result.ok === false && result.fieldErrors, {});
    assert.equal(result.ok === false && result.formError, "The two passwords do not match");
  });

  it("still derives required from the fields, not from the object rule", () => {
    assert.equal(passwordForm.field("password").required, true);
    assert.equal(passwordForm.field("confirmation").required, true);
  });

  it("leaves no form error once the rule is satisfied", () => {
    assert.equal(passwordForm.check(formData({ password: "hunter2", confirmation: "hunter2" })).ok, true);
  });
});

describe("defineForm() with an optional radio group", () => {
  // Nothing selected submits nothing and reads as "", so optional is said in string terms.
  const Survey = z.object({ budget: z.enum(["low", "high"]).or(z.literal("")) });
  const surveyForm = defineForm(Survey);

  it("accepts an empty submission and is not marked required", () => {
    const result = surveyForm.check(new FormData());

    assert.equal(surveyForm.field("budget").required, false);
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.data, { budget: "" });
  });

  it("still validates a selected value against the options", () => {
    const data = new FormData();
    data.set("budget", "nope");

    assert.equal(surveyForm.check(data).ok, false);
  });
});
