import React from "react";
import { createPortal } from "react-dom";

function BooleanOption({ active, title, label, valueLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-1 flex w-full items-center justify-between rounded px-2 py-2 text-xs ${
        active ? "bg-neutral-800 text-white" : "text-neutral-300 hover:bg-neutral-800/60"
      }`}
      title={title}
    >
      <span>{label}</span>
      <span>{valueLabel}</span>
    </button>
  );
}

function Stepper({ label, value, onPrevious, onNext, previousLabel, nextLabel, valueWidthClass = "min-w-[64px]" }) {
  return (
    <div className="flex items-center justify-between rounded px-2 py-2">
      <span className="text-xs text-neutral-400">{label}</span>
      <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
        <button
          type="button"
          onClick={onPrevious}
          className="px-2 text-xs text-neutral-300 hover:bg-neutral-700/60"
          aria-label={previousLabel}
        >
          -
        </button>
        <div className={`${valueWidthClass} border-l border-r border-neutral-700 px-2 py-1 text-center text-xs text-white`}>
          {value}
        </div>
        <button
          type="button"
          onClick={onNext}
          className="px-2 text-xs text-neutral-300 hover:bg-neutral-700/60"
          aria-label={nextLabel}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ArrangementSheetSettingsMenu({
  buttonRef,
  menuRef,
  open,
  position,
  onToggleOpen,
  scrollRows,
  onPreviousScrollRows,
  onNextScrollRows,
  theme,
  onToggleTheme,
  virtualize,
  onToggleVirtualize,
  barsPerRow,
  onPreviousBarsPerRow,
  onNextBarsPerRow,
  dynamicSpacing,
  onToggleDynamicSpacing,
  globalMergeRests,
  onToggleGlobalMergeRests,
  globalMergeNotes,
  onToggleGlobalMergeNotes,
  globalDottedNotes,
  onToggleGlobalDottedNotes,
  printSticking,
  onTogglePrintSticking,
  previewScale,
  onDecreasePreviewScale,
  onIncreasePreviewScale,
  canExportPdf,
  onOpenPdfExport,
}) {
  const scaleLabel = previewScale === "auto" ? "Auto" : `${Math.round(previewScale * 100)}%`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggleOpen}
        className={`inline-flex h-[1.625rem] items-center justify-center rounded border px-1.5 text-xs leading-none ${
          open
            ? "border-neutral-700 text-white bg-neutral-800"
            : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
        }`}
        title="Open sheet options"
      >
        ...
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[140] rounded border border-neutral-700 bg-neutral-900 p-2 shadow-2xl"
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Stepper
                label="Auto-scroll"
                value={scrollRows === 1 ? "1 row" : `${scrollRows} rows`}
                onPrevious={onPreviousScrollRows}
                onNext={onNextScrollRows}
                previousLabel="Previous auto-scroll cadence"
                nextLabel="Next auto-scroll cadence"
                valueWidthClass="min-w-[78px]"
              />
              <BooleanOption
                active={theme === "light"}
                title="Switch sheet preview theme"
                label="Theme"
                valueLabel={theme === "light" ? "Light" : "Dark"}
                onClick={onToggleTheme}
              />
              <BooleanOption
                active={virtualize}
                title="Enable or disable lazy loading of sheet pages"
                label="Render visible pages only"
                valueLabel={virtualize ? "On" : "Off"}
                onClick={onToggleVirtualize}
              />
              <div className="mt-2 border-t border-neutral-800 pt-2">
                <Stepper
                  label="Bars/row"
                  value={barsPerRow}
                  onPrevious={onPreviousBarsPerRow}
                  onNext={onNextBarsPerRow}
                  previousLabel="Previous bars per row"
                  nextLabel="Next bars per row"
                  valueWidthClass="min-w-[62px]"
                />
                <BooleanOption
                  active={dynamicSpacing}
                  title="Use content-based bar widths for the sheet by default"
                  label="Dyn. spacing"
                  valueLabel={dynamicSpacing ? "On" : "Off"}
                  onClick={onToggleDynamicSpacing}
                />
                <BooleanOption
                  active={globalMergeRests}
                  title="Use merged rest spelling as the default for sheet rows set to Global"
                  label="Default merge rests"
                  valueLabel={globalMergeRests ? "On" : "Off"}
                  onClick={onToggleGlobalMergeRests}
                />
                <BooleanOption
                  active={globalMergeNotes}
                  title="Use merged note spelling as the default for sheet rows set to Global"
                  label="Default merge notes"
                  valueLabel={globalMergeNotes ? "On" : "Off"}
                  onClick={onToggleGlobalMergeNotes}
                />
                <BooleanOption
                  active={globalDottedNotes}
                  title="Use dotted note spelling as the default for sheet rows set to Global"
                  label="Default dotted notes"
                  valueLabel={globalDottedNotes ? "On" : "Off"}
                  onClick={onToggleGlobalDottedNotes}
                />
                <BooleanOption
                  active={printSticking}
                  title="Use notation sticking by default for the sheet"
                  label="Print sticking"
                  valueLabel={printSticking ? "On" : "Off"}
                  onClick={onTogglePrintSticking}
                />
                <Stepper
                  label="Scale"
                  value={scaleLabel}
                  onPrevious={onDecreasePreviewScale}
                  onNext={onIncreasePreviewScale}
                  previousLabel="Decrease sheet preview scale"
                  nextLabel="Increase sheet preview scale"
                />
                <button
                  type="button"
                  onClick={onOpenPdfExport}
                  disabled={!canExportPdf}
                  className={`mt-1 flex w-full items-center justify-between rounded px-2 py-2 text-xs ${
                    canExportPdf
                      ? "text-neutral-300 hover:bg-neutral-800/60"
                      : "text-neutral-500 cursor-not-allowed"
                  }`}
                  title="Download sheet as A4 PDF"
                >
                  <span>PDF export</span>
                  <span>{canExportPdf ? "Open" : "Off"}</span>
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
