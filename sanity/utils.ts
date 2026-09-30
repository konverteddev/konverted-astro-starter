import type { Rule } from "sanity";
import { SANITY_SINGLETON_HOMEPAGE_ID } from "./constants";

export function isHomepageDocument(source: { _id?: unknown } | null | undefined): boolean {
  const raw = source?._id;

  if (typeof raw !== "string") {
    return false;
  }

  return raw.replace(/^drafts\./, "") === SANITY_SINGLETON_HOMEPAGE_ID;
}

/** Filter schema options by name via a caller `whitelist` or `blacklist` (mutually exclusive; throws if both). Unnamed items are always kept. */
export function selectByName<T, N extends string>(
  items: readonly T[],
  getName: (item: T) => N | null | undefined,
  { whitelist, blacklist, label }: { whitelist?: readonly N[]; blacklist?: readonly N[]; label: string }
): T[] {
  if (whitelist?.length && blacklist?.length) {
    throw new Error(`${label}: Cannot provide both whitelist and blacklist parameters.`);
  }

  return items.filter((item) => {
    const name = getName(item);

    if (!name) {
      return true;
    }

    if (whitelist?.length) {
      return whitelist.includes(name);
    }

    if (blacklist?.length) {
      return !blacklist.includes(name);
    }

    return true;
  });
}

// biome-ignore lint/suspicious/noExplicitAny: we don't know what the object is.
function dotPathToObjectValue<O extends Record<string, any>>(obj: O, path: string) {
  if (!path) {
    return obj;
  }

  return path.includes(".") ? path.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj) : obj[path];
}

/** Rule that hides a field unless another field equals the given value(s); `false` also matches undefined. */
export const visibleIf = (fieldName: string) => (value?: boolean | string | string[]) => ({
  hidden: ({ parent }: { parent: Record<string, unknown> }) => {
    const resolvedValue = parent ? dotPathToObjectValue(parent, fieldName) : undefined;
    const allowedValues = Array.isArray(value) ? value : [value];
    // When checking for boolean false, treat undefined as matching (falsy)
    const toMatch = allowedValues.length === 1 && allowedValues[0] === false ? [undefined, false] : allowedValues;
    return !toMatch.includes(resolvedValue as boolean | string);
  },
});

/** Rule that requires a field when another field equals the given value(s); `false` also matches undefined. */
export const requiredIf = (fieldName: string) => (value?: boolean | string | string[]) => {
  const allowedValues = Array.isArray(value) ? value : [value];
  const toMatch = allowedValues.length === 1 && allowedValues[0] === false ? [undefined, false] : allowedValues;

  return {
    validation: (R: unknown) => {
      return (R as Rule).custom((currentValue, { parent }) => {
        const resolvedValue = parent ? dotPathToObjectValue(parent, fieldName) : undefined;
        const conditionMatches = toMatch.includes(resolvedValue as boolean | string);
        return conditionMatches && currentValue === undefined ? "Required" : true;
      });
    },
  };
};

type ValidationBuilder<T> = (rule: T) => any;

export function isEmptyObjectValue(value: unknown) {
  return typeof value === "object" && value != null && !Array.isArray(value) && Object.values(value).every((v) => v == null);
}

export type HiddenPredicate = (props: { parent: { [key: string]: unknown } }) => boolean;

/** Mirror the field's own `hidden` rule: nested initial values leave residue that would otherwise block saving. */
export function requireTypeWhenObjectHasValue(message: string, hidden?: HiddenPredicate): ValidationBuilder<unknown> {
  return (R) =>
    (R as Rule).custom((value, context) => {
      if (!value || isEmptyObjectValue(value)) {
        return true;
      }

      if (hidden?.({ parent: (context.parent ?? {}) as { [key: string]: unknown } })) {
        return true;
      }

      return (value as { type?: string }).type ? true : message;
    });
}

export function composeValidation<T>(baseValidation: ValidationBuilder<T>, externalValidation?: ValidationBuilder<T>) {
  return (rule: T) => {
    const baseResult = baseValidation(rule);

    if (!externalValidation) {
      return baseResult;
    }

    const externalResult = externalValidation(rule);
    return Array.isArray(externalResult) ? [...externalResult, baseResult] : [externalResult, baseResult];
  };
}

type RefLike = { _ref?: string };

/** Block duplicate refs in an array-of-references field, in the dropdown (`.filter`) and on save (`.validation`). `arrayKey` names the array when the filter receives the parent object. */
export function uniqueReferenceArray(options?: { arrayKey?: string; message?: string; required?: boolean }) {
  const arrayKey = options?.arrayKey;
  const message = options?.message ?? "Each item can only be added once.";
  const required = options?.required !== false;

  const getRefs = (items: RefLike[] | undefined): string[] =>
    (items ?? []).map((item) => item?._ref).filter((ref): ref is string => Boolean(ref));

  const duplicateCheck = (value: unknown) => {
    const items = Array.isArray(value) ? (value as RefLike[]) : [];

    if (!items.length) {
      return true;
    }

    const refs = getRefs(items);
    const hasDuplicates = refs.some((id, index) => refs.indexOf(id) !== index);
    return hasDuplicates ? message : true;
  };

  return {
    filter: ({ parent }: { parent?: unknown }) => {
      const items = Array.isArray(parent)
        ? (parent as RefLike[])
        : arrayKey != null
          ? (parent as Record<string, RefLike[] | undefined>)?.[arrayKey]
          : undefined;

      const selected = getRefs(Array.isArray(items) ? items : undefined);

      if (!selected.length) {
        // Match-all GROQ filter: equivalent to "no filtering", but keeps the
        // return type a valid reference filter (Sanity rejects a boolean here).
        return { filter: "true" };
      }

      return { filter: "!(_id in $selected)", params: { selected } };
    },
    validation: (R: unknown) => {
      const rule = (R as Rule).custom(duplicateCheck);
      return required ? (R as Rule).required().custom(duplicateCheck) : rule;
    },
  };
}

/** Extract a plain-text excerpt (up to `maxLength` chars) from a Portable Text array; empty string when blank. */
// biome-ignore lint/suspicious/noExplicitAny: the portable text block is too generic to type out.
export function createExcerptFromPortableText(value: any[], maxLength = 100) {
  const text = value.map(({ _type, children }) => {
    if (_type !== "block" || !children) {
      return "";
    }

    return children.map(({ text }: { text: string }) => text).join("");
  });

  if (!text?.length) {
    return "";
  }

  const joined = text.join(" ");
  return joined.length <= maxLength ? joined : `${joined.slice(0, maxLength)} …`;
}
