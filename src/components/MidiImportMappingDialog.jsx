import React from "react";

const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function formatMidiNoteName(note) {
  const midi = Number(note);
  if (!Number.isFinite(midi)) return "";
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${MIDI_NOTE_NAMES[pitchClass]}${octave}`;
}

function hasIncompleteMapping(mapping) {
  return (mapping?.mappingEntries || []).some(
    (entry) =>
      !String(
        mapping?.noteAssignments?.[String(entry.sourceKey || entry.note)] ||
          mapping?.noteAssignments?.[String(entry.note)] ||
          ""
      ).trim()
  );
}

export default function MidiImportMappingDialog({
  mapping,
  presets = [],
  instruments = [],
  velocityRanges,
  snareGhostMax,
  onSnareGhostMaxChange,
  tomGhostMax,
  onTomGhostMaxChange,
  hihatGhostMax,
  onHihatGhostMaxChange,
  looksReady = false,
  onCancel,
  onConfirm,
  onPresetChange,
  onPreviewBarChange,
  onAssignmentChange,
  onVelocityModeChange,
}) {
  if (!mapping) return null;
  const incomplete = hasIncompleteMapping(mapping);

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Map MIDI Notes</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Review the detected MIDI mapping before import. Assign each note to an instrument or choose Ignore.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-300">Mapping preset</span>
          <select
            value={mapping.presetId || "manual"}
            onChange={(e) => onPresetChange?.(e.target.value)}
            className="min-w-[220px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
          >
            {presets.map((preset) => (
              <option key={`midi-import-preset-${preset.id}`} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          {mapping.importedKind === "arrangement" && (
            <>
              <span className="text-sm text-neutral-300">Preview bar</span>
              <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                <button
                  type="button"
                  onClick={() => onPreviewBarChange?.(Math.max(1, (Number(mapping.previewBarNumber) || 1) - 1))}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  aria-label="Preview previous bar"
                >
                  -
                </button>
                <div className="min-w-[70px] border-l border-r border-neutral-700 px-2 py-1 text-center text-xs text-white">
                  {`Bar ${Math.max(1, Math.round(Number(mapping.previewBarNumber) || 1))}`}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onPreviewBarChange?.(
                      Math.min(
                        Math.max(1, Number(mapping.previewTotalBars) || 1),
                        (Number(mapping.previewBarNumber) || 1) + 1
                      )
                    )
                  }
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  aria-label="Preview next bar"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>
        {!!(mapping.trackConflicts || []).length && (
          <div className="mt-4 rounded border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            <div className="font-medium text-amber-50">Track merge warning</div>
            <div className="mt-1 text-amber-100/90">
              Multiple source MIDI tracks currently map into the same destination instrument. If one track is a
              ghost-note lane, set its velocity mode explicitly instead of leaving it on Auto.
            </div>
          </div>
        )}
        <div className="mt-4 space-y-3">
          <div className="text-sm font-normal text-neutral-200">Exact mapping</div>
          {[...(mapping.mappingEntries || [])]
            .sort((a, b) => b.note - a.note || b.trackIndex - a.trackIndex)
            .map((entry) => {
              const sourceKey = String(entry.sourceKey || entry.note);
              const currentInstrumentId = String(
                mapping.noteAssignments?.[sourceKey] ??
                  mapping.noteAssignments?.[String(entry.note)] ??
                  ""
              ).trim();
              const assignedCounts = new Map();
              (mapping.usedInstrumentIds || []).forEach((instId) => {
                const key = String(instId || "").trim();
                if (!key) return;
                assignedCounts.set(key, Math.max(1, assignedCounts.get(key) || 0));
              });
              Object.entries(mapping.noteAssignments || {}).forEach(([assignmentKey, instId]) => {
                if (assignmentKey === sourceKey) return;
                const key = String(instId || "").trim();
                if (!key || key === "ignore") return;
                assignedCounts.set(key, (assignedCounts.get(key) || 0) + 1);
              });
              const unusedInstrumentOptions = instruments.filter((inst) => !assignedCounts.has(String(inst.id)));
              const assignedInstrumentOptions = instruments.filter((inst) => assignedCounts.has(String(inst.id)));
              const conflict = (mapping.trackConflicts || []).find(
                (item) => String(item.sourceKey) === sourceKey
              );
              const velocityMode =
                mapping.noteVelocityModes?.[sourceKey] ??
                mapping.noteVelocityModes?.[String(entry.note)] ??
                "auto";
              const effectiveVelocityMode = String(velocityMode || "auto");
              const value = currentInstrumentId;
              const sameTargetCount = currentInstrumentId && currentInstrumentId !== "ignore"
                ? (mapping.mappingEntries || []).reduce((count, candidate) => {
                    const candidateKey = String(candidate.sourceKey || candidate.note);
                    const candidateInstrumentId = String(
                      mapping.noteAssignments?.[candidateKey] ??
                        mapping.noteAssignments?.[String(candidate.note)] ??
                        ""
                    ).trim();
                    const candidateVelocityMode = String(
                      mapping.noteVelocityModes?.[candidateKey] ??
                        mapping.noteVelocityModes?.[String(candidate.note)] ??
                        "auto"
                    );
                    return count + (
                      candidateInstrumentId === currentInstrumentId &&
                      candidateVelocityMode === effectiveVelocityMode
                        ? 1
                        : 0
                    );
                  }, 0)
                : 0;

              return (
                <div
                  key={`midi-map-${sourceKey}`}
                  className={`rounded border px-3 py-2 ${
                    conflict
                      ? "border-amber-700/50 bg-amber-950/20"
                      : "border-neutral-800 bg-neutral-950/40"
                  }`}
                >
                  <div className="grid grid-cols-[84px_84px_20px_116px_minmax(0,180px)_144px] items-center gap-2 text-sm text-neutral-200">
                    <span>
                      {`MIDI ${entry.note} `}
                      <span className="text-neutral-500">{formatMidiNoteName(entry.note)}</span>
                    </span>
                    <span className="text-neutral-500 tabular-nums">{`${entry.count} hits`}</span>
                    <span className="text-neutral-500">-&gt;</span>
                    <div className="flex min-h-[24px] items-center justify-center gap-1.5 text-neutral-500">
                      {!value && (
                        <span className="rounded border border-red-700/40 bg-red-950/30 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-red-100">
                          unassigned
                        </span>
                      )}
                      {sameTargetCount > 1 && (
                        <span className="rounded border border-sky-700/40 bg-sky-950/30 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-sky-100">
                          same target
                        </span>
                      )}
                      {conflict && (
                        <span className="rounded border border-amber-600/40 bg-amber-900/30 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-amber-100">
                          merges
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <select
                        value={value}
                        onChange={(e) => onAssignmentChange?.(sourceKey, e.target.value)}
                        className="min-w-0 w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
                      >
                        <option value="">Assign instrument...</option>
                        <option value="ignore">Ignore</option>
                        {unusedInstrumentOptions.length > 0 && (
                          <optgroup label="Unused instruments">
                            {unusedInstrumentOptions.map((inst) => {
                              const midiLabel = Number.isFinite(inst.midi) ? `MIDI ${inst.midi}` : "No MIDI";
                              return (
                                <option key={`midi-note-map-${sourceKey}-${inst.id}`} value={inst.id}>
                                  {`${inst.label} (${midiLabel})`}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        {assignedInstrumentOptions.length > 0 && (
                          <optgroup label="Already assigned">
                            {assignedInstrumentOptions.map((inst) => {
                              const midiLabel = Number.isFinite(inst.midi) ? `MIDI ${inst.midi}` : "No MIDI";
                              return (
                                <option key={`midi-note-map-${sourceKey}-${inst.id}`} value={inst.id}>
                                  {`${inst.label} (${midiLabel})`}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <select
                      value={velocityMode}
                      onChange={(e) => onVelocityModeChange?.(sourceKey, e.target.value)}
                      className="w-full md:w-[144px] bg-neutral-800 border border-neutral-700 rounded pl-2 pr-6 py-1.5 text-sm text-white"
                    >
                      <option value="auto">Auto velocity</option>
                      <option value="ghost">Ghost</option>
                      <option value="normal">Normal</option>
                      <option value="accent">Accent</option>
                    </select>
                  </div>
                </div>
              );
            })}
        </div>
        <div className="mt-4 border-t border-neutral-800 pt-4">
          <div className="text-sm font-normal text-neutral-200">Velocity thresholds</div>
          <div className="mt-2 space-y-3">
            {[
              {
                label: "Snare / sidestick",
                familyKey: "snare",
                value: snareGhostMax,
                onChange: onSnareGhostMaxChange,
              },
              {
                label: "Toms",
                familyKey: "toms",
                value: tomGhostMax,
                onChange: onTomGhostMaxChange,
              },
              {
                label: "Hi-hat",
                familyKey: "hihat",
                value: hihatGhostMax,
                onChange: onHihatGhostMaxChange,
              },
            ].map((item) => (
              <label key={`midi-map-threshold-${item.label}`} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-neutral-300">{item.label}</span>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {(() => {
                      const range = velocityRanges?.[item.familyKey];
                      const rangeText = range
                        ? ` · MIDI ${Math.round(range.min)}-${Math.round(range.max)}`
                        : "";
                      return `Ghost <= ${item.value} · Normal > ${item.value}${rangeText}`;
                    })()}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={126}
                  step={1}
                  value={item.value}
                  onChange={(e) =>
                    item.onChange?.(Math.max(1, Math.min(126, Number(e.target.value) || 70)))
                  }
                  className="w-full accent-neutral-300"
                />
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={incomplete}
            className={`px-3 py-1 rounded border text-sm ${
              incomplete
                ? "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
                : looksReady
                  ? "border-cyan-700 text-cyan-100 bg-cyan-900/20 hover:bg-cyan-800/30"
                  : "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
            }`}
          >
            {mapping.applyMode === "update-last" ? "Update" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
