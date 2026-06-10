import React from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export default function LocalArrangementRows({
  listRef,
  rows,
  RowComponent,
  DropTargetComponent,
  sensors,
  collisionDetection,
  modifiers,
  normalizedSelection,
  playbackEnabled,
  activePlayingRowIndex,
  currentEditorBeatKey,
  dropTarget,
  activeSortRowId,
  orderDropTargetId,
  onClearSelection,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  onSelectRow,
  onTouchSelectRow,
  onExternalDragOverRow,
  onExternalDropRow,
  onRepeatChange,
}) {
  return (
    <div
      ref={listRef}
      className="dg-slim-scrollbar mt-3 max-h-[52vh] overflow-auto pr-1"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClearSelection?.();
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        modifiers={modifiers}
      >
        <SortableContext
          items={rows.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            <DropTargetComponent id="__trash__" className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none" />
            {rows.map((row, idx) => (
              <RowComponent
                key={`arr-row-${row.id}`}
                row={row}
                index={idx}
                isPlaying={playbackEnabled && idx === activePlayingRowIndex}
                isEditorBeat={currentEditorBeatKey === `${String(row?.source || "local")}:${String(row?.beat?.id || "")}`}
                isSelected={Boolean(
                  normalizedSelection &&
                    idx >= normalizedSelection.start &&
                    idx <= normalizedSelection.end
                )}
                onSelectRow={onSelectRow}
                onTouchSelectRow={onTouchSelectRow}
                dropPosition={dropTarget?.rowId === row.id ? dropTarget.position : null}
                onExternalDragOverRow={onExternalDragOverRow}
                onExternalDropRow={onExternalDropRow}
                onRepeatChange={onRepeatChange}
                disableTransition={!!activeSortRowId && orderDropTargetId === "__trash__"}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {rows.length === 0 && (
        <div className="text-xs text-neutral-500">
          No sections yet. Add beats from the source list to build your song form.
        </div>
      )}
    </div>
  );
}
