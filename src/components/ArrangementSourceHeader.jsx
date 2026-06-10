import React from "react";
import { createPortal } from "react-dom";

export default function ArrangementSourceHeader({
  sourceTab,
  moveUpTargetRef,
  moveUpActive = false,
  onMoveUpDragOver,
  onMoveUpDragLeave,
  onMoveUpDrop,
  onTitleMouseDown,
  onTitlePointerDown,
  titleClassName = "",
  renderBreadcrumb,
  actionSlot = null,
  filtersButtonRef,
  filtersOpen,
  filtersMenuStyle,
  filtersMenuRef,
  filtersAnchor,
  onToggleFilters,
  onSetSourceTab,
  onShowBeats,
  onShowArrangement,
  onShowBeatsAndArrangement,
  onShowSheet,
  onShowPresets,
  canSyncPersonalLibrary = false,
  personalLibraryRefreshing = false,
  onSyncPersonalLibrary,
  showBeatFilters = true,
  sortLabel,
  onCycleSort,
  timeSigFilter,
  onTimeSigFilterChange,
  allTimeSigCategories = [],
  timeSigOptionKeyPrefix = "arr-ts",
  onStartBpmRepeat,
  onStopBpmRepeat,
  onCycleBpmFilterMode,
  bpmFilterLabel,
  showRefreshPublic = false,
  onRefreshPublic,
  showPublishPublic = false,
  onPublishPublic,
  onClose,
  closeTitle,
  closeAriaLabel,
  error,
  onClearError,
  menuClassName = "",
}) {
  const sourceButtonClass = (tab) =>
    `inline-flex h-[1.625rem] items-center justify-center rounded border px-1.5 text-xs ${
      sourceTab === tab
        ? "border-neutral-700 text-white bg-neutral-800"
        : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/60"
    }`;
  const menuButtonClass =
    "inline-flex h-[1.625rem] items-center justify-center rounded border border-neutral-800 bg-neutral-900/60 px-1.5 text-xs text-neutral-400 hover:bg-neutral-800/60";

  return (
    <>
      <div className="flex items-center gap-2">
        <div
          ref={sourceTab === "local" ? moveUpTargetRef : null}
          className={`min-w-0 flex flex-1 items-center gap-2 rounded select-none ${
            moveUpActive ? "bg-cyan-900/15 text-cyan-50" : ""
          } ${titleClassName}`}
          onMouseDown={onTitleMouseDown}
          onPointerDown={onTitlePointerDown}
          onDragOver={onMoveUpDragOver}
          onDragLeave={onMoveUpDragLeave}
          onDrop={onMoveUpDrop}
        >
          <div className="text-sm text-neutral-200">{sourceTab === "presets" ? "Presets" : "Beats"}</div>
          {sourceTab === "local" && renderBreadcrumb ? renderBreadcrumb() : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {actionSlot}
          <div className="relative">
            <button
              ref={filtersButtonRef}
              type="button"
              onClick={onToggleFilters}
              className={`inline-flex h-[1.625rem] items-center justify-center px-1.5 rounded border text-xs leading-none ${
                filtersOpen
                  ? "border-neutral-700 text-white bg-neutral-800"
                  : "border-neutral-800 text-neutral-400 bg-neutral-900/60"
              }`}
              title={filtersOpen ? "Hide beat filters" : "Show beat filters"}
            >
              ...
            </button>
            {filtersOpen && filtersMenuStyle
              ? createPortal(
                  <div
                    ref={filtersMenuRef}
                    style={filtersMenuStyle}
                    className={`bg-neutral-900 p-2.5 ${
                      filtersAnchor === "docked"
                        ? "rounded-xl border border-neutral-800 shadow-xl shadow-black/20"
                        : "rounded-lg border border-neutral-700 shadow-xl"
                    } ${menuClassName}`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => onSetSourceTab("local")} className={sourceButtonClass("local")}>
                          Local
                        </button>
                        <button type="button" onClick={() => onSetSourceTab("public")} className={sourceButtonClass("public")}>
                          Public
                        </button>
                      </div>
                      <button type="button" onClick={onShowBeats} className={menuButtonClass}>
                        Beats
                      </button>
                      <button type="button" onClick={onShowArrangement} className={menuButtonClass}>
                        Arrangement
                      </button>
                      <button type="button" onClick={onShowBeatsAndArrangement} className={menuButtonClass}>
                        Beats + Arrangement
                      </button>
                      <button type="button" onClick={onShowSheet} className={menuButtonClass}>
                        Sheet
                      </button>
                      <button type="button" onClick={onShowPresets} className={menuButtonClass}>
                        Presets
                      </button>
                      {canSyncPersonalLibrary ? (
                        <button
                          type="button"
                          onClick={onSyncPersonalLibrary}
                          disabled={personalLibraryRefreshing}
                          className={`inline-flex h-[1.625rem] items-center justify-center rounded border px-1.5 text-xs ${
                            personalLibraryRefreshing
                              ? "border-neutral-800 bg-neutral-900/60 text-neutral-500 cursor-not-allowed"
                              : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/60"
                          }`}
                        >
                          {personalLibraryRefreshing ? "Syncing..." : "Sync personal cloud library"}
                        </button>
                      ) : null}
                      {showBeatFilters ? (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-neutral-400">Sort</span>
                            <button type="button" onClick={onCycleSort} className={menuButtonClass}>
                              {sortLabel}
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-neutral-400">Time sig</span>
                            <select
                              value={timeSigFilter}
                              onChange={(e) => onTimeSigFilterChange(e.target.value)}
                              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="all">All</option>
                              {allTimeSigCategories.map((ts) => (
                                <option key={`${timeSigOptionKeyPrefix}-${ts}`} value={ts}>
                                  {ts}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-neutral-400">BPM</span>
                            <div className="flex items-stretch overflow-hidden rounded border border-neutral-700 bg-neutral-800">
                              <button
                                type="button"
                                onPointerDown={() => onStartBpmRepeat(-1)}
                                onPointerUp={onStopBpmRepeat}
                                onPointerCancel={onStopBpmRepeat}
                                onPointerLeave={onStopBpmRepeat}
                                className="px-2 text-xs text-neutral-300 hover:bg-neutral-700/60 active:bg-neutral-700"
                              >
                                &minus;
                              </button>
                              <button
                                type="button"
                                onClick={onCycleBpmFilterMode}
                                className="min-w-[64px] border-l border-r border-neutral-700 px-2 py-1 text-xs text-white hover:bg-neutral-700/60"
                                title="Cycle BPM filter mode"
                              >
                                {bpmFilterLabel}
                              </button>
                              <button
                                type="button"
                                onPointerDown={() => onStartBpmRepeat(1)}
                                onPointerUp={onStopBpmRepeat}
                                onPointerCancel={onStopBpmRepeat}
                                onPointerLeave={onStopBpmRepeat}
                                className="px-2 text-xs text-neutral-300 hover:bg-neutral-700/60 active:bg-neutral-700"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          {showRefreshPublic ? (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={onRefreshPublic}
                                className="px-2 py-0.5 rounded border border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800/50"
                              >
                                Refresh
                              </button>
                            </div>
                          ) : null}
                          {showPublishPublic ? (
                            <button
                              type="button"
                              onClick={onPublishPublic}
                              className={menuButtonClass}
                              title="Publish to public beat library"
                            >
                              Publish public
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>,
                  document.body
                )
              : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded border border-neutral-800 bg-neutral-900/60 text-xs leading-none text-neutral-400 hover:bg-neutral-800/60"
            title={closeTitle}
            aria-label={closeAriaLabel}
          >
            &times;
          </button>
        </div>
      </div>
      {error ? (
        <div className="mt-3 rounded border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-xs text-amber-100 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={onClearError}
            className="px-1 rounded border border-amber-700/60 text-amber-100 hover:bg-amber-800/40"
            aria-label="Close source error"
            title="Close"
          >
            x
          </button>
        </div>
      ) : null}
    </>
  );
}
