import React from "react";
import { createPortal } from "react-dom";

export default function ArrangementDetailsHeader({
  dragHandleProps,
  playButtonRef,
  playbackUsesArrangement,
  playbackActive,
  onTogglePlayback,
  isSheetOpen,
  onOpenSheet,
  sheetDisabled,
  sheetTitle,
  menuButtonRef,
  menuRef,
  menuOpen,
  menuStyle,
  onToggleMenu,
  activeLibraryTab,
  onSetLibraryTab,
  canSyncPersonalLibrary,
  personalLibraryRefreshing,
  onSyncPersonalLibrary,
  onShowBeats,
  onShowArrangement,
  onShowBeatsAndArrangement,
  onShowSheet,
  onClose,
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 cursor-move select-none" {...dragHandleProps}>
        <div className="text-sm text-neutral-200">Arrangement</div>
        <button
          ref={playButtonRef}
          type="button"
          onClick={onTogglePlayback}
          className={`px-2 py-1 rounded border text-xs ${
            playbackUsesArrangement
              ? "border-sky-500/70 text-sky-100 bg-sky-900/30 shadow-[0_0_0_1px_rgba(14,165,233,0.35)] hover:bg-sky-900/40"
              : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
          }`}
        >
          {playbackActive ? "Stop" : "Play"}
        </button>
        {!isSheetOpen && (
          <button
            type="button"
            onClick={onOpenSheet}
            disabled={sheetDisabled}
            className={`px-2 py-1 rounded border text-xs ${
              sheetDisabled
                ? "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
                : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
            }`}
            title={sheetTitle}
          >
            Open sheet
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onToggleMenu}
            className={`inline-flex h-[1.625rem] items-center justify-center px-1.5 rounded border text-xs leading-none ${
              menuOpen
                ? "border-neutral-700 text-white bg-neutral-800"
                : "border-neutral-800 text-neutral-400 bg-neutral-900/60"
            }`}
            title={menuOpen ? "Hide arrangement options" : "Show arrangement options"}
          >
            ...
          </button>
          {menuOpen && menuStyle
            ? createPortal(
                <div
                  ref={menuRef}
                  style={menuStyle}
                  className="min-w-[11rem] rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl"
                >
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onSetLibraryTab?.("local")}
                        className={`inline-flex h-[1.625rem] items-center justify-center rounded border px-1.5 text-xs ${
                          activeLibraryTab === "local"
                            ? "border-neutral-700 text-white bg-neutral-800"
                            : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/60"
                        }`}
                      >
                        Local
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetLibraryTab?.("public")}
                        className={`inline-flex h-[1.625rem] items-center justify-center rounded border px-1.5 text-xs ${
                          activeLibraryTab === "public"
                            ? "border-neutral-700 text-white bg-neutral-800"
                            : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/60"
                        }`}
                      >
                        Public
                      </button>
                    </div>
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
                    <MenuButton onClick={onShowBeats}>Beats</MenuButton>
                    <MenuButton onClick={onShowArrangement}>Arrangement</MenuButton>
                    <MenuButton onClick={onShowBeatsAndArrangement}>Beats + Arrangement</MenuButton>
                    <MenuButton onClick={onShowSheet} disabled={sheetDisabled}>
                      Sheet
                    </MenuButton>
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
          title="Close library"
          aria-label="Close library"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function MenuButton({ disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-[1.625rem] items-center justify-center rounded border px-1.5 text-xs ${
        disabled
          ? "border-neutral-800 bg-neutral-900/60 text-neutral-500 cursor-not-allowed"
          : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/60"
      }`}
    >
      {children}
    </button>
  );
}
