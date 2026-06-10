import React, { useEffect, useRef, useState } from "react";

const CELL = {
  OFF: "off",
  ON: "on",
  GHOST: "ghost",
  ACCENT: "accent",
};

const CELL_COLOR = {
  [CELL.OFF]: "bg-neutral-800",
  [CELL.ON]: "bg-[#00b3ba]",
  [CELL.GHOST]: "bg-[#00b3ba]/35",
  [CELL.ACCENT]: "bg-[#00b3ba]",
};
const GHOST_ENABLED = new Set(["snare", "tom1", "tom2", "floorTom", "hihat"]);
const FOOT_INSTRUMENTS = new Set(["kick", "hihatFoot"]);
const QUARTER_SUBDIVISION_CYCLE = [2, 3, 4, 5, 6, 7, 8, 9];
const QUARTER_SUBDIVISION_LABELS = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
};
const DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE = {
  3: { h: 22, s: 78, l: 26, opacity: 20 },
  5: { h: 245, s: 58, l: 51, opacity: 20 },
  6: { h: 26, s: 90, l: 37, opacity: 20 },
  7: { h: 163, s: 94, l: 24, opacity: 20 },
  9: { h: 295, s: 72, l: 40, opacity: 20 },
};

function readGridSelectionHoldDelayMs() {
  try {
    const raw = String(window.localStorage.getItem("drum-grid-selection-hold-speed-v1") || "").toLowerCase();
    if (raw === "fast") return 300;
    if (raw === "slow") return 500;
    const value = Number(raw);
    if (!Number.isFinite(value)) return 300;
    return Math.max(300, Math.min(800, Math.round(value)));
  } catch (_) {
    return 300;
  }
}

function getQuarterBeatsPerBar(ts) {
  return Math.max(1, Number(ts?.n) || 4);
}

function getBaseSubdivPerQuarter(resolution, ts = { d: 4 }) {
  const beatValue = Math.max(1, Number(ts?.d) || 4);
  return Math.max(1, Math.round(resolution / beatValue));
}

function buildStepMeta(quarterSubdivisions) {
  const quarterCount = Math.max(1, quarterSubdivisions.length);
  const meta = [];
  quarterSubdivisions.forEach((subdiv, q) => {
    const s = Math.max(1, Number(subdiv) || 1);
    for (let sub = 0; sub < s; sub++) {
      const startNorm = (q + sub / s) / quarterCount;
      const centerNorm = (q + (sub + 0.5) / s) / quarterCount;
      meta.push({ quarterIndex: q, subIndex: sub, subdiv: s, startNorm, centerNorm });
    }
  });
  return meta;
}

function isPowerOfTwoSubdivision(count) {
  const normalized = Math.max(1, Math.round(Number(count) || 1));
  return (normalized & (normalized - 1)) === 0;
}

