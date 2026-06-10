import React from "react";

export default function PublicSubmitDialog({
  isOpen,
  titleInputRef,
  composerInputRef,
  title,
  onTitleChange,
  composer,
  onComposerChange,
  lockedComposer = "",
  category,
  onCategoryChange,
  style,
  onStyleChange,
  categoryOptions = [],
  styleOptions = [],
  onCancel,
  onSubmit,
}) {
  if (!isOpen) return null;
  const canSubmit =
    String(title || "").trim() &&
    (String(lockedComposer || "").trim() || String(composer || "").trim()) &&
    category !== "all" &&
    style !== "all";

  return (
    <div
      className="fixed inset-0 z-[89] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Submit Public Beat</h3>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            <span>Title</span>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              placeholder="Untitled"
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            <span>Composer</span>
            <input
              ref={composerInputRef}
              type="text"
              value={composer}
              onChange={(e) => onComposerChange?.(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                await onSubmit?.();
              }}
              placeholder="Composer"
              disabled={Boolean(lockedComposer)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => onCategoryChange?.(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="all">Select category</option>
              {categoryOptions.map((entry) => (
                <option key={`public-submit-category-${entry}`} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            <span>Style</span>
            <select
              value={style}
              onChange={(e) => onStyleChange?.(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="all">Select style</option>
              {styleOptions.map((entry) => (
                <option key={`public-submit-style-${entry}`} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-amber-200/90">
            {lockedComposer
              ? `Composer is locked for this browser: ${lockedComposer}`
              : "Warning: Composer can only be set once on this browser for public uploads."}
          </div>
        </div>
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
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`px-3 py-1.5 rounded border text-sm ${
              canSubmit
                ? "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
                : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
            }`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
