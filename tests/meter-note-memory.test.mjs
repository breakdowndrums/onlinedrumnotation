import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMeterLayout } from "../src/utils/meterLayout.js";
import { normalizeMeterNoteMemory, preserveNotesAcrossMeters } from "../src/utils/meterNoteMemory.js";

function layout(meter, resolution = 8) {
  return buildMeterLayout({ bars: 2, resolution, timeSig: { n: 4, d: 4 }, timeSigByBar: [meter, { n: 4, d: 4 }] });
}
const full = layout({ n: 4, d: 4 });
const short = layout({ n: 4, d: 8 });
const grid = { hihat: ["on", "ghost", "accent", "flam", "on", "ghost", "accent", "flam", "on", "off", "on", "off", "on", "off", "on", "off"] };

test("4/4 to 4/8 and back restores every note and its articulation", () => {
  const shortened = preserveNotesAcrossMeters({ before: full, after: short, grid });
  assert.equal(shortened.grid.hihat.filter((value) => value !== "off").length, 8);
  assert.equal(shortened.memory[0].notes.length, 8);
  const restored = preserveNotesAcrossMeters({ before: short, after: full, ...shortened });
  assert.deepEqual(restored.grid, grid);
  assert.deepEqual(restored.memory, {});
});

test("hidden sticking and selected sticking survive saving and sharing", () => {
  const shortened = preserveNotesAcrossMeters({ before: full, after: short, grid,
    sticking: { "hihat:6": "L" }, selection: { "hihat:6": true } });
  const saved = JSON.parse(JSON.stringify(shortened));
  saved.memory = normalizeMeterNoteMemory(saved.memory);
  const restored = preserveNotesAcrossMeters({ before: short, after: full, ...saved });
  assert.equal(restored.sticking["hihat:6"], "L");
  assert.equal(restored.selection["hihat:6"], true);
});

test("edits to visible notes are retained without losing hidden notes", () => {
  const shortened = preserveNotesAcrossMeters({ before: full, after: short, grid });
  shortened.grid.hihat[0] = "ghost";
  shortened.grid.hihat[1] = "off";
  const restored = preserveNotesAcrossMeters({ before: short, after: full, ...shortened });
  assert.equal(restored.grid.hihat[0], "ghost");
  assert.equal(restored.grid.hihat[1], "off");
  assert.deepEqual(restored.grid.hihat.slice(4), grid.hihat.slice(4));
});

test("numerator changes retain notes beyond the shortened bar", () => {
  const three = layout({ n: 3, d: 4 });
  const shortened = preserveNotesAcrossMeters({ before: full, after: three, grid });
  const restored = preserveNotesAcrossMeters({ before: three, after: full, ...shortened });
  assert.deepEqual(restored.grid, grid);
});

test("notes merged on a coarser grid are restored independently", () => {
  const originalLayout = layout({ n: 4, d: 8 }, 4);
  const coarseLayout = layout({ n: 4, d: 4 }, 4);
  const original = { hihat: ["on", "ghost", "accent", "flam", "off", "off", "off", "off"] };
  const merged = preserveNotesAcrossMeters({ before: originalLayout, after: coarseLayout, grid: original });
  const restored = preserveNotesAcrossMeters({ before: coarseLayout, after: originalLayout, ...merged });
  assert.deepEqual(restored.grid, original);
});

test("empty memory does not resurrect deliberately cleared notes", () => {
  const shortened = preserveNotesAcrossMeters({ before: full, after: short, grid });
  const cleared = Object.fromEntries(Object.keys(shortened.grid).map((id) => [id, Array(short.durations.length).fill("off")]));
  const restored = preserveNotesAcrossMeters({ before: short, after: full, grid: cleared, memory: {} });
  assert.ok(restored.grid.hihat.every((value) => value === "off"));
});
