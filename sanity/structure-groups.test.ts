import assert from "node:assert/strict";
import { test } from "node:test";
import { grouped, isDivider } from "./structure-groups";

const divider = { type: "divider" } as const;
const item = (title: string) => ({ title });

test("isDivider tells the one plain object apart from the builders around it", () => {
  assert.ok(isDivider(divider));
  assert.ok(!isDivider(item("Pages")));
  assert.ok(!isDivider(undefined));
  assert.ok(!isDivider(null));
});

test("a group removed from the middle takes its leftover divider with it", () => {
  // What `npm run trim` leaves behind: the items went, the rules that framed them did not.
  const before = [item("Pages"), divider, divider, item("Site")];

  assert.deepEqual(grouped(before), [item("Pages"), divider, item("Site")]);
});

test("a divider at either end is dropped, since it frames nothing", () => {
  assert.deepEqual(grouped([divider, item("Pages")]), [item("Pages")]);
  assert.deepEqual(grouped([item("Pages"), divider]), [item("Pages")]);
  assert.deepEqual(grouped([divider, item("Pages"), divider]), [item("Pages")]);
});

test("a run of dividers collapses to one, however long", () => {
  assert.deepEqual(grouped([item("A"), divider, divider, divider, item("B")]), [item("A"), divider, item("B")]);
});

test("a list of nothing but dividers comes back empty", () => {
  assert.deepEqual(grouped([divider, divider]), []);
});

test("a list that needs no tidying is returned unchanged", () => {
  const list = [item("Pages"), divider, item("Site")];

  assert.deepEqual(grouped(list), list);
});
