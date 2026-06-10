import React from "react";

export default function ArrangementDeleteDialog({
  entry,
  onCancel,
  onDelete,
}) {
  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-[89] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Delete Arrangement</h3>
        <p className="mt-2 text-sm text-neutral-300">
          {`Delete "${entry.name || "Untitled Arrangement"}"?`}
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(entry.id)}
            className="px-3 py-1.5 rounded border border-red-900 text-sm text-red-100 bg-red-950/40 hover:bg-red-900/40"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
