import React from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export default function GridSettingsPresetSourceList({
  listRef,
  presets,
  activePreset,
  activeDragId,
  dropTargetId,
  lastOverPresetId,
  editingPresetId,
  editingName,
  onEditingNameChange,
  onCommitEditing,
  onCancelEditing,
  onStartEditing,
  pendingPresetRenameExitRef,
  sensors,
  collisionDetection,
  modifiers,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  onApplyPreset,
  onSaveAsNew,
  onDeleteSelected,
  trashTargetRef,
  DropTargetComponent,
  RowComponent,
  ReservedRowSlotComponent,
  DragOverlayCardComponent,
  activeDragPreset,
  TrashIcon,
}) {
  const shouldShowCrossTargetPlaceholder =
    !!activeDragId &&
    !!dropTargetId &&
    !String(dropTargetId).startsWith("preset:") &&
    presets.some((preset) => String(preset?.id || "") === String(activeDragId || ""));
  const visiblePresets = shouldShowCrossTargetPlaceholder
    ? presets.filter((preset) => String(preset?.id || "") !== String(activeDragId || ""))
    : presets;
  const originalIndex = presets.findIndex(
    (preset) => String(preset?.id || "") === String(activeDragId || "")
  );
  const targetIndex = presets.findIndex(
    (preset) => String(preset?.id || "") === String(lastOverPresetId || "")
  );
  const placeholderIndex = shouldShowCrossTargetPlaceholder
    ? Math.max(
        0,
        Math.min(
          visiblePresets.length,
          targetIndex >= 0 ? targetIndex : originalIndex
        )
      )
    : -1;

  return (
    <div className="mt-0.5 flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="dg-slim-scrollbar max-h-[52vh] flex-1 overflow-auto pr-1 dg-scroll-follow-list">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          modifiers={modifiers}
        >
          <div className="space-y-2.5">
            <DropTargetComponent id="__trash__" className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none" />
            <SortableContext
              items={presets.map((preset) => `preset:${String(preset.id)}`)}
              strategy={verticalListSortingStrategy}
            >
              {visiblePresets.map((preset, index) => (
                <React.Fragment key={`grid-preset-node-${preset.id}`}>
                  {shouldShowCrossTargetPlaceholder && index === placeholderIndex ? (
                    <ReservedRowSlotComponent />
                  ) : null}
                  <RowComponent
                    preset={preset}
                    isActive={activePreset?.id === preset.id}
                    isEditing={String(editingPresetId || "") === String(preset.id)}
                    editingName={editingName}
                    setEditingName={onEditingNameChange}
                    commitEditing={onCommitEditing}
                    cancelEditing={onCancelEditing}
                    startEditing={onStartEditing}
                    pendingPresetRenameExitRef={pendingPresetRenameExitRef}
                    disableTransition={!!activeDragId}
                    onApply={() => onApplyPreset?.(preset)}
                  />
                </React.Fragment>
              ))}
              {shouldShowCrossTargetPlaceholder && placeholderIndex === visiblePresets.length ? (
                <ReservedRowSlotComponent />
              ) : null}
            </SortableContext>
          </div>
          <div className="mt-3 border-t border-neutral-800 pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveAsNew}
                className="h-7 rounded border border-neutral-800 bg-neutral-900/60 px-2.5 text-sm text-neutral-400 hover:bg-neutral-800/60"
                title="Save current grid settings as a new preset"
              >
                Save as new
              </button>
              <DropTargetComponent id="__trash__">
                <button
                  ref={trashTargetRef}
                  type="button"
                  onClick={onDeleteSelected}
                  className={`inline-flex h-7 items-center justify-center rounded border px-2 text-sm ${
                    dropTargetId === "__trash__"
                      ? "border-red-500/80 bg-red-900/25 text-red-100 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]"
                      : "border-neutral-800 text-neutral-500 bg-neutral-900/60"
                  }`}
                  title="Delete selected preset"
                >
                  <TrashIcon />
                </button>
              </DropTargetComponent>
            </div>
          </div>
          <DragOverlay>
            <DragOverlayCardComponent preset={activeDragPreset} />
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
