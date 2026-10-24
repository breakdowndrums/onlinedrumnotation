import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildMeterLayout, mapMeterStep } from "../src/utils/meterLayout.js";
import { exportDrumMidi, exportArrangementMidi } from "../src/utils/exportMidi.js";
import { importDrumMidi } from "../src/utils/importMidi.js";

const payload = {
  v: 1, bars: 4, resolution: 8, timeSig: { n: 4, d: 4 },
  timeSigByBar: [{ n: 4, d: 4 }, { n: 4, d: 4 }, { n: 7, d: 8 }, { n: 4, d: 4 }],
  kitInstrumentIds: ["kick"], grid: { kick: [[0, 1], [8, 1], [16, 1], [23, 1]] }, bpm: 120,
};
const instruments = [{ id: "kick", midi: 36 }];

test("mixed meters produce correct columns, durations and downbeats", () => {
  const layout = buildMeterLayout(payload);
  assert.deepEqual(layout.offsets, [0, 8, 16, 23, 31]);
  assert.equal(layout.durations.reduce((sum, value) => sum + value, 0), 15.5);
  assert.deepEqual(layout.metronome.flatMap((value, step) => value === 2 ? [step] : []), [0, 8, 16, 23]);
  assert.equal(layout.metronome.filter(Boolean).length, 19);
});

test("legacy uniform beats retain their layout", () => {
  const layout = buildMeterLayout({ bars: 2, resolution: 16, timeSig: { n: 4, d: 4 } });
  assert.deepEqual(layout.offsets, [0, 16, 32]);
  assert.equal(layout.durations.reduce((sum, value) => sum + value, 0), 8);
});

test("tuplets honor the local denominator", () => {
  const layout = buildMeterLayout({ ...payload, tupletsByBar: [[], [], [3]] });
  assert.equal(layout.subdivisions[2][0], 3);
  assert.equal(layout.durations[16], 1 / 6);
  const duration = layout.durations.slice(layout.offsets[2], layout.offsets[3]).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(duration - 3.5) < 1e-9);
});

test("changing a bar preserves musical positions in all following bars", () => {
  const before = buildMeterLayout(payload);
  const after = buildMeterLayout({ ...payload, timeSigByBar: payload.timeSigByBar.map((meter, i) => i === 2 ? { n: 9, d: 8 } : meter) });
  assert.equal(mapMeterStep(20, before, after), 20);
  assert.equal(mapMeterStep(23, before, after), 25);
  assert.equal(mapMeterStep(27, before, after), 29);
  assert.equal(mapMeterStep(29, after, before), 27);
});

test("shortening a bar flags notes beyond its new duration", () => {
  const before = buildMeterLayout(payload);
  const after = buildMeterLayout({ ...payload, timeSigByBar: payload.timeSigByBar.map((meter, i) => i === 2 ? { n: 3, d: 8 } : meter) });
  assert.equal(mapMeterStep(20, before, after), -1);
  assert.equal(mapMeterStep(23, before, after), 19);
});

async function captureMidi(action) {
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const oldCreate = URL.createObjectURL;
  const oldRevoke = URL.revokeObjectURL;
  let blob;
  globalThis.window = { setTimeout() {} };
  globalThis.document = { createElement: () => ({ click() {}, remove() {}, style: {} }), body: { appendChild() {}, removeChild() {} } };
  URL.createObjectURL = (value) => { blob = value; return "blob:test"; };
  URL.revokeObjectURL = () => {};
  try { action(); return new Uint8Array(await blob.arrayBuffer()); }
  finally { globalThis.document = oldDocument; globalThis.window = oldWindow; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; }
}

function midiMeters(bytes) {
  let index = 22, tick = 0;
  const meters = [];
  const readVar = () => { let value = 0, b; do { b = bytes[index++]; value = (value << 7) | (b & 127); } while (b & 128); return value; };
  while (index < bytes.length) {
    tick += readVar();
    const status = bytes[index++];
    if (status === 255) {
      const type = bytes[index++];
      const length = readVar();
      if (type === 88) meters.push([tick, bytes[index], 2 ** bytes[index + 1]]);
      index += length;
    } else { index += 2; }
  }
  return meters;
}

test("MIDI export emits local signature changes and keeps its embedded beat payload", async () => {
  const layout = buildMeterLayout(payload);
  const grid = { kick: Array(31).fill("off") };
  payload.grid.kick.forEach(([step]) => { grid.kick[step] = "on"; });
  const bytes = await captureMidi(() => exportDrumMidi({ grid, instruments, columns: 31,
    resolution: 8, bpm: 120, timeSig: payload.timeSig, stepQuarterDurations: layout.durations, payload }));
  assert.deepEqual(midiMeters(bytes), [[0, 4, 4], [3840, 7, 8], [5520, 4, 4]]);
  const imported = importDrumMidi({ arrayBuffer: bytes.buffer });
  assert.deepEqual(imported.payload.timeSigByBar, payload.timeSigByBar);
  assert.deepEqual(imported.payload.grid, payload.grid);
});

test("sheet MIDI repeats the signature changes each time the beat repeats", async () => {
  const bytes = await captureMidi(() => exportArrangementMidi({
    rows: [{ beat: { payload }, repeats: 2, beatBpm: 120 }], instruments,
  }));
  assert.deepEqual(midiMeters(bytes), [[0, 4, 4], [3840, 7, 8], [5520, 4, 4], [11280, 7, 8], [12960, 4, 4]]);
});

test("playback uses each bar's downbeat and note duration", async () => {
  const source = await readFile(new URL("../src/audio/engine.js", import.meta.url));
  const { makeAudioEngine } = await import(`data:text/javascript;base64,${source.toString("base64")}`);
  const previousWindow = globalThis.window;
  const hits = [];
  let tick;
  class Context {
    currentTime = 0; state = "running"; destination = {};
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createBufferSource() { return { buffer: null, connect() {}, start(time) { hits.push({ time, buffer: this.buffer }); }, stop() {} }; }
  }
  globalThis.window = { AudioContext: Context, setInterval(callback) { tick = callback; return 1; }, clearInterval() {} };
  try {
    const layout = buildMeterLayout(payload);
    const engine = makeAudioEngine(); engine.ensureContext();
    engine.setBuffers({ metronomeHi: "accent", metronomeLo: "beat" });
    engine.setTransport({ nextBpm: 120, nextColumns: 31, nextResolution: 8, nextTimeSig: payload.timeSig,
      nextStepQuarterDurations: layout.durations, nextStepMetronomeBeats: layout.metronome, nextMetronomeEnabled: true });
    const start = await engine.play(() => ({ instruments: [], grid: {}, columns: 31 }));
    for (let time = 0.05; time < 7.7; time += 0.05) { engine.getContext().currentTime = time; tick(); }
    const accents = hits.filter((hit) => hit.buffer === "accent").map((hit) => Number((hit.time - start).toFixed(4)));
    assert.deepEqual(accents.slice(0, 4), [0, 2, 4, 5.75]);
    engine.stop();
  } finally { globalThis.window = previousWindow; }
});
