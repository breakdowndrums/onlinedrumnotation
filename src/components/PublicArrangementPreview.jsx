import React from "react";

function formatDuration(totalSeconds) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export default function PublicArrangementPreview({
  selectedEntry,
  rows,
  RowComponent,
  currentEditorBeatKey,
  normalizedSelection,
  playbackEnabled,
  activePlayingRowIndex,
  loading,
  publicArrangements,
  totals,
  selectedPublicArrangementId,
  isAdmin,
  onClearSelection,
  onSelectRow,
  onLoadBeatIntoEditor,
  onRepeatChange,
  onSelectArrangementId,
  onLoadArrangement,
  onRefresh,
  onPublish,
  onDelete,
}) {
  return (
    <>
      <div
        className="dg-slim-scrollbar mt-3 max-h-[52vh] overflow-auto pr-1"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClearSelection?.();
        }}
      >
        {selectedEntry ? (
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <RowComponent
                key={`public-arr-row-${selectedEntry.id}-${row.id || idx}`}
                row={row}
                index={idx}
                isEditorBeat={currentEditorBeatKey === `${String(row?.source || "shared")}:${String(row?.beat?.id || "")}`}
                isSelected={Boolean(
                  normalizedSelection &&
                    idx >= normalizedSelection.start &&
                    idx <= normalizedSelection.end
                )}
                isPlaying={playbackEnabled && idx === activePlayingRowIndex}
                onSelectRow={(rowIndex, extend) => {
                  onSelectRow?.(rowIndex, extend);
                  if (row?.beat) onLoadBeatIntoEditor?.("shared", row.beat);
                }}
                onRepeatChange={onRepeatChange}
              />
            ))}
          </div>
        ) : (
          <div className="text-xs text-neutral-500">
            Select a public arrangement from the footer to view its beats.
          </div>
        )}
        {loading ? (
          <div className="mt-2 text-[11px] text-neutral-500">Loading public arrangements…</div>
        ) : null}
        {publicArrangements.length === 0 && !loading ? (
          <div className="text-xs text-neutral-500">No public arrangements available.</div>
        ) : null}
      </div>
      <div
        className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-neutral-500"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClearSelection?.();
        }}
      >
        <span>{`Total bars: ${totals.totalBars}`}</span>
        <span>{`Est. length: ${formatDuration(totals.totalSeconds)}`}</span>
      </div>
      <div className="mt-auto pt-3">
        <div className="border-t border-neutral-800 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <select
                value={selectedPublicArrangementId}
                onChange={(e) => onSelectArrangementId?.(e.target.value || "")}
                className="min-w-0 flex-1 h-7 bg-neutral-900/40 border border-neutral-800 rounded px-2 text-sm text-neutral-400"
              >
                <option value="">Select public arrangement</option>
                {publicArrangements.map((entry) => (
                  <option key={`public-arr-opt-${entry.id}`} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onLoadArrangement?.(selectedEntry)}
                disabled={!selectedEntry}
                className={`h-7 rounded border px-2.5 text-sm ${
                  selectedEntry
                    ? "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
                    : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
                }`}
              >
                Load
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="h-7 rounded border border-neutral-800 bg-neutral-900/60 px-2.5 text-sm text-neutral-400 hover:bg-neutral-800/60"
              >
                Refresh
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onPublish}
                  className="h-7 rounded border border-neutral-800 bg-neutral-900/60 px-2.5 text-sm text-neutral-400 hover:bg-neutral-800/60"
                  title="Publish current arrangement as a public default"
                >
                  {selectedEntry ? "Update public" : "Publish public"}
                </button>
              )}
              {isAdmin && selectedEntry && (
                <button
                  type="button"
                  onClick={() => onDelete?.(selectedEntry.id)}
                  className="h-7 rounded border border-neutral-800 bg-neutral-900/60 px-2.5 text-sm text-neutral-500 hover:bg-neutral-800/60"
                  title="Delete selected public arrangement"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
