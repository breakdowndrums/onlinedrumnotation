import { buildMeterLayout } from "./meterLayout.js";

function toVarLen(value) {
  let v = Math.max(0, value | 0);
  const bytes = [v & 0x7f];
  while ((v >>= 7)) {
    bytes.unshift((v & 0x7f) | 0x80);
  }
  return bytes;
}

function writeU16BE(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}

function writeU32BE(n) {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function sanitizeFilename(name) {
  const base = String(name || "drum-grid")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return base || "drum-grid";
}

function denominatorPowerOfTwo(d) {
  let p = 0;
  let n = Math.max(1, d | 0);
  while (n > 1) {
    n >>= 1;
    p += 1;
  }
  return p;
}

function textBytes(text) {
  const s = String(text || "");
  if (typeof TextEncoder !== "undefined") {
    return Array.from(new TextEncoder().encode(s));
  }
  // ASCII fallback
  return Array.from(s).map((ch) => ch.charCodeAt(0) & 0x7f);
}

function metaTextEvent(type, text) {
  const bytes = textBytes(text);
  return [0xff, type & 0xff, ...toVarLen(bytes.length), ...bytes];
}

function encodePayloadMeta(payload) {
  try {
    const json = JSON.stringify(payload || {});
    if (typeof btoa === "function") {
      const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
      return `DG_PAYLOAD:${btoa(utf8)}`;
    }
  } catch (_) {}
  return "";
}

function getQuarterBeatsPerBar(ts) {
  return Math.max(1, Math.round(Number(ts?.n) || 1));
}

function getBaseSubdivPerQuarter(resolution, ts = { d: 4 }) {
  const beatValue = Math.max(1, Number(ts?.d) || 4);
  return Math.max(1, Math.round(resolution / beatValue));
}

function clampTupletValue(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(2, Math.min(12, Math.round(n)));
}

function resolveQuarterSubdivisions(tupletOverrides, baseSubdiv) {
  return (tupletOverrides || []).map((v) => clampTupletValue(v) ?? baseSubdiv);
}

function buildStepQuarterDurationsFromPayload(payload) {
  return buildMeterLayout(payload || {}).durations;
}

function pushTrackEvent(track, delta, bytes) {
  track.push(...toVarLen(Math.max(0, delta | 0)), ...bytes);
}

export function exportDrumMidi({
  grid,
  instruments,
  columns,
  resolution,
  bpm,
  timeSig,
  stepQuarterDurations,
  payload,
  title = "",
  composer = "",
  filename = "drum-grid",
}) {
  if (!grid || !Array.isArray(instruments) || instruments.length === 0) {
    throw new Error("No instrument data to export.");
  }
  if (!Number.isFinite(columns) || columns <= 0) {
    throw new Error("No steps to export.");
  }

  const PPQ = 480;
  const channel = 9; // MIDI channel 10 (0-based)
  const onStatus = 0x90 | channel;
  const offStatus = 0x80 | channel;
  const resolvedStepQuarterDurations =
    Array.isArray(stepQuarterDurations) && stepQuarterDurations.length === columns
      ? stepQuarterDurations.map((q) => (Number.isFinite(q) && q > 0 ? Number(q) : 1 / Math.max(1, Number(resolution) / 4)))
      : Array.from({ length: columns }, () => 1 / Math.max(1, Number(resolution) / 4));
  const ticksByStep = resolvedStepQuarterDurations.map((q) => Math.max(1, Math.round(PPQ * q)));
  const stepStarts = [];
  let tickCursor = 0;
  ticksByStep.forEach((tickLen) => {
    stepStarts.push(tickCursor);
    tickCursor += tickLen;
  });

  const events = [];
  const flamTicks = Math.max(1, Math.round(PPQ * (Number(bpm) || 120) / 60 * 0.025));
  const pickupTicks = instruments.some((inst) => grid[inst.id]?.[0] === "flam") ? flamTicks : 0;
  for (const inst of instruments) {
    if (!inst || !Number.isFinite(inst.midi)) continue;
    const row = grid[inst.id] || [];
    for (let step = 0; step < columns; step++) {
      const cell = row[step] ?? "off";
      if (cell === "off") continue;
      const tick = (stepStarts[step] ?? 0) + pickupTicks;
      const noteLen = Math.max(1, Math.floor((ticksByStep[step] || 1) * 0.95));
      const velocity = cell === "ghost" ? 56 : 100;
      if (cell === "flam") {
        const graceTick = Math.max(0, tick - Math.min(flamTicks, Math.max(1, Math.floor(ticksByStep[step] * 0.2))));
        events.push({ tick: graceTick, type: "on", note: inst.midi, velocity: 45 });
        events.push({ tick: Math.max(graceTick + 1, tick - 1), type: "off", note: inst.midi, velocity: 0 });
      }
      events.push({ tick, type: "on", note: inst.midi, velocity });
      events.push({ tick: tick + noteLen, type: "off", note: inst.midi, velocity: 0 });
    }
  }

  if (payload?.timeSigByBar?.length) {
    const layout = buildMeterLayout(payload);
    layout.meters.forEach((meter, bar) => {
      const previous = layout.meters[bar - 1];
      if (previous && previous.n === meter.n && previous.d === meter.d) return;
      events.push({ tick: bar === 0 ? 0 : (stepStarts[layout.offsets[bar]] || 0) + pickupTicks,
        type: "meta", bytes: [0xff, 0x58, 0x04, meter.n & 0xff, denominatorPowerOfTwo(meter.d) & 0xff, 24, 8] });
    });
  }
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.type === b.type) return 0;
    if (a.type === "meta" || b.type === "meta") return a.type === "meta" ? -1 : 1;
    return a.type === "off" ? -1 : 1;
  });

  const track = [];
  if (title.trim()) track.push(...toVarLen(0), ...metaTextEvent(0x03, title.trim())); // Track name
  if (composer.trim()) track.push(...toVarLen(0), ...metaTextEvent(0x01, `Composer: ${composer.trim()}`));
  const payloadMeta = payload ? encodePayloadMeta(payload) : "";
  if (payloadMeta) track.push(...toVarLen(0), ...metaTextEvent(0x01, payloadMeta));
  const tempo = Math.max(1, Math.round(60000000 / Math.max(1, Number(bpm) || 120)));
  track.push(
    ...toVarLen(0),
    0xff,
    0x51,
    0x03,
    (tempo >> 16) & 0xff,
    (tempo >> 8) & 0xff,
    tempo & 0xff
  );

  const tsn = Math.max(1, Number(timeSig?.n) || 4);
  const tsd = Math.max(1, Number(timeSig?.d) || 4);
  if (!payload?.timeSigByBar?.length) track.push(...toVarLen(0), 0xff, 0x58, 0x04, tsn & 0xff, denominatorPowerOfTwo(tsd) & 0xff, 24, 8);

  let lastTick = 0;
  for (const ev of events) {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    if (ev.type === "meta") track.push(...toVarLen(delta), ...ev.bytes);
    else track.push(...toVarLen(delta), ev.type === "on" ? onStatus : offStatus, ev.note & 0x7f, ev.velocity & 0x7f);
  }

  track.push(...toVarLen(0), 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    ...writeU32BE(6),
    ...writeU16BE(0), // format 0
    ...writeU16BE(1), // one track
    ...writeU16BE(PPQ),
  ];
  const trackChunkHeader = [0x4d, 0x54, 0x72, 0x6b, ...writeU32BE(track.length)];
  const bytes = new Uint8Array([...header, ...trackChunkHeader, ...track]);

  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(filename)}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportArrangementMidi({
  rows,
  instruments,
  title = "",
  composer = "",
  filename = "drum-arrangement",
}) {
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error("No arrangement data to export.");
  }
  if (!Array.isArray(instruments) || instruments.length < 1) {
    throw new Error("No instrument data to export.");
  }

  const PPQ = 480;
  const channel = 9;
  const onStatus = 0x90 | channel;
  const offStatus = 0x80 | channel;
  const timelineEvents = [];
  const firstPayload = rows.find((row) => row?.beat?.payload)?.beat?.payload;
  const firstBpm = Math.max(1, Number(rows[0]?.beatBpm || firstPayload?.bpm) || 120);
  const startsWithFlam = Object.values(firstPayload?.grid || {}).some((events) =>
    Array.isArray(events) && events.some(([step, value]) => step === 0 && value === 4)
  );
  let currentTick = startsWithFlam ? Math.max(1, Math.round(PPQ * firstBpm / 60 * 0.025)) : 0;
  let previousTempo = null;
  let previousTimeSig = null;

  rows.forEach((row) => {
    const payload = row?.beat?.payload;
    if (!payload || typeof payload !== "object") return;
    const repeats = Math.max(1, Number(row?.repeats) || 1);
    const bpm = Math.max(1, Number(row?.beatBpm || payload?.bpm) || 120);
    const timeSig = {
      n: Math.max(1, Number(payload?.timeSig?.n) || 4),
      d: Math.max(1, Number(payload?.timeSig?.d) || 4),
    };
    const tempo = Math.max(1, Math.round(60000000 / bpm));
    const tsKey = `${timeSig.n}/${timeSig.d}`;
    const stepQuarterDurations = buildStepQuarterDurationsFromPayload(payload);
    const ticksByStep = stepQuarterDurations.map((q) => Math.max(1, Math.round(PPQ * q)));
    const stepStarts = [];
    let localTick = 0;
    ticksByStep.forEach((tickLen) => {
      stepStarts.push(localTick);
      localTick += tickLen;
    });
    const sectionDurationTicks = localTick;
    const grid = payload?.grid && typeof payload.grid === "object" ? payload.grid : {};

    for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex++) {
      const repeatStartTick = currentTick;
      if (previousTempo !== tempo) {
        timelineEvents.push({
          tick: repeatStartTick,
          kind: "meta",
          bytes: [0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff],
        });
        previousTempo = tempo;
      }
      const meterLayout = buildMeterLayout(payload);
      meterLayout.meters.forEach((meter, bar) => {
        const key = `${meter.n}/${meter.d}`;
        if (previousTimeSig === key) return;
        timelineEvents.push({ tick: repeatStartTick + (stepStarts[meterLayout.offsets[bar]] || 0),
          kind: "meta", bytes: [0xff, 0x58, 0x04, meter.n & 0xff, denominatorPowerOfTwo(meter.d) & 0xff, 24, 8] });
        previousTimeSig = key;
      });

      for (const inst of instruments) {
        if (!inst || !Number.isFinite(inst.midi)) continue;
        const rowEvents = Array.isArray(grid[inst.id]) ? grid[inst.id] : [];
        for (const event of rowEvents) {
          const step = Math.max(0, Math.floor(Number(event?.[0])));
          const value = Number(event?.[1]) || 0;
          if (step >= stepStarts.length || value <= 0) continue;
          const tick = repeatStartTick + stepStarts[step];
          const noteLen = Math.max(1, Math.floor((ticksByStep[step] || 1) * 0.95));
          const velocity = value === 2 ? 56 : 100;
          if (value === 4) {
            const gap = Math.min(Math.max(1, Math.round(PPQ * bpm / 60 * 0.025)), Math.max(1, Math.floor(ticksByStep[step] * 0.2)));
            const graceTick = Math.max(0, tick - gap);
            const mainTick = tick;
            timelineEvents.push({ tick: graceTick, kind: "on", bytes: [onStatus, inst.midi & 0x7f, 45] });
            timelineEvents.push({ tick: Math.max(graceTick + 1, mainTick - 1), kind: "off", bytes: [offStatus, inst.midi & 0x7f, 0] });
            timelineEvents.push({ tick: mainTick, kind: "on", bytes: [onStatus, inst.midi & 0x7f, velocity] });
            timelineEvents.push({ tick: mainTick + noteLen, kind: "off", bytes: [offStatus, inst.midi & 0x7f, 0] });
            continue;
          }
          timelineEvents.push({ tick, kind: "on", bytes: [onStatus, inst.midi & 0x7f, velocity & 0x7f] });
          timelineEvents.push({
            tick: tick + noteLen,
            kind: "off",
            bytes: [offStatus, inst.midi & 0x7f, 0],
          });
        }
      }
      currentTick += sectionDurationTicks;
    }
  });

  timelineEvents.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.kind === b.kind) return 0;
    if (a.kind === "meta") return -1;
    if (b.kind === "meta") return 1;
    return a.kind === "off" ? -1 : 1;
  });

  const track = [];
  if (title.trim()) pushTrackEvent(track, 0, metaTextEvent(0x03, title.trim()));
  if (composer.trim()) pushTrackEvent(track, 0, metaTextEvent(0x01, `Composer: ${composer.trim()}`));

  let lastTick = 0;
  timelineEvents.forEach((ev) => {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    pushTrackEvent(track, delta, ev.bytes);
  });
  track.push(...toVarLen(0), 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64,
    ...writeU32BE(6),
    ...writeU16BE(0),
    ...writeU16BE(1),
    ...writeU16BE(PPQ),
  ];
  const trackChunkHeader = [0x4d, 0x54, 0x72, 0x6b, ...writeU32BE(track.length)];
  const bytes = new Uint8Array([...header, ...trackChunkHeader, ...track]);

  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(filename)}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
