import React from "react";

export function SavePresetAsPanel({
  name,
  onNameChange,
  onSave,
  onCancel,
}) {
  return (
    <div className="mt-3 rounded-lg border border-neutral-700 bg-neutral-950/50 p-3" onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-sm text-neutral-200 mb-2">Save Preset As</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => onNameChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave?.();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel?.();
            }
          }}
          placeholder="Preset name"
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!name.trim()}
          className={`px-2.5 py-1 rounded border text-sm ${
            name.trim()
              ? "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
              : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
          }`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PresetChangeConfirmDialog({
  pendingPresetChange,
  presetLabels,
  instrumentById,
  keepTracksWithNotesEnabled,
  onKeepNotedTracks,
  onDeleteAnyway,
  onCancel,
}) {
  if (!pendingPresetChange) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Remove Notes</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Switching to <span>{presetLabels[pendingPresetChange.presetName] || pendingPresetChange.presetName}</span> would remove tracks that contain notes:
        </p>
        <div className="mt-2 text-sm text-amber-200">
          {pendingPresetChange.removedWithNotes
            .map((id) => instrumentById[id]?.label || id)
            .join(", ")}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onKeepNotedTracks}
            className="px-3 py-1.5 rounded border border-cyan-600 text-sm text-cyan-100 hover:bg-cyan-800/30"
          >
            {keepTracksWithNotesEnabled ? "Keep tracks with notes (Default)" : "Keep tracks with notes"}
          </button>
          <button
            type="button"
            onClick={onDeleteAnyway}
            className="px-3 py-1.5 rounded border border-red-700 text-sm text-red-100 hover:bg-red-900/30"
          >
            {keepTracksWithNotesEnabled ? "Remove anyway" : "Remove anyway (Default)"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
