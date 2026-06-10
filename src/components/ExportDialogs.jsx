import React from "react";

function DialogFrame({ isOpen, maxWidth = "max-w-md", onCancel, children }) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onCancel}
    >
      <div
        className={`w-full ${maxWidth} rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function BeatPrintDialog({
  isOpen,
  titleInputRef,
  composerInputRef,
  title,
  onTitleChange,
  composer,
  onComposerChange,
  watermarkEnabled,
  onToggleWatermark,
  qrEnabled,
  onToggleQr,
  onCancel,
  onPrint,
}) {
  return (
    <DialogFrame isOpen={isOpen} onCancel={onCancel}>
      <h3 className="text-base font-semibold">Print Notation</h3>
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
            placeholder="Composer"
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleWatermark}
            className={`w-fit px-2.5 py-1 rounded border text-sm ${
              !watermarkEnabled
                ? "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
                : "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/40"
            }`}
            title="Show footer watermark in exported PDF"
          >
            Disable watermark
          </button>
          <button
            type="button"
            onClick={onToggleQr}
            className={`w-fit px-2.5 py-1 rounded border text-sm ${
              qrEnabled
                ? "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
                : "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/40"
            }`}
            title="Include beat playback QR code in exported PDF"
          >
            {qrEnabled ? "Disable QR" : "Enable QR"}
          </button>
        </div>
      </div>
      <DialogActions onCancel={onCancel} onConfirm={onPrint} confirmLabel="Print" />
    </DialogFrame>
  );
}

export function NotationPngExportDialog({
  isOpen,
  color,
  onColorChange,
  onCancel,
  onExport,
}) {
  return (
    <DialogFrame isOpen={isOpen} maxWidth="max-w-sm" onCancel={onCancel}>
      <h3 className="text-base font-semibold">Export PNG</h3>
      <p className="mt-2 text-sm text-neutral-400">
        Exports notation only on a transparent background. Title, composer, watermark, and QR are omitted.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-neutral-300">Notation color</span>
        <button
          type="button"
          onClick={() => onColorChange?.("black")}
          className={`px-3 py-1.5 rounded border text-sm ${
            color === "black"
              ? "border-neutral-700 text-white bg-neutral-800"
              : "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/40"
          }`}
        >
          Black
        </button>
        <button
          type="button"
          onClick={() => onColorChange?.("white")}
          className={`px-3 py-1.5 rounded border text-sm ${
            color === "white"
              ? "border-neutral-700 text-white bg-neutral-800"
              : "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/40"
          }`}
        >
          White
        </button>
      </div>
      <DialogActions onCancel={onCancel} onConfirm={onExport} confirmLabel="Export" />
    </DialogFrame>
  );
}

export function ArrangementPrintDialog({
  isOpen,
  title,
  onTitleChange,
  subtitle,
  onSubtitleChange,
  composer,
  onComposerChange,
  watermarkEnabled,
  onToggleWatermark,
  qrEnabled,
  onToggleQr,
  onCancel,
  onPrint,
}) {
  return (
    <DialogFrame isOpen={isOpen} onCancel={onCancel}>
      <h3 className="text-base font-semibold">Print Arrangement</h3>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder="Untitled"
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          <span>Subtitle</span>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => onSubtitleChange?.(e.target.value)}
            placeholder="Optional second line"
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          <span>Composer</span>
          <input
            type="text"
            value={composer}
            onChange={(e) => onComposerChange?.(e.target.value)}
            placeholder="Composer"
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleWatermark}
            className={`w-fit px-2.5 py-1 rounded border text-sm ${
              !watermarkEnabled
                ? "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
                : "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/40"
            }`}
            title="Show footer watermark in exported PDF"
          >
            Disable watermark
          </button>
          <button
            type="button"
            onClick={onToggleQr}
            className={`w-fit px-2.5 py-1 rounded border text-sm ${
              qrEnabled
                ? "border-neutral-700 text-white bg-neutral-800 hover:bg-neutral-700/60"
                : "border-neutral-800 text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/40"
            }`}
            title="Include arrangement playback QR code in exported PDF"
          >
            {qrEnabled ? "Disable QR" : "Enable QR"}
          </button>
        </div>
      </div>
      <DialogActions onCancel={onCancel} onConfirm={onPrint} confirmLabel="Print" />
    </DialogFrame>
  );
}

export function MidiExportDialog({
  isOpen,
  mode,
  title,
  onTitleChange,
  composer,
  onComposerChange,
  onCancel,
  onExport,
}) {
  return (
    <DialogFrame isOpen={isOpen} maxWidth="max-w-md" onCancel={onCancel}>
      <h3 className="text-base font-semibold">
        {mode === "arrangement" ? "Export Arrangement MIDI" : "Export MIDI"}
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          <span>Title</span>
          <input
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
            type="text"
            value={composer}
            onChange={(e) => onComposerChange?.(e.target.value)}
            placeholder="Composer"
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>
      <DialogActions onCancel={onCancel} onConfirm={onExport} confirmLabel="Export" />
    </DialogFrame>
  );
}

function DialogActions({ onCancel, onConfirm, confirmLabel }) {
  return (
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
        onClick={onConfirm}
        className="px-3 py-1.5 rounded border border-neutral-700 text-sm text-white bg-neutral-800 hover:bg-neutral-700/60"
      >
        {confirmLabel}
      </button>
    </div>
  );
}
