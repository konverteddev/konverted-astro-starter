/**
 * Records a section or document type this project wrote, so the trim's coverage check leaves it be.
 * Plop runs it after scaffolding one; in the starter itself it records nothing, since there it is kit.
 */

import { detectRole, originRepository, readProjectRecord, writeProjectRecord } from "./project";

const root = process.cwd();
const [kind, name] = process.argv.slice(2);

if ((kind !== "section" && kind !== "type") || !name) {
  console.error("Usage: own.ts <section|type> <name>");
  process.exit(1);
}

const record = readProjectRecord(root);

if (detectRole(record, originRepository(root)) === "starter") {
  console.log(`${name} is starter kit here: give it an entry in scripts/trim-features/features.ts.`);
  process.exit(0);
}

const list = kind === "section" ? record.sections : record.documentTypes;

if (!list.includes(name)) {
  list.push(name);
  writeProjectRecord(root, record);
}
