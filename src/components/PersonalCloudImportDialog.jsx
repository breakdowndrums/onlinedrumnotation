import React from "react";

function TreeTriangle({ expanded }) {
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

function getBeatLibraryMeta(beat) {
  const direct = beat?.libraryMeta && typeof beat.libraryMeta === "object" ? beat.libraryMeta : null;
  const payloadMeta = beat?.payload?.libraryMeta && typeof beat.payload.libraryMeta === "object"
    ? beat.payload.libraryMeta
    : null;
  const meta = direct || payloadMeta || null;
  return {
    parentId: meta?.parentId ? String(meta.parentId) : null,
    manualOrder: Number.isFinite(Number(meta?.manualOrder)) ? Number(meta.manualOrder) : 0,
  };
}

function getBeatBpm(beat) {
  const direct = Number(beat?.bpm);
  if (Number.isFinite(direct) && direct >= 20 && direct <= 400) return Math.round(direct);
  const payloadBpm = Number(beat?.payload?.bpm);
  if (Number.isFinite(payloadBpm) && payloadBpm >= 20 && payloadBpm <= 400) return Math.round(payloadBpm);
  return null;
}

export default function PersonalCloudImportDialog({
  snapshot,
  pending = false,
  selectedBeatIds = [],
  selectedFolderIds = [],
  selectedArrangementIds = [],
  expandedFolderIds = [],
  selectedLibraryCount = 0,
  selectedArrangementCount = 0,
  visibleSelectedLibraryCount = 0,
  folderChildrenByParent,
  beatChildrenByParent,
  getDescendantFolderIds,
  onToggleFolderExpanded,
  onToggleFolderSelection,
  onToggleBeatSelection,
  onSelectAllLibrary,
  onSelectNoLibrary,
  onSelectAllArrangements,
  onSelectNoArrangements,
  onToggleArrangement,
  onDismiss,
  onMerge,
}) {
  if (!snapshot) return null;

  const hasSelection = visibleSelectedLibraryCount > 0 || selectedArrangementIds.length > 0;
  const folders = Array.isArray(snapshot.folders) ? snapshot.folders : [];
  const beats = Array.isArray(snapshot.beats) ? snapshot.beats : [];
  const arrangements = Array.isArray(snapshot.arrangements) ? snapshot.arrangements : [];

  const renderFolderContents = (parentId = null, depth = 0) => {
    const parentKey = String(parentId || "");
    const childFolders = folderChildrenByParent?.get(parentKey) || [];
    const childBeats = beatChildrenByParent?.get(parentKey) || [];
    const nodes = [];

    childFolders.forEach((entry) => {
      const folderId = String(entry?.id || "");
      const descendantFolderIds = getDescendantFolderIds?.(folderId) || [];
      const descendantFolderIdSet = new Set(descendantFolderIds);
      const descendantBeatIds = beats
        .filter((beat) => descendantFolderIdSet.has(String(getBeatLibraryMeta(beat).parentId || "")))
        .map((beat) => String(beat?.id || ""))
        .filter(Boolean);
      const selectedFolderCount = descendantFolderIds.filter((id) => selectedFolderIds.includes(id)).length;
      const selectedBeatCount = descendantBeatIds.filter((id) => selectedBeatIds.includes(id)).length;
      const totalSelectableCount = descendantFolderIds.length + descendantBeatIds.length;
      const selectedTotalCount = selectedFolderCount + selectedBeatCount;
      const checked = totalSelectableCount > 0 && selectedTotalCount === totalSelectableCount;
      const indeterminate = selectedTotalCount > 0 && selectedTotalCount < totalSelectableCount;
      const expanded = expandedFolderIds.includes(folderId);
      const hasChildren = descendantFolderIds.length > 1 || descendantBeatIds.length > 0;

      nodes.push(
        <div key={`pending-cloud-folder-${folderId}`}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onToggleFolderSelection?.(folderId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleFolderSelection?.(folderId);
              }
            }}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs ${
              checked || indeterminate
                ? "bg-sky-900/20 text-sky-100 ring-1 ring-inset ring-sky-500/70 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
                : "text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-200"
            }`}
            style={{ marginLeft: `${Math.max(0, depth) * 0.5}rem` }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFolderExpanded?.(folderId);
              }}
              className={`inline-flex h-6 min-w-6 items-center justify-center ${
                hasChildren ? "text-neutral-500" : "text-neutral-800"
              }`}
              disabled={!hasChildren}
            >
              {hasChildren ? <TreeTriangle expanded={expanded} /> : null}
            </button>
            <span className="min-w-0 truncate px-1 py-0.5 text-left">
              {String(entry?.name || "Untitled Folder")}
            </span>
          </div>
          {expanded ? renderFolderContents(folderId, depth + 1) : null}
        </div>
      );
    });

    childBeats.forEach((entry) => {
      const beatId = String(entry?.id || "");
      const checked = selectedBeatIds.includes(beatId);
      const beatBpm = getBeatBpm(entry);
      const beatBars = Math.max(1, Number(entry?.payload?.bars) || 1);
      nodes.push(
        <div
          key={`pending-cloud-beat-${beatId}`}
          className="mb-2.5 last:mb-0"
          style={{ marginLeft: `${Math.max(0, depth) * 0.5}rem` }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => onToggleBeatSelection?.(beatId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleBeatSelection?.(beatId);
              }
            }}
            className={`select-none flex items-center gap-2 rounded border px-2.5 py-2 text-left text-sm ${
              checked
                ? "border-sky-500/70 bg-sky-900/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
                : "border-neutral-800 bg-neutral-900/40"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">{String(entry?.name || "Untitled Beat")}</div>
              <div className="truncate text-xs text-neutral-400">
                {(entry.timeSigCategory || "4/4") +
                  (Number.isFinite(beatBpm) ? ` · ${beatBpm} BPM` : "") +
                  ` · ${beatBars} ${beatBars === 1 ? "bar" : "bars"}`}
              </div>
            </div>
          </div>
        </div>
      );
    });

    return <div className="space-y-1">{nodes}</div>;
  };

  return (
    <div
      className="fixed inset-0 z-[151] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={() => {
        if (pending) return;
        onDismiss?.();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white">Sync Local Library To Personal Cloud?</h3>
        <div className="mt-3 text-sm text-neutral-300">
          This device still has offline local content that is not yet part of your personal cloud library.
        </div>
        <div className="mt-3 rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-400">
          <div>{beats.length} beat{beats.length === 1 ? "" : "s"}</div>
          <div>{arrangements.length} arrangement{arrangements.length === 1 ? "" : "s"}</div>
          <div>{folders.length} folder{folders.length === 1 ? "" : "s"}</div>
        </div>
        <div className="mt-3 text-sm text-neutral-400">
          Choose whether to merge this device's local library into your personal cloud library, or keep using the cloud library as-is.
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-400">
          <span>
            Selected for merge: {visibleSelectedLibraryCount} library item
            {visibleSelectedLibraryCount === 1 ? "" : "s"}, {selectedArrangementCount} arrangement
            {selectedArrangementCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => {
              onSelectNoLibrary?.();
              onSelectNoArrangements?.();
            }}
            className="text-xs text-neutral-400 hover:text-white"
          >
            None
          </button>
        </div>
        {selectedLibraryCount === 0 && selectedArrangementCount > 0 ? (
          <div className="mt-3 rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-400">
            The library tree is currently unselected, but arrangements are still selected for merge.
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          <div className="rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-300">Library</div>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={onSelectAllLibrary} className="text-neutral-400 hover:text-white">
                  All
                </button>
                <button type="button" onClick={onSelectNoLibrary} className="text-neutral-400 hover:text-white">
                  None
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-56 overflow-auto pr-1">{renderFolderContents(null, 0)}</div>
          </div>
          <div className="rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-300">Arrangements</div>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={onSelectAllArrangements} className="text-neutral-400 hover:text-white">
                  All
                </button>
                <button type="button" onClick={onSelectNoArrangements} className="text-neutral-400 hover:text-white">
                  None
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-28 space-y-1 overflow-auto pr-1">
              {arrangements.map((entry) => {
                const id = String(entry?.id || "");
                const checked = selectedArrangementIds.includes(id);
                return (
                  <label key={`cloud-import-arrangement-${id}`} className="flex items-center gap-2 text-sm text-neutral-400">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onToggleArrangement?.(id, e.target.checked)}
                      className="accent-neutral-500"
                    />
                    <span className="truncate">{String(entry?.name || "Untitled Arrangement")}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className={`px-3 py-1.5 rounded border text-sm ${
              pending
                ? "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
                : !hasSelection
                  ? "border-sky-500/70 text-sky-100 bg-sky-900/20 hover:bg-sky-900/30"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800/60"
            }`}
          >
            Use cloud now, keep local on this device
          </button>
          <button
            type="button"
            onClick={onMerge}
            disabled={pending || !hasSelection}
            className={`px-3 py-1.5 rounded border text-sm ${
              pending || !hasSelection
                ? "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
                : "border-sky-500/70 text-sky-100 bg-sky-900/20 hover:bg-sky-900/30"
            }`}
          >
            {pending ? "Merging..." : "Merge into personal cloud"}
          </button>
        </div>
      </div>
    </div>
  );
}
