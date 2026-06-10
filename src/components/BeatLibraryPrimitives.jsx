import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function TreeTriangle({ expanded }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className={`h-3.5 w-3.5 fill-current transition-transform ${expanded ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M2 1.5 L8 5 L2 8.5 Z" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" aria-hidden="true">
      <path d="M3 11.5 11.8 2.7a1.5 1.5 0 0 1 2.1 2.1L5.1 13.6 2.5 14l.5-2.5Z" strokeWidth="1.4" />
      <path d="m10.7 3.8 1.5 1.5" strokeWidth="1.4" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
    </svg>
  );
}

export function BeatLibraryDropTarget({ id, children, dropTargetRef = null, ...props }) {
  const { setNodeRef } = useDroppable({ id });
  const handleRef = React.useCallback((node) => {
    setNodeRef(node);
    if (!dropTargetRef) return;
    if (typeof dropTargetRef === "function") {
      dropTargetRef(node);
    } else {
      dropTargetRef.current = node;
    }
  }, [dropTargetRef, setNodeRef]);
  return (
    <div ref={handleRef} {...props}>
      {children}
    </div>
  );
}

export function BeatLibraryDragOverlayCard({ beat, beatBpm }) {
  if (!beat) return null;
  const beatBars = Math.max(1, Number(beat?.payload?.bars) || 1);
  return (
    <div className="flex min-w-[240px] items-center gap-2 rounded border border-cyan-700/70 bg-cyan-950/85 px-2.5 py-2 text-left text-sm shadow-xl">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{beat.name || "Untitled Beat"}</div>
        <div className="truncate text-xs text-neutral-300">
          {(beat.timeSigCategory || "4/4") +
            (Number.isFinite(beatBpm) ? ` · ${beatBpm} BPM` : "") +
            ` · ${beatBars} ${beatBars === 1 ? "bar" : "bars"}`}
        </div>
      </div>
    </div>
  );
}

export function BeatLibraryReservedBeatRowSlot() {
  return (
    <div className="mb-2.5 last:mb-0 pointer-events-none">
      <div className="h-[54px] rounded border border-transparent opacity-0" />
    </div>
  );
}

export function GridSettingsPresetReservedRowSlot() {
  return (
    <div className="pointer-events-none">
      <div className="h-[52px] rounded border border-transparent opacity-0" />
    </div>
  );
}

export function GridSettingsPresetDragOverlayCard({ preset }) {
  if (!preset) return null;
  return (
    <div className="flex min-w-[240px] items-center gap-2 rounded border border-cyan-700/70 bg-cyan-950/85 px-2.5 py-2 text-left text-sm shadow-xl">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{preset.name || "Untitled Preset"}</div>
        <div className="truncate text-xs text-neutral-300">
          {`${preset.timeSig?.n || 4}/${preset.timeSig?.d || 4} · ${
            preset.resolution === 4 ? "4th" : preset.resolution === 8 ? "8th" : preset.resolution === 16 ? "16th" : "32th"
          } · ${preset.bars || 1} ${(preset.bars || 1) === 1 ? "bar" : "bars"} · ${preset.bpm || 120} BPM`}
        </div>
      </div>
    </div>
  );
}

export function SortableGridSettingsPresetRow({
  preset,
  isActive,
  isEditing,
  editingName,
  setEditingName,
  commitEditing,
  cancelEditing,
  startEditing,
  onApply,
  pendingPresetRenameExitRef,
  disableTransition = false,
}) {
  const id = `preset:${String(preset.id)}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const verticalTransform = transform ? { ...transform, x: 0 } : null;
  const style = {
    transform: CSS.Transform.toString(verticalTransform),
    transition: disableTransition ? undefined : transition,
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-0" : ""}>
      <div
        role="button"
        tabIndex={0}
        onClick={onApply}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onApply();
          }
        }}
        {...attributes}
        {...listeners}
        className={`cursor-pointer rounded border px-2.5 py-2 outline-none focus:outline-none focus-visible:outline-none ${
          isActive
            ? "border-neutral-800 bg-neutral-900/40"
            : isDragging
              ? "border-cyan-700/70 bg-cyan-950/20"
              : "border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/60"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    commitEditing();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelEditing();
                  } else if (e.key === " " || e.key === "Spacebar") {
                    e.stopPropagation();
                  }
                }}
                onBlur={() => commitEditing()}
                autoFocus
                className="w-full bg-transparent px-0 py-0 text-sm text-white outline-none"
              />
            ) : (
              <div className="text-sm text-white truncate">{preset.name}</div>
            )}
            <div className="truncate text-xs text-neutral-400">
              {`${preset.timeSig.n}/${preset.timeSig.d} · ${preset.resolution === 4 ? "4th" : preset.resolution === 8 ? "8th" : preset.resolution === 16 ? "16th" : "32th"} · ${preset.bars} ${preset.bars === 1 ? "bar" : "bars"} · ${preset.bpm} BPM`}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => {
                if (isEditing) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (pendingPresetRenameExitRef) {
                    pendingPresetRenameExitRef.current = String(preset.id);
                  }
                  return;
                }
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (pendingPresetRenameExitRef?.current === String(preset.id)) {
                  pendingPresetRenameExitRef.current = "";
                  commitEditing();
                  return;
                }
                if (isEditing) return;
                if (pendingPresetRenameExitRef) {
                  pendingPresetRenameExitRef.current = "";
                }
                startEditing(preset.id);
              }}
              className="inline-flex h-6 min-w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800/60 hover:text-white"
              title="Rename preset"
            >
              <PencilIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SortableArrangementSourceBeatRow({
  beat,
  depth,
  beatRowKey,
  beatBpm,
  isActiveDraggedBeat,
  isLoadedTrackedBeat,
  isSelectedArrangementSourceBeat,
  isBeatLibraryBeatSelected,
  editingBeatLibraryBeatId,
  editingBeatLibraryBeatName,
  setEditingBeatLibraryBeatName,
  commitEditingBeatLibraryBeat,
  cancelEditingBeatLibraryBeat,
  startEditingBeatLibraryBeat,
  showUpdateButton,
  updateCurrentLoadedBeatLocal,
  onSelectBeat,
  arrangementAddBeat,
  hideSourceWhileDragging,
  disableTransition = false,
  softActiveHighlight = false,
}) {
  const id = `beat:${String(beat.id)}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const verticalTransform = transform ? { ...transform, x: 0 } : null;
  const style = {
    marginLeft: `${Math.max(0, depth) * 0.5}rem`,
    transform: CSS.Transform.toString(verticalTransform),
    transition: disableTransition ? undefined : transition,
  };
  const isLoadedVisual = isLoadedTrackedBeat;
  const isSecondaryActive =
    !isLoadedTrackedBeat && (isBeatLibraryBeatSelected || isSelectedArrangementSourceBeat);
  const loadedActiveClass = softActiveHighlight
    ? "border-sky-500/35 bg-sky-950/10 shadow-[0_0_0_1px_rgba(14,165,233,0.14)]"
    : "border-sky-500/70 bg-sky-900/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]";
  const secondaryActiveClass = softActiveHighlight
    ? "border-neutral-700 bg-neutral-900/50 shadow-[0_0_0_1px_rgba(38,38,38,0.4)]"
    : "border-sky-500/30 bg-sky-950/10 shadow-[0_0_0_1px_rgba(14,165,233,0.12)]";
  const canRenameViaTitle = isLoadedVisual || isSecondaryActive;

  return (
    <div
      ref={setNodeRef}
      className={`relative ${
        hideSourceWhileDragging
          ? "mb-2.5 last:mb-0 opacity-0 pointer-events-none"
          : isActiveDraggedBeat
            ? "mb-2.5 last:mb-0 opacity-0"
            : "mb-2.5 last:mb-0"
      }`}
      style={style}
    >
      <div
        data-beat-row-id={beatRowKey}
        role="button"
        tabIndex={0}
        onClick={(e) => onSelectBeat?.(beat, !!e?.shiftKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectBeat?.(beat, !!e?.shiftKey);
          }
        }}
        {...attributes}
        {...listeners}
        className={`select-none flex items-center gap-1.5 rounded border px-2 py-2 text-left text-sm outline-none focus:outline-none focus-visible:outline-none ${
          isLoadedVisual
            ? loadedActiveClass
            : isSecondaryActive
              ? secondaryActiveClass
            : isDragging
              ? "border-cyan-700/70 bg-cyan-950/20"
              : "border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800/60"
        }`}
      >
        <div className="min-w-0 flex-1">
          {String(editingBeatLibraryBeatId || "") === String(beat.id) ? (
            <input
              type="text"
              value={editingBeatLibraryBeatName}
              onChange={(e) => setEditingBeatLibraryBeatName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  commitEditingBeatLibraryBeat();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelEditingBeatLibraryBeat();
                } else if (e.key === " " || e.key === "Spacebar") {
                  e.stopPropagation();
                }
              }}
              onBlur={() => commitEditingBeatLibraryBeat()}
              autoFocus
              className="w-full bg-transparent px-0 py-0 text-sm text-white outline-none"
            />
          ) : (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (canRenameViaTitle) {
                  startEditingBeatLibraryBeat(beat.id);
                  return;
                }
                onSelectBeat?.(beat, !!e?.shiftKey);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                if (canRenameViaTitle) {
                  startEditingBeatLibraryBeat(beat.id);
                  return;
                }
                onSelectBeat?.(beat, !!e?.shiftKey);
              }}
              className="block w-full truncate bg-transparent p-0 text-left text-sm text-white"
              title={canRenameViaTitle ? "Rename beat" : "Select beat"}
            >
              {beat.name || "Untitled Beat"}
            </button>
          )}
          <div className="truncate text-[11px] leading-tight text-neutral-400">
            {(() => {
              const beatBars = Math.max(1, Number(beat?.payload?.bars) || 1);
              return (beat.timeSigCategory || "4/4") +
                (Number.isFinite(beatBpm) ? ` · ${beatBpm} BPM` : "") +
                ` · ${beatBars} ${beatBars === 1 ? "bar" : "bars"}`;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showUpdateButton ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                updateCurrentLoadedBeatLocal();
              }}
              className="px-2 py-1 rounded border border-cyan-700 text-xs text-cyan-100 bg-cyan-900/20 hover:bg-cyan-800/30"
              title="Update loaded beat"
            >
              Update
            </button>
          ) : null}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              arrangementAddBeat("local", beat.id);
            }}
            className="px-1.5 py-1 rounded border border-neutral-800 text-[11px] text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
