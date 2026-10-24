import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/Grid.jsx", import.meta.url), "utf8");
const cell = source.slice(source.indexOf('data-count-row-cell="1"'));
const handler = (name) => cell.match(new RegExp(`${name}=\\{\\(e\\) => \\{([\\s\\S]*?)\\n                  \\}\\}`))[1];

function harness(popupOpen) {
  let countRowPopupState = popupOpen ? {} : null;
  const countRowPressRef = { current: { timer: null, longPressed: false, pointerId: null, dismissPointerId: null } };
  const calls = [];
  const window = { setTimeout(callback) { calls.push("timer"); this.callback = callback; return 1; } };
  const clearCountRowLongPress = () => { countRowPressRef.current.timer = null; countRowPressRef.current.pointerId = null; };
  const setCountRowPopupState = (value) => { countRowPopupState = value; };
  const openCountRowSubdivisionPopup = () => { calls.push("open"); countRowPopupState = {}; };
  const setTupletAt = () => calls.push("subdivision");
  const resetTupletAt = () => calls.push("reset");
  const normalizedTupletOverridesByBar = [];
  const selectedCountRowSubdivision = 3;
  const baseForBar = () => 2;
  const t = { bar: 0, stepMeta: { quarterIndex: 0 } };
  const down = eval(`(e) => {${handler("onPointerDown")}}`);
  const up = eval(`(e) => {${handler("onPointerUp")}}`);
  const event = { pointerId: 1, button: 0, currentTarget: {}, stopPropagation() {} };
  return { down: () => down(event), up: () => up(event), calls, window, isOpen: () => !!countRowPopupState };
}

test("clicking the count row dismisses the menu without changing subdivisions", () => {
  const h = harness(true);
  h.down();
  assert.equal(h.isOpen(), false);
  h.up();
  assert.deepEqual(h.calls, []);
  h.down();
  h.up();
  assert.deepEqual(h.calls, ["timer", "subdivision"]);
});

test("ordinary count-row clicks still toggle subdivisions", () => {
  const h = harness(false);
  h.down();
  h.up();
  assert.deepEqual(h.calls, ["timer", "subdivision"]);
});

test("long pressing opens the menu without toggling subdivisions on release", () => {
  const h = harness(false);
  h.down();
  h.window.callback();
  h.up();
  assert.equal(h.isOpen(), true);
  assert.deepEqual(h.calls, ["timer", "open"]);
});
