/**
 * Shared interactive shell for the `sanity:*` CLIs: header, summary, one confirmation, consistent exits.
 * `prompts` answers `undefined` on abort, so every wrapper treats that as a cancellation and exits 0.
 */

import prompts from "prompts";

/** One line of the summary block. A row without a label renders as a plain bullet. */
export type SummaryRow = { label?: string; value: string };

/** Marker for a step the user turned off, used as a summary value. */
export const SKIPPED = "⏭️  skip";

/** Opening banner: `{icon}  {title}` followed by indented description lines. */
export function printHeader(icon: string, title: string, lines: string[] = []): void {
  console.log(`\n${icon}  ${title}\n`);

  for (const line of lines) {
    console.log(`   ${line}`);
  }

  if (lines.length > 0) {
    console.log("");
  }
}

/** Renders summary rows with the value column aligned. Pure, so the formatting is unit tested. */
export function formatSummaryRows(rows: SummaryRow[]): string[] {
  const width = rows.reduce((max, row) => Math.max(max, row.label ? row.label.length + 1 : 0), 0);

  return rows.map((row) => {
    if (!row.label) {
      return `   • ${row.value}`;
    }

    return `   • ${`${row.label}:`.padEnd(width)} ${row.value}`;
  });
}

/** The `📋 Summary` block every script prints before its confirmation. */
export function printSummary(rows: SummaryRow[]): void {
  console.log("\n📋 Summary\n");

  for (const line of formatSummaryRows(rows)) {
    console.log(line);
  }

  console.log("");
}

/** Announces a step that is about to run (the Sanity CLI writes its own output underneath). */
export function printStep(icon: string, message: string): void {
  console.log(`\n${icon} ${message}`);
}

/** Notice printed right after the header when `--dry-run` is active. */
export function printDryRunNotice(): void {
  console.log("🔍 Dry run (--dry-run): the plan is printed, nothing runs and nothing is written.\n");
}

/** Ends a `--dry-run` after the summary. */
export function finishDryRun(): never {
  console.log("✅ Dry run complete. Nothing changed.\n");
  process.exit(0);
}

/** Success footer. */
export function printDone(message: string, detail?: string): void {
  console.log(`\n✅ ${message}`);

  if (detail) {
    console.log(`   ${detail}`);
  }

  console.log("");
}

/** Exits 0: the user declined or aborted, so nothing happened and this is not an error. */
export function cancel(detail?: string): never {
  console.log("\n👋 Cancelled.");

  if (detail) {
    console.log(`   ${detail}`);
  }

  console.log("");
  process.exit(0);
}

/** Exits 1 with the shared error shape: one headline, then indented detail lines. */
export function fail(message: string, ...details: string[]): never {
  console.error(`\n❌ ${message}`);

  for (const detail of details) {
    console.error(`   ${detail}`);
  }

  console.error("");
  process.exit(1);
}

/** Free-text answer; `validate` returns the message to show in place of the answer, or `null` when usable. */
export async function askText(
  message: string,
  options: { initial?: string; required?: boolean; validate?: (value: string) => string | null } = {}
): Promise<string> {
  const { initial, required, validate } = options;
  const answer = await prompts({
    type: "text",
    name: "value",
    message,
    initial,
    validate:
      required || validate
        ? (value) => {
            const text = String(value ?? "").trim();

            if (required && !text) {
              return "Required";
            }

            return validate?.(text) ?? true;
          }
        : undefined,
  });

  if (answer.value === undefined) {
    cancel();
  }

  return String(answer.value).trim();
}

/** Single choice from a list. */
export async function askSelect<Value>(
  message: string,
  choices: { title: string; value: Value; description?: string }[],
  options: { initial?: number } = {}
): Promise<Value> {
  const answer = await prompts({
    type: "select",
    name: "value",
    message,
    choices,
    initial: options.initial ?? 0,
  });

  if (answer.value === undefined) {
    cancel();
  }

  return answer.value as Value;
}

/** Yes/no answer. Defaults to no, because these scripts write to real datasets. */
export async function askConfirm(message: string, initial = false): Promise<boolean> {
  const answer = await prompts({ type: "confirm", name: "value", message, initial });

  if (answer.value === undefined) {
    cancel();
  }

  return answer.value === true;
}

/** Final gate: a `no` here cancels the run, optionally reporting what was left behind. */
export async function confirmOrCancel(
  message: string,
  options: { initial?: boolean; cancelDetail?: string } = {}
): Promise<void> {
  const confirmed = await askConfirm(message, options.initial ?? false);

  if (!confirmed) {
    cancel(options.cancelDetail);
  }
}

/**
 * Multiple choices from a list. `prompts` returns `[]` for "selected nothing", which is a real
 * answer, so only an `undefined` value (Ctrl-C or Escape) counts as a cancellation.
 */
export async function askMultiSelect<Value>(
  message: string,
  choices: { title: string; value: Value; description?: string; selected?: boolean; disabled?: boolean }[],
  options: { hint?: string } = {}
): Promise<Value[]> {
  const answer = await prompts({
    type: "multiselect",
    name: "value",
    message,
    choices,
    instructions: false,
    hint: options.hint ?? "space to select, enter to confirm",
  });

  if (answer.value === undefined) {
    cancel();
  }

  return answer.value as Value[];
}
