import React, { useEffect, useRef, useState } from "react";
import Vex from "vexflow";

// VexFlow API
const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Fraction, Barline } = Vex.Flow;

// ====================
// INSTRUMENT SET (MVP+)
// ====================
const INSTRUMENTS = [
  { id: "kick", label: "Kick", midi: 36 },
  { id: "snare", label: "Snare", midi: 38 },
  { id: "hihat", label: "Hi-Hat", midi: 42 },
  { id: "hihatFoot", label: "HH Foot", midi: 44 },
  { id: "tom2", label: "Tom 2", midi: 45 },
  { id: "tom1", label: "Tom 1", midi: 48 },
  { id: "floorTom", label: "Floor Tom", midi: 41 },
  { id: "ride", label: "Ride", midi: 51 },
  { id: "crash1", label: "Crash 1", midi: 49 },
  { id: "crash2", label: "Crash 2", midi: 57 },
];

const VELOCITY_CYCLE = [0, 100];

const VELOCITY_COLOR = {
  0: "bg-neutral-800",
  100: "bg-[#00b3ba]",
};

// NOTE: mapping is a starting point; we'll refine staff positions later.
const NOTATION_MAP = {
  kick: { key: "f/4" },
  snare: { key: "c/5" },

  // Cymbals / hats use X noteheads
  hihat: { key: "g/5/x2", x: true },
  hihatFoot: { key: "f/4/x2", x: true },
  ride: { key: "f/5/x2", x: true },
  crash1: { key: "a/5/x2", x: true },
  crash2: { key: "c/6/x2", x: true },

  // Toms
  tom2: { key: "a/4" },
  tom1: { key: "c/5" },
  floorTom: { key: "f/4" },
};

