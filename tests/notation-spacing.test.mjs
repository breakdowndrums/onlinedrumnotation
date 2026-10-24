import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Vex from "vexflow";

const { Stave, StaveNote, Voice, Formatter } = Vex.Flow;
const source = await readFile(new URL("../src/components/Notation.jsx", import.meta.url), "utf8");
const helper = source.slice(source.indexOf("function fitStavesToVoiceWidths("), source.indexOf("function drawNotationBarOverlay("));
const fit = new Function("Formatter", "Stave", `${helper}; return fitStavesToVoiceWidths;`)(Formatter, Stave);
const estimatorSource = source.slice(source.indexOf("function estimateNotationBarWidthDemand("), source.indexOf("function fitStavesToVoiceWidths("));
const estimate = new Function("CELL", `${estimatorSource}; return estimateNotationBarWidthDemand;`)({ OFF: "off" });
const availableWidth = (stave) => stave.getNoteEndX() - stave.getNoteStartX() - Stave.defaultPadding;

function makeVoice(beats, rests = false) {
  return new Voice({ num_beats: beats, beat_value: 8 }).addTickables(
    Array.from({ length: beats }, (_, index) => new StaveNote({
      keys: rests ? ["b/4"] : index === 0 ? ["g/5/x", "f/4"] : index === Math.floor(beats / 2) ? ["g/5/x", "c/5"] : ["g/5/x"],
      duration: rests ? "8r" : "8", clef: "percussion",
    }))
  );
}

test("matching 6/8 and 5/8 rhythms keep equal spacing across system positions", () => {
  const signatures = [5, 6, 6, 5];
  const staves = signatures.map((beats, index) => {
    const stave = new Stave(10, index < 2 ? 0 : 150, [330, 250, 350, 230][index]);
    if (index % 2 === 0) stave.addClef("percussion");
    stave.addTimeSignature(`${beats}/8`);
    stave.draw = () => {};
    return stave;
  });
  const voices = signatures.map((beats) => makeVoice(beats));
  fit({ voices, staves, rowBarCounts: [2, 2], renderer: { resize() {} }, height: 300 });
  assert.ok(Math.abs(availableWidth(staves[1]) - availableWidth(staves[2])) < 1e-6);
  assert.ok(Math.abs(availableWidth(staves[0]) - availableWidth(staves[3])) < 1e-6);
  const gaps = voices.map((voice, index) => {
    new Formatter().joinVoices([voice]).format([voice], availableWidth(staves[index]));
    return voice.getTickables().slice(1).map((note, offset) => note.getAbsoluteX() - voice.getTickables()[offset].getAbsoluteX());
  });
  gaps[1].forEach((gap, index) => assert.ok(Math.abs(gap - gaps[2][index]) < 1e-6));
  assert.equal(staves[1].getX(), staves[0].getX() + staves[0].getWidth());
  assert.equal(staves[3].getX(), staves[2].getX() + staves[2].getWidth());
});

test("width matching still leaves room for every rest in long empty bars", () => {
  for (const beats of [11, 15]) {
    const staves = [new Stave(10, 0, 120).addClef("percussion").addTimeSignature(`${beats}/8`), new Stave(130, 0, 100)];
    staves.forEach((stave) => { stave.draw = () => {}; });
    const voices = staves.map(() => makeVoice(beats, true));
    let svgWidth;
    fit({ voices, staves, rowBarCounts: [2], renderer: { resize(width) { svgWidth = width; } }, height: 200 });
    staves.forEach((stave, index) => {
      const minimum = new Formatter().joinVoices([voices[index]]).preCalculateMinTotalWidth([voices[index]]);
      assert.ok(availableWidth(stave) >= minimum + 11);
    });
    assert.ok(svgWidth >= staves[1].getX() + staves[1].getWidth() + 10);
  }
});

test("time signatures get extra leading space without compressing the notes", () => {
  const stave = new Stave(10, 0, 300).addClef("percussion").addTimeSignature("6/8");
  const originalStart = stave.getNoteStartX();
  const originalAvailable = availableWidth(stave);
  stave.__dgTimeSigNotePadding = 8;
  stave.draw = () => {};
  fit({ voices: [makeVoice(6)], staves: [stave], rowBarCounts: [1], renderer: { resize() {} }, height: 150 });
  assert.equal(stave.getNoteStartX(), originalStart + 8);
  assert.ok(availableWidth(stave) >= originalAvailable - 1e-6);
});

test("simultaneous hi-hat, snare and kick hits do not increase notation width", () => {
  const keysByInstrument = { hihat: "g/5/x", snare: "c/5", kick: "f/4" };
  const layouts = [["hihat"], ["hihat", "snare"], ["hihat", "snare", "kick"]].map((ids) => {
    const grid = Object.fromEntries(ids.map((id) => [id, Array.from({ length: 8 }, (_, step) => step % 2 === 0 ? "on" : "off")]));
    const demand = estimate({ grid, barStartStep: 0, barEndStep: 8, quarterSubdivisions: [2, 2, 2, 2], leadingWidthExtra: 78 });
    const stave = new Stave(10, 0, demand).addClef("percussion").addTimeSignature("4/4");
    stave.__dgTimeSigNotePadding = 8;
    stave.draw = () => {};
    const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables(
      Array.from({ length: 4 }, () => new StaveNote({ keys: ids.map((id) => keysByInstrument[id]), duration: "q", clef: "percussion" }))
    );
    fit({ voices: [voice], staves: [stave], rowBarCounts: [1], renderer: { resize() {} }, height: 150 });
    new Formatter().joinVoices([voice]).format([voice], availableWidth(stave) + 2);
    return { demand, width: stave.getWidth(), x: voice.getTickables().map((note) => note.getAbsoluteX()) };
  });
  for (const layout of layouts.slice(1)) {
    assert.equal(layout.demand, layouts[0].demand);
    assert.ok(Math.abs(layout.width - layouts[0].width) < 1e-6);
    layout.x.forEach((x, index) => assert.ok(Math.abs(x - layouts[0].x[index]) < 1e-6));
  }
});
