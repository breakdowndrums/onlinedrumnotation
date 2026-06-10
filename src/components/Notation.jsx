import React, { useEffect, useRef, useState } from "react";
import * as Vex from "vexflow";

const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Fraction, Barline } = Vex.Flow;
const CUSTOM_GHOST_GLYPHS = {
  black: "noteheadBlackParensCustom",
  x: "noteheadXBlackGhostSmallCustom",
  circleX: "noteheadXBlackGhostSmallCustom",
};
const CUSTOM_CIRCLED_X_LARGE_GLYPH = "noteheadCircleX115FreshCustom";
const TEMPO_QUARTER_UP_PATH =
  "M302 115v760h30v-828c0 -95 -123 -188 -223 -188c-61 0 -109 35 -109 94c0 97 99 188 222 188c33 0 61 -9 80 -26z";
const CELL = {
  OFF: "off",
  ON: "on",
  GHOST: "ghost",
  ACCENT: "accent",
};
const GHOST_NOTATION_ENABLED = new Set(["snare", "tom1", "tom2", "floorTom", "hihat"]);

const NOTATION_MAP = {
  kick: { key: "f/4" },
  snare: { key: "c/5" },
  sideStick: { key: "c/5/x2", x: true },
  hihat: { key: "g/5/x2", x: true },
  hihatOpen: { key: "g/5/x3", x: true, open: true },
  hihatFoot: { key: "d/4/x2", x: true },
  ride: { key: "f/5/x2", x: true },
  rideBell: { key: "f/5/d2", diamond: true },
  crash1: { key: "a/5/x2", x: true },
  crash2: { key: "b/5/x2", x: true },
  china: { key: "a/5/x3", x: true },
  splash: { key: "c/6/x2", x: true },
  cowbell: { key: "e/5/t2", triangle: true },
  tom2: { key: "d/5" },
  tom1: { key: "e/5" },
  floorTom: { key: "a/4" },
};

function normalizeNotationRowBarCounts(bars, barsPerLine, barsPerRow) {
  const totalBars = Math.max(1, Number(bars) || 1);
  const explicit = Array.isArray(barsPerRow)
    ? barsPerRow
        .map((n) => Math.max(1, Math.min(4, Number(n) || 0)))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const explicitSum = explicit.reduce((sum, value) => sum + value, 0);
  if (explicit.length && explicitSum === totalBars) return explicit;

  const perLine = Math.max(1, Math.min(totalBars, Number(barsPerLine) || 1));
  const out = [];
  let remaining = totalBars;
  while (remaining > 0) {
    const count = Math.max(1, Math.min(perLine, remaining));
    out.push(count);
    remaining -= count;
  }
  return out;
}

function isPowerOfTwoSubdivision(count) {
  const normalized = Math.max(1, Math.round(Number(count) || 1));
  return (normalized & (normalized - 1)) === 0;
}

function estimateNotationBarWidthDemand({
  grid,
  barStartStep,
  barEndStep,
  quarterSubdivisions = [],
  minWidth = 180,
  leadingWidthExtra = 0,
  spacingPreset = "normal",
}) {
  const start = Math.max(0, Number(barStartStep) || 0);
  const end = Math.max(start + 1, Number(barEndStep) || start + 1);
  const barSteps = Math.max(1, end - start);
  const safeGrid = grid && typeof grid === "object" ? grid : {};
  let activeCells = 0;
  let activeSteps = 0;
  let maxChordSize = 0;

  for (let step = start; step < end; step++) {
    let chordSize = 0;
    for (const cells of Object.values(safeGrid)) {
      if ((cells?.[step] ?? CELL.OFF) !== CELL.OFF) chordSize += 1;
    }
    if (chordSize > 0) {
      activeSteps += 1;
      activeCells += chordSize;
      if (chordSize > maxChordSize) maxChordSize = chordSize;
    }
  }

  const maxQuarterSubdiv = Math.max(
    1,
    ...((Array.isArray(quarterSubdivisions) ? quarterSubdivisions : [])
      .map((n) => Math.max(1, Number(n) || 1)))
  );
  const tupletBracketExtra = (Array.isArray(quarterSubdivisions) ? quarterSubdivisions : []).reduce(
    (sum, rawCount) => {
      const count = Math.max(1, Number(rawCount) || 1);
      const isPowerOfTwo = (count & (count - 1)) === 0;
      if (count <= 1 || isPowerOfTwo) return sum;
      if (count >= 9) return sum + 120;
      if (count >= 7) return sum + 88;
      if (count >= 5) return sum + 56;
      return sum + 24;
    },
    0
  );
  const densityRatio = activeSteps / barSteps;
  const chordExtras = Math.max(0, activeCells - activeSteps);
  const tupletExtra = Math.max(0, maxQuarterSubdiv - 2);
  const densityBoost =
    densityRatio > 0.85 ? 44 :
    densityRatio > 0.7 ? 28 :
    densityRatio > 0.5 ? 14 :
    0;
  const estimatedWidth =
    112 +
    Math.max(0, Number(leadingWidthExtra) || 0) +
    barSteps * 2.8 +
    activeSteps * 10 +
    chordExtras * 18 +
    tupletExtra * 28 +
    tupletBracketExtra +
    densityBoost +
    (maxChordSize >= 4 ? 38 : 0) +
    (maxChordSize === 3 ? 20 : 0);
  const presetFactor =
    spacingPreset === "large"
      ? 1.25
      : spacingPreset === "tight"
        ? 0.75
        : 1;
  return Math.max(minWidth, Math.round(estimatedWidth * presetFactor));
}

function drawNotationBarOverlay(svg, rects, barIndices, {
  className,
  fill,
  stroke,
  strokeWidth,
  pointerEvents = "",
}) {
  if (!(svg instanceof SVGElement)) return;
  svg.querySelectorAll(`.${className}`).forEach((el) => el.remove());
  const barSet = new Set(
    (Array.isArray(barIndices) ? barIndices : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
  );
  if (!barSet.size) return;
  (Array.isArray(rects) ? rects : []).forEach((rectSpec, barIndex) => {
    if (!barSet.has(barIndex) || !rectSpec) return;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(rectSpec.x));
    rect.setAttribute("y", String(rectSpec.y));
    rect.setAttribute("width", String(rectSpec.width));
    rect.setAttribute("height", String(rectSpec.height));
    rect.setAttribute("rx", "6");
    rect.setAttribute("ry", "6");
    rect.setAttribute("fill", fill);
    rect.setAttribute("stroke", stroke);
    rect.setAttribute("stroke-width", String(strokeWidth));
    rect.setAttribute("class", className);
    if (pointerEvents) rect.style.pointerEvents = pointerEvents;
    svg.insertBefore(rect, svg.firstChild);
  });
}

