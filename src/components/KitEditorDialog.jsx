import React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SavePresetAsPanel } from "./KitPresetDialogs";

export default function KitEditorDialog({
  isOpen,
  saveAsOpen,
  saveAsName,
  onSaveAsNameChange,
  onOpenSaveAs,
  onCancelSaveAs,
  onSaveAs,
  presetNameInlineDraft,
  onPresetNameInlineDraftChange,
  selectedSavedPreset,
  onRenameSelectedPreset,
  onDeleteSelectedPreset,
  onStepPreset,
  keepTracksWithNotesEnabled,
  onToggleKeepTracksWithNotes,
  pendingRemoval,
  onPendingRemovalChange,
  onConfirmRemoveMoveNotes,
  onConfirmRemoveDeleteNotes,
  kitInstrumentIds,
  allInstruments,
  instrumentById,
  kitOrderSensors,
  kitOrderListRef,
  restrictKitDragToList,
  onKitOrderDragEnd,
  availableInstrumentButtonWidthCh,
  onToggleInstrumentInKit,
  onRequestRemoveInstrument,
  onClose,
  onBackdropMouseDown,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        className="w-full max-w-[24rem] max-h-[90vh] overflow-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Edit Drumkit</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-300">Preset</span>
          <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
            <button
              type="button"
              onClick={() => onStepPreset?.(-1)}
              className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
              aria-label="Previous preset"
            >
              −
            </button>
            <input
              type="text"
              value={presetNameInlineDraft}
              readOnly={!selectedSavedPreset}
              onFocus={(e) => {
                if (!selectedSavedPreset) return;
                e.currentTarget.select();
              }}
              onChange={(e) => {
                if (!selectedSavedPreset) return;
                onPresetNameInlineDraftChange?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (!selectedSavedPreset) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRenameSelectedPreset?.();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onPresetNameInlineDraftChange?.(selectedSavedPreset.label);
                }
              }}
              className={`min-w-[112px] px-3 py-1 text-sm text-center text-white bg-neutral-800 border-l border-r border-neutral-700 outline-none ${
                selectedSavedPreset ? "cursor-text" : "cursor-default"
              }`}
              title={selectedSavedPreset ? "Edit name and press Enter to save" : "Built-in presets cannot be renamed"}
            />
            <button
              type="button"
              onClick={() => onStepPreset?.(1)}
              className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
              aria-label="Next preset"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenSaveAs}
            className="px-2.5 py-1 rounded border text-sm border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
            title="Save current drumkit as a new preset"
          >
            Save As
          </button>
          <button
            type="button"
            onClick={onDeleteSelectedPreset}
            disabled={!selectedSavedPreset}
            className={`px-2.5 py-1 rounded border text-sm ${
              selectedSavedPreset
                ? "border-red-900 text-red-200 hover:bg-red-900/30"
                : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
            }`}
            title={selectedSavedPreset ? "Delete selected preset" : "Only saved presets can be deleted"}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onToggleKeepTracksWithNotes}
            className={`px-2.5 py-1 rounded border text-sm ${
              keepTracksWithNotesEnabled
                ? "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
                : "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/40"
            }`}
            title="Automatically keep tracks with notes"
          >
            Keep tracks with notes
          </button>
        </div>

        {saveAsOpen && (
          <SavePresetAsPanel
            name={saveAsName}
            onNameChange={onSaveAsNameChange}
            onSave={onSaveAs}
            onCancel={onCancelSaveAs}
          />
        )}

        {pendingRemoval && (
          <div className="mt-4 rounded-lg border border-amber-700/70 bg-amber-950/30 p-3">
            <div className="text-sm text-amber-200">
              {(instrumentById[pendingRemoval.instId]?.label || pendingRemoval.instId) + " has notes."}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={pendingRemoval.moveTargetId || ""}
                onChange={(e) =>
                  onPendingRemovalChange?.((prev) =>
                    prev ? { ...prev, moveTargetId: e.target.value || null } : prev
                  )
                }
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
              >
                <option value="">Select destination</option>
                {kitInstrumentIds
                  .filter((id) => id !== pendingRemoval.instId)
                  .map((id) => (
                    <option key={`move-${id}`} value={id}>
                      {instrumentById[id]?.label || id}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!pendingRemoval.moveTargetId}
                onClick={onConfirmRemoveMoveNotes}
                className={`px-3 py-1 rounded border text-sm ${
                  pendingRemoval.moveTargetId
                    ? "border-cyan-600 text-cyan-100 hover:bg-cyan-800/30"
                    : "border-neutral-700 text-neutral-500 cursor-not-allowed"
                }`}
              >
                Move notes
              </button>
              <button
                type="button"
                onClick={onConfirmRemoveDeleteNotes}
                className="px-3 py-1.5 rounded border border-amber-600 text-sm text-amber-100 hover:bg-amber-800/40"
              >
                Delete notes
              </button>
              <button
                type="button"
                onClick={() => onPendingRemovalChange?.(null)}
                className="px-3 py-1.5 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-[1.35fr_0.65fr] gap-1">
          <div>
            <div className="text-sm font-medium mb-2">Kit Order</div>
            <div className="text-xs text-neutral-400 mb-2">Drag rows to reorder instruments.</div>
            <DndContext
              sensors={kitOrderSensors}
              collisionDetection={closestCenter}
              onDragEnd={onKitOrderDragEnd}
              modifiers={[restrictKitDragToList]}
            >
              <SortableContext items={kitInstrumentIds} strategy={verticalListSortingStrategy}>
                <div ref={kitOrderListRef} className="space-y-2">
                  {kitInstrumentIds.map((id, idx) => {
                    const inst = instrumentById[id];
                    if (!inst) return null;
                    return (
                      <SortableKitOrderRow
                        key={`kit-${id}`}
                        id={id}
                        index={idx}
                        label={inst.label}
                        onRemove={() => onRequestRemoveInstrument?.(id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <div
              className="text-sm font-medium mb-2 ml-auto text-left"
              style={{ width: `${availableInstrumentButtonWidthCh}ch` }}
            >
              Available Instruments
            </div>
            <div className="space-y-2 flex flex-col items-end ml-auto">
              {allInstruments.map((inst) => {
                const enabled = kitInstrumentIds.includes(inst.id);
                return (
                  <button
                    type="button"
                    onClick={() => onToggleInstrumentInKit?.(inst.id, !enabled)}
                    key={`avail-${inst.id}`}
                    className={`w-full text-left inline-flex items-center gap-2 rounded border px-2 py-1 text-sm ${
                      enabled
                        ? "border-neutral-800 text-white hover:bg-neutral-800/40"
                        : "border-neutral-800 text-neutral-500 bg-neutral-900/40 hover:bg-neutral-800/50"
                    }`}
                    style={{ width: `${availableInstrumentButtonWidthCh}ch` }}
                  >
                    <span>{inst.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableKitOrderRow({
  id,
  index,
  label,
  onRemove,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1.5 rounded border px-1.5 py-1 ${
        isDragging ? "border-cyan-700/70 bg-cyan-950/20" : "border-neutral-800"
      }`}
    >
      <div className="w-3.5 text-[11px] text-neutral-400">{index + 1}</div>
      <div className="mr-1 text-neutral-500 text-[9px]">⋮⋮</div>
      <div className="flex-1 whitespace-nowrap text-sm leading-tight pr-1">{label}</div>
      <button
        type="button"
        onClick={onRemove}
        className="h-6 px-2 shrink-0 rounded border border-red-900 text-[10px] leading-none text-red-200 hover:bg-red-900/30"
        aria-label="Remove instrument"
        title="Remove instrument"
      >
        ×
      </button>
    </div>
  );
}
