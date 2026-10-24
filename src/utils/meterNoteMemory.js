const rank = { off: 0, ghost: 1, on: 2, accent: 3, flam: 4 };
const noteId = (instrument, time) => `${instrument}:${Number(time).toFixed(9)}`;
const layoutKey = (layout, bar) => JSON.stringify([layout.meters[bar], layout.subdivisions[bar]]);

function projectNotes(notes, layout, bar) {
  const slots = new Map();
  const start = layout.offsets[bar];
  const end = layout.offsets[bar + 1];
  const meter = layout.meters[bar];
  for (const note of notes) {
    if (note.time >= meter.n * 4 / meter.d - 1e-8) continue;
    let step = start;
    for (let candidate = start + 1; candidate < end; candidate++) {
      if (Math.abs(layout.localTimes[candidate] - note.time) < Math.abs(layout.localTimes[step] - note.time) - 1e-8) step = candidate;
    }
    const key = `${note.instrument}:${step - start}`;
    const previous = slots.get(key);
    if (!previous || rank[note.value] > rank[previous.note.value]) slots.set(key, { note, step });
  }
  return slots;
}

export function normalizeMeterNoteMemory(raw, bars = 8) {
  const memory = {};
  for (let bar = 0; bar < bars; bar++) {
    const source = raw?.[bar];
    if (!Array.isArray(source?.notes)) continue;
    const notes = source.notes.filter((note) =>
      typeof note?.instrument === "string" && Number.isFinite(note.time) && note.time >= 0 &&
      note.time < 128 && rank[note.value] > 0
    ).slice(0, 4096).map((note) => ({ instrument: note.instrument, time: note.time, value: note.value,
      sticking: note.sticking === "R" || note.sticking === "L" ? note.sticking : "", selected: note.selected === true }));
    if (notes.length) memory[bar] = { notes, layoutKey: String(source.layoutKey || ""),
      visible: source.visible && typeof source.visible === "object" ? { ...source.visible } : {} };
  }
  return memory;
}

// Hidden notes retain their original musical time; visible edits update only their source note.
export function preserveNotesAcrossMeters({ before, after, grid, memory = {}, sticking = {}, selection = {} }) {
  const instruments = Object.keys(grid);
  const nextGrid = Object.fromEntries(instruments.map((id) => [id, Array(after.durations.length).fill("off")]));
  const nextSticking = {};
  const nextSelection = {};
  const nextMemory = {};
  const safeMemory = normalizeMeterNoteMemory(memory, before.meters.length);
  before.meters.forEach((_, bar) => {
    const saved = safeMemory[bar];
    const notes = new Map((saved?.notes || []).filter((note) => instruments.includes(note.instrument))
      .map((note) => [noteId(note.instrument, note.time), { ...note }]));
    const previousVisible = saved?.layoutKey === layoutKey(before, bar) ? saved.visible : Object.fromEntries(
      [...projectNotes([...notes.values()], before, bar)].map(([key, entry]) => [key, noteId(entry.note.instrument, entry.note.time)])
    );
    const start = before.offsets[bar];
    for (const instrument of instruments) {
      for (let step = start; step < before.offsets[bar + 1]; step++) {
        const sourceId = previousVisible[`${instrument}:${step - start}`];
        const value = grid[instrument]?.[step] || "off";
        if (value === "off") {
          if (sourceId) notes.delete(sourceId);
          continue;
        }
        const time = notes.get(sourceId)?.time ?? before.localTimes[step];
        notes.set(noteId(instrument, time), { instrument, time, value,
          sticking: sticking[`${instrument}:${step}`] || "", selected: selection[`${instrument}:${step}`] === true });
      }
    }
    if (!after.meters[bar]) return;
    const allNotes = [...notes.values()].sort((a, b) => a.instrument.localeCompare(b.instrument) || a.time - b.time);
    const projected = projectNotes(allNotes, after, bar);
    const visible = {};
    let needsMemory = projected.size < allNotes.length;
    for (const [key, { note, step }] of projected) {
      nextGrid[note.instrument][step] = note.value;
      visible[key] = noteId(note.instrument, note.time);
      if (Math.abs(note.time - after.localTimes[step]) > 1e-8) needsMemory = true;
      if (note.sticking) nextSticking[`${note.instrument}:${step}`] = note.sticking;
      if (note.selected) nextSelection[`${note.instrument}:${step}`] = true;
    }
    if (needsMemory) nextMemory[bar] = { notes: allNotes, visible, layoutKey: layoutKey(after, bar) };
  });
  return { grid: nextGrid, memory: nextMemory, sticking: nextSticking, selection: nextSelection };
}