export default function Notation({
  instruments,
  grid,
  stickingAssignmentsByStep,
  showNotationSticking,
  notationStickingSelection = null,
  notationStickingView,
  resolution,
  bars,
  barsPerLine,
  barsPerRow = null,
  stepsPerBar,
  timeSig,
  timeSigByBar = null,
  quarterSubdivisionsByBar,
  barStepOffsets,
  mergeRests,
  mergeNotes,
  dottedNotes,
  flatBeams,
  justifySystems = false,
  targetContentWidth = null,
  activeBarIndices = [],
  editorBarIndices = [],
  selectedBarIndices = [],
  onBarClick = null,
  onBarMenuOpen = null,
  sectionMarkers = [],
  tempoMarkers = [],
  dynamicSpacingByBar = null,
  spacingPresetByBar = null,
  mergeRestsByBar = null,
  mergeNotesByBar = null,
  dottedNotesByBar = null,
  showNotationStickingByBar = null,
  showSystemBarNumbers = false,
  barNumberOffset = 0,
  enableMeasureRepeats = false,
  theme = "dark",
}) {
  const VF = Vex.Flow;
  const ref = useRef(null);
  const highlightSvgRef = useRef(null);
  const highlightRectsRef = useRef([]);
  const onBarClickRef = useRef(onBarClick);
  const onBarMenuOpenRef = useRef(onBarMenuOpen);
  const [hitLayerVersion, setHitLayerVersion] = useState(0);
  onBarClickRef.current = onBarClick;
  onBarMenuOpenRef.current = onBarMenuOpen;
  const isLightTheme = theme === "light";
  const notationColor = isLightTheme ? "#111111" : "#ffffff";
  const secondaryTextColor = isLightTheme ? "#171717" : "#d4d4d4";
  const sectionTextColor = isLightTheme ? "#111111" : "#e5e5e5";

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      const Flow = Vex.Flow;
      let ctx;
      const buildBarSignature = (barIndex) => {
      const quarterSubs = (Array.isArray(quarterSubdivisionsByBar) ? quarterSubdivisionsByBar[barIndex] : null) || [];
      const start = Array.isArray(barStepOffsets) ? Number(barStepOffsets[barIndex]) || 0 : barIndex * stepsPerBar;
      const end = Array.isArray(barStepOffsets)
        ? Number(barStepOffsets[barIndex + 1]) || start + stepsPerBar
        : start + stepsPerBar;
      const instStates = instruments.map((inst) => {
        const slice = [];
        for (let step = start; step < end; step++) {
          slice.push(grid[inst.id]?.[step] ?? CELL.OFF);
        }
        return `${inst.id}:${slice.join("")}`;
      });
      const barTs =
        Array.isArray(timeSigByBar) && timeSigByBar[barIndex]
          ? timeSigByBar[barIndex]
          : timeSig;
      return JSON.stringify({
        timeSig: `${barTs?.n || 4}/${barTs?.d || 4}`,
        resolution: Number(resolution) || 0,
        quarterSubs,
        instStates,
      });
    };
    const barSignatures = Array.from({ length: bars }, (_, barIndex) => buildBarSignature(barIndex));
    const resolvedRowBarCounts = normalizeNotationRowBarCounts(bars, barsPerLine, barsPerRow);
    const rowStartBars = [];
    const barRowIndices = Array(bars).fill(0);
    const barCols = Array(bars).fill(0);
    let rowCursor = 0;
    resolvedRowBarCounts.forEach((count, rowIdx) => {
      rowStartBars.push(rowCursor);
      for (let i = 0; i < count && rowCursor + i < bars; i++) {
        barRowIndices[rowCursor + i] = rowIdx;
        barCols[rowCursor + i] = i;
      }
      rowCursor += count;
    });
    const rowStartSet = new Set(rowStartBars);
    const sectionMarkerMap = new Map(
      (Array.isArray(sectionMarkers) ? sectionMarkers : [])
        .map((m) => [Number(m?.bar), String(m?.text || "").trim()])
        .filter(([bar, text]) => Number.isFinite(bar) && bar >= 0 && text)
    );
    const tempoMarkerMap = new Map(
      (Array.isArray(tempoMarkers) ? tempoMarkers : [])
        .map((m) => [Number(m?.bar), String(m?.text || "").trim()])
        .filter(([bar, text]) => Number.isFinite(bar) && bar >= 0 && text)
    );
    const repeatPlan = (() => {
      if (!enableMeasureRepeats || bars < 2) return Array.from({ length: bars }, () => null);
      const plan = Array.from({ length: bars }, () => null);
      let cursor = 1;
      while (cursor < bars) {
        let assigned = false;
        for (const span of [4, 2, 1]) {
          const leader = cursor - span;
          if (leader < 0 || cursor + span - 1 >= bars) continue;
          if (span === 2 && barRowIndices[cursor] !== barRowIndices[cursor + 1]) continue;
          if (span === 2 && barSignatures[leader] === barSignatures[leader + 1]) continue;
          let matches = true;
          for (let offset = 0; offset < span; offset++) {
            if (barSignatures[leader + offset] !== barSignatures[cursor + offset]) {
              matches = false;
              break;
            }
          }
          if (!matches) continue;
          plan[cursor] = {
            type: String(span),
            leader,
            followers: span - 1,
          };
          for (let offset = 1; offset < span; offset++) {
            plan[cursor + offset] = {
              type: "follower",
              leader: cursor,
            };
          }
          cursor += span;
          assigned = true;
          break;
        }
        if (!assigned) cursor += 1;
      }
      return plan;
    })();
    const getRepeatAwareBarDemand = (barIndex, fallbackDemand) => {
      const dynamic = Array.isArray(dynamicSpacingByBar) ? dynamicSpacingByBar[barIndex] === true : false;
      if (!dynamic) return fallbackDemand;
      const repeatInfo = repeatPlan[barIndex];
      if (!repeatInfo) return fallbackDemand;
      if (repeatInfo.type === "follower") return 72;
      if (repeatInfo.type === "1") return 92;
      if (repeatInfo.type === "2") return 112;
      if (repeatInfo.type === "4") return 100;
      return fallbackDemand;
    };
    const getSpacingPresetForBar = (barIndex) => {
      const raw = Array.isArray(spacingPresetByBar) ? spacingPresetByBar[barIndex] : null;
      return raw === "large" || raw === "tight" ? raw : "normal";
    };
    const getEffectiveBarBoolean = (list, barIndex, fallback) => (
      Array.isArray(list) && typeof list[barIndex] === "boolean" ? list[barIndex] : fallback
    );
    const getBarIndexForStep = (stepIdx) => {
      if (!Array.isArray(renderBarStepOffsets) || renderBarStepOffsets.length < 2) {
        return Math.max(0, Math.min((Number(bars) || 1) - 1, Math.floor(stepIdx / Math.max(1, Number(renderStepsPerBar) || 1))));
      }
      for (let barIndex = 0; barIndex < Math.max(0, renderBarStepOffsets.length - 1); barIndex++) {
        const start = Number(renderBarStepOffsets[barIndex]) || 0;
        const end = Number(renderBarStepOffsets[barIndex + 1]) || start;
        if (stepIdx >= start && stepIdx < end) return barIndex;
      }
      return Math.max(0, Math.min((Number(bars) || 1) - 1, renderBarStepOffsets.length - 2));
    };
    const drawArrangementTextMarkers = (svgRoot, staves) => {
      if (!svgRoot || !Array.isArray(staves) || staves.length < 1) return;
      const appendText = ({
        x,
        y,
        text,
        fill,
        fontFamily,
        fontSize,
        fontWeight = "400",
        fontStyle = "normal",
      }) => {
        if (!text) return;
        const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textEl.setAttribute("x", String(x));
        textEl.setAttribute("y", String(y));
        textEl.setAttribute("fill", fill);
        textEl.setAttribute("font-family", fontFamily);
        textEl.setAttribute("font-size", String(fontSize));
        textEl.setAttribute("font-weight", String(fontWeight));
        textEl.setAttribute("font-style", String(fontStyle));
        textEl.textContent = String(text);
        svgRoot.appendChild(textEl);
      };
      const appendPath = ({ x, y, d, scale = 1, fill = secondaryTextColor }) => {
        if (!d) return;
        const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.setAttribute("d", d);
        pathEl.setAttribute("fill", fill);
        pathEl.setAttribute("stroke", "none");
        pathEl.setAttribute("transform", `translate(${x} ${y}) scale(${scale} ${-scale})`);
        svgRoot.appendChild(pathEl);
      };
      for (let b = 0; b < staves.length; b++) {
        const stave = staves[b];
        const x = Number(stave?.getX?.()) || 0;
        const yTop = Number(stave?.getYForLine?.(0)) || 0;
        const sectionText = sectionMarkerMap.get(b);
        const tempoText = tempoMarkerMap.get(b);
        const barNumberY = yTop - 16;
        const sectionY = yTop - 32;
        const tempoY = sectionText ? yTop - 49 : sectionY;
        if (showSystemBarNumbers && rowStartSet.has(b)) {
          const barNo = Math.max(1, Number(barNumberOffset) + b + 1);
          appendText({
            x: x + 2,
            y: barNumberY,
            text: String(barNo),
            fill: secondaryTextColor,
            fontFamily: "Liberation Serif",
            fontSize: 14,
            fontWeight: "400",
            fontStyle: "italic",
          });
        }
        if (sectionText) {
          appendText({
            x: x + 2,
            y: sectionY,
            text: sectionText,
            fill: sectionTextColor,
            fontFamily: "Arial",
            fontSize: 11,
            fontWeight: "700",
          });
        }
        if (tempoText) {
          const tx = x + 2;
          const ty = tempoY;
          const match = /^♩\s*=\s*(.+)$/.exec(tempoText);
          if (match) {
            try {
              const glyphScale = 0.0093;
              const glyphWidth = 332 * glyphScale;
              appendPath({
                x: tx,
                y: ty - 1,
                d: TEMPO_QUARTER_UP_PATH,
                scale: glyphScale,
              });
              appendText({
                x: tx + glyphWidth + 6,
                y: ty,
                text: `= ${match[1]}`,
                fill: secondaryTextColor,
                fontFamily: "Arial",
                fontSize: 10,
                fontWeight: "400",
              });
            } catch (_) {
              appendText({
                x: tx,
                y: ty,
                text: tempoText,
                fill: secondaryTextColor,
                fontFamily: "Arial",
                fontSize: 10,
                fontWeight: "400",
              });
            }
          } else {
            appendText({
              x: tx,
              y: ty,
              text: tempoText,
              fill: secondaryTextColor,
              fontFamily: "Arial",
              fontSize: 10,
              fontWeight: "400",
            });
          }
        }
      }
    };
    const drawTwoBarRepeatMarkers = (svgRoot, staves, repeatPlanData) => {
      if (!svgRoot || !Array.isArray(staves) || !Array.isArray(repeatPlanData)) return;
      repeatPlanData.forEach((info, barIndex) => {
        if (!info || info.type !== "2") return;
        const leftStave = staves[barIndex];
        const rightStave = staves[barIndex + 1];
        if (!leftStave || !rightStave) return;
        const centerX = (Number(leftStave.getX?.()) || 0) + (Number(leftStave.getWidth?.()) || 0);
        const repeatPoint = 40;
        const repeatWidth = Flow.Glyph.getWidth("repeat2Bars", repeatPoint, "repeatNote");
        const signY =
          ((Number(leftStave.getYForLine?.(1)) || 0) + (Number(leftStave.getYForLine?.(3)) || 0)) / 2 + 0.5;
        try {
          Flow.Glyph.renderGlyph(ctx, centerX - repeatWidth / 2, signY, repeatPoint, "repeat2Bars", {
            category: "repeatNote",
          });
        } catch (_) {}
        try {
          const numberPoint = 28;
          const numberWidth = Flow.Glyph.getWidth("timeSig2", numberPoint);
          const numberY = (Number(leftStave.getYForLine?.(0)) || 0) - 18;
          Flow.Glyph.renderGlyph(ctx, centerX - numberWidth / 2, numberY, numberPoint, "timeSig2");
        } catch (_) {}
      });
    };
    const attachDot = (note) => {
      // VexFlow API differs between versions. Prefer the modern Dot helper if available.
      if (note && typeof note.addDotToAll === "function") {
        note.addDotToAll();
        return;
      }
      if (Flow.Dot && typeof Flow.Dot.buildAndAttach === "function") {
        Flow.Dot.buildAndAttach([note], { all: true });
        return;
      }
      // Fallback: attach a Dot modifier to each key.
      try {
        const keys = note.getKeys ? note.getKeys() : note.keys || [];
        for (let i = 0; i < keys.length; i++) {
          note.addModifier(new Flow.Dot(), i);
        }
      } catch (e) {
        // ignore
      }
    };
    const createRepeatVoice = (repeatInfo) => {
      const tickables = [];
      if (repeatInfo?.type && repeatInfo.type !== "follower") {
        if (repeatInfo.type === "2") {
          tickables.push(new Flow.GhostNote("q"));
          tickables.push(new Flow.GhostNote("q"));
        } else {
        tickables.push(new Flow.RepeatNote(repeatInfo.type));
        for (let i = 0; i < (repeatInfo.followers || 0); i++) {
          tickables.push(new Flow.GhostNote("q"));
        }
        }
      } else {
        tickables.push(new Flow.GhostNote("q"));
      }
      const voice = new Voice({ num_beats: timeSig.n, beat_value: timeSig.d });
      voice.setStrict(false);
      voice.addTickables(tickables);
      return voice;
    };

    const applyGhostStyling = (note, ghostKeyIndices) => {
      if (!note || !ghostKeyIndices || ghostKeyIndices.length === 0) return;
      note.__dgHasGhost = true;

      // Use custom small SMuFL glyphs via keyProps so the override survives notehead rebuilds.
      try {
        const keyProps = (typeof note.getKeyProps === "function" && note.getKeyProps()) || [];
        let changed = false;
        ghostKeyIndices.forEach((i) => {
          const kp = keyProps?.[i];
          if (!kp) return;
          const code = String(kp.code || "");
          let target = CUSTOM_GHOST_GLYPHS.black;
          if (code.includes("CircleX")) target = CUSTOM_GHOST_GLYPHS.circleX;
          else if (code.includes("X")) target = CUSTOM_GHOST_GLYPHS.x;
          if (kp.code !== target) {
            kp.code = target;
            changed = true;
          }
        });
        if (changed && typeof note.reset === "function") note.reset();
      } catch (_) {}
    };
    const applyGhostStemOverride = (note, ghostKeyIndices) => {
      if (!note || !ghostKeyIndices || ghostKeyIndices.length === 0) return;
      try {
        // Stabilize ghost stem geometry when custom notehead metrics differ.
        // Value is in px and intentionally close to VexFlow default stem size.
        if (typeof note.setStemLength === "function") note.setStemLength(35);
      } catch (_) {}
    };
    const applySpecialStemOverride = (note) => {
      if (!note || typeof note.getKeys !== "function") return;
      try {
        const keys = note.getKeys() || [];
        if (!Array.isArray(keys) || keys.length === 0) return;
        const hasFoot = keys.includes("d/4/x2");
        const hasRideBell = keys.includes("f/5/d2");
        const hasChina = keys.includes("a/5/x3");
        const hasCowbell = keys.includes("e/5/t2");
        if (!hasFoot || (!hasRideBell && !hasChina && !hasCowbell)) return;
        note.__dgStemUpBaseOffset = hasCowbell ? -16 : hasRideBell ? -5 : -15;
        note.__dgStemUpBaseOffsetStandalone = hasCowbell ? -5 : hasRideBell ? -5 : -5;
      } catch (_) {}
    };
    const finalizeSpecialStemOverridesForVoice = (voice) => {
      const tickables = (voice && typeof voice.getTickables === "function" && voice.getTickables()) || [];
      tickables.forEach((note) => {
        try {
          const baseLift = Number(note?.__dgStemUpBaseOffset);
          const standaloneBaseLift = Number(note?.__dgStemUpBaseOffsetStandalone);
          if (!Number.isFinite(baseLift) || typeof note.getStem !== "function") return;
          const stem = note.getStem();
          if (!stem || typeof stem.setOptions !== "function") return;
          const keys = (typeof note.getKeys === "function" && note.getKeys()) || [];
          const isBeamed =
            !!note?.beam ||
            (typeof note?.getBeam === "function" && !!note.getBeam()) ||
            !!note?.__dgIsBeamed;
          const currentUpOffset = Number(stem.stem_up_y_offset) || 0;
          const currentDownOffset = Number(stem.stem_down_y_offset) || 0;
          const currentDownBaseOffset = Number(stem.stem_down_y_base_offset) || 0;
          const resolvedBaseLift =
            !isBeamed && Number.isFinite(standaloneBaseLift) ? standaloneBaseLift : baseLift;
          stem.setOptions({
            stem_up_y_offset: currentUpOffset,
            stem_down_y_offset: currentDownOffset,
            stem_up_y_base_offset: resolvedBaseLift,
            stem_down_y_base_offset: currentDownBaseOffset,
          });
          if (
            Array.isArray(keys) &&
            keys.includes("e/5/t2") &&
            !isBeamed &&
            typeof note.setStemLength === "function"
          ) {
            note.setStemLength(37);
          }
        } catch (_) {}
      });
    };
    const applyAccentArticulation = (note, accentKeyIndices) => {
      if (!note || !accentKeyIndices || accentKeyIndices.length === 0) return;
      try {
        const art = new Flow.Articulation("a>");
        art.setPosition(Flow.Modifier.Position.ABOVE);
        if (art?.render_options && Number.isFinite(art.render_options.font_scale)) {
          art.render_options.font_scale = art.render_options.font_scale * 0.88;
          if (typeof art.reset === "function") art.reset();
        }
        if (typeof art.setXShift === "function") art.setXShift(2);
        note.addModifier(art, 0);
      } catch (_) {}
    };
    const getStickingSpecForStep = (stepIdx) => {
      const barIndex = getBarIndexForStep(stepIdx);
      const sourceStepIdx =
        Array.isArray(renderStepSourceIndexMap) && Number.isFinite(renderStepSourceIndexMap[stepIdx])
          ? Number(renderStepSourceIndexMap[stepIdx])
          : stepIdx;
      const effectiveShowNotationSticking = getEffectiveBarBoolean(
        showNotationStickingByBar,
        barIndex,
        showNotationSticking
      );
      if (!effectiveShowNotationSticking) return [];
      const map = stickingAssignmentsByStep?.[sourceStepIdx];
      if (!map || typeof map !== "object") return [];
      const entries = Object.entries(map).filter(([instId, hand]) => {
        if (hand !== "L" && hand !== "R") return false;
        if (!notationStickingSelection) return true;
        return notationStickingSelection[`${instId}:${sourceStepIdx}`] === true;
      });
      if (!entries.length) return [];
      const hands = entries.map(([, hand]) => hand);
      if (!hands.length) return [];
      const hasR = hands.includes("R");
      const hasL = hands.includes("L");
      const splitTop = { text: "R", lane: "top" };
      const splitBottom = { text: "L", lane: "bottom" };
      if (notationStickingView === "split-rows") {
        const out = [];
        if (hasR) out.push(splitTop);
        if (hasL) out.push(splitBottom);
        return out;
      }
      // "stacked" view: only stack when both hands are present at this step.
      if (hasR && hasL) return [{ text: "R", lane: "top" }, { text: "L", lane: "bottom" }];
      if (hasR) return [{ text: "R", lane: "top" }];
      return [{ text: "L", lane: "top" }];
    };
    const applyStickingAnnotation = (note, specList, stepIdx = -1) => {
      if (!note || !Array.isArray(specList) || specList.length < 1) return;
      // Draw after voice rendering; this avoids Annotation layout quirks.
      note.__dgStickingSpec = specList;
      note.__dgStickingStep = stepIdx;
    };
    const drawStickingSpecsForVoice = (voice, svgRoot) => {
      if (!svgRoot) return;
      const tickables = (voice && typeof voice.getTickables === "function" && voice.getTickables()) || [];
      tickables.forEach((note) => {
        const specList = note?.__dgStickingSpec;
        if (!Array.isArray(specList) || specList.length < 1) return;
        const stave = note.getStave?.();
        const absX = Number(note.getAbsoluteX?.()) || 0;
        const headBegin = Number(note.getNoteHeadBeginX?.());
        const headEnd = Number(note.getNoteHeadEndX?.());
        const x =
          Number.isFinite(headBegin) && Number.isFinite(headEnd) && headEnd > headBegin
            ? (headBegin + headEnd) / 2
            : absX;
        // Keep two fixed rows, visually aligned closer to noteheads.
        const yTop = (stave?.getYForBottomText?.(1) ?? 143) - 3;
        const yBottom = stave?.getYForBottomText?.(2) ?? 156;
        specList.forEach((spec) => {
          const txt = String(spec?.text || "");
          if (!txt) return;
          const lane = String(spec?.lane || "stackSingle");
          const y = (lane === "bottom" ? yBottom : yTop) + 8;
          const xNudge = txt === "L" && lane === "bottom" ? -1.00 : 0;
          const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
          textEl.setAttribute("x", String(x + xNudge));
          textEl.setAttribute("y", String(y));
          textEl.setAttribute("fill", notationColor);
          textEl.setAttribute("font-family", "Arial");
          textEl.setAttribute("font-size", "12");
          textEl.setAttribute("font-weight", "400");
          textEl.setAttribute("text-anchor", "middle");
          textEl.setAttribute("class", "dg-sticking");
          textEl.textContent = txt;
          svgRoot.appendChild(textEl);
        });
      });
    };

    const applyCircledXLargeStyling = (note, keyIndices) => {
      if (!note || !keyIndices || keyIndices.length === 0) return;
      try {
        const keyProps = (typeof note.getKeyProps === "function" && note.getKeyProps()) || [];
        let changed = false;
        keyIndices.forEach((i) => {
          const kp = keyProps?.[i];
          if (!kp) return;
          if (kp.code !== CUSTOM_CIRCLED_X_LARGE_GLYPH) {
            kp.code = CUSTOM_CIRCLED_X_LARGE_GLYPH;
            changed = true;
          }
        });
        if (changed && typeof note.reset === "function") note.reset();
      } catch (_) {}
    };
    const applyTupletEdgeInsetDraw = (tuplet) => {
      if (!tuplet || tuplet.__dgInsetPatched) return;
      tuplet.__dgInsetPatched = true;
      const originalDraw = tuplet.draw.bind(tuplet);
      tuplet.draw = function drawTupletWithInset() {
        const inset = Math.max(0, Number(this.options?.edge_inset) || 0);
        if (!this.bracketed || inset <= 0 || !Array.isArray(this.notes) || this.notes.length < 2) {
          return originalDraw();
        }

        const first = this.notes[0];
        const last = this.notes[this.notes.length - 1];
        const origLeft = first.getTieLeftX?.bind(first);
        const origRight = last.getTieRightX?.bind(last);
        if (!origLeft || !origRight) return originalDraw();

        first.getTieLeftX = () => origLeft() + inset;
        last.getTieRightX = () => origRight() - inset;
        try {
          return originalDraw();
        } finally {
          first.getTieLeftX = origLeft;
          last.getTieRightX = origRight;
        }
      };
    };
;

    if (!ref.current) return;

    const quarterCount = Math.max(1, Number(timeSig?.n) || 1);
    const baseSubdivPerQuarter = Math.max(1, Math.round(resolution / Math.max(1, Number(timeSig?.d) || 4)));
    const beatValue = Math.max(1, Number(timeSig?.d) || 4);
    const resolvedTimeSigByBar =
      Array.isArray(timeSigByBar) && timeSigByBar.length === bars
        ? timeSigByBar.map((ts) => ({
            n: Math.max(1, Number(ts?.n) || 4),
            d: Math.max(1, Number(ts?.d) || 4),
          }))
        : Array.from({ length: bars }, () => ({
            n: Math.max(1, Number(timeSig?.n) || 4),
            d: Math.max(1, Number(timeSig?.d) || 4),
          }));
    const hasVariableTimeSig = resolvedTimeSigByBar.some(
      (ts, idx) =>
        idx > 0 &&
        (Number(ts?.n) !== Number(resolvedTimeSigByBar[idx - 1]?.n) ||
          Number(ts?.d) !== Number(resolvedTimeSigByBar[idx - 1]?.d))
    );
    const resolvedQuarterSubsByBar =
      Array.isArray(quarterSubdivisionsByBar) && quarterSubdivisionsByBar.length === bars
        ? quarterSubdivisionsByBar.map((row, barIndex) => {
            const barTimeSig = resolvedTimeSigByBar[barIndex] || timeSig || { n: 4, d: 4 };
            const barQuarterCount = Math.max(1, Number(barTimeSig?.n) || 1);
            const barBaseSubdivPerQuarter = Math.max(
              1,
              Math.round(resolution / Math.max(1, Number(barTimeSig?.d) || 4))
            );
            return Array.from(
              { length: barQuarterCount },
              (_, i) => Math.max(1, Number(row?.[i]) || barBaseSubdivPerQuarter)
            );
          })
        : Array.from({ length: bars }, (_, barIndex) => {
            const barTimeSig = resolvedTimeSigByBar[barIndex] || timeSig || { n: 4, d: 4 };
            const barQuarterCount = Math.max(1, Number(barTimeSig?.n) || 1);
            const barBaseSubdivPerQuarter = Math.max(
              1,
              Math.round(resolution / Math.max(1, Number(barTimeSig?.d) || 4))
            );
            return Array.from({ length: barQuarterCount }, () => barBaseSubdivPerQuarter);
          });

    const resolvedStepOffsets =
      Array.isArray(barStepOffsets) && barStepOffsets.length === bars + 1
        ? barStepOffsets
        : (() => {
            const out = [0];
            for (let b = 0; b < bars; b++) {
              const steps = resolvedQuarterSubsByBar[b].reduce((sum, n) => sum + Math.max(1, Number(n) || 1), 0);
              out.push(out[b] + steps);
            }
            return out;
          })();
    const straightOnlyMixedStandardState = (() => {
      if (hasVariableTimeSig) return null;
      if (!resolvedQuarterSubsByBar.some((row) => row.some((n) => Math.max(1, Number(n) || 1) !== baseSubdivPerQuarter))) {
        return null;
      }
      if (!resolvedQuarterSubsByBar.every((row) => row.every((n) => isPowerOfTwoSubdivision(n)))) {
        return null;
      }
      const maxSubdivPerQuarter = resolvedQuarterSubsByBar.reduce(
        (max, row) => Math.max(max, ...row.map((n) => Math.max(1, Number(n) || 1))),
        baseSubdivPerQuarter
      );
      const expandedResolution = beatValue * maxSubdivPerQuarter;
      if (![4, 8, 16, 32].includes(expandedResolution)) return null;
      const uniformQuarterSubsByBar = resolvedQuarterSubsByBar.map((row) => row.map(() => maxSubdivPerQuarter));
      const uniformBarStepOffsets = [0];
      for (let b = 0; b < bars; b++) {
        const stepsInBar = uniformQuarterSubsByBar[b].reduce((sum, value) => sum + Math.max(1, Number(value) || 1), 0);
        uniformBarStepOffsets.push(uniformBarStepOffsets[b] + stepsInBar);
      }
      const expandedStepSourceIndexMap = Array(
        Math.max(0, Number(uniformBarStepOffsets[uniformBarStepOffsets.length - 1] ?? 0))
      ).fill(null);
      const expandedGrid = {};
      instruments.forEach((inst) => {
        expandedGrid[inst.id] = Array(uniformBarStepOffsets[uniformBarStepOffsets.length - 1] || 0).fill(CELL.OFF);
      });
      const sourceToTargetIndexMap = Array(
        Math.max(0, Number(resolvedStepOffsets[resolvedStepOffsets.length - 1] ?? 0))
      ).fill(null);
      for (let b = 0; b < bars; b++) {
        const sourceBarStart = resolvedStepOffsets[b] ?? 0;
        const targetBarStart = uniformBarStepOffsets[b] ?? 0;
        let sourceQuarterOffset = 0;
        for (let q = 0; q < resolvedQuarterSubsByBar[b].length; q++) {
          const sourceSubdiv = Math.max(1, Number(resolvedQuarterSubsByBar[b][q]) || 1);
          const targetFactor = Math.max(1, Math.round(maxSubdivPerQuarter / sourceSubdiv));
          for (let sub = 0; sub < sourceSubdiv; sub++) {
            const sourceIndex = sourceBarStart + sourceQuarterOffset + sub;
            const targetIndex = targetBarStart + q * maxSubdivPerQuarter + sub * targetFactor;
            expandedStepSourceIndexMap[targetIndex] = sourceIndex;
            sourceToTargetIndexMap[sourceIndex] = targetIndex;
          }
          sourceQuarterOffset += sourceSubdiv;
        }
      }
      instruments.forEach((inst) => {
        const sourceRow = grid[inst.id] || [];
        const targetRow = expandedGrid[inst.id];
        for (let sourceIndex = 0; sourceIndex < sourceRow.length; sourceIndex++) {
          const value = sourceRow[sourceIndex] ?? CELL.OFF;
          if (value === CELL.OFF) continue;
          const targetIndex = sourceToTargetIndexMap[sourceIndex];
          if (targetIndex == null) continue;
          targetRow[targetIndex] = value;
        }
      });
      return {
        grid: expandedGrid,
        resolution: expandedResolution,
        stepsPerBar: resolvedTimeSigByBar[0].n * maxSubdivPerQuarter,
        quarterSubdivisionsByBar: uniformQuarterSubsByBar,
        barStepOffsets: uniformBarStepOffsets,
        stepSourceIndexMap: expandedStepSourceIndexMap,
      };
    })();
    const renderGrid = straightOnlyMixedStandardState?.grid || grid;
    const renderResolution = straightOnlyMixedStandardState?.resolution || resolution;
    const renderStepsPerBar = straightOnlyMixedStandardState?.stepsPerBar || stepsPerBar;
    const renderQuarterSubsByBar = straightOnlyMixedStandardState?.quarterSubdivisionsByBar || resolvedQuarterSubsByBar;
    const renderBarStepOffsets = straightOnlyMixedStandardState?.barStepOffsets || resolvedStepOffsets;
    const renderStepSourceIndexMap = straightOnlyMixedStandardState?.stepSourceIndexMap || null;
    const hasTuplets =
      hasVariableTimeSig ||
      (!straightOnlyMixedStandardState &&
        resolvedQuarterSubsByBar.some((row) =>
          row.some((n) => Math.max(1, Number(n) || 1) !== baseSubdivPerQuarter)
        ));

    if (hasTuplets) {
      const shouldShowTupletBracket = (count) => {
        const normalized = Math.max(1, Math.round(Number(count) || 1));
        return normalized > 1 && (normalized & (normalized - 1)) !== 0;
      };
      const tupletDisplayBase = (subdiv) => {
        const s = Math.max(1, Number(subdiv) || 1);
        // Keep tuplet note values stable across global resolution changes:
        // 3->2 (eighth-triplet), 5/6/7->4 (sixteenth-based), 9->8 (thirty-second-based), etc.
        let base = 1;
        while (base * 2 <= s) base *= 2;
        return Math.max(1, Math.min(8, base));
      };
      const durationFromBase = (displayBase) => {
        const base = Math.max(1, Number(displayBase) || 1);
        const denom = Math.max(1, beatValue * base);
        if (denom === 4) return "q";
        return String(denom);
      };
      const durationFromLen = (lenSteps, baseStepsPerQuarter) => {
        const base = Math.max(1, Number(baseStepsPerQuarter) || 1);
        const len = Math.max(1, Math.min(base, Number(lenSteps) || 1));
        const ratio = base / len;
        const denom = beatValue * ratio;
        if (denom === 4) return "q";
        return String(denom);
      };

      const naturalBarWidths = Array.from({ length: bars }, (_, b) =>
        getRepeatAwareBarDemand(b, estimateNotationBarWidthDemand({
        grid: renderGrid,
        barStartStep: renderBarStepOffsets[b] ?? 0,
        barEndStep: renderBarStepOffsets[b + 1] ?? renderBarStepOffsets[b] ?? 0,
        quarterSubdivisions: renderQuarterSubsByBar[b],
          minWidth: 130,
          leadingWidthExtra: (rowStartSet.has(b) ? 30 : 0) + (b === 0 ? 48 : 0),
          spacingPreset: getSpacingPresetForBar(b),
        }))
      );
      const rows = resolvedRowBarCounts.length;
      const systemHeight = 108;
      const height = 47 + rows * systemHeight;
      const naturalRowWidths = Array.from({ length: rows }, (_, rowIdx) => {
        const start = rowStartBars[rowIdx] ?? 0;
        const end = Math.min(bars, start + (resolvedRowBarCounts[rowIdx] || 0));
        let sum = 0;
        for (let b = start; b < end; b++) sum += naturalBarWidths[b];
        return sum;
      });
      const targetRowWidth =
        Number.isFinite(Number(targetContentWidth)) && Number(targetContentWidth) > 200
          ? Math.round(Number(targetContentWidth))
          : (naturalRowWidths.length ? Math.max(...naturalRowWidths) : 0);
      const rowWidths = naturalRowWidths.map((w, rowIdx) => {
        if (!justifySystems) return w;
        const start = rowStartBars[rowIdx] ?? 0;
        const end = Math.min(bars, start + (resolvedRowBarCounts[rowIdx] || 0));
        const barsInRow = Math.max(1, end - start);
        return Math.max(80 * barsInRow, targetRowWidth);
      });
      const barWidths = Array(bars).fill(0);
      for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
        const start = rowStartBars[rowIdx] ?? 0;
        const end = Math.min(bars, start + (resolvedRowBarCounts[rowIdx] || 0));
        const nat = Math.max(1, naturalRowWidths[rowIdx] || 1);
        const dst = Math.max(1, rowWidths[rowIdx] || nat);
        let consumed = 0;
        for (let b = start; b < end; b++) {
          if (b === end - 1) {
            barWidths[b] = Math.max(80, dst - consumed);
          } else {
            const scaled = Math.max(80, Math.round((naturalBarWidths[b] / nat) * dst));
            barWidths[b] = scaled;
            consumed += scaled;
          }
        }
      }
      const width = 20 + (rowWidths.length ? Math.max(...rowWidths) : 0);

      ref.current.innerHTML = "";
      const renderer = new Renderer(ref.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      ctx = renderer.getContext();
      const svgRoot = ref.current.querySelector("svg");
      if (svgRoot instanceof SVGElement) {
        svgRoot.style.overflow = "visible";
        svgRoot.setAttribute("overflow", "visible");
      }

      const staves = [];
      const voices = [];
      const beamsByBar = Array.from({ length: bars }, () => []);
      const tupletsByBar = Array.from({ length: bars }, () => []);

      for (let b = 0; b < bars; b++) {
        const barTimeSig = resolvedTimeSigByBar[b] || timeSig || { n: 4, d: 4 };
        const effectiveMergeRests = getEffectiveBarBoolean(mergeRestsByBar, b, mergeRests);
        const effectiveMergeNotes = getEffectiveBarBoolean(mergeNotesByBar, b, mergeNotes);
        const effectiveDottedNotes = getEffectiveBarBoolean(dottedNotesByBar, b, dottedNotes);
        const prevBarTimeSig = b > 0 ? (resolvedTimeSigByBar[b - 1] || timeSig || { n: 4, d: 4 }) : null;
        const showBarTimeSig =
          b === 0 ||
          Number(prevBarTimeSig?.n) !== Number(barTimeSig?.n) ||
          Number(prevBarTimeSig?.d) !== Number(barTimeSig?.d);
        const row = barRowIndices[b] ?? 0;
        const col = barCols[b] ?? 0;
        const rowStartBar = rowStartBars[row] ?? 0;
        let x = 10;
        for (let bi = rowStartBar; bi < rowStartBar + col; bi++) {
          if (bi >= bars) break;
          x += barWidths[bi];
        }
          const y = 27.5 + row * systemHeight;
        const stave = new Stave(x, y, barWidths[b]);
        if (col > 0) stave.setBegBarType(Barline.type.NONE);
        if (col === 0) {
          stave.addClef("percussion");
        }
        if (showBarTimeSig) stave.addTimeSignature(`${barTimeSig.n}/${barTimeSig.d}`);
        stave.setContext(ctx).draw();
        staves.push(stave);

        const repeatInfo = repeatPlan[b];
        if (repeatInfo) {
          voices.push(createRepeatVoice(repeatInfo));
          beamsByBar[b] = [];
          tupletsByBar[b] = [];
          continue;
        }

        const notes = [];
        const beamBuckets = [];
        const tuplets = [];
        const barStart = resolvedStepOffsets[b] ?? 0;
        const barSubs = resolvedQuarterSubsByBar[b] || [];
        let localStep = 0;

        for (let q = 0; q < barSubs.length; q++) {
          const subdiv = Math.max(1, Number(barSubs[q]) || 1);
          const tupletQuarter = !isPowerOfTwoSubdivision(subdiv);
          const barBaseSubdivPerQuarter = Math.max(
            1,
            Math.round(resolution / Math.max(1, Number(barTimeSig?.d) || 4))
          );
          const quarterDisplayBase = tupletQuarter ? tupletDisplayBase(subdiv) : subdiv;
          const quarterNotes = [];
          const quarterBeamBucket = [];
          const stepData = [];
          for (let sub = 0; sub < subdiv; sub++) {
            const globalIdx = barStart + localStep + sub;
            const keys = [];
            const ghostKeyIndices = [];
            const circledXLargeKeyIndices = [];
            const accentKeyIndices = [];
            instruments.forEach((inst) => {
              const val = grid[inst.id]?.[globalIdx] ?? CELL.OFF;
              if (val === CELL.OFF) return;
              const notation = NOTATION_MAP[inst.id];
              if (!notation) return;
              keys.push(notation.key);
              const keyIndex = keys.length - 1;
              if (val === CELL.GHOST && GHOST_NOTATION_ENABLED.has(inst.id)) ghostKeyIndices.push(keyIndex);
              if (val === CELL.ACCENT) accentKeyIndices.push(keyIndex);
              if (inst.id === "china" || inst.id === "hihatOpen") circledXLargeKeyIndices.push(keyIndex);
            });
            const stickingSpec = getStickingSpecForStep(globalIdx);
            stepData.push({ keys, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec, globalIdx });
          }

          const mergeBaseStepsPerQuarter = isPowerOfTwoSubdivision(subdiv) ? subdiv : barBaseSubdivPerQuarter;
          const canUseMergedQuarterLogic = isPowerOfTwoSubdivision(subdiv) && (effectiveMergeNotes || effectiveMergeRests);
          if (canUseMergedQuarterLogic) {
            let sub = 0;
            while (sub < subdiv) {
              const entry = stepData[sub];
              if (entry.keys.length > 0) {
                if (
                  mergeBaseStepsPerQuarter === 4 &&
                  sub === 0 &&
                  stepData[0]?.keys.length &&
                  stepData[1]?.keys.length &&
                  !(stepData[2]?.keys.length) &&
                  stepData[3]?.keys.length
                ) {
                  const note16a = new StaveNote({
                    keys: stepData[0].keys,
                    duration: "16",
                    clef: "percussion",
                  });
                  note16a.setStemDirection(1);
                  applyGhostStyling(note16a, stepData[0].ghostKeyIndices);
                  applyGhostStemOverride(note16a, stepData[0].ghostKeyIndices);
                  applySpecialStemOverride(note16a);
                  applyCircledXLargeStyling(note16a, stepData[0].circledXLargeKeyIndices);
                  applyAccentArticulation(note16a, stepData[0].accentKeyIndices);
                  applyStickingAnnotation(note16a, stepData[0].stickingSpec, stepData[0].globalIdx);
                  note16a.__dgIsBeamed = false;
                  notes.push(note16a);
                  quarterNotes.push(note16a);
                  quarterBeamBucket.push(note16a);

                  const note8 = new StaveNote({
                    keys: stepData[1].keys,
                    duration: "8",
                    clef: "percussion",
                  });
                  note8.setStemDirection(1);
                  applyGhostStyling(note8, stepData[1].ghostKeyIndices);
                  applyGhostStemOverride(note8, stepData[1].ghostKeyIndices);
                  applySpecialStemOverride(note8);
                  applyCircledXLargeStyling(note8, stepData[1].circledXLargeKeyIndices);
                  applyAccentArticulation(note8, stepData[1].accentKeyIndices);
                  applyStickingAnnotation(note8, stepData[1].stickingSpec, stepData[1].globalIdx);
                  note8.__dgIsBeamed = false;
                  notes.push(note8);
                  quarterNotes.push(note8);
                  quarterBeamBucket.push(note8);

                  const note16b = new StaveNote({
                    keys: stepData[3].keys,
                    duration: "16",
                    clef: "percussion",
                  });
                  note16b.setStemDirection(1);
                  applyGhostStyling(note16b, stepData[3].ghostKeyIndices);
                  applyGhostStemOverride(note16b, stepData[3].ghostKeyIndices);
                  applySpecialStemOverride(note16b);
                  applyCircledXLargeStyling(note16b, stepData[3].circledXLargeKeyIndices);
                  applyAccentArticulation(note16b, stepData[3].accentKeyIndices);
                  applyStickingAnnotation(note16b, stepData[3].stickingSpec, stepData[3].globalIdx);
                  note16b.__dgIsBeamed = false;
                  notes.push(note16b);
                  quarterNotes.push(note16b);
                  quarterBeamBucket.push(note16b);

                  sub += 4;
                  continue;
                }
                let len = 1;
                if (effectiveMergeNotes) {
                  const canLen = (candidateLen) => {
                    if (candidateLen < 1) return false;
                    const requiresBeatAlignedStart =
                      candidateLen >= 2 || mergeBaseStepsPerQuarter <= 2;
                    if (requiresBeatAlignedStart && sub % candidateLen !== 0) return false;
                    if (sub + candidateLen > subdiv) return false;
                    for (let k = 1; k < candidateLen; k++) {
                      if (stepData[sub + k]?.keys.length) return false;
                    }
                    return true;
                  };
                  for (let p = mergeBaseStepsPerQuarter; p >= 1; p = Math.floor(p / 2)) {
                    if (canLen(p)) {
                      len = p;
                      break;
                    }
                  }
                }
                let dotted = false;
                if (effectiveMergeNotes && effectiveDottedNotes && len >= 2) {
                  const extra = len / 2;
                  if (sub + len + extra <= subdiv) {
                    dotted = true;
                    for (let k = 0; k < extra; k++) {
                      if (stepData[sub + len + k]?.keys.length) {
                        dotted = false;
                        break;
                      }
                    }
                  }
                }

                const note = new StaveNote({
                  keys: entry.keys,
                  duration: durationFromLen(len, mergeBaseStepsPerQuarter),
                  clef: "percussion",
                });
                note.setStemDirection(1);
                if (dotted) attachDot(note);
                applyGhostStyling(note, entry.ghostKeyIndices);
                applyGhostStemOverride(note, entry.ghostKeyIndices);
                applySpecialStemOverride(note);
                applyCircledXLargeStyling(note, entry.circledXLargeKeyIndices);
                applyAccentArticulation(note, entry.accentKeyIndices);
                applyStickingAnnotation(note, entry.stickingSpec, entry.globalIdx);
                note.__dgIsBeamed = false;
                notes.push(note);
                quarterNotes.push(note);
                quarterBeamBucket.push(note);
                sub += dotted ? len + len / 2 : len;
                continue;
              }

              if (!effectiveMergeRests) {
                const rest = new StaveNote({
                  keys: ["b/4"],
                  duration: `${durationFromBase(quarterDisplayBase)}r`,
                  clef: "percussion",
                });
                notes.push(rest);
                quarterNotes.push(rest);
                sub += 1;
                continue;
              }

              let remain = subdiv - sub;
              let chunk = 1;
              for (let p = mergeBaseStepsPerQuarter; p >= 1; p = Math.floor(p / 2)) {
                if (p > remain || sub % p !== 0) continue;
                let canUseChunk = true;
                for (let k = 1; k < p; k++) {
                  if (stepData[sub + k]?.keys.length) {
                    canUseChunk = false;
                    break;
                  }
                }
                if (canUseChunk) {
                  chunk = p;
                  break;
                }
              }
              const restDur = `${durationFromLen(chunk, mergeBaseStepsPerQuarter)}r`;
              const rest = new StaveNote({ keys: ["b/4"], duration: restDur, clef: "percussion" });
              notes.push(rest);
              quarterNotes.push(rest);
              if (chunk === 1) {
                const hasHitBefore = stepData.slice(0, sub).some((item) => (item?.keys?.length || 0) > 0);
                const hasHitAfter = stepData.slice(sub + chunk).some((item) => (item?.keys?.length || 0) > 0);
                if (hasHitBefore && hasHitAfter) {
                  rest.__dgBeamRest = true;
                  quarterBeamBucket.push(rest);
                }
              }
              sub += chunk;
            }
          } else {
            for (let sub = 0; sub < subdiv; sub++) {
              const entry = stepData[sub];
              const note = entry.keys.length
                ? new StaveNote({ keys: entry.keys, duration: durationFromBase(quarterDisplayBase), clef: "percussion" })
                : new StaveNote({ keys: ["b/4"], duration: `${durationFromBase(quarterDisplayBase)}r`, clef: "percussion" });
              if (entry.keys.length) note.setStemDirection(1);
              applyGhostStyling(note, entry.ghostKeyIndices);
              applyGhostStemOverride(note, entry.ghostKeyIndices);
              applySpecialStemOverride(note);
              applyCircledXLargeStyling(note, entry.circledXLargeKeyIndices);
              applyAccentArticulation(note, entry.accentKeyIndices);
              applyStickingAnnotation(note, entry.stickingSpec, entry.globalIdx);
              note.__dgIsBeamed = false;
              notes.push(note);
              quarterNotes.push(note);
              if (entry.keys.length) quarterBeamBucket.push(note);
            }
          }

          beamBuckets.push(quarterBeamBucket);
          if (
            subdiv !== baseSubdivPerQuarter &&
            quarterNotes.length > 1 &&
            shouldShowTupletBracket(subdiv)
          ) {
            try {
              const t = new Vex.Flow.Tuplet(quarterNotes, {
                num_notes: subdiv,
                notes_occupied: quarterDisplayBase,
                bracketed: true,
                ratioed: false,
                y_offset: subdiv === 6 ? -6 : 0,
                edge_inset: 1.5,
              });
              applyTupletEdgeInsetDraw(t);
              tuplets.push(t);
            } catch (_) {}
          }
          localStep += subdiv;
        }

        const voice = new Voice({ num_beats: barTimeSig.n, beat_value: barTimeSig.d });
        voice.setStrict(false);
        voice.addTickables(notes);
        voices.push(voice);

        try {
          const quarterBeams = [];
          beamBuckets.forEach((bucket) => {
            if (!bucket.length) return;
            const beams = Beam.generateBeams(bucket, {
              groups: [new Fraction(1, Math.max(1, Number(barTimeSig?.d) || 4))],
              stem_direction: 1,
              beam_rests: bucket.some((note) => note?.__dgBeamRest === true),
              flat_beams: !!flatBeams,
            });
            beams.forEach((beam) => {
              const beamNotes = (typeof beam.getNotes === "function" ? beam.getNotes() : beam.notes) || [];
              beamNotes.forEach((n) => {
                n.__dgIsBeamed = beamNotes.length > 1;
              });
            });
            quarterBeams.push(...beams);
          });
          beamsByBar[b] = quarterBeams;
        } catch (_) {
          beamsByBar[b] = [];
        }
        tupletsByBar[b] = tuplets;
      }

      for (let b = 0; b < bars; b++) {
        const formatter = new Formatter().joinVoices([voices[b]]);
        formatter.formatToStave([voices[b]], staves[b]);
        finalizeSpecialStemOverridesForVoice(voices[b]);
        voices[b].draw(ctx, staves[b]);
        drawStickingSpecsForVoice(voices[b], svgRoot);
        (beamsByBar[b] || []).forEach((beam) => {
          try {
            const beamNotes = (typeof beam.getNotes === "function" ? beam.getNotes() : beam.notes) || [];
            const ghostNotes = beamNotes.filter(
              (n) => !!n?.__dgHasGhost && typeof n.getStemLength === "function" && typeof n.setStemLength === "function"
            );
            if (ghostNotes.length) {
              const targetStem = Math.max(
                ...beamNotes.map((n) => (typeof n?.getStemLength === "function" ? n.getStemLength() : 0))
              );
              if (targetStem > 0) {
                ghostNotes.forEach((n) => n.setStemLength(targetStem));
                beam.postFormatted = false;
                beam.postFormat?.();
              }
            }
          } catch (_) {}
          beam.setContext(ctx).draw();
        });
        (tupletsByBar[b] || []).forEach((tuplet) => {
          try { tuplet.setContext(ctx).draw(); } catch (_) {}
        });
      }
      drawArrangementTextMarkers(svgRoot, staves);
      const svg = ref.current.querySelector("svg");
      if (svg) {
        drawTwoBarRepeatMarkers(svg, staves, repeatPlan);
        svg.style.background = "transparent";
        svg.querySelectorAll("path, line, rect, circle").forEach((el) => {
          el.setAttribute("stroke", notationColor);
          el.setAttribute("fill", notationColor);
        });
        svg.querySelectorAll("text").forEach((el) => {
          el.setAttribute("fill", notationColor);
        });
        highlightSvgRef.current = svg;
        const highlightRects = staves.map((stave) => {
          const x = Number(stave?.getX?.()) || 0;
          const width = Number(stave?.getWidth?.()) || 0;
          const yTop = Number(stave?.getYForLine?.(0)) || 0;
          const yBottom = Number(stave?.getYForLine?.(4)) || 0;
          return {
            x: x + 1,
            y: yTop - 22,
            width: Math.max(0, width - 2),
            height: Math.max(40, (yBottom - yTop) + 44),
          };
        });
        highlightRectsRef.current = highlightRects;
        drawNotationBarOverlay(svg, highlightRects, selectedBarIndices, {
          className: "dg-selected-bar",
          fill: "rgba(14,165,233,0.04)",
          stroke: "rgba(14,165,233,0.45)",
          strokeWidth: 1.5,
          pointerEvents: "none",
        });
        drawNotationBarOverlay(svg, highlightRects, editorBarIndices, {
          className: "dg-editor-bar",
          fill: "rgba(14,165,233,0.08)",
          stroke: "rgba(14,165,233,0.9)",
          strokeWidth: 2,
        });
        drawNotationBarOverlay(svg, highlightRects, activeBarIndices, {
          className: "dg-active-bar",
          fill: "rgba(34,211,238,0.08)",
          stroke: "rgba(34,211,238,0.7)",
          strokeWidth: 1.5,
        });
        setHitLayerVersion((v) => v + 1);
      }
      return;
    }

      // Beam grouping per bar (used for beaming and dotted-note limits)
      const beamGroupsPerBar = (() => {
        // Compound meters like 6/8, 9/8, 12/8: group in dotted quarters (3 eighths)
        if (timeSig.d === 8 && timeSig.n % 3 === 0 && timeSig.n > 3) return timeSig.n / 3;
        // Simple meters: group by beats in the numerator (e.g., 4/4 -> 4, 3/4 -> 3)
        return timeSig.n;
      })();

      // VexFlow beam grouping fraction (repeated across the bar).
      const beamGroupsFraction = (() => {
        if (timeSig.d === 8 && timeSig.n % 3 === 0 && timeSig.n > 3) return new Fraction(3, 8);
        return new Fraction(1, timeSig.d);
      })();
      const groups = [beamGroupsFraction];

    
    // Compute steps per beat from the current grid resolution.
    const stepsPerBeatBase = renderStepsPerBar / timeSig.n;

    // Prefer the simplest readable notation: if we're on a 32nd grid but no hits use odd 32nd positions,
    // engrave as 16ths to avoid unnecessary 32nd rests (keeps dotted/rest spelling stable).
    const canDownsample32to16 = false;

    const notationFactor = 1;
    const notationResolution = renderResolution;
    const stepsPerBeatN = stepsPerBeatBase;
    const stepsPerBarN = renderStepsPerBar;

    const notationGrid = renderGrid;


    
    const naturalBarWidths = Array.from({ length: bars }, (_, b) =>
      getRepeatAwareBarDemand(b, estimateNotationBarWidthDemand({
        grid: notationGrid,
        barStartStep: renderBarStepOffsets[b] ?? 0,
        barEndStep: renderBarStepOffsets[b + 1] ?? renderBarStepOffsets[b] ?? 0,
        quarterSubdivisions: renderQuarterSubsByBar[b],
        minWidth: 140,
        leadingWidthExtra: (rowStartSet.has(b) ? 30 : 0) + (b === 0 ? 48 : 0),
        spacingPreset: getSpacingPresetForBar(b),
      }))
    );
    const rows = resolvedRowBarCounts.length;
    const systemHeight = 108;
    const height = 47 + rows * systemHeight;
    const naturalRowWidths = Array.from({ length: rows }, (_, rowIdx) => {
      const start = rowStartBars[rowIdx] ?? 0;
      const end = Math.min(bars, start + (resolvedRowBarCounts[rowIdx] || 0));
      let sum = 0;
      for (let b = start; b < end; b++) sum += naturalBarWidths[b];
      return sum;
    });
    const targetRowWidth =
      Number.isFinite(Number(targetContentWidth)) && Number(targetContentWidth) > 200
        ? Math.round(Number(targetContentWidth))
        : (naturalRowWidths.length ? Math.max(...naturalRowWidths) : 0);
    const rowWidths = naturalRowWidths.map((w, rowIdx) => {
      if (!justifySystems) return w;
      const start = rowStartBars[rowIdx] ?? 0;
      const end = Math.min(bars, start + (resolvedRowBarCounts[rowIdx] || 0));
      const barsInRow = Math.max(1, end - start);
      return Math.max(80 * barsInRow, targetRowWidth);
    });
    const barWidths = Array(bars).fill(0);
    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      const start = rowStartBars[rowIdx] ?? 0;
      const end = Math.min(bars, start + (resolvedRowBarCounts[rowIdx] || 0));
      const nat = Math.max(1, naturalRowWidths[rowIdx] || 1);
      const dst = Math.max(1, rowWidths[rowIdx] || nat);
      let consumed = 0;
      for (let b = start; b < end; b++) {
        if (b === end - 1) {
          barWidths[b] = Math.max(80, dst - consumed);
        } else {
          const scaled = Math.max(80, Math.round((naturalBarWidths[b] / nat) * dst));
          barWidths[b] = scaled;
          consumed += scaled;
        }
      }
    }
    const width = 20 + (rowWidths.length ? Math.max(...rowWidths) : 0);

    ref.current.innerHTML = "";
    const renderer = new Renderer(ref.current, Renderer.Backends.SVG);
    renderer.resize(width, height);
    ctx = renderer.getContext();
    const svgRoot = ref.current.querySelector("svg");
    if (svgRoot instanceof SVGElement) {
      svgRoot.style.overflow = "visible";
      svgRoot.setAttribute("overflow", "visible");
    }

    const dur = notationResolution === 4 ? "q" : notationResolution === 8 ? "8" : notationResolution === 16 ? "16" : "32";

    const staves = [];
    const voices = [];
    const beamsByBar = Array.from({ length: bars }, () => []);
    const beamBucketsByBar = Array.from({ length: bars }, () => []);
    const createRepeatVoiceForBar = (repeatInfo, barTimeSig) => {
      const tickables = [];
      if (repeatInfo?.type && repeatInfo.type !== "follower") {
        if (repeatInfo.type === "2") {
          tickables.push(new Flow.GhostNote("q"));
          tickables.push(new Flow.GhostNote("q"));
        } else {
          tickables.push(new Flow.RepeatNote(repeatInfo.type));
          for (let i = 0; i < (repeatInfo.followers || 0); i++) {
            tickables.push(new Flow.GhostNote("q"));
          }
        }
      } else {
        tickables.push(new Flow.GhostNote("q"));
      }
      const voice = new Voice({
        num_beats: Math.max(1, Number(barTimeSig?.n) || 4),
        beat_value: Math.max(1, Number(barTimeSig?.d) || 4),
      });
      voice.setStrict(false);
      voice.addTickables(tickables);
      return voice;
    };

    for (let b = 0; b < bars; b++) {
      const barTimeSig = resolvedTimeSigByBar[b] || timeSig || { n: 4, d: 4 };
      const effectiveMergeRests = getEffectiveBarBoolean(mergeRestsByBar, b, mergeRests);
      const effectiveMergeNotes = getEffectiveBarBoolean(mergeNotesByBar, b, mergeNotes);
      const effectiveDottedNotes = getEffectiveBarBoolean(dottedNotesByBar, b, dottedNotes);
      const prevBarTimeSig = b > 0 ? (resolvedTimeSigByBar[b - 1] || timeSig || { n: 4, d: 4 }) : null;
      const showBarTimeSig =
        b === 0 ||
        Number(prevBarTimeSig?.n) !== Number(barTimeSig?.n) ||
        Number(prevBarTimeSig?.d) !== Number(barTimeSig?.d);
      const row = barRowIndices[b] ?? 0;
      const col = barCols[b] ?? 0;
      const rowStartBar = rowStartBars[row] ?? 0;
      let x = 10;
      for (let bi = rowStartBar; bi < rowStartBar + col; bi++) {
        if (bi >= bars) break;
        x += barWidths[bi];
      }
      const y = 27.5 + row * systemHeight;
      const stave = new Stave(x, y, barWidths[b]);

      // Remove repeated left barline so bars connect visually
      if (col > 0) stave.setBegBarType(Barline.type.NONE);

      if (col === 0) {
        stave.addClef("percussion");
      }
      if (showBarTimeSig) stave.addTimeSignature(`${barTimeSig.n}/${barTimeSig.d}`);

      stave.setContext(ctx).draw();
      staves.push(stave);

      const repeatInfo = repeatPlan[b];
      if (repeatInfo) {
        voices.push(createRepeatVoiceForBar(repeatInfo, barTimeSig));
        beamsByBar[b] = [];
        beamBucketsByBar[b] = [];
        continue;
      }

      const notes = [];
      const noteStarts = [];
      const barStartStep = renderBarStepOffsets[b] ?? 0;
      const pushNote = (n, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec = [], stepIdx = -1) => {
        applyGhostStyling(n, ghostKeyIndices);
        applyGhostStemOverride(n, ghostKeyIndices);
        applySpecialStemOverride(n);
        applyCircledXLargeStyling(n, circledXLargeKeyIndices);
        applyAccentArticulation(n, accentKeyIndices);
        applyStickingAnnotation(n, stickingSpec, stepIdx);
        n.__dgIsBeamed = false;
        notes.push(n);
        noteStarts.push(s);
      };

      let s = 0;
      while (s < stepsPerBarN) {
        const globalIdx = barStartStep + s;
        const stickingSpec = getStickingSpecForStep(globalIdx);

        const keys = [];
        const ghostKeyIndices = [];
        const circledXLargeKeyIndices = [];
        const accentKeyIndices = [];

        instruments.forEach((inst) => {
          const val = notationGrid[inst.id]?.[globalIdx] ?? CELL.OFF;
          if (val !== CELL.OFF) {
            const notation = NOTATION_MAP[inst.id];
            if (!notation) return;
            keys.push(notation.key);
            const keyIndex = keys.length - 1;
            if (val === CELL.GHOST && GHOST_NOTATION_ENABLED.has(inst.id)) {
              ghostKeyIndices.push(keyIndex);
            }
            if (val === CELL.ACCENT) {
              accentKeyIndices.push(keyIndex);
            }
            if (inst.id === "china" || inst.id === "hihatOpen") {
              circledXLargeKeyIndices.push(keyIndex);
            }
          }
        });
const isRest = keys.length === 0;

        // Merge notes/rests to larger durations (optional)
        const stepsPerBeatN = Math.max(1, Math.round(notationResolution / barTimeSig.d));
        const subInBeat = stepsPerBeatN === 0 ? 0 : (s % stepsPerBeatN);

        const hasAnyHitAt = (absIdx) => {
      for (const inst of instruments) {
        if ((notationGrid[inst.id]?.[absIdx] ?? CELL.OFF) !== CELL.OFF) return true;
      }
      return false;
    };

        const isStepEmpty = (absIdx) => !hasAnyHitAt(absIdx);
        const getStepEntry = (absIdx) => {
          const entryKeys = [];
          const entryGhostKeyIndices = [];
          const entryCircledXLargeKeyIndices = [];
          const entryAccentKeyIndices = [];
          instruments.forEach((inst) => {
            const val = notationGrid[inst.id]?.[absIdx] ?? CELL.OFF;
            if (val === CELL.OFF) return;
            const notation = NOTATION_MAP[inst.id];
            if (!notation) return;
            entryKeys.push(notation.key);
            const keyIndex = entryKeys.length - 1;
            if (val === CELL.GHOST && GHOST_NOTATION_ENABLED.has(inst.id)) {
              entryGhostKeyIndices.push(keyIndex);
            }
            if (val === CELL.ACCENT) {
              entryAccentKeyIndices.push(keyIndex);
            }
            if (inst.id === "china" || inst.id === "hihatOpen") {
              entryCircledXLargeKeyIndices.push(keyIndex);
            }
          });
          return {
            keys: entryKeys,
            ghostKeyIndices: entryGhostKeyIndices,
            circledXLargeKeyIndices: entryCircledXLargeKeyIndices,
            accentKeyIndices: entryAccentKeyIndices,
            stickingSpec: getStickingSpecForStep(absIdx),
            globalIdx: absIdx,
          };
        };

        const allowDotted = effectiveDottedNotes && ("all" === "all" || notationResolution > 8);
        // Dotted notes should not cross the "beam group" divisions of the bar.
        // Example: in 4/4, don't dot across quarter-note beats; in 6/8, don't dot across the 3+3 grouping.
        const beamGroupsPerBar = (() => {
          // Compound meters like 6/8, 9/8, 12/8: group in dotted quarters (3 eighths)
          if (barTimeSig.d === 8 && barTimeSig.n % 3 === 0 && barTimeSig.n > 3) return barTimeSig.n / 3;
          // Simple meters: group by beats in the numerator (e.g., 4/4 -> 4, 3/4 -> 3)
          return barTimeSig.n;
        })();
        const groupSizeSteps = stepsPerBarN / beamGroupsPerBar;
        const inSameBeamGroup = (startStep, endExclusiveStep) => {
          const last = endExclusiveStep - 1;
          return Math.floor(startStep / groupSizeSteps) === Math.floor(last / groupSizeSteps);
        };


        // --- Merge NOTES ---
        if (effectiveMergeNotes && !isRest) {
          if (notationResolution === 16 && stepsPerBeatN === 4 && subInBeat === 0 && s + 3 < stepsPerBarN) {
            const entry0 = getStepEntry(barStartStep + s);
            const entry1 = getStepEntry(barStartStep + (s + 1));
            const entry2 = getStepEntry(barStartStep + (s + 2));
            const entry3 = getStepEntry(barStartStep + (s + 3));
            if (entry0.keys.length && entry1.keys.length && !entry2.keys.length && entry3.keys.length) {
              const note16a = new StaveNote({ keys: entry0.keys, duration: "16", clef: "percussion" });
              note16a.setStemDirection(1);
              pushNote(
                note16a,
                entry0.ghostKeyIndices,
                entry0.circledXLargeKeyIndices,
                entry0.accentKeyIndices,
                entry0.stickingSpec,
                entry0.globalIdx
              );
              const note8 = new StaveNote({ keys: entry1.keys, duration: "8", clef: "percussion" });
              note8.setStemDirection(1);
              pushNote(
                note8,
                entry1.ghostKeyIndices,
                entry1.circledXLargeKeyIndices,
                entry1.accentKeyIndices,
                entry1.stickingSpec,
                entry1.globalIdx
              );
              const note16b = new StaveNote({ keys: entry3.keys, duration: "16", clef: "percussion" });
              note16b.setStemDirection(1);
              pushNote(
                note16b,
                entry3.ghostKeyIndices,
                entry3.circledXLargeKeyIndices,
                entry3.accentKeyIndices,
                entry3.stickingSpec,
                entry3.globalIdx
              );
              s += 4;
              continue;
            }
          }
          // 8ths in x/4: beat is a quarter, pattern: [hit][empty] -> quarter note
          if (notationResolution === 8 && stepsPerBeatN === 2 && subInBeat === 0 && s + 1 < stepsPerBarN) {
            if (isStepEmpty(barStartStep + (s + 1))) {
              const noteQ = new StaveNote({ keys, duration: "q", clef: "percussion" });
              noteQ.setStemDirection(1);
              pushNote(noteQ, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec, globalIdx);
                if (allowDotted && effectiveMergeNotes) {
                  const after = barStartStep + (s + 2);
                  if (s + 2 < stepsPerBarN && isStepEmpty(after) && inSameBeamGroup(s, s + 3)) {
                    attachDot(noteQ);
                    s += 3;
                    continue;
                  }
                }
                s += 2;
                continue;
            }
          }

          // 16ths:
          // - In x/4 (stepsPerBeatN=4):
          //   * [hit][empty][empty][empty] at beat start -> quarter note
          //   * [hit][empty] at 8th boundaries (sub 0 or 2) -> eighth note
          if (notationResolution === 16 && stepsPerBeatN === 4) {
            if (subInBeat === 0 && s + 3 < stepsPerBarN) {
              const a = barStartStep + (s + 1);
              const b2 = barStartStep + (s + 2);
              const c = barStartStep + (s + 3);
              if (isStepEmpty(a) && isStepEmpty(b2) && isStepEmpty(c)) {
                const noteQ = new StaveNote({ keys, duration: "q", clef: "percussion" });
                noteQ.setStemDirection(1);
                pushNote(noteQ, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec, globalIdx);
                s += 4;
                continue;
              }
            }
            if ((subInBeat === 0 || subInBeat === 2) && s + 1 < stepsPerBarN) {
              const next = barStartStep + (s + 1);
              if (isStepEmpty(next)) {
                const note8 = new StaveNote({ keys, duration: "8", clef: "percussion" });
                note8.setStemDirection(1);
                pushNote(note8, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec, globalIdx);
                if (allowDotted && effectiveMergeNotes) {
                  const after = barStartStep + (s + 2);
                  if (s + 2 < stepsPerBarN && isStepEmpty(after) && inSameBeamGroup(s, s + 3)) {
                    attachDot(note8);
                    s += 3;
                    continue;
                  }
                }
                s += 2;
                continue;
              }
            }
          }

          
          // 32nds:
          // - In x/4 (stepsPerBeatN=8):
          //   * [hit][empty x7] at beat start -> quarter note
          //   * [hit][empty x3] at 8th boundaries (sub 0 or 4) -> eighth note
          //   * [hit][empty] at 16th boundaries (sub 0,2,4,6) -> 16th note
          if (notationResolution === 32 && (stepsPerBeatN === 8 || stepsPerBeatN === 4)) {
            // 32nd-grid per-hit downsampling (32 -> 16 -> 8 -> 4) based on silence to the right.
            // This keeps bar math correct and prefers the longest simple value to minimize rests.
            const abs = barStartStep + s;

            // Choose longest power-of-two length (in 32nd steps) that:
            // 1) starts aligned (s % len === 0),
            // 2) has no hits in the covered window (excluding the first step),
            // 3) does not cross the current beam group division.
            const canLen = (len) => {
              if (s % len !== 0) return false;
              if (s + (len - 1) >= stepsPerBarN) return false;
              if (!inSameBeamGroup(s, s + len)) return false;
              for (let k = 1; k < len; k++) {
                if (!isStepEmpty(abs + k)) return false;
              }
              return true;
            };

            let len = 1;
            if (canLen(2)) len = 2;
            if (canLen(4)) len = 4;
            if (canLen(8)) len = 8;

            // Optional dotted extension (adds half the base length), only if it fits in-group and is silent.
            // dotted 16th: 2+1=3, dotted 8th: 4+2=6, dotted quarter: 8+4=12
            let dotted = false;
            if (allowDotted && len >= 2) {
              const extra = len / 2;
              if (s + (len + extra - 1) < stepsPerBarN && inSameBeamGroup(s, s + len + extra)) {
                let ok = true;
                for (let k = len; k < len + extra; k++) {
                  if (!isStepEmpty(abs + k)) { ok = false; break; }
                }
                if (ok) dotted = true;
              }
            }

            const dur =
              len === 8 ? "q" :
              len === 4 ? "8" :
              len === 2 ? "16" :
              "32";

            const note = new StaveNote({ keys, duration: dur, clef: "percussion" });
            note.setStemDirection(1);
            if (dotted) attachDot(note);
            pushNote(note, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec, globalIdx);

            s += dotted ? (len + len / 2) : len;
            continue;
          }


          // 32nds in x/8 (stepsPerBeatN=4):
          //   * [hit][empty x3] at beat start -> eighth note
          //   * [hit][empty] at 16th boundaries (sub 0 or 2) -> 16th note
          


// 16ths in x/8 (stepsPerBeatN=2): [hit][empty] -> eighth note (beat unit)
          if (notationResolution === 16 && stepsPerBeatN === 2 && subInBeat === 0 && s + 1 < stepsPerBarN) {
            if (isStepEmpty(barStartStep + (s + 1))) {
              const note8 = new StaveNote({ keys, duration: "8", clef: "percussion" });
              note8.setStemDirection(1);
              pushNote(note8, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec, globalIdx);
                if (allowDotted && effectiveMergeNotes) {
                  const after = barStartStep + (s + 2);
                  if (s + 2 < stepsPerBarN && isStepEmpty(after) && inSameBeamGroup(s, s + 3)) {
                    attachDot(note8);
                    s += 3;
                    continue;
                  }
                }
                s += 2;
                continue;
            }
          }
        }

        // --- Merge RESTS ---
        if (effectiveMergeRests && isRest) {
          // 8ths in x/4: [rest][rest] at beat start -> quarter rest
          if (notationResolution === 8 && stepsPerBeatN === 2 && subInBeat === 0 && s + 1 < stepsPerBarN) {
            if (isStepEmpty(barStartStep + (s + 1))) {
              pushNote(new StaveNote({ keys: ["b/4"], duration: "qr", clef: "percussion" }));
              s += 2;
              continue;
            }
          }

          // 16ths in x/4:
          //  * [rest][rest][rest][rest] at beat start -> quarter rest
          //  * [rest][rest] at 8th boundaries (sub 0 or 2) -> eighth rest
          if (notationResolution === 16 && stepsPerBeatN === 4) {
            if (subInBeat === 0 && s + 3 < stepsPerBarN) {
              const a = barStartStep + (s + 1);
              const b2 = barStartStep + (s + 2);
              const c = barStartStep + (s + 3);
              if (isStepEmpty(a) && isStepEmpty(b2) && isStepEmpty(c)) {
                pushNote(new StaveNote({ keys: ["b/4"], duration: "qr", clef: "percussion" }));
                s += 4;
                continue;
              }
            }
            if ((subInBeat === 0 || subInBeat === 2) && s + 1 < stepsPerBarN) {
              const next = barStartStep + (s + 1);
              if (isStepEmpty(next)) {
                pushNote(new StaveNote({ keys: ["b/4"], duration: "8r", clef: "percussion" }));
                s += 2;
                continue;
              }
            }
          }

          
          // 32nds in x/4 (stepsPerBeatN=8):
          //  * [rest x8] at beat start -> quarter rest
          //  * [rest x4] at 8th boundaries (sub 0 or 4) -> eighth rest
          //  * [rest x2] at 16th boundaries (sub 0,2,4,6) -> 16th rest
          if (notationResolution === 32 && stepsPerBeatN === 8) {
            if (subInBeat === 0 && s + 7 < stepsPerBarN) {
              const empties = Array.from({ length: 7 }, (_, i) => barStartStep + (s + 1 + i));
              if (empties.every(isStepEmpty)) {
                pushNote(new StaveNote({ keys: ["b/4"], duration: "qr", clef: "percussion" }));
                s += 8;
                continue;
              }
            }
            if ((subInBeat === 0 || subInBeat === 4) && s + 3 < stepsPerBarN) {
              const a = barStartStep + (s + 1);
              const b2 = barStartStep + (s + 2);
              const c = barStartStep + (s + 3);
              if (isStepEmpty(a) && isStepEmpty(b2) && isStepEmpty(c)) {
                pushNote(new StaveNote({ keys: ["b/4"], duration: "8r", clef: "percussion" }));
                s += 4;
                continue;
              }
            }
            if ((subInBeat === 0 || subInBeat === 2 || subInBeat === 4 || subInBeat === 6) && s + 1 < stepsPerBarN) {
              const next = barStartStep + (s + 1);
              if (isStepEmpty(next)) {
                pushNote(new StaveNote({ keys: ["b/4"], duration: "16r", clef: "percussion" }));
                s += 2;
                continue;
              }
            }
          }

          // 32nds in x/8 (stepsPerBeatN=4):
          //  * [rest x4] -> eighth rest
          //  * [rest x2] -> 16th rest
          if (notationResolution === 32 && stepsPerBeatN === 4) {
            if (subInBeat === 0 && s + 3 < stepsPerBarN) {
              const a = barStartStep + (s + 1);
              const b2 = barStartStep + (s + 2);
              const c = barStartStep + (s + 3);
              if (isStepEmpty(a) && isStepEmpty(b2) && isStepEmpty(c)) {
                pushNote(new StaveNote({ keys: ["b/4"], duration: "8r", clef: "percussion" }));
                s += 4;
                continue;
              }
            }
            if ((subInBeat === 0 || subInBeat === 2) && s + 1 < stepsPerBarN) {
              const next = barStartStep + (s + 1);
              if (isStepEmpty(next)) {
                pushNote(new StaveNote({ keys: ["b/4"], duration: "16r", clef: "percussion" }));
                s += 2;
                continue;
              }
            }
          }


// 16ths in x/8 (stepsPerBeatN=2): [rest][rest] -> eighth rest
          if (notationResolution === 16 && stepsPerBeatN === 2 && subInBeat === 0 && s + 1 < stepsPerBarN) {
            if (isStepEmpty(barStartStep + (s + 1))) {
              pushNote(new StaveNote({ keys: ["b/4"], duration: "8r", clef: "percussion" }));
              s += 2;
              continue;
            }
          }
        }

        if (isRest) {
          pushNote(new StaveNote({ keys: ["b/4"], duration: dur + "r", clef: "percussion" }));
          s += 1;
          continue;
        }

        const note = new StaveNote({ keys, duration: dur, clef: "percussion" });
        // Force stems (and therefore beams) upwards
        note.setStemDirection(1);

        // MVP: if any cymbal is present in this slice, use X noteheads for the chord.
        // Next upgrade: per-key notehead types.

        pushNote(note, ghostKeyIndices, circledXLargeKeyIndices, accentKeyIndices, stickingSpec, globalIdx);
        s += 1;
      }

      const voice = new Voice({ num_beats: barTimeSig.n, beat_value: barTimeSig.d });
      voice.setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);
      voices.push(voice);

      // Beaming groups
      if (barTimeSig.n === 6 && barTimeSig.d === 8) {
        // Typical 6/8: 3+3 grouping
      } else {
        // Beam by beat unit
      }

      // Safety: enforce stem up on all non-rest notes before beaming
      notes.forEach((n) => {
        try {
          if (typeof n.isRest === "function" ? !n.isRest() : !String(n.getDuration?.() ?? "").includes("r")) {
            n.setStemDirection?.(1);
          }
        } catch (e) {}
      });

