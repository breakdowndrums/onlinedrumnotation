import React from "react";

function clampTimingShift(value) {
  return Math.max(-15, Math.min(15, Number(value) || 0));
}

function getArrangementPreviewTotalBars(prompt) {
  if (prompt?.imported?.kind !== "arrangement") return 1;
  return (prompt.imported.sections || []).reduce(
    (sum, section) => sum + Math.max(1, Number(section?.payload?.bars) || 1),
    0
  );
}

export default function MidiImportSettingsDialog({
  prompt,
  currentBpm,
  onCancel,
  onConfirm,
  onPatch,
  onArrangementImportModeChange,
  normalizeArrangementImportMode,
  formatTimingShiftLabel,
  getSuggestedBpm,
  onTempoMultiplierStepStart,
  onTempoMultiplierStepStop,
  onTempoMultiplierReset,
}) {
  if (!prompt) return null;

  const tempoMultiplier = Number(prompt.tempoMultiplier) || 1;
  const isDefaultMultiplier = Math.abs(tempoMultiplier - 1) < 0.001;
  const isArrangementImport = prompt.imported?.kind === "arrangement";

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Import MIDI</h3>
        <p className="mt-2 text-sm text-neutral-300">
          {prompt.imported?.hasTempo
            ? "This MIDI file includes tempo information. Adjust the BPM if you want to override it for import."
            : "This MIDI file has no embedded tempo. Choose a BPM to use for import."}
        </p>
        <label className="mt-4 flex flex-col gap-1 text-sm text-neutral-300">
          <span>BPM</span>
          <input
            type="number"
            inputMode="numeric"
            min={20}
            max={400}
            step={0.1}
            value={prompt.bpm}
            onChange={(e) => onPatch?.({ bpm: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm?.();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel?.();
              }
            }}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </label>
        {prompt.imported?.hasTempo && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-300">Multiplier</span>
            <div className="text-right">
              <div className="mb-1 text-[11px] text-neutral-500 tabular-nums">
                {`${getSuggestedBpm?.(prompt.imported, currentBpm, tempoMultiplier) ?? ""} BPM`}
              </div>
              <div
                className={`flex items-stretch overflow-hidden rounded-md border ${
                  isDefaultMultiplier
                    ? "border-neutral-800 bg-neutral-900/60"
                    : "border-neutral-700 bg-neutral-800"
                }`}
              >
                <button
                  type="button"
                  onPointerDown={() => onTempoMultiplierStepStart?.(-0.05)}
                  onPointerUp={onTempoMultiplierStepStop}
                  onPointerCancel={onTempoMultiplierStepStop}
                  onPointerLeave={onTempoMultiplierStepStop}
                  className={`px-1.5 text-sm leading-none ${
                    isDefaultMultiplier
                      ? "text-neutral-500 hover:bg-neutral-800/40"
                      : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  }`}
                  aria-label="Decrease MIDI tempo multiplier"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={onTempoMultiplierReset}
                  className={`min-w-[56px] border-l border-r px-2 py-1 text-center text-xs tabular-nums ${
                    isDefaultMultiplier
                      ? "text-neutral-500 border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/40"
                      : "text-white border-neutral-700 bg-neutral-800 hover:bg-neutral-700/40"
                  } touch-none select-none`}
                >
                  {`x${tempoMultiplier.toFixed(2).replace(/\.?0+$/, "")}`}
                </button>
                <button
                  type="button"
                  onPointerDown={() => onTempoMultiplierStepStart?.(0.05)}
                  onPointerUp={onTempoMultiplierStepStop}
                  onPointerCancel={onTempoMultiplierStepStop}
                  onPointerLeave={onTempoMultiplierStepStop}
                  className={`px-1.5 text-sm leading-none ${
                    isDefaultMultiplier
                      ? "text-neutral-500 hover:bg-neutral-800/40"
                      : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  }`}
                  aria-label="Increase MIDI tempo multiplier"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-300">Shift</span>
          <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
            <button
              type="button"
              onClick={() => onPatch?.({ timingShiftSixteenths: clampTimingShift((Number(prompt.timingShiftSixteenths) || 0) - 1) })}
              className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
              aria-label="Shift imported MIDI earlier"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => onPatch?.({ timingShiftSixteenths: 0 })}
              className="min-w-[78px] border-l border-r border-neutral-700 px-2 py-1 text-center text-xs text-white hover:bg-neutral-700/30"
              title="Reset timing shift"
            >
              {formatTimingShiftLabel?.(prompt.timingShiftSixteenths || 0)}
            </button>
            <button
              type="button"
              onClick={() => onPatch?.({ timingShiftSixteenths: clampTimingShift((Number(prompt.timingShiftSixteenths) || 0) + 1) })}
              className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
              aria-label="Shift imported MIDI later"
            >
              +
            </button>
          </div>
          {!!prompt.imported?.suggestedShiftSixteenths && (
            <>
              <span className="text-sm text-neutral-500">
                Suggested: {formatTimingShiftLabel?.(prompt.imported?.suggestedShiftSixteenths || 0)}
              </span>
              <button
                type="button"
                onClick={() =>
                  onPatch?.({
                    timingShiftSixteenths: clampTimingShift(prompt.imported?.suggestedShiftSixteenths),
                  })
                }
                className="rounded border border-neutral-700 px-2.5 py-1 text-sm text-neutral-200 hover:bg-neutral-800/60"
                title="Apply suggested timing shift"
              >
                Use suggested
              </button>
            </>
          )}
          {isArrangementImport && (
            <>
              <span className="text-sm text-neutral-300">Preview bar</span>
              <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                <button
                  type="button"
                  onClick={() => onPatch?.({ previewBarNumber: Math.max(1, (Number(prompt.previewBarNumber) || 1) - 1) })}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  aria-label="Preview previous bar"
                >
                  -
                </button>
                <div className="min-w-[70px] border-l border-r border-neutral-700 px-2 py-1 text-center text-xs text-white">
                  {`Bar ${Math.max(1, Math.round(Number(prompt.previewBarNumber) || 1))}`}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onPatch?.({
                      previewBarNumber: Math.min(
                        Math.max(1, getArrangementPreviewTotalBars(prompt)),
                        (Number(prompt.previewBarNumber) || 1) + 1
                      ),
                    })
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
        {isArrangementImport && (
          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-sm text-neutral-300 flex flex-col gap-1">
              <span>Title line 1</span>
              <input
                type="text"
                value={prompt.titleLine1 || ""}
                onChange={(e) => onPatch?.({ titleLine1: e.target.value })}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-sm text-neutral-300 flex flex-col gap-1">
              <span>Title line 2</span>
              <input
                type="text"
                value={prompt.titleLine2 || ""}
                onChange={(e) => onPatch?.({ titleLine2: e.target.value })}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-sm text-neutral-300 flex flex-col gap-1">
              <span>Author</span>
              <input
                type="text"
                value={prompt.author || ""}
                onChange={(e) => onPatch?.({ author: e.target.value })}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-sm text-neutral-300 flex flex-col gap-1">
              <span>Import into</span>
              <select
                value={normalizeArrangementImportMode?.(prompt.arrangementImportMode)}
                onChange={(e) => onArrangementImportModeChange?.(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="new-arrangement">New saved arrangement</option>
                <option value="override-current-arrangement">Override current arrangement</option>
              </select>
            </label>
            <div className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm">
              <span className="text-neutral-400">Bars per section</span>
              <div className="flex items-center overflow-hidden rounded border border-neutral-700">
                <button
                  type="button"
                  onClick={() => onPatch?.({ splitBars: Math.max(1, Number(prompt.splitBars || 1) - 1) })}
                  className="w-9 h-9 border-r border-neutral-700 text-neutral-200 hover:bg-neutral-800/60"
                  aria-label="Reduce MIDI arrangement split size"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => onPatch?.({ splitBars: Number(prompt.splitBars) === 2 ? 1 : 2 })}
                  className="min-w-[86px] h-9 px-3 text-neutral-100 hover:bg-neutral-800/60"
                  aria-label="Toggle MIDI arrangement split size"
                  title="Toggle between 1 bar and the last larger split size"
                >
                  {prompt.splitBars || 1} {(prompt.splitBars || 1) === 1 ? "bar" : "bars"}
                </button>
                <button
                  type="button"
                  onClick={() => onPatch?.({ splitBars: Math.min(8, Number(prompt.splitBars || 1) + 1) })}
                  className="w-9 h-9 border-l border-neutral-700 text-neutral-200 hover:bg-neutral-800/60"
                  aria-label="Increase MIDI arrangement split size"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded border border-neutral-700 text-sm text-white bg-neutral-800 hover:bg-neutral-700/60"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
