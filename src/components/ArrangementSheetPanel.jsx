import React from "react";

export default function ArrangementSheetPanel({
  panelRef,
  isMobile,
  position,
  shellWidth,
  onPanelMouseDown,
  onHeaderMouseDown,
  onHeaderPointerDown,
  playbackActive,
  playbackDisabled,
  hasLoopSelection,
  onTogglePlayback,
  clearDisabled,
  clearTitle,
  onClear,
  libraryActive,
  onOpenLibrary,
  onClose,
  LibraryIcon,
  settingsMenu,
  children,
}) {
  return (
    <div className="fixed inset-0 z-[87] pointer-events-none">
      <div
        ref={panelRef}
        className={`overflow-auto rounded-xl border border-neutral-700 bg-neutral-900 pt-0 pointer-events-auto shadow-2xl ${
          isMobile ? "max-h-[calc(100vh-8px)]" : "max-h-[88vh]"
        }`}
        style={{
          position: "absolute",
          left: isMobile ? 4 : position.x,
          top: isMobile ? 4 : position.y,
          width: `${shellWidth}px`,
          maxWidth: "calc(100vw - 8px)",
          paddingBottom: "0px",
        }}
        onMouseDown={onPanelMouseDown}
      >
        <div
          className="sticky top-0 z-10 mb-3 border-b border-neutral-800 bg-neutral-900 px-3 pt-2 pb-1.5 md:pt-3 cursor-move select-none touch-none"
          onMouseDown={onHeaderMouseDown}
          onPointerDown={onHeaderPointerDown}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-3"
                onMouseDown={onHeaderMouseDown}
                onPointerDown={onHeaderPointerDown}
                title="Drag window"
              >
                <h3 className="text-sm text-neutral-200">Sheet</h3>
              </div>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onTogglePlayback?.();
                }}
                onClick={() => {}}
                disabled={playbackDisabled}
                className={`inline-flex h-[1.625rem] items-center justify-center rounded border px-2 text-xs leading-none ${
                  !playbackDisabled
                    ? hasLoopSelection
                      ? "border-sky-500/70 text-sky-100 bg-sky-900/20 hover:bg-sky-900/30"
                      : "border-sky-700 text-sky-100 bg-sky-900/30 hover:bg-sky-900/40"
                    : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
                }`}
              >
                {playbackActive ? "Stop" : "Play"}
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear?.();
                }}
                disabled={clearDisabled}
                className={`inline-flex h-[1.625rem] items-center justify-center rounded border px-2 text-xs leading-none ${
                  !clearDisabled
                    ? "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
                    : "border-neutral-800 bg-neutral-900/60 text-neutral-600 cursor-not-allowed"
                }`}
                title={clearTitle}
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => onOpenLibrary?.(!!e.shiftKey)}
                className={`inline-flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded border text-xs leading-none ${
                  libraryActive
                    ? "border-neutral-700 text-white bg-neutral-800"
                    : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
                }`}
                title="Open library"
                aria-label="Open library"
              >
                <LibraryIcon />
              </button>
              {settingsMenu}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded border border-neutral-800 bg-neutral-900/60 text-xs leading-none text-neutral-400 hover:bg-neutral-800/60"
                aria-label="Close sheet"
                title="Close sheet"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
