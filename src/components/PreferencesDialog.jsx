import React from "react";

const PREFERENCE_CATEGORIES = [
  { id: "defaults", label: "Defaults" },
  { id: "timing", label: "Drum Grid" },
  { id: "editor", label: "Editing" },
  { id: "appearance", label: "Appearance" },
];

function ToggleButton({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-none select-none px-3 py-[5px] rounded border text-sm ${
        active
          ? "bg-neutral-800 border-neutral-700 text-white"
          : "bg-neutral-900 border-neutral-800 text-neutral-600"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

export default function PreferencesDialog({
  isOpen,
  category,
  onCategoryChange,
  onClose,
  defaultLoopRepeats,
  loopRepeatsOrder,
  lastNonAllLoopRepeatsRef,
  onDefaultLoopRepeatsChange,
  onLoopRepeatsChange,
  defaultMetronomeVolume,
  onDefaultMetronomeVolumeChange,
  onMetronomeVolumeChange,
  settingsSidebarDefaultOpen,
  onSettingsSidebarDefaultOpenChange,
  onSettingsSidebarCollapsedChange,
  customStartupGridSettings,
  onSaveCurrentStartupGridSettings,
  onResetStartupGridSettings,
  isShortcutsDialogOpen,
  onShortcutsDialogOpenChange,
  gridSelectionHoldDelayMs,
  onGridSelectionHoldDelayMsChange,
  playabilityWarningsEnabled,
  onPlayabilityWarningsEnabledChange,
  loopRespectPlayability,
  onLoopRespectPlayabilityChange,
  stickingHandedness,
  onStickingHandednessChange,
  stickingLeadHand,
  onStickingLeadHandChange,
  stickingKeepQuarterLeadHand,
  onStickingKeepQuarterLeadHandChange,
  showEditedSticking,
  onShowEditedStickingChange,
  onClearStickingOverrides,
  wrapSelectionMoveEnabled,
  onWrapSelectionMoveEnabledChange,
  moveOverlapMode,
  moveOverlapModes,
  onMoveOverlapModeChange,
  getOverlapModeDescription,
  moveOverrideBehavior,
  onMoveOverrideBehaviorChange,
  bars,
  barsPerLine,
  onBarsPerLineChange,
  gridBarsPerLine,
  onGridBarsPerLineChange,
  layout,
  onLayoutChange,
  gridNotationGap,
  onGridNotationGapChange,
  notationGridGapOffset,
  onNotationGridGapOffsetChange,
  tupletGridAppearanceByValue,
  defaultTupletGridAppearanceByValue,
  openTupletAppearanceEditor,
  onOpenTupletAppearanceEditorChange,
  onTupletGridAppearanceByValueChange,
  formatTupletHslColor,
  hslToHex,
  hexToHsl,
  darkenCountRowNonQuarters,
  onDarkenCountRowNonQuartersChange,
  shortcuts,
  editingShortcutActionId,
  onEditingShortcutActionIdChange,
  onShortcutBindingsChange,
  getShortcutBinding,
  displayShortcutBinding,
}) {
  if (!isOpen) return null;

  const closeShortcuts = () => {
    onShortcutsDialogOpenChange?.(false);
    onEditingShortcutActionIdChange?.(null);
  };

  return (
    <div
      className="fixed inset-0 z-[92] bg-black/60 p-4 flex items-center justify-center"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Preferences</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800/60"
            title="Close preferences"
            aria-label="Close preferences"
          >
            ×
          </button>
        </div>
        <div className="mt-4 grid min-h-[24rem] grid-cols-[8.5rem_minmax(0,1fr)] gap-0 rounded border border-neutral-700 overflow-hidden">
          <aside className="bg-neutral-950/40">
            <div className="flex flex-col">
              {PREFERENCE_CATEGORIES.map((cat) => (
                <button
                  key={`pref-cat-${cat.id}`}
                  type="button"
                  onClick={() => onCategoryChange?.(cat.id)}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    category === cat.id
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-300 hover:bg-neutral-800/50"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </aside>
          <section className="h-full bg-neutral-900 p-3">
            {category === "defaults" ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-normal text-neutral-200">Default settings</div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-neutral-300">Loop repeat</span>
                  <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                    <button
                      type="button"
                      onClick={() => {
                        onDefaultLoopRepeatsChange?.((prev) => {
                          const index = Math.max(0, loopRepeatsOrder.indexOf(String(prev)));
                          const next = loopRepeatsOrder[(index - 1 + loopRepeatsOrder.length) % loopRepeatsOrder.length];
                          onLoopRepeatsChange?.(next);
                          return next;
                        });
                      }}
                      className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      aria-label="Decrease default loop repeat"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDefaultLoopRepeatsChange?.((prev) => {
                          const next = prev === "all" ? (lastNonAllLoopRepeatsRef.current || "1") : "all";
                          onLoopRepeatsChange?.(next);
                          return next;
                        })
                      }
                      className="min-w-[56px] border-l border-r border-neutral-700 px-3 py-1 text-center text-sm text-white hover:bg-neutral-700/30"
                      title="Toggle default loop repeat between all and the last numeric value"
                    >
                      {defaultLoopRepeats}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDefaultLoopRepeatsChange?.((prev) => {
                          const index = Math.max(0, loopRepeatsOrder.indexOf(String(prev)));
                          const next = loopRepeatsOrder[(index + 1) % loopRepeatsOrder.length];
                          onLoopRepeatsChange?.(next);
                          return next;
                        });
                      }}
                      className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      aria-label="Increase default loop repeat"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="my-3 border-t border-neutral-800" />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-neutral-300">Metronome volume</span>
                  <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                    <button
                      type="button"
                      onClick={() => {
                        onDefaultMetronomeVolumeChange?.((prev) => {
                          const next = Math.max(0, Math.min(1, Math.round((prev - 0.05) * 100) / 100));
                          onMetronomeVolumeChange?.(next);
                          return next;
                        });
                      }}
                      className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      aria-label="Decrease default metronome volume"
                    >
                      −
                    </button>
                    <div className="min-w-[72px] border-l border-r border-neutral-700 px-3 py-1 text-center text-sm text-white">
                      {`${Math.round(defaultMetronomeVolume * 100)}%`}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onDefaultMetronomeVolumeChange?.((prev) => {
                          const next = Math.max(0, Math.min(1, Math.round((prev + 0.05) * 100) / 100));
                          onMetronomeVolumeChange?.(next);
                          return next;
                        });
                      }}
                      className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      aria-label="Increase default metronome volume"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="my-3 border-t border-neutral-800" />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-neutral-300">Settings sidebar</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSettingsSidebarDefaultOpenChange?.((prev) => {
                        const next = !prev;
                        onSettingsSidebarCollapsedChange?.(!next);
                        return next;
                      });
                    }}
                    className="px-3 py-1 rounded border border-neutral-700 text-sm text-white bg-neutral-800 hover:bg-neutral-700/60"
                    title="Choose whether the desktop settings sidebar starts open by default"
                  >
                    {settingsSidebarDefaultOpen ? "Open" : "Closed"}
                  </button>
                </div>
                <div className="my-3 border-t border-neutral-800" />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-neutral-300">Startup grid</span>
                  <button
                    type="button"
                    onClick={onSaveCurrentStartupGridSettings}
                    className="px-3 py-1 rounded border border-neutral-700 text-sm text-white bg-neutral-800 hover:bg-neutral-700/60"
                    title="Save the current grid setup as the startup default"
                  >
                    Save current
                  </button>
                  <button
                    type="button"
                    onClick={onResetStartupGridSettings}
                    disabled={!customStartupGridSettings}
                    className={`px-3 py-1 rounded border text-sm ${
                      customStartupGridSettings
                        ? "border-neutral-700 text-neutral-300 hover:bg-neutral-800/60"
                        : "border-neutral-800 text-neutral-600 cursor-default"
                    }`}
                    title="Reset startup grid to the built-in default"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {customStartupGridSettings ? "Custom startup grid active." : "Using built-in startup grid."}
                </div>
                <div className="my-3 border-t border-neutral-800" />
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-neutral-300">Keyboard shortcuts</span>
                  <button
                    type="button"
                    onClick={() => onShortcutsDialogOpenChange?.(true)}
                    className="px-3 py-1 rounded border border-neutral-700 text-sm text-white bg-neutral-800 hover:bg-neutral-700/60"
                  >
                    Open
                  </button>
                </div>
              </>
            ) : category === "timing" ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-normal text-neutral-200">Selection</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-neutral-300">Selection hold</span>
                  <div className="flex min-w-[180px] items-center gap-2 px-0 py-0">
                    <input
                      type="range"
                      min={300}
                      max={800}
                      step={10}
                      value={gridSelectionHoldDelayMs}
                      onChange={(e) =>
                        onGridSelectionHoldDelayMsChange?.(
                          Math.max(300, Math.min(800, Math.round(Number(e.target.value) || 300)))
                        )
                      }
                      className="w-28 accent-neutral-700 opacity-80"
                      style={{ accentColor: "#3f3f46" }}
                    />
                    <span className="min-w-[48px] text-right text-xs text-neutral-500 tabular-nums">
                      {`${gridSelectionHoldDelayMs}ms`}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  Controls how long you need to hold before grid selection mode arms. Range: 300ms to 800ms.
                </div>
                <div className="my-3 border-t border-neutral-800" />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-normal text-neutral-200">Playability</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ToggleButton active={playabilityWarningsEnabled} onClick={() => onPlayabilityWarningsEnabledChange?.((v) => !v)} title="Warn when more than two hand hits occur at the same time">
                    Playability warnings
                  </ToggleButton>
                  <ToggleButton active={loopRespectPlayability} onClick={() => onLoopRespectPlayabilityChange?.((v) => !v)} title="Skip looped hand hits where they would create an unplayable overlap">
                    Loop respect playability
                  </ToggleButton>
                </div>
                <div className="my-3 border-t border-neutral-800" />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-normal text-neutral-200">Sticking Mode</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                    <button
                      type="button"
                      onClick={() => onStickingHandednessChange?.((v) => (v === "right" ? "left" : "right"))}
                      className="min-w-[96px] px-3 py-1 text-sm text-neutral-100 hover:bg-neutral-700/60"
                      title="Switch handedness model"
                    >
                      {stickingHandedness === "right" ? "Right-handed" : "Left-handed"}
                    </button>
                  </div>
                  <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                    <button
                      type="button"
                      onClick={() => onStickingLeadHandChange?.((v) => (v === "right" ? "left" : "right"))}
                      className="min-w-[84px] px-3 py-1 text-sm text-neutral-100 hover:bg-neutral-700/60"
                      title="Switch lead hand used for tie-breaks"
                    >
                      Lead: {stickingLeadHand.toUpperCase()}
                    </button>
                  </div>
                  <ToggleButton active={stickingKeepQuarterLeadHand} onClick={() => onStickingKeepQuarterLeadHandChange?.((v) => !v)} title="When enabled, quarter-note spacing keeps lead-hand behavior">
                    Keep quarter lead hand
                  </ToggleButton>
                  <ToggleButton active={showEditedSticking} onClick={() => onShowEditedStickingChange?.((v) => !v)} title="Show manual sticking edits highlighted in yellow">
                    Show edits
                  </ToggleButton>
                  <button
                    type="button"
                    onClick={onClearStickingOverrides}
                    className="px-2 py-1 rounded border border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800/60"
                    title="Clear all manual sticking edits"
                  >
                    Clear edits
                  </button>
                </div>
              </>
            ) : category === "editor" ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-normal text-neutral-200">Move Mode</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-300">Move overlap</span>
                    <div className="flex w-fit max-w-full items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                      <button
                        type="button"
                        onClick={() =>
                          onMoveOverlapModeChange?.((prev) => {
                            const modes = Array.isArray(moveOverlapModes) ? moveOverlapModes : [];
                            const idx = Math.max(0, modes.findIndex((m) => m.id === prev));
                            return modes.length ? modes[(idx - 1 + modes.length) % modes.length].id : prev;
                          })
                        }
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMoveOverlapModeChange?.((prev) => (prev === "all-to-all" ? "active-to-empty" : "all-to-all"))
                        }
                        className="min-w-[126px] border-l border-r border-neutral-700 px-3 py-1 text-sm text-white hover:bg-neutral-700/50"
                        title={getOverlapModeDescription?.(moveOverlapMode)}
                      >
                        {(Array.isArray(moveOverlapModes) ? moveOverlapModes : []).find((m) => m.id === moveOverlapMode)?.label || "All overrides all"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMoveOverlapModeChange?.((prev) => {
                            const modes = Array.isArray(moveOverlapModes) ? moveOverlapModes : [];
                            const idx = Math.max(0, modes.findIndex((m) => m.id === prev));
                            return modes.length ? modes[(idx + 1) % modes.length].id : prev;
                          })
                        }
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <ToggleButton active={wrapSelectionMoveEnabled} onClick={() => onWrapSelectionMoveEnabledChange?.((v) => !v)} title="When moving selection with arrows, wrap around at grid edges">
                    Wrap edges
                  </ToggleButton>
                  <ToggleButton active={moveOverrideBehavior === "permanent"} onClick={() => onMoveOverrideBehaviorChange?.((prev) => (prev === "permanent" ? "temporary" : "permanent"))} title="When on: overlaps become permanent changes">
                    Permanent
                  </ToggleButton>
                </div>
              </>
            ) : category === "library" ? (
              <></>
            ) : category === "appearance" ? (
              <AppearancePreferences
                bars={bars}
                barsPerLine={barsPerLine}
                onBarsPerLineChange={onBarsPerLineChange}
                gridBarsPerLine={gridBarsPerLine}
                onGridBarsPerLineChange={onGridBarsPerLineChange}
                layout={layout}
                onLayoutChange={onLayoutChange}
                gridNotationGap={gridNotationGap}
                onGridNotationGapChange={onGridNotationGapChange}
                notationGridGapOffset={notationGridGapOffset}
                onNotationGridGapOffsetChange={onNotationGridGapOffsetChange}
                tupletGridAppearanceByValue={tupletGridAppearanceByValue}
                defaultTupletGridAppearanceByValue={defaultTupletGridAppearanceByValue}
                openTupletAppearanceEditor={openTupletAppearanceEditor}
                onOpenTupletAppearanceEditorChange={onOpenTupletAppearanceEditorChange}
                onTupletGridAppearanceByValueChange={onTupletGridAppearanceByValueChange}
                formatTupletHslColor={formatTupletHslColor}
                hslToHex={hslToHex}
                hexToHsl={hexToHsl}
                darkenCountRowNonQuarters={darkenCountRowNonQuarters}
                onDarkenCountRowNonQuartersChange={onDarkenCountRowNonQuartersChange}
              />
            ) : (
              <>
                <div className="text-sm text-neutral-200">Coming soon</div>
                <div className="mt-1 text-xs text-neutral-500">
                  This category will contain additional preferences.
                </div>
                <div className="mt-3 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
                  No settings yet.
                </div>
              </>
            )}
          </section>
        </div>
        {isShortcutsDialogOpen && (
          <ShortcutsDialog
            shortcuts={shortcuts}
            editingShortcutActionId={editingShortcutActionId}
            onEditingShortcutActionIdChange={onEditingShortcutActionIdChange}
            onShortcutBindingsChange={onShortcutBindingsChange}
            getShortcutBinding={getShortcutBinding}
            displayShortcutBinding={displayShortcutBinding}
            onClose={closeShortcuts}
          />
        )}
      </div>
    </div>
  );
}

