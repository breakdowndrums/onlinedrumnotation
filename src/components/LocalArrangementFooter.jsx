import React from "react";
import { createPortal } from "react-dom";

function formatDuration(totalSeconds) {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds || 0));
  return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, "0")}`;
}

export default function LocalArrangementFooter({
  barLoopSelection,
  rowLoopSelection,
  totals,
  onClearSelection,
  isRenaming,
  nameInputRef,
  nameDraft,
  onNameDraftChange,
  onCommitRename,
  onCancelRename,
  renameWidth,
  renameHoverAction,
  onRenameHoverActionChange,
  onSaveAsNew,
  nameButtonRef,
  canRename,
  displayName,
  onBeginRename,
  pickerMenuOpen,
  pickerMenuRef,
  pickerMenuPosition,
  savedArrangements,
  activeArrangementEntry,
  onLoadSavedArrangement,
  pickerButtonRef,
  onPickerButtonMouseDown,
  onPickerButtonClick,
  titleMenuButtonRef,
  titleMenuOpen,
  onToggleTitleMenu,
  titleMenuRef,
  titleMenuPosition,
  titleLine1Draft,
  onTitleLine1DraftChange,
  titleLine2Draft,
  onTitleLine2DraftChange,
  composerDraft,
  onComposerDraftChange,
  onCreateNew,
  isAdmin,
  actionsMenuButtonRef,
  actionsMenuOpen,
  actionsMenuStyle,
  actionsMenuRef,
  onToggleActionsMenu,
  onPublishPublic,
  DropTargetComponent,
  trashTargetRef,
  trashDisabled,
  trashActive,
  trashTitle,
  onTrashClick,
  PencilIcon,
  TrashIcon,
}) {
  return (
    <>
      <div
        className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-neutral-500"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClearSelection?.();
        }}
      >
        {barLoopSelection ? (
          <span className="text-neutral-500">
            {`Loop selection: bars ${barLoopSelection.start + 1}-${barLoopSelection.end + 1}`}
          </span>
        ) : rowLoopSelection ? (
          <span className="text-neutral-500">
            {`Loop selection: ${rowLoopSelection.start + 1}-${rowLoopSelection.end + 1}`}
          </span>
        ) : null}
        <span>{`Total bars: ${totals?.totalBars || 0}`}</span>
        <span>{`Est. length: ${formatDuration(totals?.totalSeconds)}`}</span>
      </div>
      <div className="mt-auto pt-3">
        <div className="border-t border-neutral-800 pt-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              {isRenaming ? (
                <div className="relative min-w-0">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameDraft}
                    onChange={(e) => onNameDraftChange?.(e.target.value)}
                    onBlur={() => onCommitRename?.()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onCommitRename?.();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        onCancelRename?.();
                      }
                    }}
                    autoFocus
                    className="block h-7 w-full min-w-0 border-0 bg-transparent px-0 text-sm text-neutral-300 outline-none ring-0 focus:outline-none focus:ring-0"
                    style={renameWidth ? { width: `${renameWidth}px` } : undefined}
                    aria-label="Current arrangement name"
                  />
                  <div className="absolute left-1/2 top-full z-20 mt-2 inline-flex -translate-x-1/2 items-center overflow-hidden whitespace-nowrap rounded border border-neutral-700 bg-neutral-900 shadow-[0_12px_28px_rgba(0,0,0,0.38)]">
                    <button
                      type="button"
                      onMouseEnter={() => onRenameHoverActionChange?.("rename")}
                      onMouseLeave={() => onRenameHoverActionChange?.(null)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onCommitRename?.()}
                      className={`px-3 py-1.5 text-xs transition-colors ${
                        renameHoverAction === "save-as-new"
                          ? "text-neutral-300 hover:text-white"
                          : "bg-neutral-800 text-white hover:bg-neutral-700"
                      } active:bg-neutral-700`}
                      title="Rename current arrangement"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onMouseEnter={() => onRenameHoverActionChange?.("save-as-new")}
                      onMouseLeave={() => onRenameHoverActionChange?.(null)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onSaveAsNew?.()}
                      className={`border-l border-neutral-700 px-3 py-1.5 text-xs transition-colors ${
                        renameHoverAction === "save-as-new"
                          ? "bg-neutral-800 text-white hover:bg-neutral-700"
                          : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                      } active:bg-neutral-700`}
                      title="Save as new arrangement"
                    >
                      Save as new
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  ref={nameButtonRef}
                  type="button"
                  onClick={() => {
                    if (!canRename) return;
                    onBeginRename?.();
                  }}
                  disabled={!canRename}
                  className={`block h-7 w-full min-w-0 truncate bg-transparent p-0 text-left text-sm transition-colors ${
                    canRename
                      ? "text-neutral-300 hover:text-white"
                      : "text-neutral-500 cursor-default"
                  }`}
                  title={canRename ? "Rename current arrangement" : displayName || "Arrangement"}
                >
                  {displayName || "Arrangement"}
                </button>
              )}
              {pickerMenuOpen
                ? createPortal(
                    <div
                      ref={pickerMenuRef}
                      className="fixed z-[140] overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl"
                      style={{
                        top: `${pickerMenuPosition.top}px`,
                        left: `${pickerMenuPosition.left}px`,
                        width: `${pickerMenuPosition.width}px`,
                        maxHeight: `${pickerMenuPosition.maxHeight || 320}px`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-1">
                        {savedArrangements.length > 0 ? (
                          savedArrangements.map((entry) => {
                            const isActive = String(activeArrangementEntry?.id || "") === String(entry.id || "");
                            return (
                              <button
                                key={`arr-save-opt-${entry.id}`}
                                type="button"
                                onClick={() => onLoadSavedArrangement?.(entry)}
                                className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                                  isActive
                                    ? "bg-neutral-800 text-white"
                                    : "text-neutral-300 hover:bg-neutral-800/60"
                                }`}
                                title={entry.name}
                              >
                                <span className="block truncate">{entry.name || "Untitled Arrangement"}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2 text-sm text-neutral-500">No saved arrangements yet.</div>
                        )}
                      </div>
                    </div>,
                    document.body
                  )
                : null}
            </div>
            <button
              ref={pickerButtonRef}
              type="button"
              onMouseDown={onPickerButtonMouseDown}
              onClick={onPickerButtonClick}
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded border px-2 text-sm leading-none ${
                pickerMenuOpen
                  ? "border-neutral-600 text-white bg-neutral-800"
                  : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
              }`}
              title="Show saved arrangements"
              aria-label="Show saved arrangements"
            >
              ▾
            </button>
            <button
              ref={titleMenuButtonRef}
              type="button"
              onClick={onToggleTitleMenu}
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded border ${
                titleMenuOpen
                  ? "border-neutral-600 text-white bg-neutral-800"
                  : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
              }`}
              title="Edit score title and author"
              aria-label="Edit score title and author"
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              onClick={onCreateNew}
              className="h-7 rounded border border-neutral-800 bg-neutral-900/60 px-2.5 text-sm text-neutral-400 hover:bg-neutral-800/60"
              title="Create a new empty arrangement"
            >
              New
            </button>
            {isAdmin && (
              <div className="relative">
                <button
                  ref={actionsMenuButtonRef}
                  type="button"
                  onClick={onToggleActionsMenu}
                  className={`h-7 rounded border px-2 text-sm leading-none ${
                    actionsMenuOpen
                      ? "border-neutral-700 text-white bg-neutral-800"
                      : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
                  }`}
                  title="More arrangement actions"
                >
                  ...
                </button>
                {actionsMenuOpen && actionsMenuStyle
                  ? createPortal(
                      <div
                        ref={actionsMenuRef}
                        style={actionsMenuStyle}
                        className="min-w-[11rem] rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl"
                      >
                        <button
                          type="button"
                          onClick={onPublishPublic}
                          className="w-full rounded px-3 py-2 text-left text-sm text-white hover:bg-neutral-800/60"
                          title="Publish current arrangement as a new public arrangement"
                        >
                          Publish public
                        </button>
                      </div>,
                      document.body
                    )
                  : null}
              </div>
            )}
            <DropTargetComponent id="__trash__">
              <button
                ref={trashTargetRef}
                type="button"
                onClick={onTrashClick}
                disabled={trashDisabled}
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded border px-2 text-sm ${
                  trashActive
                    ? "border-red-500/80 bg-red-900/25 text-red-100 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]"
                    : !trashDisabled
                      ? "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/60"
                      : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
                }`}
                aria-label="Delete arrangement"
                title={trashTitle}
              >
                <TrashIcon />
              </button>
            </DropTargetComponent>
            {titleMenuOpen
              ? createPortal(
                  <div
                    ref={titleMenuRef}
                    className="fixed z-[140] w-72 rounded border border-neutral-700 bg-neutral-900 p-2 shadow-2xl"
                    style={{
                      top: `${titleMenuPosition.top}px`,
                      left: `${titleMenuPosition.left}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <label className="flex flex-col gap-1 text-[11px] text-neutral-400">
                      <span>Title line 1</span>
                      <input
                        type="text"
                        value={titleLine1Draft}
                        onChange={(e) => onTitleLine1DraftChange?.(e.target.value)}
                        placeholder="Main title"
                        autoFocus
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="mt-2 flex flex-col gap-1 text-[11px] text-neutral-400">
                      <span>Title line 2</span>
                      <input
                        type="text"
                        value={titleLine2Draft}
                        onChange={(e) => onTitleLine2DraftChange?.(e.target.value)}
                        placeholder="Subtitle"
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="mt-2 flex flex-col gap-1 text-[11px] text-neutral-400">
                      <span>Author</span>
                      <input
                        type="text"
                        value={composerDraft}
                        onChange={(e) => onComposerDraftChange?.(e.target.value)}
                        placeholder="Author / composer"
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </label>
                  </div>,
                  document.body
                )
              : null}
          </div>
        </div>
      </div>
    </>
  );
}
