/** Day-month-year in a fixed locale, so the rendered date never depends on the runtime's own. */
export function formatDate(date: string): string {
  // Force local midnight so the day does not shift by timezone.
  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