function AppearancePreferences({
  bars,
  barsPerLine,
  onBarsPerLineChange,
  gridBarsPerLine,
  onGridBarsPerLineChange,
  layout,
  onLayoutChange,
  gridNotationGap,
  onGridNotationGapChange,
  notationGridGapOffset,
  onNotationGridGapOffsetChange,
  tupletGridAppearanceByValue,
  defaultTupletGridAppearanceByValue,
  openTupletAppearanceEditor,
  onOpenTupletAppearanceEditorChange,
  onTupletGridAppearanceByValueChange,
  formatTupletHslColor,
  hslToHex,
  hexToHsl,
  darkenCountRowNonQuarters,
  onDarkenCountRowNonQuartersChange,
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-normal text-neutral-200">Layout</div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <NumberStepper label="Bars/line" value={barsPerLine} onDecrease={() => onBarsPerLineChange?.((v) => Math.max(1, v - 1))} onIncrease={() => onBarsPerLineChange?.((v) => Math.min(bars, v + 1))} />
        <NumberStepper label="Grid bars/line" value={gridBarsPerLine} onDecrease={() => onGridBarsPerLineChange?.((v) => Math.max(1, v - 1))} onIncrease={() => onGridBarsPerLineChange?.((v) => Math.min(bars, v + 1))} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-300 whitespace-nowrap">Layout</span>
          <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
            {["grid-top", "notation-top"].map((layoutOption, index) => (
              <button
                key={layoutOption}
                type="button"
                onClick={() => onLayoutChange?.(layoutOption)}
                className={`${index > 0 ? "border-l border-neutral-700 " : ""}px-3 py-1 text-sm whitespace-nowrap ${
                  layout === layoutOption
                    ? "bg-neutral-700 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700/60 hover:text-neutral-200"
                }`}
              >
                {layoutOption === "grid-top" ? "Grid top" : "Notation top"}
              </button>
            ))}
          </div>
        </div>
        {layout === "grid-top" ? (
          <RangeSetting label="Offset" min="0" max="80" value={gridNotationGap} onChange={onGridNotationGapChange} />
        ) : null}
        {layout === "notation-top" ? (
          <RangeSetting label="Offset" min="-40" max="50" value={notationGridGapOffset} onChange={onNotationGridGapOffsetChange} />
        ) : null}
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <div className="text-sm font-normal text-neutral-200">Tuplet cells</div>
      </div>
      <div className="mt-2">
        <div className="flex flex-wrap gap-2">
          {[3, 5, 6, 7, 9].map((tupletValue) => {
            const appearance = tupletGridAppearanceByValue?.[tupletValue] || defaultTupletGridAppearanceByValue[tupletValue];
            const isOpen = openTupletAppearanceEditor === tupletValue;
            return (
              <button
                key={`tuplet-opacity-${tupletValue}`}
                type="button"
                onClick={() => onOpenTupletAppearanceEditorChange?.((prev) => (prev === tupletValue ? null : tupletValue))}
                className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 text-sm transition ${
                  isOpen
                    ? "border-neutral-600 bg-neutral-800 text-neutral-100"
                    : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-sm border border-neutral-800"
                  style={{ backgroundColor: formatTupletHslColor(appearance, 1) }}
                  aria-hidden="true"
                />
                <span>{tupletValue}</span>
              </button>
            );
          })}
        </div>
        {openTupletAppearanceEditor != null ? (
          <TupletAppearanceEditor
            tupletValue={openTupletAppearanceEditor}
            appearance={tupletGridAppearanceByValue?.[openTupletAppearanceEditor] || defaultTupletGridAppearanceByValue[openTupletAppearanceEditor]}
            defaultAppearance={defaultTupletGridAppearanceByValue[openTupletAppearanceEditor]}
            onClose={() => onOpenTupletAppearanceEditorChange?.(null)}
            onChange={onTupletGridAppearanceByValueChange}
            formatTupletHslColor={formatTupletHslColor}
            hslToHex={hslToHex}
            hexToHsl={hexToHsl}
          />
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-300">Emphasize quarter counts</span>
        <button
          type="button"
          onClick={() => onDarkenCountRowNonQuartersChange?.((v) => !v)}
          className={`w-fit whitespace-nowrap touch-none select-none px-3 py-[5px] rounded border text-sm ${
            darkenCountRowNonQuarters
              ? "bg-neutral-800 border-neutral-700 text-white"
              : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
          }`}
          title="Make the quarter counts stand out more than the subdivision labels"
        >
          {darkenCountRowNonQuarters ? "On" : "Off"}
        </button>
      </div>
    </>
  );
}

function NumberStepper({ label, value, onDecrease, onIncrease }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-300 whitespace-nowrap">{label}</span>
      <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
        <button type="button" onClick={onDecrease} className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700">
          −
        </button>
        <div className="min-w-[44px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-800 border-l border-r border-neutral-700">
          {value}
        </div>
        <button type="button" onClick={onIncrease} className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700">
          +
        </button>
      </div>
    </div>
  );
}

function RangeSetting({ label, min, max, value, onChange }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="shrink-0 text-sm text-neutral-300 whitespace-nowrap">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="min-w-[7rem] flex-1"
      />
      <span className="shrink-0 w-10 text-right text-xs text-neutral-400 tabular-nums">{value}</span>
    </div>
  );
}

function TupletAppearanceEditor({
  tupletValue,
  appearance,
  defaultAppearance,
  onClose,
  onChange,
  formatTupletHslColor,
  hslToHex,
  hexToHsl,
}) {
  const opacity = Math.max(0, Math.min(100, Math.round(Number(appearance?.opacity) || 0)));
  const hexValue = hslToHex(appearance?.h, appearance?.s, appearance?.l);

  const updateAppearance = (patch) => {
    onChange?.((prev) => ({
      ...prev,
      [tupletValue]: {
        ...(prev?.[tupletValue] || defaultAppearance),
        ...patch,
      },
    }));
  };

  return (
    <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-900/95 px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 rounded-sm border border-neutral-800"
            style={{ backgroundColor: formatTupletHslColor(appearance, 1) }}
            aria-hidden="true"
          />
          <span className="text-sm text-neutral-200">Tuplet {tupletValue}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
        >
          Close
        </button>
      </div>
      <div className="mb-3 flex items-center gap-3">
        <span className="w-4 text-xs text-neutral-500">#</span>
        <input
          type="text"
          inputMode="text"
          spellCheck={false}
          value={hexValue}
          onChange={(e) => {
            const parsed = hexToHsl(e.target.value);
            if (!parsed) return;
            updateAppearance({ h: parsed.h, s: parsed.s, l: parsed.l });
          }}
          className="min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-200 outline-none transition focus:border-neutral-700"
        />
        <button
          type="button"
          onClick={() =>
            updateAppearance({
              h: defaultAppearance?.h ?? appearance?.h ?? 0,
              s: defaultAppearance?.s ?? appearance?.s ?? 0,
              l: defaultAppearance?.l ?? appearance?.l ?? 0,
            })
          }
          className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
          title="Reset hex color to default"
        >
          Reset
        </button>
      </div>
      <div className="grid gap-2">
        {[
          { key: "h", label: "H", min: 0, max: 360, value: appearance?.h ?? 0 },
          { key: "s", label: "S", min: 0, max: 100, value: appearance?.s ?? 0 },
          { key: "l", label: "L", min: 0, max: 100, value: appearance?.l ?? 0 },
          { key: "opacity", label: "A", min: 0, max: 100, value: opacity },
        ].map((slider) => (
          <div key={slider.key} className="flex items-center gap-3">
            <span className="w-4 text-xs text-neutral-500">{slider.label}</span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step="1"
              value={slider.value}
              onDoubleClick={() =>
                updateAppearance({
                  [slider.key]: defaultAppearance?.[slider.key] ?? slider.value,
                })
              }
              onChange={(e) => updateAppearance({ [slider.key]: Number(e.target.value) })}
              className="flex-1 accent-neutral-700 opacity-80"
              title="Double-click to reset to default"
            />
            <span className="w-10 text-right text-xs text-neutral-400">{slider.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortcutsDialog({
  shortcuts,
  editingShortcutActionId,
  onEditingShortcutActionIdChange,
  onShortcutBindingsChange,
  getShortcutBinding,
  displayShortcutBinding,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-[93] bg-black/40 p-4 flex items-center justify-center"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-neutral-700 bg-neutral-900 p-4 md:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold">Keyboard shortcuts</h4>
            <div className="mt-1 text-xs text-neutral-500">
              Click a keystroke to record a custom binding. Press Escape while recording to cancel.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onShortcutBindingsChange?.({});
                onEditingShortcutActionIdChange?.(null);
              }}
              className="px-2 py-1 rounded border border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800/60"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 rounded border border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800/60"
            >
              Close
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded border border-neutral-800">
          <div className="grid grid-cols-[minmax(0,1.15fr)_180px_minmax(0,1.35fr)_72px] gap-0 border-b border-neutral-800 bg-neutral-950/40 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-500">
            <div>Command</div>
            <div>Keystroke</div>
            <div>Description</div>
            <div />
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {shortcuts.map((entry) => {
              const currentBinding = getShortcutBinding(entry.id);
              const isEditing = editingShortcutActionId === entry.id;
              return (
                <div
                  key={`shortcut-row-${entry.id}`}
                  className="grid grid-cols-[minmax(0,1.15fr)_180px_minmax(0,1.35fr)_72px] gap-0 border-b border-neutral-800 px-3 py-2 text-sm last:border-b-0"
                >
                  <div className="pr-3 text-neutral-100">{entry.command}</div>
                  <div className="pr-3">
                    <button
                      type="button"
                      onClick={() =>
                        onEditingShortcutActionIdChange?.((prev) =>
                          prev === entry.id ? null : entry.id
                        )
                      }
                      className={`w-full rounded border px-2 py-1 text-left text-xs ${
                        isEditing
                          ? "border-sky-500/70 bg-sky-900/20 text-sky-100"
                          : "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700/60"
                      }`}
                    >
                      {isEditing ? "Press keys..." : displayShortcutBinding(currentBinding)}
                    </button>
                  </div>
                  <div className="pr-3 text-neutral-400">{entry.description}</div>
                  <div className="flex items-start justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        onShortcutBindingsChange?.((prev) => {
                          const next = { ...(prev || {}) };
                          delete next[entry.id];
                          return next;
                        })
                      }
                      className="rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800/60"
                      title="Reset to default"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