// Generate beams *within* each beam group division only (never across groups).
      // This prevents later beats from affecting earlier beaming (e.g., dotted 8th + 16th in beat 1).
      const groupBuckets = Array.from({ length: beamGroupsPerBar }, () => []);
      const groupSizeSteps = stepsPerBarN / beamGroupsPerBar;
for (let i = 0; i < notes.length; i++) {
        const st = noteStarts[i] ?? CELL.OFF;
        const g = Math.max(0, Math.min(beamGroupsPerBar - 1, Math.floor(st / groupSizeSteps)));
        groupBuckets[g].push(notes[i]);
      }
      groupBuckets.forEach((bucket) => {
        if (!bucket.length) return;
        const beams = Beam.generateBeams(bucket, {
          groups,
          stem_direction: 1,
          beam_rests: bucket.some((note) => note?.__dgBeamRest === true),
          flat_beams: !!flatBeams,
        });
        beams.forEach((beam) => {
          const beamNotes = (typeof beam.getNotes === "function" ? beam.getNotes() : beam.notes) || [];
          beamNotes.forEach((n) => {
            n.__dgIsBeamed = beamNotes.length > 1;
          });
        });
        beamsByBar[b].push(...beams);
        // Store buckets so we can regenerate beams cleanly for bar-level alignment.
        beamBucketsByBar[b].push(bucket.slice());
      });
    }

    // Format and draw each bar independently (format to stave so barlines stay correct)
    for (let b = 0; b < bars; b++) {
      const formatter = new Formatter().joinVoices([voices[b]]);
      formatter.formatToStave([voices[b]], staves[b]);
      finalizeSpecialStemOverridesForVoice(voices[b]);
      voices[b].draw(ctx, staves[b]);
      drawStickingSpecsForVoice(voices[b], svgRoot);
    }

    // Draw beams last for clarity
    for (let b = 0; b < bars; b++) {
      let barBeams = beamsByBar[b] || [];
      if (flatBeams && barBeams.length) {
        // First pass: compute the highest beam Y in this bar.
        barBeams.forEach((beam) => {
          try { beam.postFormat?.(); } catch (_) {}
        });

        const ys = barBeams
          .map((beam) => {
            try { return beam.getBeamYToDraw?.(); } catch (_) { return null; }
          })
          .filter((y) => typeof y === "number");

        if (ys.length) {
          const targetY = Math.min(...ys);

          // Second pass: regenerate beams (fresh objects) and apply flat_beam_offset BEFORE final postFormat/draw.
          const fresh = [];
          const buckets = beamBucketsByBar[b] || [];

          buckets.forEach((bucket) => {
            if (!bucket.length) return;

            // Clear any previously associated beam metadata on notes (helps avoid drawing/geometry artifacts).
            bucket.forEach((n) => {
              try { n.setBeam?.(null); } catch (_) {}
            });

            const beams = Beam.generateBeams(bucket, {
              groups,
              stem_direction: 1,
              beam_rests: bucket.some((note) => note?.__dgBeamRest === true),
              flat_beams: true,
            });
            beams.forEach((beam) => {
              try {
                beam.setContext(ctx);
                // First postFormat to compute beam geometry for the current note layout.
                beam.postFormat?.();
                beam.applyStemExtensions?.();

                const currentY = beam.getBeamYToDraw?.();
                if (typeof currentY === "number") {
                  const delta = targetY - currentY;
                  beam.render_options.flat_beam_offset = (beam.render_options.flat_beam_offset ?? 0) + delta;
                }

                // Recompute after shifting the flat beam offset so stems match.
                beam.postFormat?.();
                beam.applyStemExtensions?.();
              } catch (_) {}
              fresh.push(beam);
            });
          });

          // Use regenerated beams for drawing (gives cleaner geometry).
          barBeams = fresh;
        }
      }

      barBeams.forEach((beam) => beam.setContext(ctx).draw());
    }

    drawArrangementTextMarkers(svgRoot, staves);


    // White notation on dark UI
    const svg = ref.current.querySelector("svg");
    if (svg) {
      drawTwoBarRepeatMarkers(svg, staves, repeatPlan);
      svg.style.background = "transparent";
      svg.querySelectorAll("path, line, rect, circle").forEach((el) => {
          el.setAttribute("stroke", notationColor);
          el.setAttribute("fill", notationColor);
      });
      svg.querySelectorAll("text").forEach((el) => {
          el.setAttribute("fill", notationColor);
      });
      highlightSvgRef.current = svg;
      const highlightRects = staves.map((stave) => {
        const x = Number(stave?.getX?.()) || 0;
        const width = Number(stave?.getWidth?.()) || 0;
        const yTop = Number(stave?.getYForLine?.(0)) || 0;
        const yBottom = Number(stave?.getYForLine?.(4)) || 0;
        return {
          x: x + 1,
          y: yTop - 22,
          width: Math.max(0, width - 2),
          height: Math.max(40, (yBottom - yTop) + 44),
        };
      });
      highlightRectsRef.current = highlightRects;
      drawNotationBarOverlay(svg, highlightRects, selectedBarIndices, {
        className: "dg-selected-bar",
        fill: "rgba(14,165,233,0.04)",
        stroke: "rgba(14,165,233,0.45)",
        strokeWidth: 1.5,
        pointerEvents: "none",
      });
      drawNotationBarOverlay(svg, highlightRects, editorBarIndices, {
        className: "dg-editor-bar",
        fill: "rgba(14,165,233,0.08)",
        stroke: "rgba(14,165,233,0.9)",
        strokeWidth: 2,
      });
      drawNotationBarOverlay(svg, highlightRects, activeBarIndices, {
        className: "dg-active-bar",
        fill: "rgba(34,211,238,0.08)",
        stroke: "rgba(34,211,238,0.7)",
        strokeWidth: 1.5,
      });
      setHitLayerVersion((v) => v + 1);
    }
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [instruments, grid, stickingAssignmentsByStep, showNotationSticking, notationStickingSelection, notationStickingView, resolution, bars, barsPerLine, barsPerRow, stepsPerBar, timeSig, timeSigByBar, quarterSubdivisionsByBar, barStepOffsets, mergeRests, mergeNotes, dottedNotes, flatBeams, justifySystems, targetContentWidth, sectionMarkers, tempoMarkers, dynamicSpacingByBar, showSystemBarNumbers, barNumberOffset, enableMeasureRepeats, spacingPresetByBar, mergeRestsByBar, mergeNotesByBar, dottedNotesByBar, showNotationStickingByBar, theme]);

  useEffect(() => {
    const svg = highlightSvgRef.current;
    const rects = Array.isArray(highlightRectsRef.current) ? highlightRectsRef.current : [];
    drawNotationBarOverlay(svg, rects, activeBarIndices, {
      className: "dg-active-bar",
      fill: "rgba(34,211,238,0.08)",
      stroke: "rgba(34,211,238,0.7)",
      strokeWidth: 1.5,
    });
  }, [activeBarIndices, hitLayerVersion]);
  useEffect(() => {
    const svg = highlightSvgRef.current;
    const rects = Array.isArray(highlightRectsRef.current) ? highlightRectsRef.current : [];
    drawNotationBarOverlay(svg, rects, editorBarIndices, {
      className: "dg-editor-bar",
      fill: "rgba(14,165,233,0.08)",
      stroke: "rgba(14,165,233,0.9)",
      strokeWidth: 2,
    });
  }, [editorBarIndices, hitLayerVersion]);
  useEffect(() => {
    const svg = highlightSvgRef.current;
    const rects = Array.isArray(highlightRectsRef.current) ? highlightRectsRef.current : [];
    drawNotationBarOverlay(svg, rects, selectedBarIndices, {
      className: "dg-selected-bar",
      fill: "rgba(14,165,233,0.04)",
      stroke: "rgba(14,165,233,0.45)",
      strokeWidth: 1.5,
      pointerEvents: "none",
    });
  }, [selectedBarIndices, hitLayerVersion]);

  useEffect(() => {
    const svg = highlightSvgRef.current;
    if (!(svg instanceof SVGElement)) return;
    svg.querySelectorAll(".dg-click-bar").forEach((el) => el.remove());
    if (typeof onBarClickRef.current !== "function") return;
    const rects = Array.isArray(highlightRectsRef.current) ? highlightRectsRef.current : [];
    rects.forEach((rectSpec, barIndex) => {
      if (!rectSpec) return;
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      let pointerDownHandledClick = false;
      hit.setAttribute("x", String(rectSpec.x));
      hit.setAttribute("y", String(rectSpec.y));
      hit.setAttribute("width", String(rectSpec.width));
      hit.setAttribute("height", String(rectSpec.height));
      hit.setAttribute("fill", "rgba(0,0,0,0)");
      hit.setAttribute("stroke", "none");
      hit.setAttribute("class", "dg-click-bar");
      hit.setAttribute("data-no-window-drag", "1");
      hit.style.cursor = "pointer";
      hit.style.pointerEvents = "all";
      hit.style.touchAction = "pan-y";
      hit.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });
      hit.addEventListener("touchstart", (event) => {
        event.stopPropagation();
      });
      hit.addEventListener("pointerdown", (event) => {
        pointerDownHandledClick = false;
        event.stopPropagation();
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const clickHandler = onBarClickRef.current;
        if (typeof clickHandler !== "function") return;
        if (event.pointerType !== "mouse") {
          pointerDownHandledClick = true;
          clickHandler(barIndex, event);
          return;
        }
        pointerDownHandledClick = true;
        event.preventDefault();
        clickHandler(barIndex, event);
      });
      hit.addEventListener("contextmenu", (event) => {
        const menuHandler = onBarMenuOpenRef.current;
        if (typeof menuHandler !== "function") return;
        event.preventDefault();
        event.stopPropagation();
        menuHandler(barIndex, event);
      });
      hit.addEventListener("click", (event) => {
        event.stopPropagation();
        if (pointerDownHandledClick) {
          pointerDownHandledClick = false;
          event.preventDefault();
          return;
        }
        const clickHandler = onBarClickRef.current;
        if (typeof clickHandler === "function") clickHandler(barIndex, event);
      });
      svg.appendChild(hit);
    });
  }, [hitLayerVersion]);

  return (
    <div
      ref={ref}
      style={{
        touchAction: typeof onBarClick === "function" ? "pan-y" : "auto",
        paddingRight: "1rem",
      }}
    />
  );

}
