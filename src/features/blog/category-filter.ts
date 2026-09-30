// The category filter lives entirely in the URL, which is what keeps the filtering server-side:
// the list renders already filtered, needs no JavaScript, survives a reload, and is linkable.

/** The query parameter the filter reads and writes. Repeated once per selected category. */
export const CATEGORY_PARAM = "category";

/** Unknown slugs are dropped against `known`, so a stale URL narrows to nothing rather than filtering on a dead slug. */
export function selectedCategories(params: URLSearchParams, known: readonly string[]): string[] {
  const allowed = new Set(known);
  const selected = new Set<string>();

  for (const value of params.getAll(CATEGORY_PARAM)) {
    const slug = value.trim();

    if (slug && allowed.has(slug)) {
      selected.add(slug);
    }
  }

  return [...selected];
}

/** Built from the category params alone: carrying an unknown query through a filter click would smuggle state into a cached URL. */
export function toggleCategoryHref(pathname: string, selected: readonly string[], slug: string): string {
  const next = selected.includes(slug) ? selected.filter((entry) => entry !== slug) : [...selected, slug];

  if (next.length === 0) {
    return pathname;
  }

  const params = new URLSearchParams();

  for (const entry of next) {
    params.append(CATEGORY_PARAM, entry);
  }

  return `${pathname}?${params.toString()}`;
}
