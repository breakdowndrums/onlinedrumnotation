import React from "react";

export default function PublicBeatSourceList({
  beats,
  getBeatBpm,
  selectedBeatKey,
  softActiveHighlight,
  loading,
  isAdmin,
  keyPrefix = "arr-src",
  onBeginDrag,
  onClearDrag,
  onSelectBeat,
  onAddBeat,
  onDeleteBeat,
}) {
  return (
    <div className="dg-slim-scrollbar mt-3 max-h-[52vh] overflow-auto space-y-2.5 pr-1 dg-scroll-follow-list">
      {beats.map((beat) => {
        const beatBpm = getBeatBpm?.(beat);
        const sourceLabel = "public";
        const beatRowKey = `${sourceLabel}:${String(beat.id)}`;
        const isSelected = selectedBeatKey === beatRowKey;
        const beatBars = Math.max(1, Number(beat?.payload?.bars) || 1);
        return (
          <div
            key={`${keyPrefix}-${sourceLabel}-${beat.id}`}
            data-beat-row-id={beatRowKey}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(e) => {
              onBeginDrag?.("public", beat.id);
              try {
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({
                    source: "public",
                    beatId: beat.id,
                  })
                );
              } catch (_) {}
            }}
            onDragEnd={onClearDrag}
            onClick={() => onSelectBeat?.(beat)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectBeat?.(beat);
              }
            }}
            className={`rounded border px-2 py-2 cursor-pointer outline-none focus:outline-none focus-visible:outline-none ${
              isSelected
                ? softActiveHighlight
                  ? "border-sky-500/35 bg-sky-950/10 shadow-[0_0_0_1px_rgba(14,165,233,0.14)]"
                  : "border-sky-500/70 bg-sky-900/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
                : "border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{beat.name || "Untitled Beat"}</div>
                <div className="text-[11px] leading-tight text-neutral-400 truncate">
                  {(beat.timeSigCategory || "4/4") +
                    (Number.isFinite(beatBpm) ? ` · ${beatBpm} BPM` : "") +
                    ` · ${beatBars} ${beatBars === 1 ? "bar" : "bars"}`}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddBeat?.("public", beat.id);
                  }}
                  className="px-1.5 py-1 rounded border border-neutral-700 text-[11px] text-white bg-neutral-800 hover:bg-neutral-700/60"
                >
                  Add
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => onDeleteBeat?.(e, beat.publishedShareId || beat.id)}
                    className="px-2 py-1 rounded border border-red-900 text-xs text-red-200 hover:bg-red-900/30"
                    aria-label="Delete public beat"
                    title="Delete public beat"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {loading && (
        <div className="text-xs text-neutral-400">Loading public library...</div>
      )}
      {beats.length === 0 && (
        <div className="text-xs text-neutral-500">No beats in this source with current filters.</div>
      )}
    </div>
  );
}
