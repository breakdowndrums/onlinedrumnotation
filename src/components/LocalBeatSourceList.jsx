import React from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";

export default function LocalBeatSourceList({
  listRef,
  variant = "floating",
  sensors,
  collisionDetection,
  modifiers,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  DropTargetComponent,
  DragOverlayCardComponent,
  activeDragBeat,
  activeDragBeatBpm,
  selectedContainerId,
  currentParentId,
  currentFolders,
  currentBeats,
  renderFolderContents,
  onCreateFolder,
  onSaveAsNew,
  trashTargetRef,
  onTrashClick,
  onTrashDragOver,
  onTrashDragLeave,
  onTrashDrop,
  trashActive,
  trashEmphasis,
  trashTitle,
  TrashIcon,
}) {
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="dg-slim-scrollbar dg-scroll-follow-list max-h-[52vh] flex-1 overflow-auto pr-1">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          modifiers={modifiers}
        >
          <div className="space-y-0">
            <DropTargetComponent id="__up__" className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none" />
            <DropTargetComponent id="__trash__" className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none" />
            <div className={selectedContainerId !== "all" ? "pt-1" : ""}>
              {renderFolderContents?.(currentParentId, 0, variant)}
            </div>
            {currentFolders.length === 0 && currentBeats.length === 0 && (
              <div className="px-2 py-1 text-xs text-neutral-500">
                {selectedContainerId === "all"
                  ? "No local beats saved yet. Create a folder or save a beat."
                  : "This folder is empty."}
              </div>
            )}
          </div>
          <DragOverlay>
            <DragOverlayCardComponent
              beat={activeDragBeat}
              beatBpm={activeDragBeatBpm}
            />
          </DragOverlay>
        </DndContext>
      </div>
      <div className="mt-3 border-t border-neutral-800 pt-3">
        <div className={variant === "docked" ? "flex flex-wrap items-center gap-2" : "flex items-center gap-2"}>
          <button
            type="button"
            onClick={onCreateFolder}
            className="flex h-7 flex-1 items-center justify-center rounded border border-neutral-800 bg-neutral-900/40 px-2 text-sm text-neutral-400 hover:bg-neutral-800/60"
          >
            {variant === "docked" ? "Folder" : "+ Folder"}
          </button>
          <button
            type="button"
            onClick={onSaveAsNew}
            className="h-7 rounded border border-neutral-800 bg-neutral-900/60 px-2.5 text-sm text-neutral-400 hover:bg-neutral-800/60"
            title="Save as new beat"
          >
            Save as new
          </button>
          <DropTargetComponent id="__trash__">
            <button
              ref={trashTargetRef}
              type="button"
              onClick={onTrashClick}
              onDragOver={onTrashDragOver}
              onDragLeave={onTrashDragLeave}
              onDrop={onTrashDrop}
              className={`inline-flex h-7 items-center justify-center rounded border px-2 text-sm ${
                trashActive
                  ? "border-red-500/80 bg-red-900/25 text-red-100 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]"
                  : trashEmphasis
                    ? "border-red-900 text-red-200 hover:bg-red-900/30"
                    : "border-neutral-800 text-neutral-500 bg-neutral-900/60"
              }`}
              title={trashTitle}
            >
              <TrashIcon />
            </button>
          </DropTargetComponent>
        </div>
      </div>
    </div>
  );
}
