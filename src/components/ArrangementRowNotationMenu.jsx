import React from "react";

export default function ArrangementRowNotationMenu({
  row,
  position,
  globalNotationBarsPerRow,
  globalNotationDynamicSpacing,
  globalMergeRests,
  globalMergeNotes,
  globalDottedNotes,
  globalNotationPrintStickingMode,
  getNotationPrintStickingModeFromPayload,
  onClose,
  onToggleNotationBeatName,
  onSetNotationDynamicSpacing,
  onSetNotationSpacingPreset,
  onSetNotationCustomText,
  onSetNotationBarsPerRowOverride,
  onSetNotationMergeRests,
  onSetNotationMergeNotes,
  onSetNotationDottedNotes,
  onSetNotationPrintSticking,
}) {
  const menuRef = React.useRef(null);
  const [menuStyle, setMenuStyle] = React.useState(() => ({
    top: `${position.top}px`,
    left: `${position.left}px`,
  }));
  const [customTextDraft, setCustomTextDraft] = React.useState(String(row?.notationCustomText || ""));

  React.useEffect(() => {
    setCustomTextDraft(String(row?.notationCustomText || ""));
  }, [row?.notationCustomText]);

  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!(menu instanceof HTMLElement) || typeof window === "undefined") {
      setMenuStyle({
        top: `${position.top}px`,
        left: `${position.left}px`,
      });
      return;
    }
    const margin = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = menu.getBoundingClientRect();
    const nextLeft = Math.max(margin, Math.min(position.left, viewportWidth - rect.width - margin));
    const preferredBelowTop = position.top;
    const fitsBelow = preferredBelowTop + rect.height <= viewportHeight - margin;
    const nextTop = fitsBelow
      ? Math.max(margin, preferredBelowTop)
      : Math.max(margin, Math.min(position.top - rect.height - 16, viewportHeight - rect.height - margin));
    setMenuStyle({
      top: `${Math.round(nextTop)}px`,
      left: `${Math.round(nextLeft)}px`,
    });
  }, [position.left, position.top, row?.id]);

  React.useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = menuRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      onClose?.();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const commitCustomText = React.useCallback(() => {
    onSetNotationCustomText?.(customTextDraft);
  }, [customTextDraft, onSetNotationCustomText]);

  const allowedBarsPerRow = [1, 2, 3, 4];
  const spacingPresets = ["large", "normal", "tight"];
  const spacingPresetLabels = { large: "Large", normal: "Normal", tight: "Tight" };
  const effectiveBarsPerRow = Number.isFinite(Number(row?.notationBarsPerRowOverride))
    && row?.notationBarsPerRowCustom === true
    ? Math.max(1, Math.min(4, Math.round(Number(row.notationBarsPerRowOverride))))
    : allowedBarsPerRow.includes(Number(globalNotationBarsPerRow))
      ? Number(globalNotationBarsPerRow)
      : 4;
  const hasExplicitBarsPerRowOverride = row?.notationBarsPerRowCustom === true;
  const hasExplicitDynamicSpacingOverride = row?.notationDynamicSpacingCustom === true;
  const effectiveDynamicSpacing =
    row?.notationDynamicSpacingCustom === true && typeof row?.notationDynamicSpacingOverride === "boolean"
      ? row.notationDynamicSpacingOverride
      : globalNotationDynamicSpacing === true;
  const effectiveSpacingPreset = spacingPresets.includes(String(row?.notationSpacingPreset || ""))
    ? String(row?.notationSpacingPreset)
    : "normal";
  const effectiveSpacingPresetIndex = Math.max(0, spacingPresets.indexOf(effectiveSpacingPreset));
  const effectiveBarsPerRowIndex = Math.max(0, allowedBarsPerRow.indexOf(effectiveBarsPerRow));
  const barsPerRowControlDisabled = row?.notationBarsPerRowControlDisabled === true;
  const effectiveMergeRests =
    row?.notationMergeRestsCustom === true && typeof row?.notationMergeRestsOverride === "boolean"
      ? row.notationMergeRestsOverride
      : globalMergeRests === true;
  const effectiveMergeNotes =
    row?.notationMergeNotesCustom === true && typeof row?.notationMergeNotesOverride === "boolean"
      ? row.notationMergeNotesOverride
      : globalMergeNotes === true;
  const effectiveDottedNotes =
    row?.notationDottedNotesCustom === true && typeof row?.notationDottedNotesOverride === "boolean"
      ? row.notationDottedNotesOverride
      : globalDottedNotes === true;
  const effectivePrintStickingMode =
    row?.notationPrintStickingCustom === true
      ? row?.notationPrintStickingOverride === false
        ? "off"
        : row?.notationPrintStickingModeOverride === "all"
          ? "all"
          : "custom"
      : row?.notationPrintStickingFollowBeat === true
        ? getNotationPrintStickingModeFromPayload?.(row?.beat?.payload, globalNotationPrintStickingMode)
        : globalNotationPrintStickingMode === "all"
          ? "all"
          : globalNotationPrintStickingMode === "off"
            ? "off"
            : "custom";
  const cyclePrintStickingMode = React.useCallback((delta) => {
    const modes = ["off", "all", "custom"];
    const currentIndex = Math.max(0, modes.indexOf(effectivePrintStickingMode));
    const nextIndex = (currentIndex + delta + modes.length) % modes.length;
    onSetNotationPrintSticking?.(modes[nextIndex]);
  }, [effectivePrintStickingMode, onSetNotationPrintSticking]);

  const TriStateRow = ({ label, effectiveValue, hasOverride, onChange }) => (
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="text-[11px] text-neutral-400">{label}</span>
      <div className="flex items-stretch overflow-hidden rounded border border-neutral-700 bg-neutral-800">
        <button
          type="button"
          onClick={() => onChange?.(true)}
          className={`px-2 py-1 text-[11px] ${hasOverride && effectiveValue === true ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-700/60"}`}
        >
          On
        </button>
        <button
          type="button"
          onClick={() => onChange?.(false)}
          className={`border-l border-r border-neutral-700 px-2 py-1 text-[11px] ${hasOverride && effectiveValue === false ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-700/60"}`}
        >
          Off
        </button>
        <button
          type="button"
          onClick={() => onChange?.(null)}
          className={`px-2 py-1 text-[11px] ${!hasOverride ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-700/60"}`}
        >
          Global
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-[140] w-56 rounded border border-neutral-700 bg-neutral-900 p-2 shadow-2xl"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onToggleNotationBeatName?.()}
        className={`w-full rounded border px-2 py-1 text-left text-xs ${
          row?.showNotationBeatName
            ? "border-neutral-700 text-white bg-neutral-800"
            : "border-neutral-800 text-neutral-400 bg-neutral-900"
        }`}
        title="Show beat name above this section in the sheet"
      >
        Show beat name
      </button>
      <button
        type="button"
        onClick={() => onSetNotationDynamicSpacing?.(!effectiveDynamicSpacing)}
        className={`mt-2 w-full rounded border px-2 py-1 text-left text-xs ${
          effectiveDynamicSpacing
            ? "border-neutral-700 text-white bg-neutral-800"
            : "border-neutral-800 text-neutral-400 bg-neutral-900"
        }`}
        title="Allow this section to use content-based bar widths in the sheet"
      >
        Dynamic spacing
      </button>
      <div className="mt-2 flex items-start justify-between gap-2">
        <span className="text-[11px] text-neutral-400">Spacing</span>
        <div className="flex items-stretch overflow-hidden rounded border border-neutral-700 bg-neutral-800">
          <button
            type="button"
            onClick={() =>
              onSetNotationSpacingPreset?.(
                spacingPresets[Math.min(spacingPresets.length - 1, effectiveSpacingPresetIndex + 1)]
              )
            }
            className="px-2 text-xs text-neutral-300 hover:bg-neutral-700/60"
            aria-label="Tighter spacing preset"
          >
            -
          </button>
          <div className="min-w-[78px] border-l border-r border-neutral-700 px-2 py-1 text-center text-[11px] text-white">
            {spacingPresetLabels[effectiveSpacingPreset]}
          </div>
          <button
            type="button"
            onClick={() =>
              onSetNotationSpacingPreset?.(
                spacingPresets[Math.max(0, effectiveSpacingPresetIndex - 1)]
              )
            }
            className="px-2 text-xs text-neutral-300 hover:bg-neutral-700/60"
            aria-label="Looser spacing preset"
          >
            +
          </button>
        </div>
      </div>
      <TriStateRow
        label="Merge rests"
        effectiveValue={effectiveMergeRests}
        hasOverride={row?.notationMergeRestsCustom === true}
        onChange={onSetNotationMergeRests}
      />
      <TriStateRow
        label="Merge notes"
        effectiveValue={effectiveMergeNotes}
        hasOverride={row?.notationMergeNotesCustom === true}
        onChange={onSetNotationMergeNotes}
      />
      <TriStateRow
        label="Dotted notes"
        effectiveValue={effectiveDottedNotes}
        hasOverride={row?.notationDottedNotesCustom === true}
        onChange={onSetNotationDottedNotes}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-neutral-400">Print sticking</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-stretch overflow-hidden rounded border border-neutral-700 bg-neutral-800">
            <button
              type="button"
              onClick={() => cyclePrintStickingMode(-1)}
              className="px-2 py-1 text-sm leading-none text-neutral-400 hover:bg-neutral-700/60"
              title="Previous print sticking mode"
              aria-label="Previous print sticking mode"
            >
              -
            </button>
            <div className="min-w-[60px] border-l border-r border-neutral-700 px-2 py-1 text-center text-[11px] text-white">
              {effectivePrintStickingMode === "all"
                ? "All"
                : effectivePrintStickingMode === "custom"
                  ? "Some"
                  : "None"}
            </div>
            <button
              type="button"
              onClick={() => cyclePrintStickingMode(1)}
              className="px-2 py-1 text-sm leading-none text-neutral-400 hover:bg-neutral-700/60"
              title="Next print sticking mode"
              aria-label="Next print sticking mode"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onSetNotationPrintSticking?.(null)}
            className={`rounded border px-1.5 py-1 text-[10px] ${
              row?.notationPrintStickingCustom === true || row?.notationPrintStickingFollowBeat === true
                ? "border-neutral-700 text-neutral-300 bg-neutral-800 hover:bg-neutral-700/60"
                : "border-neutral-800 text-neutral-600 bg-neutral-900/60"
            }`}
            title="Use global print sticking"
          >
            G
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSetNotationDynamicSpacing?.(null)}
        disabled={!hasExplicitDynamicSpacingOverride}
        className={`mt-2 rounded border px-2 py-1 text-[11px] ${
          !hasExplicitDynamicSpacingOverride
            ? "border-neutral-800 text-neutral-600 bg-neutral-900/60 cursor-not-allowed"
            : "border-neutral-700 text-neutral-300 bg-neutral-800 hover:bg-neutral-700/60"
        }`}
        title="Use global dynamic spacing"
      >
        Use global
      </button>
      <label className="mt-2 flex flex-col gap-1 text-[11px] text-neutral-400">
        <span>Custom text</span>
        <input
          type="text"
          value={customTextDraft}
          onChange={(e) => setCustomTextDraft(e.target.value)}
          onBlur={commitCustomText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitCustomText();
              onClose?.();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setCustomTextDraft(String(row?.notationCustomText || ""));
              onClose?.();
            }
          }}
          placeholder="Custom notation label"
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white"
        />
      </label>
      <div className="mt-2 flex items-start justify-between gap-2">
        <span className={`text-[11px] ${barsPerRowControlDisabled ? "text-neutral-500" : "text-neutral-400"}`}>
          Bars/row
        </span>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-stretch overflow-hidden rounded border border-neutral-700 bg-neutral-800">
            <button
              type="button"
              disabled={barsPerRowControlDisabled}
              onClick={() =>
                onSetNotationBarsPerRowOverride?.(
                  effectiveBarsPerRowIndex > 0 ? allowedBarsPerRow[effectiveBarsPerRowIndex - 1] : null
                )
              }
              className={`px-2 text-xs ${
                barsPerRowControlDisabled
                  ? "text-neutral-600 cursor-not-allowed"
                  : "text-neutral-300 hover:bg-neutral-700/60"
              }`}
              aria-label="Decrease bars per row"
            >
              -
            </button>
            <button
              type="button"
              disabled={barsPerRowControlDisabled}
              className={`min-w-[48px] border-l border-r border-neutral-700 px-2 py-1 text-center text-xs ${
                barsPerRowControlDisabled
                  ? "text-neutral-600"
                  : hasExplicitBarsPerRowOverride
                    ? "text-white"
                    : "text-neutral-500"
              }`}
              title={hasExplicitBarsPerRowOverride ? "Custom bars per row" : "Using global value"}
            >
              {effectiveBarsPerRow}
            </button>
            <button
              type="button"
              disabled={barsPerRowControlDisabled}
              onClick={() =>
                onSetNotationBarsPerRowOverride?.(
                  effectiveBarsPerRowIndex < allowedBarsPerRow.length - 1
                    ? allowedBarsPerRow[effectiveBarsPerRowIndex + 1]
                    : null
                )
              }
              className={`px-2 text-xs ${
                barsPerRowControlDisabled
                  ? "text-neutral-600 cursor-not-allowed"
                  : "text-neutral-300 hover:bg-neutral-700/60"
              }`}
              aria-label="Increase bars per row"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onSetNotationBarsPerRowOverride?.(null)}
            disabled={barsPerRowControlDisabled || !hasExplicitBarsPerRowOverride}
            className={`rounded border px-2 py-1 text-[11px] ${
              barsPerRowControlDisabled || !hasExplicitBarsPerRowOverride
                ? "border-neutral-800 text-neutral-600 bg-neutral-900/60 cursor-not-allowed"
                : "border-neutral-700 text-neutral-300 bg-neutral-800 hover:bg-neutral-700/60"
            }`}
            title="Use global bars per row"
          >
            Use global
          </button>
        </div>
      </div>
    </div>
  );
}