function formatTupletHslColor(appearance, alpha = 1) {
  const h = Math.max(0, Math.min(360, Math.round(Number(appearance?.h) || 0)));
  const s = Math.max(0, Math.min(100, Math.round(Number(appearance?.s) || 0)));
  const l = Math.max(0, Math.min(100, Math.round(Number(appearance?.l) || 0)));
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export default function Grid({
  instruments,
  grid, columns, bars, stepsPerBar, resolution, timeSig, quarterSubdivisionsByBar, normalizedTupletOverridesByBar, barStepOffsets, setTupletAt, resetTupletAt, selectedCountRowSubdivision = 3, onSelectedCountRowSubdivisionChange, gridBarsPerLine,
  cycleVelocity, toggleGhost, selection, setSelection, loopRule,
    loopRepeats,
  setLoopRule, wrappedSelectionCells, playhead, moveSelectionByDelta, playabilityWarningsEnabled, playabilityWarningStepSet, stickingConflictStepSet, stickingGuideEnabled, showEditedSticking, notationStickingSelection, stickingAssignmentsByStep, stickingEditModeEnabled, notationStickingSelectionModeEnabled, stickingOverrides, onCycleStickingOverride, onToggleNotationStickingSelection, onDisableNotationStickingSelectionMode, onDisableStickingEditMode, bakeLoopPreview, hoveredGridCellRef, labelGutterWidth = "calc(8ch + 0.75rem)", tupletGridAppearanceByValue = DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE, darkenCountRowNonQuarters = true
}) {
  const gridContentOffsetStyle = React.useMemo(
    () => ({ transform: "translateX(-0.6rem)" }),
    []
  );
  const notifySelectionFinalized = React.useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("dg-selection-finalized"));
    } catch (_) {}
  }, []);
  const longPress = React.useRef({ timer: null, did: false });
  const mouseDragRef = React.useRef({
    phase: "idle", // idle | pending | selecting
    suppressClickUntil: 0,
    startX: 0,
    startY: 0,
    anchorRow: 0,
    anchorCol: 0,
  });
  const skipNextGlobalMouseUpFinalizeRef = React.useRef(false);
  const skipNextWrappedSelectionClearRef = React.useRef(false);
  const suppressNextCellClickToggleRef = React.useRef(false);
  const stepMoveFromPointerDeltaRef = React.useRef(() => false);
  const countRowPressRef = React.useRef({
    timer: null,
    longPressed: false,
    pointerId: null,
  });
  const countRowPopupRef = React.useRef(null);
  const [countRowPopupState, setCountRowPopupState] = useState(null);
  const maybeClearSingleCellSelectionAfterMove = React.useCallback(() => {
    const shouldClearSingleSelection =
      press.current.mode === "move" ||
      (press.current.mode === "select" && !press.current.didSelect);
    if (!shouldClearSingleSelection) return;
    const selectedCount =
      Array.isArray(wrappedSelectionCells) && wrappedSelectionCells.length > 0
        ? wrappedSelectionCells.length
        : selection
          ? Math.max(
              1,
              (selection.rowEnd - selection.rowStart + 1) *
                Math.max(1, selection.endExclusive - selection.start)
            )
          : 0;
    if (selectedCount === 1) {
      setLoopRule(null);
      setSelection(null);
    }
  }, [selection, wrappedSelectionCells, setLoopRule, setSelection]);

  // Ensure pending long-press timers don't leak across clicks (desktop).
  useEffect(() => {
    const onGlobalMouseUp = () => {
      if (longPress.current.timer) {
        window.clearTimeout(longPress.current.timer);
        longPress.current.timer = null;
      }
      const wasSelecting = mouseDragRef.current.phase === "selecting";
      mouseDragRef.current.phase = "idle";
      if (skipNextGlobalMouseUpFinalizeRef.current) {
        skipNextGlobalMouseUpFinalizeRef.current = false;
        return;
      }
      // If a selection drag was in progress and the user released outside the grid,
      // we still need to end the drag so clicks work again.
      setDrag((d) => {
        if (d || wasSelecting) {
          // finalize selection gesture
          try { notifySelectionFinalized(); } catch (_) {}
          mouseDragRef.current.suppressClickUntil = Date.now() + 220;
          return null;
        }
        return d;
      });
    };
    window.addEventListener("mouseup", onGlobalMouseUp);
    window.addEventListener("blur", onGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", onGlobalMouseUp);
      window.removeEventListener("blur", onGlobalMouseUp);
    };
  }, []);

  // Desktop long-press interactions: ghost / move / selection.
  useEffect(() => {
    const onMove = (e) => {
      if (!press.current.active) return;
      if (press.current.pointerId !== "mouse") return;

      // Only react while the mouse button is still held down.
      if ((e.buttons & 1) !== 1) return;

      // Require a small movement threshold to avoid accidental selection from small cursor drift.
      // For move interactions, use a very small threshold so dragging a selected region feels immediate.
      const dx = e.clientX - press.current.startX;
      const dy = e.clientY - press.current.startY;
      const isMoveInteraction =
        press.current.mode === "moveArmed" || press.current.mode === "move";
      const thresholdSq = isMoveInteraction ? 1 : 36; // ~1px for move, 6px otherwise
      if (dx * dx + dy * dy < thresholdSq) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest?.("[data-gridcell='1']");
      if (!cell) return;

      const r1 = Number(cell.getAttribute("data-row"));
      const c1 = Number(cell.getAttribute("data-col"));
      if (Number.isNaN(r1) || Number.isNaN(c1)) return;

      const r0 = press.current.startRow;
      const c0 = press.current.startCol;
      const isMoveComparison =
        press.current.mode === "moveArmed" || press.current.mode === "move";
      const refRow = isMoveComparison ? press.current.moveLastRow : r0;
      const refCol = isMoveComparison ? press.current.moveLastCol : c0;
      if (r1 === refRow && c1 === refCol) return;

      if (press.current.mode === "ghostArmed") {
        if (longPress.current.timer) {
          window.clearTimeout(longPress.current.timer);
          longPress.current.timer = null;
        }
        longPress.current.did = false;
        if (press.current.startWasSelected || press.current.startVal !== CELL.OFF) {
          if (!press.current.startWasSelected) {
            setSelection({ rowStart: r0, rowEnd: r0, start: c0, endExclusive: c0 + 1 });
          }
          press.current.mode = "move";
          press.current.moveLastRow = r0;
          press.current.moveLastCol = c0;
          const movedNow = stepMoveFromPointerDeltaRef.current?.(r1, c1);
          if (!movedNow) {
            window.requestAnimationFrame(() => {
              if (!press.current.active || press.current.pointerId !== "mouse") return;
              if (press.current.mode !== "move") return;
              stepMoveFromPointerDeltaRef.current?.(r1, c1);
            });
          }
        } else {
          press.current.mode = "selectArmed";
        }
      } else if (press.current.mode === "ghostDone") {
        if (press.current.ghostToggled && press.current.instId) {
          try { toggleGhost(press.current.instId, c0, press.current.startVal); } catch (_) {}
        }
        if (!press.current.startWasSelected) {
          press.current.mode = "select";
          mouseDragRef.current.phase = "selecting";
          mouseDragRef.current.anchorRow = r0;
          mouseDragRef.current.anchorCol = c0;
          mouseDragRef.current.startX = press.current.startX;
          mouseDragRef.current.startY = press.current.startY;
          setDrag({ row: r0, col: c0 });
          setSelection({
            rowStart: Math.min(r0, r1),
            rowEnd: Math.max(r0, r1),
            start: Math.min(c0, c1),
            endExclusive: Math.max(c0, c1) + 1,
          });
        } else {
          if (!press.current.startWasSelected) {
            setSelection({ rowStart: r0, rowEnd: r0, start: c0, endExclusive: c0 + 1 });
          }
          press.current.mode = "move";
          press.current.moveLastRow = r0;
          press.current.moveLastCol = c0;
          stepMoveFromPointerDeltaRef.current?.(r1, c1);
        }
      } else if (press.current.mode === "moveArmed" || press.current.mode === "move") {
        // Modern mode: distinguish quick drag (move) vs long-press drag (selection for looping)
        // for single-cell starts. Existing multi-cell selection dragging still uses move mode.
        const heldMs = Date.now() - (press.current.startTime || 0);
        const holdDelayMs = readGridSelectionHoldDelayMs();
        const shouldLongPressSelect =
          press.current.mode === "moveArmed" &&
          !press.current.startWasSelected &&
          heldMs >= holdDelayMs;
        if (shouldLongPressSelect) {
          press.current.mode = "select";
          mouseDragRef.current.phase = "selecting";
          mouseDragRef.current.anchorRow = r0;
          mouseDragRef.current.anchorCol = c0;
          mouseDragRef.current.startX = press.current.startX;
          mouseDragRef.current.startY = press.current.startY;
          setDrag({ row: r0, col: c0 });
          setSelection({
            rowStart: Math.min(r0, r1),
            rowEnd: Math.max(r0, r1),
            start: Math.min(c0, c1),
            endExclusive: Math.max(c0, c1) + 1,
          });
          return;
        }
        if (press.current.mode === "moveArmed") {
          if (!press.current.startWasSelected) {
            setSelection({ rowStart: r0, rowEnd: r0, start: c0, endExclusive: c0 + 1 });
          }
          press.current.mode = "move";
        }
        const movedNow = stepMoveFromPointerDeltaRef.current?.(r1, c1);
        if (!movedNow) {
          window.requestAnimationFrame(() => {
            if (!press.current.active || press.current.pointerId !== "mouse") return;
            if (press.current.mode !== "move") return;
            stepMoveFromPointerDeltaRef.current?.(r1, c1);
          });
        }
      } else if (press.current.mode === "selectArmed") {
        const heldMs = Date.now() - (press.current.startTime || 0);
        const holdDelayMs = readGridSelectionHoldDelayMs();
        if (heldMs >= holdDelayMs) {
          press.current.mode = "select";
          mouseDragRef.current.phase = "selecting";
          mouseDragRef.current.anchorRow = r0;
          mouseDragRef.current.anchorCol = c0;
          mouseDragRef.current.startX = press.current.startX;
          mouseDragRef.current.startY = press.current.startY;
          setDrag({ row: r0, col: c0 });
          press.current.didSelect = true;
          setSelection({
            rowStart: Math.min(r0, r1),
            rowEnd: Math.max(r0, r1),
            start: Math.min(c0, c1),
            endExclusive: Math.max(c0, c1) + 1,
          });
        }
      } else if (press.current.mode === "select") {
        press.current.didSelect = true;
        setSelection({ rowStart: Math.min(r0, r1), rowEnd: Math.max(r0, r1), start: Math.min(c0, c1), endExclusive: Math.max(c0, c1) + 1 });
      }
    };

    const onUp = () => {
      if (!press.current.active) return;
      if (press.current.pointerId !== "mouse") return;

      if (longPress.current.timer) {
        window.clearTimeout(longPress.current.timer);
        longPress.current.timer = null;
      }

      // If we switched into selection mode while holding, finalize it on release.
      // This handler only runs for the special long-press/ghost path (active ghost-enabled cells).
      if (press.current.mode === "select" || press.current.didSelect) {
        setDrag(null);
        notifySelectionFinalized();
      }
      maybeClearSingleCellSelectionAfterMove();

      press.current.active = false;
      press.current.pointerId = null;
      press.current.mode = "none";
                        press.current.ghostToggled = false;
                        press.current.didSelect = false;
      press.current.didSelect = false;
      press.current.instId = null;
      press.current.ghostToggled = false;
      press.current.didSelect = false;
      press.current.startX = 0;
      press.current.startY = 0;
      press.current.startTime = 0;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [notifySelectionFinalized, maybeClearSingleCellSelectionAfterMove]);
  const press = React.useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    mode: "none", // none | ghostArmed | ghostDone | selectArmed | select | moveArmed | move
    startRow: 0,
    startCol: 0,
    moveLastRow: 0,
    moveLastCol: 0,
    startVal: CELL.OFF,
    startWasSelected: false,
    instId: null,
    ghostToggled: false,
    didSelect: false,
  });
  const [drag, setDrag] = useState(null); // { row, col }
  const stepMetaByBar = React.useMemo(
    () => quarterSubdivisionsByBar.map((subs) => buildStepMeta(subs)),
    [quarterSubdivisionsByBar]
  );
  const quarterOffsetByBar = React.useMemo(() => {
    let runningQuarterCount = 0;
    return quarterSubdivisionsByBar.map((subs) => {
      const currentOffset = runningQuarterCount;
      runningQuarterCount += Array.isArray(subs) && subs.length > 0 ? subs.length : getQuarterBeatsPerBar(timeSig);
      return currentOffset;
    });
  }, [quarterSubdivisionsByBar, timeSig]);
  const gridBaseSubdivPerQuarter = React.useMemo(
    () => getBaseSubdivPerQuarter(resolution, timeSig),
    [resolution, timeSig]
  );

  const labelFor = (stepMeta) => {
    const beat = stepMeta.quarterIndex + 1;
    const sub = stepMeta.subIndex;
    const subdiv = Math.max(1, stepMeta.subdiv || 1);
    if (subdiv === 1) return `${beat}`;
    if (subdiv === 2) return sub === 0 ? `${beat}` : "&";
    if (subdiv === 3) return [String(beat), "tri", "let"][sub] || "·";
    if (subdiv === 4) return [String(beat), "e", "&", "a"][sub] || "·";
    return sub === 0 ? `${beat}` : "·";
  };

  const getQuarterBandClass = React.useCallback(
    (barIdx, stepMeta) => {
      if (!stepMeta) return "";
      const quarterIdx = stepMeta.quarterIndex ?? 0;
      const quarterCellCount = Math.max(1, Number(stepMeta.subdiv) || 1);
      const globalQuarterIdx = (quarterOffsetByBar?.[barIdx] ?? 0) + quarterIdx;
      const tuplet = normalizedTupletOverridesByBar?.[barIdx]?.[quarterIdx] ?? null;
      if (tuplet != null && !isPowerOfTwoSubdivision(tuplet)) {
        const prevTuplet = normalizedTupletOverridesByBar?.[barIdx]?.[quarterIdx - 1] ?? null;
        const nextTuplet = normalizedTupletOverridesByBar?.[barIdx]?.[quarterIdx + 1] ?? null;
        const hasTupletNeighbor =
          (prevTuplet != null && !isPowerOfTwoSubdivision(prevTuplet)) ||
          (nextTuplet != null && !isPowerOfTwoSubdivision(nextTuplet));
        if (hasTupletNeighbor && globalQuarterIdx % 2 === 1) return "is-tuplet-band-dark";
        return "is-tuplet-band";
      }
      if (
        tuplet != null &&
        isPowerOfTwoSubdivision(tuplet) &&
        Math.max(1, Number(tuplet) || 1) !== gridBaseSubdivPerQuarter
      ) {
        return "bg-black/[0.14]";
      }
      if ((resolution === 16 || resolution === 32) && quarterCellCount >= 4 && globalQuarterIdx % 2 === 1) {
        return "bg-black/[0.14]";
      }
      return "";
    },
    [normalizedTupletOverridesByBar, resolution, quarterOffsetByBar, gridBaseSubdivPerQuarter]
  );
  const getTupletQuarterBandStyle = React.useCallback((tupletValue, dark = false) => {
    const appearance =
      tupletGridAppearanceByValue?.[tupletValue] ||
      DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE[String(tupletValue)] ||
      DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE[tupletValue] ||
      DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE[3];
    const opacity = Math.max(0, Math.min(100, Number(appearance?.opacity) || 0)) / 100;
    if (!dark) {
      if (opacity <= 0) return { backgroundColor: "transparent" };
      return {
        backgroundColor: formatTupletHslColor(appearance, opacity),
      };
    }
    const darkBase = "rgba(0, 0, 0, 0.14)";
    if (opacity <= 0) return { backgroundColor: darkBase };
    const darkOpacity = Math.min(1, opacity + opacity * 0.25);
    const darkColor = formatTupletHslColor(appearance, darkOpacity);
    return {
      backgroundImage: [`linear-gradient(${darkBase}, ${darkBase})`, `linear-gradient(${darkColor}, ${darkColor})`].join(
        ", "
      ),
    };
  }, [tupletGridAppearanceByValue]);
  const getCountRowQuarterBandStyle = React.useCallback((quarterBandClass, quarterTupletValue) => {
    if (quarterBandClass === "is-tuplet-band") {
      return getTupletQuarterBandStyle(quarterTupletValue, false);
    }
    if (quarterBandClass === "is-tuplet-band-dark") {
      return getTupletQuarterBandStyle(quarterTupletValue, true);
    }
    if (quarterBandClass === "bg-black/[0.14]") {
      const straightOverride = Math.max(1, Number(quarterTupletValue) || 0);
      if (
        !quarterTupletValue ||
        !isPowerOfTwoSubdivision(straightOverride) ||
        straightOverride === gridBaseSubdivPerQuarter
      ) {
        return undefined;
      }
      return { backgroundColor: "#1f1f1f" };
    }
    return undefined;
  }, [getTupletQuarterBandStyle, gridBaseSubdivPerQuarter]);

  const getQuarterBorderClass = React.useCallback(
    (barIdx, stepMeta) => {
      if (!stepMeta) return "";
      const quarterIdx = stepMeta.quarterIndex ?? 0;
      const quarterCellCount = Math.max(1, Number(stepMeta.subdiv) || 1);
      const globalQuarterIdx = (quarterOffsetByBar?.[barIdx] ?? 0) + quarterIdx;
      const tuplet = normalizedTupletOverridesByBar?.[barIdx]?.[quarterIdx] ?? null;
      if (tuplet != null && !isPowerOfTwoSubdivision(tuplet)) {
        const prevTuplet = normalizedTupletOverridesByBar?.[barIdx]?.[quarterIdx - 1] ?? null;
        const nextTuplet = normalizedTupletOverridesByBar?.[barIdx]?.[quarterIdx + 1] ?? null;
        const hasTupletNeighbor =
          (prevTuplet != null && !isPowerOfTwoSubdivision(prevTuplet)) ||
          (nextTuplet != null && !isPowerOfTwoSubdivision(nextTuplet));
        return hasTupletNeighbor && globalQuarterIdx % 2 === 1 ? "border-[#212121]" : "";
      }
      if (
        tuplet != null &&
        isPowerOfTwoSubdivision(tuplet) &&
        Math.max(1, Number(tuplet) || 1) !== gridBaseSubdivPerQuarter
      ) {
        return "border-[#212121]";
      }
      if ((resolution === 16 || resolution === 32) && quarterCellCount >= 4 && globalQuarterIdx % 2 === 1) {
        return "border-[#212121]";
      }
      return "";
    },
    [normalizedTupletOverridesByBar, resolution, quarterOffsetByBar, gridBaseSubdivPerQuarter]
  );

  const clearCountRowLongPress = React.useCallback(() => {
    if (countRowPressRef.current.timer) {
      window.clearTimeout(countRowPressRef.current.timer);
      countRowPressRef.current.timer = null;
    }
    countRowPressRef.current.pointerId = null;
  }, []);

  const openCountRowSubdivisionPopup = React.useCallback((target, barIdx, quarterIdx) => {
    const rect = target?.getBoundingClientRect?.();
    if (!rect) return;
    const popupWidth = 196;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const left = Math.max(
      8,
      Math.min(viewportWidth - popupWidth - 8, rect.left + rect.width / 2 - popupWidth / 2)
    );
    const estimatedHeight = 170;
    const top = rect.bottom + estimatedHeight + 12 <= viewportHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - estimatedHeight - 8);
    setCountRowPopupState({ left, top, barIdx, quarterIdx });
  }, []);

  const applyCountRowSubdivision = React.useCallback(
    (value, barIdx, quarterIdx) => {
      const nextValue = Number(value);
      if (!Number.isFinite(nextValue)) return;
      onSelectedCountRowSubdivisionChange?.(nextValue);
      setTupletAt?.(barIdx, quarterIdx, nextValue);
      setCountRowPopupState(null);
    },
    [onSelectedCountRowSubdivisionChange, setTupletAt]
  );

  React.useEffect(() => {
    const handleGlobalPointerUp = () => {
      countRowPressRef.current.longPressed = false;
      clearCountRowLongPress();
    };
    const handlePointerDownOutside = (event) => {
      if (!countRowPopupState) return;
      const popupEl = countRowPopupRef.current;
      if (popupEl && popupEl.contains(event.target)) return;
      setCountRowPopupState(null);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setCountRowPopupState(null);
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    window.addEventListener("pointerdown", handlePointerDownOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
      window.removeEventListener("pointerdown", handlePointerDownOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [clearCountRowLongPress, countRowPopupState]);



  
  const getCellRole = (instId, stepIndex) => {
    if (loopRule) {
      const r = instruments.findIndex((x) => x.id === instId);
      if (r >= loopRule.rowStart && r <= loopRule.rowEnd) {
        const inSrc =
          stepIndex >= loopRule.start && stepIndex < loopRule.start + loopRule.length;
        if (inSrc) return "source";

        const maxRepeats =
          loopRepeats === "off"
            ? 0
            : loopRepeats === "all"
              ? Infinity
              : Math.max(1, Math.min(8, Number(loopRepeats) || 1));
        const loopEndExclusive =
          maxRepeats === Infinity
            ? columns
            : Math.min(columns, loopRule.start + loopRule.length * (1 + maxRepeats));

        if (maxRepeats !== 0) {
          if (
            stepIndex >= loopRule.start + loopRule.length &&
            stepIndex < loopEndExclusive
          )
            return "generated";
        }
      }
    }

    // Show the selection outline for any non-empty rectangular selection,
    // including a single-column multi-row selection.
    if (selection) {
      const r = instruments.findIndex((x) => x.id === instId);
      if (wrappedSelectionCells && wrappedSelectionCells.length >= 1) {
        return wrappedSelectionCells.some((cell) => cell.row === r && cell.col === stepIndex)
          ? "selected"
          : "none";
      }
      const width = selection.endExclusive - selection.start;
      if (width >= 1) {
        if (
          r >= selection.rowStart &&
          r <= selection.rowEnd &&
          stepIndex >= selection.start &&
          stepIndex < selection.endExclusive
        )
          return "selected";
      }
    }

    return "none";
  };
  const isCellInSelection = React.useCallback(
    (row, col) => {
      if (!Number.isFinite(row) || !Number.isFinite(col)) return false;
      if (wrappedSelectionCells && wrappedSelectionCells.length > 0) {
        return wrappedSelectionCells.some((cell) => cell.row === row && cell.col === col);
      }
      if (!selection) return false;
      return (
        row >= selection.rowStart &&
        row <= selection.rowEnd &&
        col >= selection.start &&
        col < selection.endExclusive
      );
    },
    [selection, wrappedSelectionCells]
  );
  const stepMoveFromPointerDelta = React.useCallback(
    (toRow, toCol) => {
      if (!moveSelectionByDelta) return;
      const fromRow = press.current.moveLastRow;
      const fromCol = press.current.moveLastCol;
      let dRow = toRow - fromRow;
      let dCol = toCol - fromCol;
      let movedAny = false;
      while (dRow !== 0) {
        const step = dRow > 0 ? 1 : -1;
        const moved = moveSelectionByDelta(step, 0);
        if (moved) movedAny = true;
        dRow -= step;
      }
      while (dCol !== 0) {
        const step = dCol > 0 ? 1 : -1;
        const moved = moveSelectionByDelta(0, step);
        if (moved) movedAny = true;
        dCol -= step;
      }
      if (movedAny) {
        press.current.moveLastRow = toRow;
        press.current.moveLastCol = toCol;
      }
      return movedAny;
    },
    [moveSelectionByDelta]
  );
  stepMoveFromPointerDeltaRef.current = stepMoveFromPointerDelta;



  return (
    <div className="relative inline-flex w-max flex-col gap-6" data-gridsurface="1">
      {countRowPopupState ? (
        <div
          ref={countRowPopupRef}
          className="fixed z-[180] w-[12.25rem] rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
          style={{ left: `${countRowPopupState.left}px`, top: `${countRowPopupState.top}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 text-sm font-medium text-neutral-100">Subdivisions</div>
          <div className="mb-2 text-xs text-neutral-500">Notes per quarter</div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUARTER_SUBDIVISION_CYCLE.filter((value) => value !== 2).map((value) => {
              const selected = Number(selectedCountRowSubdivision) === value;
              return (
                <button
                  key={`subdiv-option-${value}`}
                  type="button"
                  onClick={() =>
                    applyCountRowSubdivision(
                      value,
                      countRowPopupState?.barIdx,
                      countRowPopupState?.quarterIdx
                    )
                  }
                  className={`rounded border px-2.5 py-1 text-sm ${
                    selected
                      ? "border-neutral-700 bg-neutral-800 text-white"
                      : "border-neutral-800 bg-neutral-900 text-neutral-500"
                  }`}
                  title={`Use ${QUARTER_SUBDIVISION_LABELS[value]} notes per quarter for this beat`}
                >
                  {QUARTER_SUBDIVISION_LABELS[value] || String(value)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {Array.from({ length: Math.ceil(bars / Math.max(1, Math.min(bars, Number(gridBarsPerLine) || 1))) }).map((_, lineIdx) => {
        const perLine = Math.max(1, Math.min(bars, Number(gridBarsPerLine) || 1));
        const barStart = lineIdx * perLine;
        const barEnd = Math.min(bars, (lineIdx + 1) * perLine);
        const stepsInLine = (barEnd - barStart) * stepsPerBar;

        // Build timeline for this line (with visual bar gaps)
        const timeline = [];
        for (let b = barStart; b < barEnd; b++) {
          const meta = stepMetaByBar[b] || [];
          const barOffset = barStepOffsets[b] ?? 0;
          for (let s = 0; s < meta.length; s++) {
            timeline.push({
              bar: b,
              stepInBar: s,
              stepMeta: meta[s],
              stepIndex: barOffset + s,
              type: "cell",
            });
          }
          if (b !== barEnd - 1) timeline.push({ type: "gap", key: `gap-${b}` });
        }

        return (
          <div key={`gridline-${lineIdx}`} className="grid gap-1" style={{ gridTemplateColumns: `${labelGutterWidth} repeat(${timeline.length}, 28px)` }}>
            <div className="flex h-6 items-end justify-end pr-0" style={{ width: labelGutterWidth }} />
                {timeline.map((t, i) => {
                  if (t.type === "gap") return <div key={t.key} />;
                  const label = labelFor(t.stepMeta || { quarterIndex: 0, subIndex: 0, subdiv: 1 });
                  const quarterBandClass = getQuarterBandClass(t.bar, t.stepMeta);
                  const quarterBorderClass = getQuarterBorderClass(t.bar, t.stepMeta);
                  const quarterTupletValue =
                    normalizedTupletOverridesByBar?.[t.bar]?.[t.stepMeta?.quarterIndex ?? 0] ?? null;
                  const countRowQuarterBandStyle = getCountRowQuarterBandStyle(
                    quarterBandClass,
                    quarterTupletValue
                  );
              return (
                <div
                  key={`h-${t.stepIndex}`}
                  data-count-row-cell="1"
                  className="relative h-6 text-xs text-center select-none overflow-visible cursor-pointer rounded-sm"
                  style={gridContentOffsetStyle}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.button != null && e.button !== 0) return;
                    setCountRowPopupState(null);
                    const targetEl = e.currentTarget;
                    countRowPressRef.current.longPressed = false;
                    countRowPressRef.current.pointerId = e.pointerId;
                    clearCountRowLongPress();
                    countRowPressRef.current.timer = window.setTimeout(() => {
                      countRowPressRef.current.longPressed = true;
                      openCountRowSubdivisionPopup(targetEl, t.bar, t.stepMeta?.quarterIndex ?? 0);
                    }, 420);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    const wasLongPressed = countRowPressRef.current.longPressed;
                    countRowPressRef.current.longPressed = false;
                    clearCountRowLongPress();
                    if (wasLongPressed) return;
                    const quarterIdx = t.stepMeta?.quarterIndex ?? 0;
                    const selectedSubdivision = Number(selectedCountRowSubdivision) || 3;
                    const currentOverride =
                      normalizedTupletOverridesByBar?.[t.bar]?.[quarterIdx] ?? null;
                    const currentEffective =
                      currentOverride == null
                        ? gridBaseSubdivPerQuarter
                        : Math.max(1, Math.round(Number(currentOverride) || gridBaseSubdivPerQuarter));
                    if (currentEffective === selectedSubdivision) {
                      resetTupletAt?.(t.bar, quarterIdx);
                      return;
                    }
                    setTupletAt?.(t.bar, quarterIdx, selectedSubdivision);
                  }}
                  onPointerCancel={() => {
                    countRowPressRef.current.longPressed = false;
                    clearCountRowLongPress();
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse" && !countRowPressRef.current.longPressed) {
                      clearCountRowLongPress();
                    }
                  }}
                  title="Click to toggle subdivisions. Long press for subdivision options"
                >
                  {/* Playhead indicator: kept within header row to avoid clipping/overlap. */}
                  {playhead === t.stepIndex && (
                    <span
                      className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-neutral-700"
                      aria-hidden="true"
                    />
                  )}
                  {countRowQuarterBandStyle ? (
                    <span
                      className={`pointer-events-none absolute inset-0 rounded-sm ${quarterBandClass}`}
                      style={countRowQuarterBandStyle}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={`absolute bottom-0 inset-x-0 hover:text-neutral-200 ${
                      /^\d+$/.test(label)
                        ? "text-neutral-400"
                        : darkenCountRowNonQuarters
                          ? "text-neutral-600"
                          : "text-neutral-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}

            {instruments.map((inst) => (
              <React.Fragment key={`${inst.id}-${lineIdx}`}>
                <div
                  className="pr-0 text-xs text-right whitespace-nowrap select-none cursor-pointer hover:text-neutral-200"
                  style={{ width: labelGutterWidth }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    const r = instruments.findIndex((x) => x.id === inst.id);
                    if (r < 0) return;
                    setSelection({
                      rowStart: r,
                      rowEnd: r,
                      start: 0,
                      endExclusive: columns,
                    });
                    notifySelectionFinalized();
                  }}
                  title="Select full row"
                >
                  {inst.label}
                </div>
                {timeline.map((t, i) => {
                  if (t.type === "gap") return <div key={`g-${inst.id}-${lineIdx}-${i}`} style={gridContentOffsetStyle} />;
                  const val = grid[inst.id]?.[t.stepIndex] ?? CELL.OFF;
                  const quarterBandClass = getQuarterBandClass(t.bar, t.stepMeta);
                  const quarterBorderClass = getQuarterBorderClass(t.bar, t.stepMeta);
                  const quarterTupletValue =
                    normalizedTupletOverridesByBar?.[t.bar]?.[t.stepMeta?.quarterIndex ?? 0] ?? null;
                  const isUnplayableStep = !!playabilityWarningStepSet?.has(t.stepIndex);
                  const hasPlayabilityWarning =
                    !!playabilityWarningsEnabled && isUnplayableStep;
                  const hasStickingConflictWarning =
                    !!stickingEditModeEnabled && !!stickingConflictStepSet?.has(t.stepIndex);
                  const stickingOverrideKey = `${inst.id}:${t.stepIndex}`;
                  const hasManualStickingOverride =
                    !FOOT_INSTRUMENTS.has(inst.id) &&
                    (stickingOverrides?.[stickingOverrideKey] === "L" ||
                      stickingOverrides?.[stickingOverrideKey] === "R");
                  const stickingHand =
                    (stickingEditModeEnabled || notationStickingSelectionModeEnabled) &&
                    !isUnplayableStep &&
                    !FOOT_INSTRUMENTS.has(inst.id) &&
                    val !== CELL.OFF
                      ? stickingAssignmentsByStep?.[t.stepIndex]?.[inst.id] || ""
                      : "";
                  const hasCustomNotationSticking =
                    val !== CELL.OFF &&
                    notationStickingSelection?.[`${inst.id}:${t.stepIndex}`] === true;
                  return (
                    <div
                      key={`${inst.id}-${t.stepIndex}`}
                      style={gridContentOffsetStyle}
                      data-gridcell="1"
                      data-row={instruments.findIndex((x) => x.id === inst.id)}
                      data-col={t.stepIndex}
                      onMouseEnter={() => {
                        hoveredGridCellRef.current = {
                          row: instruments.findIndex((x) => x.id === inst.id),
                          col: t.stepIndex,
                        };
                      }}
                      onMouseMove={() => {
                        hoveredGridCellRef.current = {
                          row: instruments.findIndex((x) => x.id === inst.id),
                          col: t.stepIndex,
                        };
                      }}
                      onPointerDown={(e) => {
                        // Mobile/touch-only gesture handling.
                        if (e.pointerType === "mouse") return;

                        // Alternative loop/selection end: while holding a long-press (or ghost) gesture,
                        // tap another cell with a second finger to set the end of the region.
                        // This must also work when starting on an *active* ghost-enabled cell (snare/toms/hihat):
                        // if ghost already toggled, revert it before switching into selection.
                        if (
                          press.current.active &&
                          (press.current.mode === "select" || press.current.mode === "ghostArmed" || press.current.mode === "ghostDone") &&
                          press.current.pointerId !== e.pointerId
                        ) {
                          const el = e.target?.closest?.("[data-gridcell='1']");
                          if (el) {
                            const r1 = Number(el.getAttribute("data-row"));
                            const c1 = Number(el.getAttribute("data-col"));
                            const r0 = press.current.startRow;
                            const c0 = press.current.startCol;

                            // If we were arming/toggling a ghost note, cancel/revert that.
                            if (press.current.mode === "ghostArmed") {
                              if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                              longPress.current.timer = null;
                              longPress.current.did = false;
                            } else if (press.current.mode === "ghostDone") {
                              if (press.current.ghostToggled && press.current.instId) {
                                try { toggleGhost(press.current.instId, c0, press.current.startVal); } catch (_) {}
                              }
                              longPress.current.did = false;
                            }

                            const rowStart = Math.min(r0, r1);
                            const rowEnd = Math.max(r0, r1);
                            const start = Math.min(c0, c1);
                            const endExclusive = Math.max(c0, c1) + 1;

                            setSelection({ rowStart, rowEnd, start, endExclusive });
                            setDrag(null);
                            notifySelectionFinalized();
                          }

                          // end the hold gesture
                          press.current.active = false;
                          press.current.pointerId = null;
                          press.current.mode = "none";
                          press.current.ghostToggled = false;
                          if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                          longPress.current.timer = null;
                          return;
                        }
                        e.preventDefault();
                        e.stopPropagation();

                        const r = instruments.findIndex((x) => x.id === inst.id);
                        const c = t.stepIndex;
                        // If loop preview is active and user starts on the current selection,
                        // exit looping so long-press / drag can enter move interaction.
                        if (loopRule) {
                          if (isCellInSelection(r, c)) {
                            // Keep loop active on simple press/click.
                            // Move mode will take over only after actual drag movement.
                          } else {
                            bakeLoopPreview?.();
                            return;
                          }
                        }

                        press.current.active = true;
                        press.current.pointerId = e.pointerId;
                        press.current.startX = e.clientX;
                        press.current.startY = e.clientY;
                        press.current.startTime = Date.now();
                        press.current.mode = "none";
                        press.current.ghostToggled = false;
                        press.current.didSelect = false;
                        longPress.current.did = false;
                        press.current.startRow = r;
                        press.current.startCol = c;
                        press.current.moveLastRow = r;
                        press.current.moveLastCol = c;
                        press.current.startVal = val;
                        press.current.startWasSelected = isCellInSelection(r, c);
                        press.current.instId = inst.id;

                        // In notation-sticking selection mode, selection gestures should stay in selection flow.
                        if (notationStickingSelectionModeEnabled) {
                          press.current.mode = "selectArmed";
                        } else if (press.current.startWasSelected) {
                          press.current.mode = "moveArmed";
                        } else if (val !== CELL.OFF && GHOST_ENABLED.has(inst.id)) {
                          // Ghost long-press on active cells (ghost-enabled instruments)
                          press.current.mode = "ghostArmed";
                        } else if (val !== CELL.OFF) {
                          press.current.mode = "moveArmed";
                        }

                        if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                        longPress.current.did = false;
                        longPress.current.timer = window.setTimeout(() => {
                          if (!press.current.active) return;

                          // Ghost takes priority if armed
                          if (press.current.mode === "ghostArmed") {
                            longPress.current.did = true;
                            toggleGhost(inst.id, c);
                            press.current.mode = "ghostDone";
                            press.current.ghostToggled = true;
                            return;
                          }
                          if (press.current.mode === "moveArmed") {
                            // Enter move mode only when pointer actually moves.
                            return;
                          }

                          // A stationary hold should behave like a normal tap.
                          // Selection only starts once the user drags to another cell.
                        }, readGridSelectionHoldDelayMs());
                      }}
                      onPointerMove={(e) => {
                        hoveredGridCellRef.current = {
                          row: instruments.findIndex((x) => x.id === inst.id),
                          col: t.stepIndex,
                        };
                        if (e.pointerType === "mouse") return;
                        if (!press.current.active) return;
                        if (press.current.pointerId !== e.pointerId) return;
                        e.preventDefault();


                        // If we long-pressed an active ghost-enabled cell and then move away,
                        // switch into move/selection mode and revert the ghost toggle when needed.
                        const el0 = document.elementFromPoint(e.clientX, e.clientY);
                        const cell0 = el0?.closest?.("[data-gridcell='1']");
                        if (cell0) {
                          const r1 = Number(cell0.getAttribute("data-row"));
                          const c1 = Number(cell0.getAttribute("data-col"));
                          const r0 = press.current.startRow;
                          const c0 = press.current.startCol;

                          if (!Number.isNaN(r1) && !Number.isNaN(c1) && (r1 !== r0 || c1 !== c0)) {
                            if (press.current.mode === "ghostArmed") {
                              if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                              longPress.current.timer = null;
                              longPress.current.did = false;
                              if (press.current.startWasSelected || press.current.startVal !== CELL.OFF) {
                                if (!press.current.startWasSelected) {
                                  setSelection({ rowStart: r0, rowEnd: r0, start: c0, endExclusive: c0 + 1 });
                                }
                                press.current.mode = "move";
                                press.current.moveLastRow = r0;
                                press.current.moveLastCol = c0;
                                stepMoveFromPointerDelta(r1, c1);
                              } else {
                                press.current.mode = "select";
                                setDrag({ row: r0, col: c0 });
                                press.current.didSelect = true;
                                setSelection({ rowStart: Math.min(r0, r1), rowEnd: Math.max(r0, r1), start: Math.min(c0, c1), endExclusive: Math.max(c0, c1) + 1 });
                              }
                            } else if (press.current.mode === "ghostDone") {
                              longPress.current.did = false;
                              if (press.current.ghostToggled && press.current.instId) {
                                try { toggleGhost(press.current.instId, c0, press.current.startVal); } catch (_) {}
                              }
                              if (!press.current.startWasSelected) {
                                press.current.mode = "select";
                                setDrag({ row: r0, col: c0 });
                                press.current.didSelect = true;
                                setSelection({
                                  rowStart: Math.min(r0, r1),
                                  rowEnd: Math.max(r0, r1),
                                  start: Math.min(c0, c1),
                                  endExclusive: Math.max(c0, c1) + 1,
                                });
                              } else {
                                if (!press.current.startWasSelected) {
                                  setSelection({ rowStart: r0, rowEnd: r0, start: c0, endExclusive: c0 + 1 });
                                }
                                press.current.mode = "move";
                                press.current.moveLastRow = r0;
                                press.current.moveLastCol = c0;
                                stepMoveFromPointerDelta(r1, c1);
                              }
                            } else if (press.current.mode === "moveArmed") {
                              if (!press.current.startWasSelected) {
                                setSelection({ rowStart: r0, rowEnd: r0, start: c0, endExclusive: c0 + 1 });
                              }
                              press.current.mode = "move";
                              press.current.moveLastRow = r0;
                              press.current.moveLastCol = c0;
                              stepMoveFromPointerDelta(r1, c1);
                            } else if (press.current.mode === "move") {
                              stepMoveFromPointerDelta(r1, c1);
                            } else if (press.current.mode === "selectArmed") {
                              const heldMs = Date.now() - (press.current.startTime || 0);
                              if (heldMs >= 130) {
                                press.current.mode = "select";
                                setDrag({ row: r0, col: c0 });
                                press.current.didSelect = true;
                                setSelection({
                                  rowStart: Math.min(r0, r1),
                                  rowEnd: Math.max(r0, r1),
                                  start: Math.min(c0, c1),
                                  endExclusive: Math.max(c0, c1) + 1,
                                });
                              }
                            } else if (press.current.mode === "select") {
                              setSelection({ rowStart: Math.min(r0, r1), rowEnd: Math.max(r0, r1), start: Math.min(c0, c1), endExclusive: Math.max(c0, c1) + 1 });
                            }
                          }
                        }

                        // Only drag after selection mode has begun (after long-press).
                        if (press.current.mode !== "select" && press.current.mode !== "move") return;

                        const el = document.elementFromPoint(e.clientX, e.clientY);
                        const cell = el?.closest?.("[data-gridcell='1']");
                        if (!cell) return;
                        const r1 = Number(cell.getAttribute("data-row"));
                        const c1 = Number(cell.getAttribute("data-col"));
                        if (Number.isNaN(r1) || Number.isNaN(c1)) return;

                        const r0 = press.current.startRow;
                        const c0 = press.current.startCol;

                        if (press.current.mode === "move") {
                          stepMoveFromPointerDelta(r1, c1);
                        } else {
                          press.current.didSelect = true;
                          const rowStart = Math.min(r0, r1);
                          const rowEnd = Math.max(r0, r1);
                          const start = Math.min(c0, c1);
                          const endExclusive = Math.max(c0, c1) + 1;
                          setSelection({ rowStart, rowEnd, start, endExclusive });
                        }
                      }}
                      onPointerUp={(e) => {
                        if (e.pointerType === "mouse") return;
                        if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                        longPress.current.timer = null;

                        maybeClearSingleCellSelectionAfterMove();
                        press.current.active = false;
                        press.current.pointerId = null;
                        setDrag(null);
                        notifySelectionFinalized();
                      }}
                      onPointerCancel={(e) => {
                        if (e.pointerType === "mouse") return;
                        if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                        longPress.current.timer = null;

                        maybeClearSingleCellSelectionAfterMove();
                        press.current.active = false;
                        press.current.pointerId = null;
                        setDrag(null);
                        notifySelectionFinalized();
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType === "mouse") return;
                        if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                        longPress.current.timer = null;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (longPress.current.timer) {
                          window.clearTimeout(longPress.current.timer);
                          longPress.current.timer = null;
                        }
                        // Suppress click toggle if a long-press fired (touch).
                        if (longPress.current.did) {
                          longPress.current.did = false;
                          return;
                        }
                        if (suppressNextCellClickToggleRef.current) {
                          suppressNextCellClickToggleRef.current = false;
                          return;
                        }
                        if (Date.now() < (mouseDragRef.current.suppressClickUntil || 0)) {
                          return;
                        }
                        const clickRow = instruments.findIndex((x) => x.id === inst.id);
                        const clickCol = t.stepIndex;
                        const clickedInSelection = isCellInSelection(clickRow, clickCol);
                        if (notationStickingSelectionModeEnabled) {
                          if (!FOOT_INSTRUMENTS.has(inst.id) && val !== CELL.OFF) {
                            onToggleNotationStickingSelection?.(inst.id, t.stepIndex);
                            return;
                          }
                          setLoopRule(null);
                          setSelection(null);
                          onDisableNotationStickingSelectionMode?.();
                          onDisableStickingEditMode?.();
                          cycleVelocity(inst.id, t.stepIndex);
                          return;
                        }
                        if (selection) {
                          if (skipNextWrappedSelectionClearRef.current) {
                            skipNextWrappedSelectionClearRef.current = false;
                            if (clickedInSelection) return;
                          }
                          if (!clickedInSelection) {
                            setLoopRule(null);
                            setSelection(null);
                            return;
                          }
                          if (
                            !loopRule &&
                            !(stickingEditModeEnabled && clickedInSelection) &&
                            !(notationStickingSelectionModeEnabled && clickedInSelection)
                          ) return;
                        }
                        if (wrappedSelectionCells && wrappedSelectionCells.length > 0) {
                          setLoopRule(null);
                          setSelection(null);
                          return;
                        }
                        if (
                          stickingEditModeEnabled &&
                          !FOOT_INSTRUMENTS.has(inst.id) &&
                          val !== CELL.OFF
                        ) {
                          onCycleStickingOverride?.(inst.id, t.stepIndex);
                          return;
                        }
                        if (stickingEditModeEnabled) {
                          onDisableStickingEditMode?.();
                        }
                        cycleVelocity(inst.id, t.stepIndex);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const r = instruments.findIndex((x) => x.id === inst.id);
                        const c = t.stepIndex;
                        if (loopRule) {
                          if (isCellInSelection(r, c)) {
                            // Keep loop active on simple press/click.
                            // Move mode will take over only after actual drag movement.
                          } else {
                            suppressNextCellClickToggleRef.current = true;
                            bakeLoopPreview?.();
                            return;
                          }
                        }
                        // Guard against stale ghost press state leaking into a new interaction.
                        if (press.current.pointerId === "mouse" && press.current.mode === "ghostDone") {
                          if (longPress.current.timer) {
                            window.clearTimeout(longPress.current.timer);
                            longPress.current.timer = null;
                          }
                          press.current.active = false;
                          press.current.pointerId = null;
                          press.current.mode = "none";
                          press.current.ghostToggled = false;
                          press.current.didSelect = false;
                          longPress.current.did = false;
                        }

                        const val = grid[inst.id][c];
                        const ghostAllowed = GHOST_ENABLED.has(inst.id);
                        press.current.active = true;
                        press.current.pointerId = "mouse";
                        press.current.startRow = r;
                        press.current.startCol = c;
                        press.current.moveLastRow = r;
                        press.current.moveLastCol = c;
                        press.current.startVal = val;
                        press.current.startWasSelected = isCellInSelection(r, c);
                        press.current.startX = e.clientX;
                        press.current.startY = e.clientY;
                        press.current.startTime = Date.now();
                        press.current.instId = inst.id;
                        press.current.ghostToggled = false;
                        press.current.didSelect = false;
                        longPress.current.did = false;

                        // Mode priority:
                        // 1) moving existing selection
                        // 2) ghost toggle on active ghost-capable cell
                        // 3) move single active cell
                        // 4) selection (legacy immediate-drag or long-press-drag)
                        if (notationStickingSelectionModeEnabled) {
                          press.current.mode = "selectArmed";
                        } else if (press.current.startWasSelected) {
                          press.current.mode = "moveArmed";
                        } else if (ghostAllowed && (val === CELL.ON || val === CELL.GHOST || val === CELL.ACCENT)) {
                          press.current.mode = "ghostArmed";
                        } else if (val !== CELL.OFF) {
                          press.current.mode = "moveArmed";
                        } else {
                          press.current.mode = "selectArmed";
                        }

                        if (longPress.current.timer) window.clearTimeout(longPress.current.timer);
                        longPress.current.did = false;
                        longPress.current.timer = window.setTimeout(() => {
                          if (!press.current.active || press.current.pointerId !== "mouse") return;
                          if (press.current.mode === "ghostArmed") {
                            longPress.current.did = true;
                            toggleGhost(inst.id, c);
                            press.current.mode = "ghostDone";
                            press.current.ghostToggled = true;
                            return;
                          }
                          if (press.current.mode === "moveArmed") {
                            // Enter move mode only when pointer actually moves.
                            return;
                          }
                          if (press.current.mode === "selectArmed") {
                            // A stationary hold should behave like a normal click.
                            // Selection starts only after dragging into another cell.
                            return;
                          }
                        }, readGridSelectionHoldDelayMs());
                      }}
                      className={`w-7 h-7 border cursor-pointer ${CELL_COLOR[val]} ${val === CELL.ACCENT ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.98)]" : ""} ${(() => {
                        const role = getCellRole(inst.id, t.stepIndex);
                        if (role === "source") return "border-cyan-300 ring-2 ring-cyan-300/40";
                        if (role === "generated") return "border-neutral-600 opacity-70";
                        if (role === "selected") return "border-cyan-300 ring-2 ring-cyan-300/30";
                        if (notationStickingSelectionModeEnabled && hasCustomNotationSticking) {
                          return "border-amber-300 ring-2 ring-amber-300/35";
                        }
                        return quarterBorderClass || "border-neutral-800";
                      })()} ${(hasPlayabilityWarning || hasStickingConflictWarning) ? "shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35)]" : ""} relative overflow-hidden`}
                    >
                      <span
                        className={`pointer-events-none absolute inset-0 ${quarterBandClass} ${
                          quarterBandClass ? "opacity-100" : (val === CELL.OFF ? "opacity-100" : "opacity-40")
                        }`}
                        style={
                          quarterBandClass === "is-tuplet-band"
                            ? getTupletQuarterBandStyle(quarterTupletValue, false)
                            : quarterBandClass === "is-tuplet-band-dark"
                              ? getTupletQuarterBandStyle(quarterTupletValue, true)
                              : undefined
                        }
                        aria-hidden="true"
                      />
                      {stickingHand && (
                        <span
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] leading-none font-bold ${
                            showEditedSticking && hasManualStickingOverride ? "text-amber-300" : "text-neutral-100/90"
                          }`}
                          aria-hidden="true"
                        >
                          {stickingHand}
                        </span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}