export default function App() {
  const [resolution, setResolution] = useState(8); // 4, 8, 16
  const [bars, setBars] = useState(2);
  const [timeSig, setTimeSig] = useState({ n: 4, d: 4 });
  const [keepTiming, setKeepTiming] = useState(true);
  const [mergeRests, setMergeRests] = useState(true);
  const [mergeNotes, setMergeNotes] = useState(true);

  const stepsPerBar = Math.max(1, Math.round((timeSig.n * resolution) / timeSig.d));
  const columns = bars * stepsPerBar;


  const computeStepsPerBar = (ts, res) => Math.max(1, Math.round((ts.n * res) / ts.d));

  const remapGrid = (prevGrid, oldStepsPerBar, newStepsPerBar) => {
    const next = {};
    INSTRUMENTS.forEach((inst) => {
      const out = Array(bars * newStepsPerBar).fill(0);
      for (let b = 0; b < bars; b++) {
        for (let s = 0; s < oldStepsPerBar; s++) {
          const oldGlobal = b * oldStepsPerBar + s;
          const val = prevGrid[inst.id]?.[oldGlobal] ?? 0;
          if (val === 0) continue;

          const newLocal = Math.round((s * newStepsPerBar) / oldStepsPerBar);
          const clamped = Math.min(newStepsPerBar - 1, Math.max(0, newLocal));
          const newGlobal = b * newStepsPerBar + clamped;

          out[newGlobal] = Math.max(out[newGlobal] ?? 0, val);
        }
      }
      next[inst.id] = out;
    });
    return next;
  };

  const handleResolutionChange = (newRes) => {
    if (!keepTiming) {
      setResolution(newRes);
      return;
    }
    const oldSPB = stepsPerBar;
    const newSPB = computeStepsPerBar(timeSig, newRes);
    setGrid((prev) => remapGrid(prev, oldSPB, newSPB));
    setResolution(newRes);
  };

  const handleTimeSigChange = (newTS) => {
    if (!keepTiming) {
      setTimeSig(newTS);
      return;
    }
    const oldSPB = stepsPerBar;
    const newSPB = computeStepsPerBar(newTS, resolution);
    setGrid((prev) => remapGrid(prev, oldSPB, newSPB));
    setTimeSig(newTS);
  };


  const [grid, setGrid] = useState(() => {
    const g = {};
    INSTRUMENTS.forEach((i) => (g[i.id] = Array(columns).fill(0)));
    return g;
  });

  // Resize grid when resolution/bars change (preserve existing hits)
  useEffect(() => {
    setGrid((prev) => {
      const next = {};
      INSTRUMENTS.forEach((i) => {
        next[i.id] = Array(columns)
          .fill(0)
          .map((_, idx) => prev[i.id]?.[idx] ?? 0);
      });
      return next;
    });
  }, [columns]);

  const cycleVelocity = (inst, idx) => {
    setGrid((prev) => {
      const current = prev[inst][idx];
      const nextVal =
        VELOCITY_CYCLE[(VELOCITY_CYCLE.indexOf(current) + 1) % VELOCITY_CYCLE.length];

      return {
        ...prev,
        [inst]: prev[inst].map((v, i) => (i === idx ? nextVal : v)),
      };
    });
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold mr-4">Drum Grid → Notation</h1>

        <label className="text-sm text-neutral-300 flex items-center gap-2">
          Resolution
          <select
            value={resolution}
            onChange={(e) => handleResolutionChange(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1"
          >
            <option value={4}>4th</option>
            <option value={8}>8th</option>
            <option value={16}>16th</option>
          </select>
        </label>

        <label className="text-sm text-neutral-300 flex items-center gap-2">
          <input
            type="checkbox"
            checked={keepTiming}
            onChange={(e) => setKeepTiming(e.target.checked)}
          />
          Keep timing
        </label>


        <label className="text-sm text-neutral-300 flex items-center gap-2">
          Time
          <select
            value={`${timeSig.n}/${timeSig.d}`}
            onChange={(e) => {
              const [n, d] = e.target.value.split("/").map(Number);
              handleTimeSigChange({ n, d });
            }}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1"
          >
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="6/8">6/8</option>
          </select>
        </label>

        <label className="text-sm text-neutral-300 flex items-center gap-2">
          Bars
          <input
            type="number"
            min={1}
            max={8}
            value={bars}
            onChange={(e) => setBars(Number(e.target.value))}
            className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1"
          />
        </label>

        <button
          onClick={() => setMergeRests((v) => !v)}
          className={`px-3 py-2 rounded border text-sm ${mergeRests ? "bg-neutral-800 border-neutral-700" : "bg-neutral-900 border-neutral-700"} `}
          title="Merge consecutive rests into larger rests"
        >
          Merge rests: {mergeRests ? "On" : "Off"}
        </button>

        <button
          onClick={() => setMergeNotes((v) => !v)}
          className={`px-3 py-2 rounded border text-sm ${mergeNotes ? "bg-neutral-800 border-neutral-700" : "bg-neutral-900 border-neutral-700"} `}
          title="Merge notes across empty subdivisions (e.g., 8ths on 1 and 2 become quarters when & is empty)"
        >
          Merge notes: {mergeNotes ? "On" : "Off"}
        </button>

        <div className="text-xs text-neutral-400 ml-auto">
          Click cell: Off → 100 → Off
        </div>
      </header>

      <main className="mt-6 grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-6 items-start">
        <div className="overflow-x-auto rounded-lg border border-neutral-800 p-3 bg-neutral-950/30">
          <Grid grid={grid} columns={columns} bars={bars} stepsPerBar={stepsPerBar} resolution={resolution} timeSig={timeSig} cycleVelocity={cycleVelocity} />
        </div>

        <div className="rounded-lg border border-neutral-800 p-3 bg-neutral-950/30">
          <Notation grid={grid} resolution={resolution} bars={bars} stepsPerBar={stepsPerBar} timeSig={timeSig} mergeRests={mergeRests} mergeNotes={mergeNotes} />
        </div>
      </main>
    </div>
  );
}


function Grid({ grid, columns, bars, stepsPerBar, resolution, timeSig, cycleVelocity }) {
  // Build a render timeline with a visual gap between bars.
  // Example for 2 bars of 8ths: [0..7, GAP, 8..15]
  const timeline = [];
  for (let b = 0; b < bars; b++) {
    for (let s = 0; s < stepsPerBar; s++) {
      timeline.push({ type: "step", stepIndex: b * stepsPerBar + s, bar: b, stepInBar: s });
    }
    if (b < bars - 1) timeline.push({ type: "gap" });
  }

  const labelFor = (stepInBar) => {
    // Beat unit is denominator (d). Steps per beat = resolution / d.
    const stepsPerBeat = Math.max(1, Math.round(resolution / timeSig.d));
    const beat = Math.floor(stepInBar / stepsPerBeat) + 1;
    const sub = stepInBar % stepsPerBeat;

    if (stepsPerBeat === 1) return `${beat}`;
    if (stepsPerBeat === 2) return sub === 0 ? `${beat}` : "&";
    if (stepsPerBeat === 4) return [String(beat), "e", "&", "a"][sub];
    return sub === 0 ? `${beat}` : "·";
  };

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${timeline.length}, 28px)` }}>
      <div />
      {timeline.map((t, i) =>
        t.type === "gap" ? (
          <div key={`h-gap-${i}`} className="w-7 h-7" />
        ) : (
          <div
            key={`h-${t.stepIndex}`}
            className="text-[10px] text-center text-neutral-400 select-none px-1 whitespace-nowrap"
            title={`Bar ${t.bar + 1}, step ${t.stepInBar + 1}`}
          >
            {labelFor(t.stepInBar)}
          </div>
        )
      )}

      {[...INSTRUMENTS].reverse().map((inst) => (
        <React.Fragment key={inst.id}>
          <div className="pr-2 pl-2 text-xs text-right whitespace-nowrap">{inst.label}</div>

          {timeline.map((t, i) => {
            if (t.type === "gap") return <div key={`${inst.id}-gap-${i}`} className="w-7 h-7" />;

            const val = grid[inst.id][t.stepIndex];
            return (
              <div
                key={`${inst.id}-${t.stepIndex}`}
                onClick={() => cycleVelocity(inst.id, t.stepIndex)}
                className={`w-7 h-7 border border-neutral-800 cursor-pointer ${VELOCITY_COLOR[val]}`}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function Notation({ grid, resolution, bars, stepsPerBar, timeSig, mergeRests, mergeNotes }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";

    const barWidth = 300;
    const height = 240;
    const width = 20 + bars * barWidth;

    const renderer = new Renderer(ref.current, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();

    const dur = resolution === 4 ? "q" : resolution === 8 ? "8" : "16";

    const staves = [];
    const voices = [];
    const allBeams = [];

    for (let b = 0; b < bars; b++) {
      const x = 10 + b * barWidth;
      const stave = new Stave(x, 40, barWidth);

      // Remove repeated left barline so bars connect visually
      if (b > 0) stave.setBegBarType(Barline.type.NONE);

      if (b === 0) {
        stave.addClef("percussion");
        stave.addTimeSignature(`${timeSig.n}/${timeSig.d}`);
      }

      stave.setContext(ctx).draw();
      staves.push(stave);

      const notes = [];

      let s = 0;
      while (s < stepsPerBar) {
        const globalIdx = b * stepsPerBar + s;

        const keys = [];
        
        INSTRUMENTS.forEach((inst) => {
          const val = grid[inst.id][globalIdx];
          if (val !== 0) {
            keys.push(NOTATION_MAP[inst.id].key);
          }
        });

        const isRest = keys.length === 0;

        // Merge notes/rests to larger durations (optional)
        const stepsPerBeat = Math.max(1, Math.round(resolution / timeSig.d));
        const subInBeat = stepsPerBeat === 0 ? 0 : (s % stepsPerBeat);

        const hasAnyHitAt = (absIdx) => {
          for (const inst of INSTRUMENTS) {
            if (grid[inst.id][absIdx] !== 0) return true;
          }
          return false;
        };

        const isStepEmpty = (absIdx) => !hasAnyHitAt(absIdx);

        // --- Merge NOTES ---
        if (mergeNotes && !isRest) {
          // 8ths in x/4: beat is a quarter, pattern: [hit][empty] -> quarter note
          if (resolution === 8 && stepsPerBeat === 2 && subInBeat === 0 && s + 1 < stepsPerBar) {
            if (isStepEmpty(b * stepsPerBar + (s + 1))) {
              const noteQ = new StaveNote({ keys, duration: "q", clef: "percussion" });
              noteQ.setStemDirection(1);
              notes.push(noteQ);
              s += 2;
              continue;
            }
          }

          // 16ths:
          // - In x/4 (stepsPerBeat=4):
          //   * [hit][empty][empty][empty] at beat start -> quarter note
          //   * [hit][empty] at 8th boundaries (sub 0 or 2) -> eighth note
          if (resolution === 16 && stepsPerBeat === 4) {
            if (subInBeat === 0 && s + 3 < stepsPerBar) {
              const a = b * stepsPerBar + (s + 1);
              const b2 = b * stepsPerBar + (s + 2);
              const c = b * stepsPerBar + (s + 3);
              if (isStepEmpty(a) && isStepEmpty(b2) && isStepEmpty(c)) {
                const noteQ = new StaveNote({ keys, duration: "q", clef: "percussion" });
                noteQ.setStemDirection(1);
                notes.push(noteQ);
                s += 4;
                continue;
              }
            }
            if ((subInBeat === 0 || subInBeat === 2) && s + 1 < stepsPerBar) {
              const next = b * stepsPerBar + (s + 1);
              if (isStepEmpty(next)) {
                const note8 = new StaveNote({ keys, duration: "8", clef: "percussion" });
                note8.setStemDirection(1);
                notes.push(note8);
                s += 2;
                continue;
              }
            }
          }

          // 16ths in x/8 (stepsPerBeat=2): [hit][empty] -> eighth note (beat unit)
          if (resolution === 16 && stepsPerBeat === 2 && subInBeat === 0 && s + 1 < stepsPerBar) {
            if (isStepEmpty(b * stepsPerBar + (s + 1))) {
              const note8 = new StaveNote({ keys, duration: "8", clef: "percussion" });
              note8.setStemDirection(1);
              notes.push(note8);
              s += 2;
              continue;
            }
          }
        }

        // --- Merge RESTS ---
        if (mergeRests && isRest) {
          // 8ths in x/4: [rest][rest] at beat start -> quarter rest
          if (resolution === 8 && stepsPerBeat === 2 && subInBeat === 0 && s + 1 < stepsPerBar) {
            if (isStepEmpty(b * stepsPerBar + (s + 1))) {
              notes.push(new StaveNote({ keys: ["b/4"], duration: "qr", clef: "percussion" }));
              s += 2;
              continue;
            }
          }

          // 16ths in x/4:
          //  * [rest][rest][rest][rest] at beat start -> quarter rest
          //  * [rest][rest] at 8th boundaries (sub 0 or 2) -> eighth rest
          if (resolution === 16 && stepsPerBeat === 4) {
            if (subInBeat === 0 && s + 3 < stepsPerBar) {
              const a = b * stepsPerBar + (s + 1);
              const b2 = b * stepsPerBar + (s + 2);
              const c = b * stepsPerBar + (s + 3);
              if (isStepEmpty(a) && isStepEmpty(b2) && isStepEmpty(c)) {
                notes.push(new StaveNote({ keys: ["b/4"], duration: "qr", clef: "percussion" }));
                s += 4;
                continue;
              }
            }
            if ((subInBeat === 0 || subInBeat === 2) && s + 1 < stepsPerBar) {
              const next = b * stepsPerBar + (s + 1);
              if (isStepEmpty(next)) {
                notes.push(new StaveNote({ keys: ["b/4"], duration: "8r", clef: "percussion" }));
                s += 2;
                continue;
              }
            }
          }

          // 16ths in x/8 (stepsPerBeat=2): [rest][rest] -> eighth rest
          if (resolution === 16 && stepsPerBeat === 2 && subInBeat === 0 && s + 1 < stepsPerBar) {
            if (isStepEmpty(b * stepsPerBar + (s + 1))) {
              notes.push(new StaveNote({ keys: ["b/4"], duration: "8r", clef: "percussion" }));
              s += 2;
              continue;
            }
          }
        }

        if (isRest) {
          notes.push(new StaveNote({ keys: ["b/4"], duration: dur + "r", clef: "percussion" }));
          s += 1;
          continue;
        }

        const note = new StaveNote({ keys, duration: dur, clef: "percussion" });
        // Force stems (and therefore beams) upwards
        note.setStemDirection(1);

        // MVP: if any cymbal is present in this slice, use X noteheads for the chord.
        // Next upgrade: per-key notehead types.

        notes.push(note);
        s += 1;
      }

      const voice = new Voice({ num_beats: timeSig.n, beat_value: timeSig.d });
      voice.setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);
      voices.push(voice);

      // Beaming groups
      let groups;
      if (timeSig.n === 6 && timeSig.d === 8) {
        // Typical 6/8: 3+3 grouping
        groups = [new Fraction(3, 8)];
      } else {
        // Beam by beat unit
        groups = [new Fraction(1, timeSig.d)];
      }

      // Safety: enforce stem up on all non-rest notes before beaming
      notes.forEach((n) => {
        try {
          if (typeof n.isRest === "function" ? !n.isRest() : !String(n.getDuration?.() ?? "").includes("r")) {
            n.setStemDirection?.(1);
          }
        } catch {}
      });

      const beams = Beam.generateBeams(notes, { groups, stem_direction: 1 });
      allBeams.push(...beams);
    }

    // Format and draw each bar independently (format to stave so barlines stay correct)
    for (let b = 0; b < bars; b++) {
      const formatter = new Formatter().joinVoices([voices[b]]);
      formatter.formatToStave([voices[b]], staves[b]);
      voices[b].draw(ctx, staves[b]);
    }

    // Draw beams last for clarity
    allBeams.forEach((beam) => beam.setContext(ctx).draw());


    // White notation on dark UI
    const svg = ref.current.querySelector("svg");
    if (svg) {
      svg.style.background = "transparent";
      svg.querySelectorAll("path, line, rect, circle").forEach((el) => {
        el.setAttribute("stroke", "white");
        el.setAttribute("fill", "white");
      });
      svg.querySelectorAll("text").forEach((el) => {
        el.setAttribute("fill", "white");
      });
    }
  }, [grid, resolution, bars, stepsPerBar, timeSig, mergeRests, mergeNotes]);

  return <div ref={ref} />;
}
