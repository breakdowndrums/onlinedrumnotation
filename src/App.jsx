import React, { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { exportNotationPdf } from "./utils/exportNotationPdf";
import { exportNotationPng } from "./utils/exportNotationPng";
import { exportArrangementPdf } from "./utils/exportArrangementPdf";
import { exportArrangementMidi, exportDrumMidi } from "./utils/exportMidi";
import { importDrumMidi } from "./utils/importMidi";
import { trackClientEvent } from "./utils/trackStats";
import useKitEditorState from "./hooks/useKitEditorState";
import ArrangementDeleteDialog from "./components/ArrangementDeleteDialog";
import ArrangementDetailsHeader from "./components/ArrangementDetailsHeader";
import ArrangementDetailsPane from "./components/ArrangementDetailsPane";
import ArrangementPanelShell from "./components/ArrangementPanelShell";
import ArrangementSourceHeader from "./components/ArrangementSourceHeader";
import ArrangementSheetExportPreview from "./components/ArrangementSheetExportPreview";
import ArrangementSheetPanel from "./components/ArrangementSheetPanel";
import ArrangementSheetPreview from "./components/ArrangementSheetPreview";
import ArrangementSheetRowMenuPortal from "./components/ArrangementSheetRowMenuPortal";
import ArrangementSheetSettingsMenu from "./components/ArrangementSheetSettingsMenu";
import AppHeader from "./components/AppHeader";
import AuthDialog from "./components/AuthDialog";
import AdminStatsPanel from "./components/AdminStatsPanel";
import ArrangementRowNotationMenu from "./components/ArrangementRowNotationMenu";
import {
  BeatLibraryDragOverlayCard,
  BeatLibraryDropTarget,
  BeatLibraryReservedBeatRowSlot,
  GridSettingsPresetDragOverlayCard,
  GridSettingsPresetReservedRowSlot,
  PencilIcon,
  SortableArrangementSourceBeatRow,
  SortableGridSettingsPresetRow,
  TrashIcon,
  TreeTriangle,
} from "./components/BeatLibraryPrimitives";
import FeedbackPanel from "./components/FeedbackPanel";
import KitEditorDialog from "./components/KitEditorDialog";
import { PresetChangeConfirmDialog } from "./components/KitPresetDialogs";
import LegalDialog from "./components/LegalDialog";
import GridSettingsPresetSourceList from "./components/GridSettingsPresetSourceList";
import Grid from "./components/Grid";
import LocalBeatSourceList from "./components/LocalBeatSourceList";
import LocalArrangementFooter from "./components/LocalArrangementFooter";
import LocalArrangementRows from "./components/LocalArrangementRows";
import {
  ArrangementPrintDialog,
  BeatPrintDialog,
  MidiExportDialog,
  NotationPngExportDialog,
} from "./components/ExportDialogs";
import MidiImportMappingDialog from "./components/MidiImportMappingDialog";
import MidiImportSettingsDialog from "./components/MidiImportSettingsDialog";
import Notation from "./components/Notation";
import PersonalCloudImportDialog from "./components/PersonalCloudImportDialog";
import PreferencesDialog from "./components/PreferencesDialog";
import PublicArrangementPreview from "./components/PublicArrangementPreview";
import PublicBeatSourceList from "./components/PublicBeatSourceList";
import PublicSubmitDialog from "./components/PublicSubmitDialog";
import ShareActionsDialog from "./components/ShareActionsDialog";
import TransportMenu from "./components/TransportMenu";
import { hasSupabaseEnabled, supabase } from "./lib/supabase";
import { requestFeedbackApi } from "./services/feedback";
import { fetchAdminStats } from "./services/stats";
import { fetchUsageLimits } from "./services/usageLimits";
import {
  createAnonymousShortShareLink,
  createSupabaseShortShareLink,
  deleteOwnedShareLink,
  deleteOwnedShareLinksByIds,
  fetchOwnedShareLinkRows,
  fetchShareLinkRowById,
  SHARE_LINK_PURPOSE,
  touchTemporaryShareLinkAccess,
} from "./services/shareLinks";
import {
  deleteOwnedPublicShareRow,
  fetchFallbackPublicBeats,
  fetchPublicArrangementRows,
  fetchPublicBeatRows,
  publishFallbackPublicBeat,
  publishPublicArrangementRow,
  publishPublicBeatRow,
} from "./services/publicLibrary";
import {
  countCloudLibraryRows,
  createCloudBeatRow,
  deleteCloudArrangementRow,
  deleteCloudArrangementRows,
  deleteCloudBeatRow,
  deleteCloudBeatRows,
  fetchCloudArrangementRows,
  fetchCloudBeatRows,
  fetchCloudLibraryStatePayload,
  insertCloudArrangementRow,
  insertCloudBeatRow,
  saveCloudLibraryStatePayload,
  updateCloudArrangementRow,
  updateCloudArrangementRows,
  updateCloudBeatRow,
  updateCloudBeatRows,
} from "./services/cloudLibrary";
import QRCode from "qrcode";
import { usePlayback } from "./audio/usePlayback";
import * as Vex from "vexflow";
import customSmuflFont from "./fonts/customSmuflFont.json";
import { DndContext, DragOverlay, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CUSTOM_MUSIC_FONT_NAME = "DrumGridCustomSmufl";
const SHORTCUT_BINDINGS_STORAGE_KEY = "drum-grid-shortcut-bindings-v1";
const FEEDBACK_ANON_FINGERPRINT_STORAGE_KEY = "drum-grid-feedback-anon-fingerprint-v1";
const BEAT_AUTO_UPDATE_ENABLED_STORAGE_KEY = "drum-grid-beat-auto-update-enabled-v1";
const TUPLET_GRID_APPEARANCE_BY_VALUE_STORAGE_KEY = "drum-grid-tuplet-grid-appearance-by-value-v2";
const COUNT_ROW_DARKEN_NON_QUARTERS_STORAGE_KEY = "drum-grid-count-row-darken-non-quarters-v1";
const PERSONAL_CLOUD_BEAT_LIMIT = 1000;
const PERSONAL_CLOUD_ARRANGEMENT_LIMIT = 100;
const SHORTCUTS = [
  {
    id: "play_toggle",
    command: "Play / Stop",
    description: "Start or stop playback. Uses arrangement playback if arrangement selection is active.",
    defaultBinding: "Space",
  },
  {
    id: "copy_selection",
    command: "Copy selection",
    description: "Copy the current grid selection to the internal clipboard.",
    defaultBinding: "Mod+C",
  },
  {
    id: "paste_selection",
    command: "Paste clipboard",
    description: "Paste at the current hovered grid cell, or fall back to the selection anchor.",
    defaultBinding: "Mod+V",
  },
  {
    id: "duplicate_selection",
    command: "Duplicate selection",
    description: "Duplicate the current selection one selection-width to the right.",
    defaultBinding: "Mod+D",
  },
  {
    id: "undo",
    command: "Undo",
    description: "Undo the last change in the active editor or library context.",
    defaultBinding: "Mod+Z",
  },
  {
    id: "redo",
    command: "Redo",
    description: "Redo the previously undone change.",
    defaultBinding: "Mod+Shift+Z",
  },
  {
    id: "loop_all_toggle",
    command: "Toggle looping all",
    description: "Toggle looping between Off and All.",
    defaultBinding: "L",
  },
  {
    id: "assign_sticking_left",
    command: "Assign sticking L",
    description: "In sticking edit mode, assign L to the current selected active notes.",
    defaultBinding: "L",
  },
  {
    id: "assign_sticking_right",
    command: "Assign sticking R",
    description: "In sticking edit mode, assign R to the current selected active notes.",
    defaultBinding: "R",
  },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `loop_${index + 1}_toggle`,
    command: `Set looping ${index + 1}`,
    description: `Set loop repeat to ${index + 1}.`,
    defaultBinding: `L+${index + 1}`,
  })),
];

let customSmuflInstalled = false;

function ensureCustomSmuflFontInstalled() {
  if (customSmuflInstalled) return;
  try {
    const currentStack = (Vex.Flow.getMusicFont && Vex.Flow.getMusicFont()) || [];
    if (!currentStack.length) {
      Vex.Flow.setMusicFont("Bravura", "Gonville", "Custom");
    }
    Vex.Flow.Font.load(CUSTOM_MUSIC_FONT_NAME, customSmuflFont.data, customSmuflFont.metrics);
    const names = (Vex.Flow.getMusicFont && Vex.Flow.getMusicFont()) || ["Bravura", "Gonville", "Custom"];
    const nextStack = [CUSTOM_MUSIC_FONT_NAME, ...names.filter((n) => n !== CUSTOM_MUSIC_FONT_NAME)];
    Vex.Flow.setMusicFont(...nextStack);
    customSmuflInstalled = true;
  } catch (_) {
    // Keep existing music font stack if custom overlay fails.
  }
}

ensureCustomSmuflFontInstalled();

function isMidiLikeFile(file) {
  if (!file) return false;
  const fileName = String(file?.name || "").toLowerCase();
  const fileType = String(file?.type || "").toLowerCase();
  return (
    fileName.endsWith(".mid") ||
    fileName.endsWith(".midi") ||
    fileType.includes("midi")
  );
}

function formatTimingShiftLabel(sixteenths) {
  const value = Math.max(-15, Math.min(15, Math.round(Number(sixteenths) || 0)));
  if (value === 0) return "Off";
  return value < 0 ? `${Math.abs(value)}/16 earlier` : `${value}/16 later`;
}

function bindingFromKeyboardEvent(event) {
  const parts = [];
  if (event.metaKey || event.ctrlKey) parts.push("Mod");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");
  const code = String(event.code || "");
  let key = "";
  if (code === "Space") key = "Space";
  else if (code === "Enter") key = "Enter";
  else if (code === "Escape") key = "Escape";
  else if (code.startsWith("Key")) key = code.slice(3).toUpperCase();
  else if (code.startsWith("Digit")) key = code.slice(5);
  else {
    const raw = String(event.key || "").trim();
    if (raw === " ") key = "Space";
    else if (raw.length === 1) key = raw.toUpperCase();
    else key = raw;
  }
  if (!key) return "";
  parts.push(key);
  return parts.join("+");
}

function shortcutsMapFromStorage() {
  try {
    const raw = window.localStorage.getItem(SHORTCUT_BINDINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function displayShortcutBinding(binding) {
  return String(binding || "")
    .replace(/\bMod\b/g, "Cmd/Ctrl")
    .replace(/\+/g, " + ");
}

function matchesChordShortcut(event, binding, heldKeys) {
  const normalized = String(binding || "").trim().toUpperCase();
  const match = normalized.match(/^([A-Z])\+([0-9])$/);
  if (!match) return false;
  const [, heldLetter, triggerDigit] = match;
  const eventCode = String(event.code || "");
  const eventDigit =
    eventCode.startsWith("Digit") ? eventCode.slice(5) : String(event.key || "").trim();
  if (eventDigit !== triggerDigit) return false;
  return heldKeys?.has?.(heldLetter) === true;
}

function readGridSelectionHoldDelayMs() {
  try {
    const raw = String(
      window.localStorage.getItem("drum-grid-selection-hold-speed-v1") || ""
    ).toLowerCase();
    if (raw === "fast") return 300;
    if (raw === "slow") return 500;
    const value = Number(raw);
    if (!Number.isFinite(value)) return 300;
    return Math.max(300, Math.min(800, Math.round(value)));
  } catch (_) {
    return 300;
  }
}

function SaveStateIcon() {
  return (
    <span
      className="block h-[0.95rem] w-[0.95rem] bg-current"
      style={{
        WebkitMaskImage: "url('/save-check-streamline.png')",
        maskImage: "url('/save-check-streamline.png')",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
      aria-hidden="true"
    />
  );
}

function LibraryIcon() {
  return (
    <span
      aria-hidden="true"
      className="block h-3.5 w-3.5 bg-current"
      style={{
        WebkitMaskImage: 'url("/menu-list-square.png")',
        maskImage: 'url("/menu-list-square.png")',
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

function SheetIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M4 1.75A1.75 1.75 0 0 1 5.75 0h3.98c.46 0 .9.18 1.23.5l2.54 2.54c.32.33.5.77.5 1.23v9.98A1.75 1.75 0 0 1 12.25 16h-6.5A1.75 1.75 0 0 1 4 14.25zM9.5 1.5v2.25c0 .41.34.75.75.75h2.25zM6 7.25c0 .41.34.75.75.75h4.5a.75.75 0 0 0 0-1.5h-4.5a.75.75 0 0 0-.75.75m0 3c0 .41.34.75.75.75h4.5a.75.75 0 0 0 0-1.5h-4.5a.75.75 0 0 0-.75.75M6.75 12.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5z" />
    </svg>
  );
}

function AddToSheetIcon({ showPlus = true }) {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center overflow-visible" aria-hidden="true">
      <SheetIcon />
      {showPlus ? (
        <span className="pointer-events-none absolute -right-[6px] top-0 h-[6px] w-[6px]">
          <span className="absolute left-0 top-1/2 h-[1.25px] w-full -translate-y-1/2 rounded-full bg-current" />
          <span className="absolute left-1/2 top-0 h-full w-[1.25px] -translate-x-1/2 rounded-full bg-current" />
        </span>
      ) : null}
    </span>
  );
}

function SettingsIcon() {
  return (
    <span
      aria-hidden="true"
      className="block h-4 w-4 bg-current"
      style={{
        WebkitMaskImage: 'url("/setting.png")',
        maskImage: 'url("/setting.png")',
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

// ====================
// INSTRUMENT SET (MVP+)
// ====================

const ALL_INSTRUMENTS = [
  { id: "splash", label: "Splash", midi: 55 },
  { id: "china", label: "China", midi: 52 },
  { id: "crash2", label: "Crash 2", midi: 57 },
  { id: "crash1", label: "Crash 1", midi: 49 },
  { id: "ride", label: "Ride", midi: 51 },
  { id: "rideBell", label: "Ride Bell", midi: 53 },

  { id: "hihatOpen", label: "HH Open", midi: 46 },
  { id: "hihat", label: "Hi-Hat", midi: 42 },
  { id: "hihatFoot", label: "HH Foot", midi: 44 },

  { id: "cowbell", label: "Cowbell", midi: 56 },

  { id: "tom1", label: "Tom 1", midi: 48 },
  { id: "tom2", label: "Tom 2", midi: 45 },
  { id: "floorTom", label: "Floor Tom", midi: 41 },

  { id: "sideStick", label: "Sidestick", midi: 37 },
  { id: "snare", label: "Snare", midi: 38 },
  { id: "kick", label: "Kick", midi: 36 }
];

const INSTRUMENT_BY_ID = Object.fromEntries(ALL_INSTRUMENTS.map((i) => [i.id, i]));

const DRUMKIT_PRESETS = {
  standard: ["crash2", "crash1", "ride", "hihatFoot", "tom1", "tom2", "floorTom", "hihat", "snare", "kick"],
  full: [
    "splash",
    "cowbell",
    "china",
    "crash2",
    "crash1",
    "rideBell",
    "ride",
    "hihatFoot",
    "tom1",
    "tom2",
    "floorTom",
    "hihatOpen",
    "hihat",
    "sideStick",
    "snare",
    "kick",
  ],
  ksh: ["hihat", "snare", "kick"],
};

const BUILTIN_PRESET_ORDER = ["standard", "full", "ksh"];
const PRESET_LABELS = {
  standard: "Standard",
  full: "Full",
  ksh: "Minimal",
};
const USER_PRESETS_STORAGE_KEY = "drum-grid-user-presets-v1";
const LOCAL_BEAT_LIBRARY_STORAGE_KEY = "drum-grid-local-beat-library-v1";
const DEVICE_LOCAL_BEAT_LIBRARY_SNAPSHOT_STORAGE_KEY =
  "drum-grid-device-local-beat-library-snapshot-v1";
const PUBLIC_SUBMIT_COMPOSER_STORAGE_KEY = "drum-grid-public-submit-composer-v1";
const SONG_ARRANGEMENT_STORAGE_KEY = "drum-grid-song-arrangement-v1";
const SONG_ARRANGEMENT_LIBRARY_STORAGE_KEY = "drum-grid-song-arrangement-library-v1";
const DEVICE_LOCAL_SONG_ARRANGEMENT_LIBRARY_SNAPSHOT_STORAGE_KEY =
  "drum-grid-device-local-song-arrangement-library-snapshot-v1";
const LAST_USED_ARRANGEMENT_ID_STORAGE_KEY = "drum-grid-last-used-arrangement-id-v1";
const PERSONAL_CLOUD_IMPORT_DECISIONS_STORAGE_KEY = "drum-grid-personal-cloud-import-decisions-v1";
const PLAYBACK_RATE_STORAGE_KEY = "drum-grid-playback-rate-v1";
const METRONOME_ENABLED_STORAGE_KEY = "drum-grid-metronome-enabled-v1";
const METRONOME_VOLUME_STORAGE_KEY = "drum-grid-metronome-volume-v1";
const DEFAULT_METRONOME_VOLUME_STORAGE_KEY = "drum-grid-default-metronome-volume-v1";
const DEFAULT_METRONOME_VOLUME = 0.5;
const METRONOME_COUNT_IN_ENABLED_STORAGE_KEY = "drum-grid-metronome-count-in-enabled-v1";
const MIDI_IMPORT_SNARE_GHOST_MAX_STORAGE_KEY = "drum-grid-midi-import-snare-ghost-max-v1";
const MIDI_IMPORT_TOM_GHOST_MAX_STORAGE_KEY = "drum-grid-midi-import-tom-ghost-max-v1";
const MIDI_IMPORT_HIHAT_GHOST_MAX_STORAGE_KEY = "drum-grid-midi-import-hihat-ghost-max-v1";
const GRID_SELECTION_HOLD_SPEED_STORAGE_KEY = "drum-grid-selection-hold-speed-v1";
const SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY = "drum-grid-settings-sidebar-collapsed-v1";
const SETTINGS_SIDEBAR_DEFAULT_OPEN_STORAGE_KEY = "drum-grid-settings-sidebar-default-open-v1";
const STICKING_GUIDE_ENABLED_STORAGE_KEY = "drum-grid-sticking-guide-enabled-v1";
const STICKING_HANDEDNESS_STORAGE_KEY = "drum-grid-sticking-handedness-v1";
const STICKING_LEAD_HAND_STORAGE_KEY = "drum-grid-sticking-lead-hand-v1";
const STICKING_EDIT_MODE_ENABLED_STORAGE_KEY = "drum-grid-sticking-edit-mode-enabled-v1";
const NOTATION_STICKING_SELECTION_MODE_ENABLED_STORAGE_KEY =
  "drum-grid-notation-sticking-selection-mode-enabled-v1";
const STICKING_OVERRIDES_STORAGE_KEY = "drum-grid-sticking-overrides-v1";
const STICKING_KEEP_QUARTER_LEAD_HAND_STORAGE_KEY =
  "drum-grid-sticking-keep-quarter-lead-hand-v1";
const COUNT_ROW_SELECTED_SUBDIVISION_STORAGE_KEY = "drum-grid-count-row-selected-subdivision-v1";
const SHOW_EDITED_STICKING_STORAGE_KEY = "drum-grid-show-edited-sticking-v1";
const SHOW_NOTATION_STICKING_STORAGE_KEY = "drum-grid-show-notation-sticking-v1";
const AUTO_PRINT_NEW_BEAT_STICKING_STORAGE_KEY = "drum-grid-auto-print-new-beat-sticking-v1";
const NOTATION_STICKING_VIEW_STORAGE_KEY = "drum-grid-notation-sticking-view-v2";
const NOTATION_STICKING_SELECTION_STORAGE_KEY = "drum-grid-notation-sticking-selection-v1";
const ARRANGEMENT_NOTATION_BARS_PER_ROW_STORAGE_KEY =
  "drum-grid-arrangement-notation-bars-per-row-v1";
const ARRANGEMENT_NOTATION_DYNAMIC_SPACING_STORAGE_KEY =
  "drum-grid-arrangement-notation-dynamic-spacing-v1";
const ARRANGEMENT_NOTATION_GLOBAL_MERGE_RESTS_STORAGE_KEY =
  "drum-grid-arrangement-notation-global-merge-rests-v1";
const ARRANGEMENT_NOTATION_GLOBAL_MERGE_NOTES_STORAGE_KEY =
  "drum-grid-arrangement-notation-global-merge-notes-v1";
const ARRANGEMENT_NOTATION_GLOBAL_DOTTED_NOTES_STORAGE_KEY =
  "drum-grid-arrangement-notation-global-dotted-notes-v1";
const ARRANGEMENT_NOTATION_SCROLL_ROWS_STORAGE_KEY =
  "drum-grid-arrangement-notation-scroll-rows-v1";
const ARRANGEMENT_NOTATION_THEME_STORAGE_KEY =
  "drum-grid-arrangement-notation-theme-v1";
const ARRANGEMENT_NOTATION_VIRTUALIZE_STORAGE_KEY =
  "drum-grid-arrangement-notation-virtualize-v1";
const ARRANGEMENT_NOTATION_PREVIEW_SCALE_STORAGE_KEY =
  "drum-grid-arrangement-notation-preview-scale-v1";
const ARRANGEMENT_TITLE_LINE1_STORAGE_KEY = "drum-grid-arrangement-title-line1-v1";
const ARRANGEMENT_TITLE_LINE2_STORAGE_KEY = "drum-grid-arrangement-title-line2-v1";
const ARRANGEMENT_COMPOSER_STORAGE_KEY = "drum-grid-arrangement-composer-v1";
const PREFERENCES_CATEGORY_STORAGE_KEY = "drum-grid-preferences-category-v1";
const GRID_NOTATION_GAP_STORAGE_KEY = "drum-grid-grid-notation-gap-v1";
const NOTATION_GRID_GAP_OFFSET_STORAGE_KEY = "drum-grid-notation-grid-gap-offset-v1";
const DEFAULT_LOOP_REPEATS_STORAGE_KEY = "drum-grid-default-loop-repeats-v1";
const STARTUP_GRID_SETTINGS_STORAGE_KEY = "drum-grid-startup-grid-settings-v1";
const BEAT_LIBRARY_CONTAINERS_STORAGE_KEY = "drum-grid-beat-library-containers-v1";
const DEVICE_LOCAL_BEAT_LIBRARY_CONTAINERS_SNAPSHOT_STORAGE_KEY =
  "drum-grid-device-local-beat-library-containers-snapshot-v1";
const PERSONAL_LIBRARY_STATE_PAYLOAD_KIND = "personal-library-state";
const PERSONAL_LIBRARY_STATE_SHARE_LINK_KIND = "arrangement";
const SHARE_LINK_CLEANUP_LAST_RUN_STORAGE_KEY = "drum-grid-share-link-cleanup-last-run-v1";
const SHARE_LINK_CLEANUP_LAST_COUNT_STORAGE_KEY = "drum-grid-share-link-cleanup-last-count-v1";
const TEMPORARY_SHARE_LINK_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 120;
const TEMPORARY_SHARE_LINK_CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24;
const BEAT_LIBRARY_SELECTED_CONTAINER_STORAGE_KEY = "drum-grid-beat-library-selected-container-v1";
const BEAT_LIBRARY_ROOT_COLLAPSED_STORAGE_KEY = "drum-grid-beat-library-root-collapsed-v1";
const GRID_SETTINGS_PRESET_LIBRARY_STORAGE_KEY = "drum-grid-grid-settings-presets-v1";
const APP_VERSION = "0.1.497";
const BEAT_CATEGORY_OPTIONS = [
  "Groove",
  "Fill",
  "Intro",
  "Verse",
  "Chorus",
  "Bridge",
  "Outro",
  "Other",
];
const BEAT_STYLE_OPTIONS = ["Rock", "Funk", "Jazz", "Hiphop", "DnB", "Disco", "Latin & World"];


const CELL = {
  OFF: "off",
  ON: "on",
  GHOST: "ghost",
  ACCENT: "accent",
};

const CELL_CYCLE = [CELL.OFF, CELL.ON];
const MOVE_OVERLAP_MODES = [
  { id: "all-to-all", label: "All overwrites" },
  { id: "active-to-all", label: "Hits overwrite" },
  { id: "active-to-empty", label: "Fill in gaps" },
];
const getOverlapModeDescription = (modeId) => {
  if (modeId === "all-to-all") return "Every looped step overwrites whatever is already in the target area.";
  if (modeId === "active-to-all") return "Only looped hits overwrite the target area. Empty loop steps do not erase notes.";
  if (modeId === "active-to-empty") return "Looped hits are written only into empty target steps. Existing notes stay unchanged.";
  return "Choose how looped notes interact with existing notes.";
};
const LIBRARY_SORT_MODES = [
  { id: "latest", label: "Creation date: newest" },
  { id: "oldest", label: "Creation date: oldest" },
  { id: "bpm-asc", label: "BPM: low to high" },
  { id: "bpm-desc", label: "BPM: high to low" },
];
const LIBRARY_BPM_FILTER_MODES = [
  { id: "any", label: "Any BPM" },
  { id: "exact", label: "Exact BPM" },
  { id: "pm5", label: "BPM ±5" },
  { id: "pm10", label: "BPM ±10" },
];
const DEFAULT_GRID_SETTINGS_PRESETS = [
  { id: "grid-4-4-16-1", name: "Preset 1", bars: 1, resolution: 16, timeSig: { n: 4, d: 4 }, bpm: 120 },
  { id: "grid-7-4-8-2", name: "Preset 2", bars: 2, resolution: 8, timeSig: { n: 7, d: 4 }, bpm: 120 },
  { id: "grid-5-4-8-2", name: "Preset 3", bars: 2, resolution: 8, timeSig: { n: 5, d: 4 }, bpm: 120 },
];
const LOOP_REPEATS_ORDER = ["all", "off", "1", "2", "3", "4", "5", "6", "7", "8"];
const BEAT_LIBRARY_CONTAINER_TYPES = [
  { id: "folder", label: "Folder" },
];
const MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS = {
  21: "splash",
  22: "hihat",
  23: "hihat",
  24: "hihat",
  25: "hihatOpen",
  26: "hihatOpen",
  27: "crash1",
  28: "crash2",
  29: "ride",
  30: "rideBell",
  31: "sideStick",
  32: "snare",
  33: "kick",
  34: "kick",
  39: "snare",
  54: "hihatOpen",
  58: "crash2",
};
const MIDI_IMPORT_MAPPING_PRESETS = [
  { id: "manual", label: "Manual", assignments: {} },
  {
    id: "expanded-gm",
    label: "Expanded GM",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      24: "hihatOpen",
      31: "sideStick",
      39: "snare",
    },
  },
  {
    id: "ezdrummer",
    label: "EZdrummer",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      21: "sideStick",
      24: "hihatOpen",
      25: "hihatOpen",
      26: "hihatOpen",
      31: "sideStick",
      39: "snare",
      54: "hihatOpen",
    },
  },
  {
    id: "common-edrums",
    label: "Common e-drums",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
    },
  },
  {
    id: "superior-drummer",
    label: "Superior Drummer",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      21: "sideStick",
      24: "hihatOpen",
      25: "hihatOpen",
      26: "hihatOpen",
      47: "tom2",
      60: "hihatOpen",
      62: "hihat",
      63: "hihat",
    },
  },
  {
    id: "addictive-drums-2",
    label: "Addictive Drums 2",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      21: "hihatFoot",
      24: "hihat",
      25: "hihatOpen",
      26: "hihatOpen",
      31: "sideStick",
      39: "snare",
      54: "hihat",
    },
  },
  {
    id: "steven-slate-drums",
    label: "Steven Slate Drums",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      21: "sideStick",
      24: "hihat",
      25: "hihatOpen",
      26: "hihatOpen",
      31: "sideStick",
      39: "snare",
      54: "hihatOpen",
    },
  },
  {
    id: "bfd3",
    label: "BFD3",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      24: "kick",
      25: "sideStick",
      26: "snare",
      27: "floorTom",
      28: "hihatFoot",
      29: "hihatOpen",
      30: "tom2",
      31: "hihat",
      32: "tom1",
      33: "china",
      34: "rideBell",
      35: "splash",
      39: "ride",
      57: "crash2",
      58: "crash2",
    },
  },
  {
    id: "getgood-drums",
    label: "GetGood Drums",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      21: "sideStick",
      24: "hihatOpen",
      25: "hihatOpen",
      26: "hihatOpen",
      31: "sideStick",
      39: "snare",
      54: "hihatOpen",
    },
  },
  {
    id: "mt-power-drum-kit-2",
    label: "MT Power Drum Kit 2",
    assignments: {
      ...MIDI_IMPORT_COMMON_FALLBACK_ASSIGNMENTS,
      21: "hihatFoot",
      24: "hihat",
      25: "hihatOpen",
      31: "sideStick",
      39: "snare",
    },
  },
];
const MIDI_IMPORT_MAPPING_PRESET_BY_ID = Object.fromEntries(
  MIDI_IMPORT_MAPPING_PRESETS.map((preset) => [preset.id, preset])
);

const TUPLET_OPTIONS = [null, 3, 5, 6, 7, 9];
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
const COUNT_ROW_SUBDIVISION_OPTIONS = [3, 4, 5, 6, 7, 8, 9];
const DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE = {
  3: { h: 22, s: 78, l: 26, opacity: 20 },
  5: { h: 245, s: 58, l: 51, opacity: 20 },
  6: { h: 26, s: 90, l: 37, opacity: 20 },
  7: { h: 163, s: 94, l: 24, opacity: 20 },
  9: { h: 295, s: 72, l: 40, opacity: 20 },
};
const LEGACY_TUPLET_GRID_DEFAULT_OPACITY = 25;

function normalizeTupletAppearanceByValue(raw) {
  const next = {};
  Object.entries(DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE).forEach(([key, defaults]) => {
    const source = raw && typeof raw === "object" ? raw[key] : null;
    const h = Number(source?.h);
    const s = Number(source?.s);
    const l = Number(source?.l);
    const opacity = Number(source?.opacity);
    const hasLegacyDefaultOpacity =
      Number.isFinite(opacity) &&
      Math.round(opacity) === LEGACY_TUPLET_GRID_DEFAULT_OPACITY &&
      (!Number.isFinite(h) || Math.round(h) === defaults.h) &&
      (!Number.isFinite(s) || Math.round(s) === defaults.s) &&
      (!Number.isFinite(l) || Math.round(l) === defaults.l);
    next[key] = {
      h: Number.isFinite(h) ? Math.max(0, Math.min(360, Math.round(h))) : defaults.h,
      s: Number.isFinite(s) ? Math.max(0, Math.min(100, Math.round(s))) : defaults.s,
      l: Number.isFinite(l) ? Math.max(0, Math.min(100, Math.round(l))) : defaults.l,
      opacity: hasLegacyDefaultOpacity
        ? defaults.opacity
        : Number.isFinite(opacity)
          ? Math.max(0, Math.min(100, Math.round(opacity)))
          : defaults.opacity,
    };
  });
  return next;
}

function formatTupletHslColor(appearance, alpha = 1) {
  const h = Math.max(0, Math.min(360, Math.round(Number(appearance?.h) || 0)));
  const s = Math.max(0, Math.min(100, Math.round(Number(appearance?.s) || 0)));
  const l = Math.max(0, Math.min(100, Math.round(Number(appearance?.l) || 0)));
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function hslToHex(h, s, l) {
  const hue = ((Number(h) || 0) % 360 + 360) % 360;
  const sat = Math.max(0, Math.min(100, Number(s) || 0)) / 100;
  const light = Math.max(0, Math.min(100, Number(l) || 0)) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;
  if (segment >= 0 && segment < 1) {
    rPrime = chroma;
    gPrime = x;
  } else if (segment < 2) {
    rPrime = x;
    gPrime = chroma;
  } else if (segment < 3) {
    gPrime = chroma;
    bPrime = x;
  } else if (segment < 4) {
    gPrime = x;
    bPrime = chroma;
  } else if (segment < 5) {
    rPrime = x;
    bPrime = chroma;
  } else {
    rPrime = chroma;
    bPrime = x;
  }
  const match = light - chroma / 2;
  const toHex = (value) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
}

function hexToHsl(hex) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function encodeBase64UrlUtf8(input) {
  try {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch (_) {
    return "";
  }
}

function decodeBase64UrlUtf8(input) {
  try {
    const padded = `${input}`.replace(/-/g, "+").replace(/_/g, "/");
    const base64 = padded + "===".slice((padded.length + 3) % 4);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (_) {
    return null;
  }
}

function encodeShareState(state) {
  try {
    return encodeBase64UrlUtf8(JSON.stringify(state));
  } catch (_) {
    return "";
  }
}

function decodeShareState(raw) {
  if (!raw) return null;
  const json = decodeBase64UrlUtf8(raw);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function clampPlaybackRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.5, Math.min(2, Math.round(n * 100) / 100));
}

function parseStoredUnitVolume(raw) {
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normalizeArrangementItems(items) {
  if (!Array.isArray(items)) return [];
  const normalizeSpacingPreset = (raw) => {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "large" || value === "tight") return value;
    return "normal";
  };
  const normalizeBarsPerRowOverride = (raw) => {
    if (raw == null || raw === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded <= 1) return 1;
    if (rounded === 2) return 2;
    if (rounded === 3) return 3;
    if (rounded >= 4) return 4;
    return 2;
  };
  const normalizeNotationBooleanOverride = (raw) => (
    typeof raw === "boolean" ? raw : null
  );
  const normalizeNotationPrintStickingModeOverride = (raw) => (
    raw === "all" || raw === "custom" ? raw : null
  );
  return items
    .map((item) => ({
      id: String(item?.id || ""),
      source:
        item?.source === "public"
          ? "public"
          : item?.source === "shared"
            ? "shared"
            : "local",
      beatId: String(item?.beatId || ""),
      repeats: Math.max(1, Math.min(64, Number(item?.repeats) || 1)),
      showNotationBeatName: Boolean(item?.showNotationBeatName),
      notationCustomText: String(item?.notationCustomText || ""),
      notationDynamicSpacingCustom: item?.notationDynamicSpacingCustom === true,
      notationDynamicSpacingOverride:
        typeof item?.notationDynamicSpacingOverride === "boolean"
          ? item.notationDynamicSpacingOverride
          : (typeof item?.notationDynamicSpacing === "boolean" ? item.notationDynamicSpacing : null),
      notationJoinWithNext: Boolean(item?.notationJoinWithNext),
      notationBarsPerRowCustom: Boolean(item?.notationBarsPerRowCustom),
      notationBarsPerRowOverride: normalizeBarsPerRowOverride(item?.notationBarsPerRowOverride),
      notationSpacingPreset: normalizeSpacingPreset(item?.notationSpacingPreset),
      notationMergeRestsCustom: item?.notationMergeRestsCustom === true,
      notationMergeRestsFollowBeat: item?.notationMergeRestsFollowBeat === true,
      notationMergeRestsOverride: normalizeNotationBooleanOverride(item?.notationMergeRestsOverride),
      notationMergeNotesCustom: item?.notationMergeNotesCustom === true,
      notationMergeNotesFollowBeat: item?.notationMergeNotesFollowBeat === true,
      notationMergeNotesOverride: normalizeNotationBooleanOverride(item?.notationMergeNotesOverride),
      notationDottedNotesCustom: item?.notationDottedNotesCustom === true,
      notationDottedNotesFollowBeat: item?.notationDottedNotesFollowBeat === true,
      notationDottedNotesOverride: normalizeNotationBooleanOverride(item?.notationDottedNotesOverride),
      notationPrintStickingCustom: item?.notationPrintStickingCustom === true,
      notationPrintStickingFollowBeat:
        Object.prototype.hasOwnProperty.call(item || {}, "notationPrintStickingFollowBeat")
          ? item?.notationPrintStickingFollowBeat === true
          : item?.notationPrintStickingCustom !== true,
      notationPrintStickingOverride: normalizeNotationBooleanOverride(item?.notationPrintStickingOverride),
      notationPrintStickingModeOverride: normalizeNotationPrintStickingModeOverride(item?.notationPrintStickingModeOverride),
    }))
    .filter((item) => item.id && item.beatId);
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function readStoredLocalBeats() {
  try {
    const raw = window.localStorage.getItem(LOCAL_BEAT_LIBRARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const fallbackBaseTime = Date.now();
    return parsed
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const payload = entry?.payload && typeof entry.payload === "object" ? { ...entry.payload } : {};
        const entryNotationStickingSelection =
          entry?.notationStickingSelection && typeof entry.notationStickingSelection === "object"
            ? Object.fromEntries(
                Object.entries(entry.notationStickingSelection).filter(([, value]) => value === true)
              )
            : null;
        if (
          entryNotationStickingSelection &&
          !(
            payload.notationStickingSelection &&
            typeof payload.notationStickingSelection === "object"
          )
        ) {
          payload.notationStickingSelection = entryNotationStickingSelection;
        }
        const fallbackCreatedAt = new Date(fallbackBaseTime - index * 1000).toISOString();
        const createdAt = String(
          entry?.createdAt ||
            entry?.updatedAt ||
            payload?.createdAt ||
            fallbackCreatedAt
        );
        const updatedAt = String(entry?.updatedAt || createdAt);
        return {
          ...entry,
          id: String(entry?.id || `local-${index}`),
          name: String(entry?.name || "").trim() || "Untitled Beat",
          category: String(entry?.category || "Groove"),
          style: entry?.style ? String(entry.style) : undefined,
          timeSigCategory:
            String(entry?.timeSigCategory || "") ||
            `${payload?.timeSig?.n || 4}/${payload?.timeSig?.d || 4}`,
          bpm: Math.max(20, Math.min(400, Number(entry?.bpm ?? payload?.bpm) || 120)),
          createdAt,
          updatedAt,
          payload,
          notationStickingSelection:
            payload?.notationStickingSelection &&
            typeof payload.notationStickingSelection === "object"
              ? Object.fromEntries(
                  Object.entries(payload.notationStickingSelection).filter(([, value]) => value === true)
                )
              : {},
          libraryMeta:
            entry?.libraryMeta && typeof entry.libraryMeta === "object"
              ? {
                  parentId: entry.libraryMeta.parentId ? String(entry.libraryMeta.parentId) : null,
                  manualOrder: Number.isFinite(Number(entry.libraryMeta.manualOrder))
                    ? Number(entry.libraryMeta.manualOrder)
                    : 0,
                }
              : payload?.libraryMeta && typeof payload.libraryMeta === "object"
                ? {
                    parentId: payload.libraryMeta.parentId ? String(payload.libraryMeta.parentId) : null,
                    manualOrder: Number.isFinite(Number(payload.libraryMeta.manualOrder))
                      ? Number(payload.libraryMeta.manualOrder)
                      : 0,
                  }
                : null,
          source: "local",
        };
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function buildEmptyTupletOverridesForPreset(bars, timeSig) {
  const safeBars = Math.max(1, Number(bars) || 1);
  const quarterCount = Math.max(1, getQuarterBeatsPerBar(timeSig || { n: 4, d: 4 }));
  return Array.from({ length: safeBars }, () =>
    Array.from({ length: quarterCount }, () => null)
  );
}

const BUILT_IN_STARTUP_GRID_SETTINGS = {
  resolution: 8,
  bars: 2,
  timeSig: { n: 4, d: 4 },
  tupletsByBar: buildEmptyTupletOverridesForPreset(2, { n: 4, d: 4 }),
  kitInstrumentIds: [...DRUMKIT_PRESETS.standard],
};

function cloneTupletOverridesByBar(rows, bars, timeSig) {
  const fallback = buildEmptyTupletOverridesForPreset(bars, timeSig);
  return fallback.map((row, barIdx) =>
    row.map((_, qIdx) => clampTupletValue(rows?.[barIdx]?.[qIdx]) ?? null)
  );
}

function normalizeStartupGridSettings(entry) {
  if (!entry || typeof entry !== "object") return null;
  const bars = Math.max(1, Number(entry?.bars) || BUILT_IN_STARTUP_GRID_SETTINGS.bars);
  const resolution = [4, 8, 16, 32].includes(Number(entry?.resolution))
    ? Number(entry.resolution)
    : BUILT_IN_STARTUP_GRID_SETTINGS.resolution;
  const timeSig = {
    n: Math.max(2, Math.min(15, Number(entry?.timeSig?.n) || BUILT_IN_STARTUP_GRID_SETTINGS.timeSig.n)),
    d: Number(entry?.timeSig?.d) === 8 ? 8 : 4,
  };
  const kitInstrumentIds = Array.isArray(entry?.kitInstrumentIds)
    ? [...new Set(entry.kitInstrumentIds.filter((id) => INSTRUMENT_BY_ID[id]))]
    : [];
  return {
    bars,
    resolution,
    timeSig,
    tupletsByBar: cloneTupletOverridesByBar(entry?.tupletsByBar, bars, timeSig),
    kitInstrumentIds: kitInstrumentIds.length
      ? kitInstrumentIds
      : [...BUILT_IN_STARTUP_GRID_SETTINGS.kitInstrumentIds],
  };
}

function readStoredStartupGridSettings() {
  try {
    const raw = window.localStorage.getItem(STARTUP_GRID_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStartupGridSettings(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

function getNotationPrintStickingModeFromPayload(payload, fallbackMode = "off") {
  const nextFallback =
    fallbackMode === "all" || fallbackMode === "custom" || fallbackMode === "off"
      ? fallbackMode
      : "off";
  if (!payload || typeof payload !== "object") return nextFallback;
  if (payload.showNotationSticking === false) return "off";
  if (payload.showNotationSticking === true) {
    const hasCustomSelection =
      payload.notationStickingSelection &&
      typeof payload.notationStickingSelection === "object" &&
      Object.values(payload.notationStickingSelection).some((value) => value === true);
    return hasCustomSelection ? "custom" : "all";
  }
  return nextFallback;
}

function normalizeGridSettingsPresetEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object") return null;
  const bars = Math.max(1, Number(entry?.bars) || 1);
  const resolution = [4, 8, 16, 32].includes(Number(entry?.resolution))
    ? Number(entry.resolution)
    : 8;
  const timeSig = {
    n: Math.max(2, Math.min(15, Number(entry?.timeSig?.n) || 4)),
    d: Number(entry?.timeSig?.d) === 8 ? 8 : 4,
  };
  return {
    id: String(entry?.id || `grid-preset-${index}`),
    name: String(entry?.name || "").trim() || `Preset ${index + 1}`,
    bars,
    resolution,
    timeSig,
    bpm: Math.max(20, Math.min(400, Number(entry?.bpm) || 120)),
    tupletsByBar: buildEmptyTupletOverridesForPreset(bars, timeSig),
  };
}

function readStoredGridSettingsPresets() {
  try {
    const raw = window.localStorage.getItem(GRID_SETTINGS_PRESET_LIBRARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : DEFAULT_GRID_SETTINGS_PRESETS;
    const source = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_GRID_SETTINGS_PRESETS;
    const normalized = source
      .map((entry, index) => normalizeGridSettingsPresetEntry(entry, index))
      .filter(Boolean);
    return normalized.length
      ? normalized
      : DEFAULT_GRID_SETTINGS_PRESETS
          .map((entry, index) => normalizeGridSettingsPresetEntry(entry, index))
          .filter(Boolean);
  } catch (_) {
    return DEFAULT_GRID_SETTINGS_PRESETS
      .map((entry, index) => normalizeGridSettingsPresetEntry(entry, index))
      .filter(Boolean);
  }
}

function normalizeBeatLibraryContainers(source) {
  if (!Array.isArray(source)) return [];
  return source
    .map((entry, index) => ({
      id: String(entry?.id || ""),
      name: String(entry?.name || "").trim(),
      type: "folder",
      parentId: entry?.parentId ? String(entry.parentId) : null,
      collapsed: entry?.collapsed === true,
      order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : index,
    }))
    .filter((entry) => entry.id && entry.name);
}

function readStoredBeatLibraryContainers() {
  try {
    const raw = window.localStorage.getItem(BEAT_LIBRARY_CONTAINERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeBeatLibraryContainers(parsed);
  } catch (_) {
    return [];
  }
}

function readStoredDeviceLocalBeats() {
  try {
    const raw = window.localStorage.getItem(DEVICE_LOCAL_BEAT_LIBRARY_SNAPSHOT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return normalizeLocalBeatLibrary(parsed);
  } catch (_) {}
  return readStoredLocalBeats();
}

function readStoredDeviceLocalArrangements() {
  try {
    const raw = window.localStorage.getItem(
      DEVICE_LOCAL_SONG_ARRANGEMENT_LIBRARY_SNAPSHOT_STORAGE_KEY
    );
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return normalizeArrangementLibrary(parsed);
  } catch (_) {}
  return readStoredSavedArrangements();
}

function readStoredDeviceLocalBeatLibraryContainers() {
  try {
    const raw = window.localStorage.getItem(
      DEVICE_LOCAL_BEAT_LIBRARY_CONTAINERS_SNAPSHOT_STORAGE_KEY
    );
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return normalizeBeatLibraryContainers(parsed);
  } catch (_) {}
  return readStoredBeatLibraryContainers();
}

function getPersonalLibraryStateShareId(userId) {
  const normalized = String(userId || "").trim();
  return normalized ? `personal-library-${normalized}` : "";
}

function buildOfflineLocalLibrarySnapshot() {
  const beats = readStoredDeviceLocalBeats();
  const arrangements = readStoredDeviceLocalArrangements();
  const folders = readStoredDeviceLocalBeatLibraryContainers();
  const fingerprint = JSON.stringify({
    beats: beats.map((entry) => [
      String(entry?.id || ""),
      String(entry?.name || ""),
      String(entry?.updatedAt || entry?.createdAt || ""),
    ]),
    arrangements: arrangements.map((entry) => [
      String(entry?.id || ""),
      String(entry?.name || ""),
      String(entry?.updatedAt || entry?.createdAt || ""),
    ]),
    folders: folders.map((entry) => [
      String(entry?.id || ""),
      String(entry?.name || ""),
      String(entry?.parentId || ""),
      entry?.collapsed === true ? 1 : 0,
      Number(entry?.order) || 0,
    ]),
  });
  return { beats, arrangements, folders, fingerprint };
}

function readPersonalCloudImportDecisions() {
  try {
    const raw = window.localStorage.getItem(PERSONAL_CLOUD_IMPORT_DECISIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writePersonalCloudImportDecision(userId, fingerprint, decision) {
  try {
    const key = `${String(userId || "")}:${String(fingerprint || "")}`;
    if (!key || key === ":") return;
    const next = {
      ...readPersonalCloudImportDecisions(),
      [key]: {
        decision: String(decision || ""),
        updatedAt: new Date().toISOString(),
      },
    };
    window.localStorage.setItem(
      PERSONAL_CLOUD_IMPORT_DECISIONS_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch (_) {}
}

function hasHandledPersonalCloudImportDecision(userId, fingerprint) {
  if (!userId || !fingerprint) return false;
  const decisions = readPersonalCloudImportDecisions();
  return Boolean(decisions[`${String(userId)}:${String(fingerprint)}`]);
}

function writeStoredLocalBeats(beats) {
  try {
    window.localStorage.setItem(LOCAL_BEAT_LIBRARY_STORAGE_KEY, JSON.stringify(beats || []));
  } catch (_) {}
}

function writeStoredDeviceLocalBeats(beats) {
  try {
    window.localStorage.setItem(
      DEVICE_LOCAL_BEAT_LIBRARY_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(beats || [])
    );
  } catch (_) {}
}

function writeStoredSavedArrangements(items) {
  try {
    window.localStorage.setItem(SONG_ARRANGEMENT_LIBRARY_STORAGE_KEY, JSON.stringify(items || []));
  } catch (_) {}
}

function writeStoredDeviceLocalArrangements(items) {
  try {
    window.localStorage.setItem(
      DEVICE_LOCAL_SONG_ARRANGEMENT_LIBRARY_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(items || [])
    );
  } catch (_) {}
}

function writeStoredBeatLibraryContainers(items) {
  try {
    window.localStorage.setItem(BEAT_LIBRARY_CONTAINERS_STORAGE_KEY, JSON.stringify(items || []));
  } catch (_) {}
}

function writeStoredDeviceLocalBeatLibraryContainers(items) {
  try {
    window.localStorage.setItem(
      DEVICE_LOCAL_BEAT_LIBRARY_CONTAINERS_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(items || [])
    );
  } catch (_) {}
}

function getBeatLibraryMeta(beat) {
  const direct = beat?.libraryMeta && typeof beat.libraryMeta === "object" ? beat.libraryMeta : null;
  const payloadMeta = beat?.payload?.libraryMeta && typeof beat.payload.libraryMeta === "object"
    ? beat.payload.libraryMeta
    : null;
  const meta = direct || payloadMeta || null;
  return {
    parentId: meta?.parentId ? String(meta.parentId) : null,
    manualOrder: Number.isFinite(Number(meta?.manualOrder)) ? Number(meta.manualOrder) : 0,
  };
}

function getComparableBeatPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  const nextBars = Math.max(1, Math.min(8, Number(payload?.bars) || 1));
  const nextResolution = [4, 8, 16, 32].includes(Number(payload?.resolution))
    ? Number(payload.resolution)
    : 8;
  const nextTimeSig = {
    n: Math.max(1, Number(payload?.timeSig?.n) || 4),
    d: Math.max(1, Number(payload?.timeSig?.d) || 4),
  };
  const quarterCount = getQuarterBeatsPerBar(nextTimeSig);
  const nextTupletsByBar = Array.from({ length: nextBars }, (_, barIdx) =>
    Array.from({ length: quarterCount }, (_, qIdx) => {
      const raw = payload?.tupletsByBar?.[barIdx]?.[qIdx];
      return clampTupletValue(raw) ?? null;
    })
  );
  const nextGrid = {};
  ALL_INSTRUMENTS.forEach((inst) => {
    const source = Array.isArray(payload?.grid?.[inst.id]) ? payload.grid[inst.id] : [];
    const events = source
      .map((entry) =>
        Array.isArray(entry)
          ? [Math.max(0, Math.round(Number(entry[0]) || 0)), Math.max(1, Math.min(3, Math.round(Number(entry[1]) || 1)))]
          : null
      )
      .filter(Boolean)
      .sort((a, b) => a[0] - b[0]);
    if (events.length) nextGrid[inst.id] = events;
  });
  const nextNotationStickingSelection =
    payload?.notationStickingSelection && typeof payload.notationStickingSelection === "object"
      ? Object.fromEntries(
          Object.entries(payload.notationStickingSelection)
            .filter(([, value]) => value === true)
            .sort(([a], [b]) => String(a).localeCompare(String(b)))
        )
      : {};
  const nextStickingOverrides =
    payload?.stickingOverrides && typeof payload.stickingOverrides === "object"
      ? Object.fromEntries(
          Object.entries(payload.stickingOverrides)
            .filter(
              ([key, value]) =>
                typeof key === "string" &&
                key.includes(":") &&
                (value === "L" || value === "R")
            )
            .sort(([a], [b]) => String(a).localeCompare(String(b)))
        )
      : {};
  const next = {
    v: Number(payload?.v) || 1,
    name: String(payload?.name || "").trim(),
    composer: String(payload?.composer || "").trim(),
    category: String(payload?.category || "").trim(),
    style: String(payload?.style || "").trim(),
    kitInstrumentIds:
      Array.isArray(payload?.kitInstrumentIds) && payload.kitInstrumentIds.length
        ? [...new Set(payload.kitInstrumentIds.filter((id) => INSTRUMENT_BY_ID[id]))]
        : [...DRUMKIT_PRESETS.standard],
    bars: nextBars,
    resolution: nextResolution,
    timeSig: nextTimeSig,
    bpm: Math.max(20, Math.min(400, Number(payload?.bpm) || 120)),
    layout:
      payload?.layout === "grid-right" ||
      payload?.layout === "notation-right" ||
      payload?.layout === "notation-top"
        ? payload.layout
        : "grid-top",
    mergeRests: payload?.mergeRests !== false,
    mergeNotes: payload?.mergeNotes !== false,
    dottedNotes: payload?.dottedNotes !== false,
    showNotationSticking: payload?.showNotationSticking !== false,
    notationStickingView: payload?.notationStickingView === "split-rows" ? "split-rows" : "above",
    tupletsByBar: nextTupletsByBar,
    grid: nextGrid,
    stickingHandedness: payload?.stickingHandedness === "left" ? "left" : "right",
    stickingLeadHand: payload?.stickingLeadHand === "left" ? "left" : "right",
    stickingKeepQuarterLeadHand: payload?.stickingKeepQuarterLeadHand !== false,
    ...(Object.keys(nextStickingOverrides).length > 0
      ? { stickingOverrides: nextStickingOverrides }
      : {}),
    ...(Object.keys(nextNotationStickingSelection).length > 0
      ? { notationStickingSelection: nextNotationStickingSelection }
      : {}),
  };
  if (next.showNotationSticking === false) {
    delete next.notationStickingSelection;
  } else if (next.notationStickingSelection) {
    const normalizedSelection = Object.fromEntries(
      Object.entries(next.notationStickingSelection).filter(([, value]) => value === true)
    );
    const normalizedKeys = Object.keys(normalizedSelection).sort();
    const allKeys = Object.keys(buildNotationStickingSelectionFromPayloadGrid(next.grid)).sort();
    const matchesAll =
      allKeys.length > 0 &&
      normalizedKeys.length === allKeys.length &&
      allKeys.every((key, idx) => key === normalizedKeys[idx]);
    if (matchesAll) {
      delete next.notationStickingSelection;
    }
  }
  delete next.libraryMeta;
  return next;
}

function getComparableBeatPayloadWithoutNotationSticking(payload) {
  const next = getComparableBeatPayload(payload);
  delete next.notationStickingSelection;
  return next;
}

function getComparableBeatPayloadForLibraryBeat(beat) {
  const payload = beat?.payload && typeof beat.payload === "object" ? beat.payload : {};
  const metadataPayload = {
    ...payload,
    name: String(beat?.name || payload?.name || "").trim(),
    category: String(beat?.category || payload?.category || "Groove"),
    style: String(beat?.style || payload?.style || ""),
    bpm: Number.isFinite(Number(beat?.bpm)) ? Number(beat.bpm) : payload?.bpm,
    ...(beat?.notationStickingSelection &&
    typeof beat.notationStickingSelection === "object" &&
    Object.keys(beat.notationStickingSelection).length > 0
      ? { notationStickingSelection: beat.notationStickingSelection }
      : {}),
  };
  return getComparableBeatPayload(metadataPayload);
}

function getComparableBeatPayloadForLibraryBeatWithoutNotationSticking(beat) {
  const next = getComparableBeatPayloadForLibraryBeat(beat);
  delete next.notationStickingSelection;
  return next;
}

function compareBeatLibraryOrder(a, b) {
  const metaA = getBeatLibraryMeta(a);
  const metaB = getBeatLibraryMeta(b);
  const orderDiff = (Number(metaA.manualOrder) || 0) - (Number(metaB.manualOrder) || 0);
  if (orderDiff) return orderDiff;
  return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
}

function readStoredSavedArrangements() {
  try {
    const raw = window.localStorage.getItem(SONG_ARRANGEMENT_LIBRARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: String(entry?.id || ""),
        name: String(entry?.name || "").trim(),
        titleLine1: String(entry?.titleLine1 || ""),
        titleLine2: String(entry?.titleLine2 || ""),
        composer: String(entry?.composer || ""),
        updatedAt: String(entry?.updatedAt || entry?.createdAt || ""),
        createdAt: String(entry?.createdAt || entry?.updatedAt || ""),
        items: normalizeArrangementItems(entry?.items),
      }))
      .filter((entry) => entry.id && entry.name);
  } catch (_) {
    return [];
  }
}

function normalizeCloudBeatRow(row) {
  if (!row || typeof row !== "object") return null;
  const payload = row.payload && typeof row.payload === "object" ? row.payload : null;
  if (!payload) return null;
  const notationStickingSelection =
    payload?.notationStickingSelection && typeof payload.notationStickingSelection === "object"
      ? Object.fromEntries(
          Object.entries(payload.notationStickingSelection).filter(([, value]) => value === true)
        )
      : {};
  const libraryMeta = payload?.libraryMeta && typeof payload.libraryMeta === "object"
    ? {
        parentId: payload.libraryMeta.parentId ? String(payload.libraryMeta.parentId) : null,
        manualOrder: Number.isFinite(Number(payload.libraryMeta.manualOrder))
          ? Number(payload.libraryMeta.manualOrder)
          : 0,
      }
    : null;
  return {
    id: String(row.id || ""),
    name: String(row.name || "").trim() || "Untitled Beat",
    category: "Groove",
    style: undefined,
    timeSigCategory: `${payload?.timeSig?.n || 4}/${payload?.timeSig?.d || 4}`,
    bpm: Math.max(20, Math.min(400, Number(payload?.bpm) || 120)),
    createdAt: String(row.created_at || row.updated_at || ""),
    updatedAt: String(row.updated_at || row.created_at || ""),
    payload,
    notationStickingSelection,
    libraryMeta,
    source: "local",
  };
}

function normalizeCloudArrangementRow(row) {
  if (!row || typeof row !== "object") return null;
  const items = normalizeArrangementItems(row.rows);
  return {
    id: String(row.id || ""),
    name: String(row.name || "").trim() || "Untitled Arrangement",
    titleLine1: String(row.title_line_1 || ""),
    titleLine2: String(row.title_line_2 || ""),
    composer: String(row.author || ""),
    updatedAt: String(row.updated_at || row.created_at || ""),
    createdAt: String(row.created_at || row.updated_at || ""),
    items,
  };
}

function makeShortShareId() {
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

function isPlainObjectRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stableSerializeValue(value) {
  if (value == null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerializeValue(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerializeValue(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function computeStableSha256Hex(input) {
  const text = String(input || "");
  try {
    if (window.crypto?.subtle) {
      const bytes = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch (_) {}
  let hash = 2166136261;
  for (let idx = 0; idx < text.length; idx += 1) {
    hash ^= text.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildCanonicalArrangementSharePayload(payload) {
  if (!isPlainObjectRecord(payload)) return null;
  const beats = Array.isArray(payload.beats) ? payload.beats : [];
  const beatIndexBySharedId = new Map();
  const normalizedBeats = beats
    .map((beat, index) => {
      const sharedId = String(beat?.id || "");
      if (sharedId) beatIndexBySharedId.set(sharedId, index);
      return {
        name: String(beat?.name || "").trim() || `Beat ${index + 1}`,
        category: String(beat?.category || "Groove"),
        style: beat?.style ? String(beat.style) : "",
        timeSigCategory: String(beat?.timeSigCategory || "4/4"),
        bpm: Math.max(20, Math.min(400, Number(beat?.bpm) || Number(beat?.payload?.bpm) || 120)),
        payload: getComparableBeatPayload(beat?.payload || {}),
      };
    });
  const normalizedItems = normalizeArrangementItems(payload.items).map((item) => ({
    beatIndex: Math.max(0, beatIndexBySharedId.get(String(item?.beatId || "")) ?? 0),
    repeats: Math.max(1, Number(item?.repeats) || 1),
  }));
  return {
    v: Number(payload?.v) || 1,
    kind: "arrangement",
    name: String(payload?.name || "").trim() || "Arrangement",
    titleLine1: String(payload?.titleLine1 || "").trim(),
    titleLine2: String(payload?.titleLine2 || "").trim(),
    composer: String(payload?.composer || "").trim(),
    beats: normalizedBeats,
    items: normalizedItems,
  };
}

async function buildSharePayloadFingerprint(mode, payload) {
  const canonical =
    mode === "arrangement"
      ? buildCanonicalArrangementSharePayload(payload)
      : {
          kind: "beat",
          payload: getComparableBeatPayload(payload),
        };
  return computeStableSha256Hex(stableSerializeValue(canonical));
}

function getShareLinkMeta(payload) {
  if (!isPlainObjectRecord(payload) || !isPlainObjectRecord(payload.shareMeta)) return null;
  return payload.shareMeta;
}

function isPersonalLibraryStatePayload(payload) {
  return String(payload?.kind || "") === PERSONAL_LIBRARY_STATE_PAYLOAD_KIND;
}

function isPublishedDefaultSharePayload(payload) {
  return payload?.publishedDefault === true;
}

function isTemporarySharePayload(payload) {
  return getShareLinkMeta(payload)?.temporary === true;
}

function isPermanentSharePayload(payload) {
  return getShareLinkMeta(payload)?.permanent === true;
}

function getShareLinkPurpose(row) {
  const explicitPurpose = String(row?.purpose || "").trim();
  if (Object.values(SHARE_LINK_PURPOSE).includes(explicitPurpose)) return explicitPurpose;
  const payload = row?.payload;
  if (isPersonalLibraryStatePayload(payload)) return SHARE_LINK_PURPOSE.PERSONAL_LIBRARY_STATE;
  if (isPublishedDefaultSharePayload(payload)) {
    return String(row?.kind || "") === "arrangement"
      ? SHARE_LINK_PURPOSE.PUBLIC_ARRANGEMENT
      : SHARE_LINK_PURPOSE.PUBLIC_BEAT;
  }
  if (isTemporarySharePayload(payload)) return SHARE_LINK_PURPOSE.TEMPORARY_SHARE;
  return "";
}

function isUserManagedShareLinkRow(row) {
  return getShareLinkPurpose(row) === SHARE_LINK_PURPOSE.TEMPORARY_SHARE;
}

function isPublicBeatShareLinkRow(row) {
  return getShareLinkPurpose(row) === SHARE_LINK_PURPOSE.PUBLIC_BEAT;
}

function isPublicArrangementShareLinkRow(row) {
  return getShareLinkPurpose(row) === SHARE_LINK_PURPOSE.PUBLIC_ARRANGEMENT;
}

function withShareLinkMeta(payload, nextMeta) {
  if (!isPlainObjectRecord(payload)) return payload;
  const sanitizedMeta = isPlainObjectRecord(nextMeta) ? nextMeta : {};
  return {
    ...payload,
    shareMeta: sanitizedMeta,
  };
}

function getSharePayloadFingerprint(payload) {
  return String(getShareLinkMeta(payload)?.fingerprint || "").trim();
}

function buildTemporarySharePayload(payload, fingerprint = "") {
  if (!isPlainObjectRecord(payload)) return payload;
  const now = new Date().toISOString();
  return withShareLinkMeta(payload, {
    temporary: true,
    permanent: false,
    fingerprint: String(fingerprint || "").trim(),
    createdAt: now,
    lastAccessedAt: null,
    accessCount: 0,
  });
}

function buildTouchedSharePayload(payload) {
  if (!isTemporarySharePayload(payload)) return payload;
  const currentMeta = getShareLinkMeta(payload) || {};
  return withShareLinkMeta(payload, {
    ...currentMeta,
    temporary: true,
    permanent: false,
    lastAccessedAt: new Date().toISOString(),
    accessCount: Math.max(0, Number(currentMeta.accessCount) || 0) + 1,
  });
}

function isShareLinkAutoCleanupCandidate(row, nowMs = Date.now()) {
  if (getShareLinkPurpose(row) !== SHARE_LINK_PURPOSE.TEMPORARY_SHARE) return false;
  const payload = row?.payload;
  if (!isTemporarySharePayload(payload)) return false;
  if (isPermanentSharePayload(payload)) return false;
  if (isPublishedDefaultSharePayload(payload) || isPersonalLibraryStatePayload(payload)) return false;
  const meta = getShareLinkMeta(payload) || {};
  const accessCount = Math.max(0, Number(meta.accessCount) || 0);
  if (accessCount > 0) return false;
  const createdAtMs = Date.parse(
    String(meta.createdAt || row?.created_at || row?.updated_at || "")
  );
  if (!Number.isFinite(createdAtMs)) return false;
  return nowMs - createdAtMs >= TEMPORARY_SHARE_LINK_MAX_AGE_MS;
}

function getProfileShareLinkLabel(row) {
  const payload = row?.payload;
  const kind = String(row?.kind || "");
  if (isPersonalLibraryStatePayload(payload)) return "Personal library state";
  if (kind === "beat") {
    if (isPublishedDefaultSharePayload(payload)) {
      return String(payload?.name || "").trim() || "Public beat";
    }
    return String(payload?.name || "").trim() || "Shared beat";
  }
  if (kind === "arrangement") {
    if (isPublishedDefaultSharePayload(payload)) {
      return (
        String(payload?.titleLine1 || "").trim() ||
        String(payload?.name || "").trim() ||
        "Public arrangement"
      );
    }
    return (
      String(payload?.titleLine1 || "").trim() ||
      String(payload?.name || "").trim() ||
      "Shared arrangement"
    );
  }
  return "Share link";
}

function getProfileShareLinkTypeLabel(row) {
  const payload = row?.payload;
  if (isPersonalLibraryStatePayload(payload)) return "Library state";
  if (isPermanentSharePayload(payload)) return "Permanent";
  if (isTemporarySharePayload(payload)) return "Temporary";
  if (isPublishedDefaultSharePayload(payload)) return "Public";
  return String(row?.kind || "Share");
}

function normalizeProfileShareLinkEntry(row) {
  if (!row || typeof row !== "object") return null;
  const payload = isPlainObjectRecord(row.payload) ? row.payload : {};
  const shareMeta = getShareLinkMeta(payload) || {};
  const createdAt =
    String(shareMeta.createdAt || row.created_at || row.updated_at || "").trim() || "";
  return {
    id: String(row.id || ""),
    kind: String(row.kind || ""),
    label: getProfileShareLinkLabel(row),
    typeLabel: getProfileShareLinkTypeLabel(row),
    temporary: isTemporarySharePayload(payload),
    published: isPublishedDefaultSharePayload(payload),
    accessCount: Math.max(0, Number(shareMeta.accessCount) || 0),
    lastAccessedAt: String(shareMeta.lastAccessedAt || "").trim(),
    createdAt,
  };
}

function truncateMiddleText(value, maxLength = 22, edgeLength = 7) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  const safeEdge = Math.max(2, Math.min(edgeLength, Math.floor((maxLength - 1) / 2)));
  const start = text.slice(0, safeEdge);
  const end = text.slice(-safeEdge);
  return `${start}…${end}`;
}

function truncatePrefixToLastText(value, maxLength = 12, prefixLength = 3, minTailLength = 3) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  const tailFloor = Math.max(3, Number(minTailLength) || 3);
  const safePrefix = Math.max(1, Math.min(prefixLength, Math.max(1, maxLength - tailFloor - 1)));
  const availableTail = Math.max(tailFloor, maxLength - safePrefix - 1);
  const safeTail = Math.max(
    tailFloor,
    Math.min(text.length - safePrefix, Math.max(tailFloor, availableTail))
  );
  return `${text.slice(0, safePrefix)}…${text.slice(-safeTail)}`;
}

function fitPrefixToLastTextByWidth(value, maxWidth, measureTextWidth, prefixLength = 3, minTailLength = 3) {
  const text = String(value || "");
  if (!text) return "";
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return text;
  if (measureTextWidth(text) <= maxWidth) return text;

  const safePrefix = Math.max(1, Number(prefixLength) || 3);
  const tailFloor = Math.max(3, Number(minTailLength) || 3);
  const prefix = text.slice(0, Math.min(safePrefix, text.length));

  const minCandidate = `${prefix}…${text.slice(-Math.min(tailFloor, text.length))}`;
  if (measureTextWidth(minCandidate) > maxWidth) {
    const fallbackTail = text.slice(-Math.min(tailFloor, text.length));
    const fallback = `…${fallbackTail}`;
    if (measureTextWidth(fallback) <= maxWidth) return fallback;
    return fallbackTail;
  }

  let low = tailFloor;
  let high = Math.max(tailFloor, text.length - prefix.length);
  let best = minCandidate;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${prefix}…${text.slice(-mid)}`;
    if (measureTextWidth(candidate) <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function MeasuredTailText({
  text,
  className = "",
  prefixLength = 3,
  minTailLength = 3,
  widthSafetyPx = 12,
}) {
  const containerRef = React.useRef(null);
  const [displayText, setDisplayText] = React.useState(() => String(text || ""));

  React.useLayoutEffect(() => {
    const node = containerRef.current;
    if (!(node instanceof HTMLElement)) return undefined;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      setDisplayText(String(text || ""));
      return undefined;
    }

    let frameId = 0;
    const measure = () => {
      const computed = window.getComputedStyle(node);
      context.font = [
        computed.fontStyle,
        computed.fontVariant,
        computed.fontWeight,
        computed.fontStretch,
        computed.fontSize,
        computed.lineHeight === "normal" ? "" : `/${computed.lineHeight}`,
        computed.fontFamily,
      ]
        .filter(Boolean)
        .join(" ");
      const availableWidth = Math.max(0, node.clientWidth - Math.max(0, Number(widthSafetyPx) || 0));
      const next = fitPrefixToLastTextByWidth(
        text,
        availableWidth,
        (value) => context.measureText(String(value || "")).width,
        prefixLength,
        minTailLength
      );
      setDisplayText((prev) => (prev === next ? prev : next));
    };
    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(node);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [text, prefixLength, minTailLength, widthSafetyPx]);

  return (
    <span ref={containerRef} className={className} title={String(text || "")}>
      {displayText}
    </span>
  );
}

function truncateToLastText(value, maxLength = 14, tailLength = 8) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  const safeTail = Math.max(3, Math.min(tailLength, maxLength - 1));
  return `…${text.slice(-safeTail)}`;
}

function getAnonymousFeedbackFingerprint() {
  if (typeof window === "undefined") return "";
  try {
    const existing = String(
      window.localStorage.getItem(FEEDBACK_ANON_FINGERPRINT_STORAGE_KEY) || ""
    ).trim();
    if (existing) return existing;
    const next =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `anon-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(FEEDBACK_ANON_FINGERPRINT_STORAGE_KEY, next);
    return next;
  } catch (_) {
    return "";
  }
}

function buildEffectiveNotationPayloadFromBeat(beat, overrides = {}) {
  const basePayload =
    beat?.payload && typeof beat.payload === "object"
      ? { ...beat.payload }
      : null;
  if (!basePayload) return null;
  const printStickingMode =
    overrides?.printStickingMode === "all"
      ? "all"
      : overrides?.printStickingMode === "off"
        ? "off"
        : "custom";
  const sourceNotationStickingSelection =
    overrides?.notationStickingSelection &&
    typeof overrides.notationStickingSelection === "object"
      ? overrides.notationStickingSelection
      : beat?.notationStickingSelection && typeof beat.notationStickingSelection === "object"
        ? beat.notationStickingSelection
        : null;
  const mirroredNotationStickingSelection =
    sourceNotationStickingSelection && typeof sourceNotationStickingSelection === "object"
      ? Object.fromEntries(
          Object.entries(sourceNotationStickingSelection).filter(([, value]) => value === true)
        )
      : null;
  if (printStickingMode === "all") {
    delete basePayload.notationStickingSelection;
    basePayload.showNotationSticking = true;
  } else if (printStickingMode === "off") {
    basePayload.showNotationSticking = false;
  } else if (mirroredNotationStickingSelection) {
    if (Object.keys(mirroredNotationStickingSelection).length > 0) {
      basePayload.notationStickingSelection = mirroredNotationStickingSelection;
    } else {
      delete basePayload.notationStickingSelection;
    }
  }
  if (typeof overrides.showNotationSticking === "boolean") {
    basePayload.showNotationSticking = overrides.showNotationSticking;
  }
  return basePayload;
}

function normalizePublishedBeatEntry(row) {
  const payload = row?.payload;
  if (!payload || payload.kind !== "beat-default" || !payload.beatPayload) return null;
  const beatPayload = payload.beatPayload;
  const notationStickingSelection =
    beatPayload?.notationStickingSelection && typeof beatPayload.notationStickingSelection === "object"
      ? Object.fromEntries(
          Object.entries(beatPayload.notationStickingSelection).filter(([, value]) => value === true)
        )
      : {};
  return {
    id: String(row.id || ""),
    name: String(payload.name || "").trim() || "Untitled Beat",
    composer: String(payload.composer || ""),
    category: String(payload.category || "Groove"),
    style: String(payload.style || "") || undefined,
    timeSigCategory: `${beatPayload?.timeSig?.n || 4}/${beatPayload?.timeSig?.d || 4}`,
    bpm: Math.max(20, Math.min(400, Number(beatPayload?.bpm) || 120)),
    createdAt: String(row.created_at || payload.createdAt || ""),
    payload: beatPayload,
    notationStickingSelection,
    source: "public",
    publishedShareId: String(row.id || ""),
  };
}

function normalizePublishedArrangementEntry(row) {
  const payload = row?.payload;
  if (!payload || payload.kind !== "arrangement-default" || !Array.isArray(payload.items)) return null;
  const sharedBeats = Array.isArray(payload?.beats)
    ? payload.beats
        .map((beat, idx) => {
          const nextPayload = beat?.payload && typeof beat.payload === "object" ? beat.payload : null;
          if (!nextPayload) return null;
          const notationStickingSelection =
            nextPayload?.notationStickingSelection &&
            typeof nextPayload.notationStickingSelection === "object"
              ? Object.fromEntries(
                  Object.entries(nextPayload.notationStickingSelection).filter(([, value]) => value === true)
                )
              : {};
          return {
            id: String(beat?.id || `shared-${idx + 1}`),
            name: String(beat?.name || `Beat ${idx + 1}`),
            category: String(beat?.category || "Groove"),
            style: beat?.style ? String(beat.style) : undefined,
            timeSigCategory: String(
              beat?.timeSigCategory ||
                `${Number(nextPayload.timeSig?.n) || 4}/${Number(nextPayload.timeSig?.d) || 4}`
            ),
            bpm: Number.isFinite(Number(beat?.bpm))
              ? Math.round(Number(beat.bpm))
              : Number(nextPayload.bpm) || 120,
            payload: nextPayload,
            notationStickingSelection,
            source: "shared",
          };
        })
        .filter(Boolean)
    : [];
  const beatNameById = new Map(sharedBeats.map((beat) => [String(beat.id || ""), String(beat.name || "")]));
  const beatNames = normalizeArrangementItems(payload.items)
    .map((item) => beatNameById.get(String(item?.beatId || "")) || "")
    .filter(Boolean);
  return {
    id: String(row.id || ""),
    name:
      getArrangementNameFromTitles(payload.titleLine1, payload.titleLine2, String(payload.name || "")) ||
      "Untitled Arrangement",
    titleLine1: String(payload.titleLine1 || ""),
    titleLine2: String(payload.titleLine2 || ""),
    composer: String(payload.composer || ""),
    updatedAt: String(row.created_at || payload.createdAt || ""),
    createdAt: String(row.created_at || payload.createdAt || ""),
    items: normalizeArrangementItems(payload.items),
    beats: sharedBeats,
    beatNames,
    publishedShareId: String(row.id || ""),
  };
}

function getArrangementNameFromTitles(titleLine1, titleLine2, fallback = "Arrangement") {
  const parts = [String(titleLine1 || "").trim(), String(titleLine2 || "").trim()].filter(Boolean);
  return parts.join(" ") || String(fallback || "Arrangement").trim() || "Arrangement";
}

function getNextNumberedArrangementName(baseName, existingEntries = []) {
  const rawBase = String(baseName || "").trim() || "Arrangement";
  const match = rawBase.match(/^(.*?)(?:\s+(\d+))?$/);
  const normalizedBase = String(match?.[1] || rawBase).trim() || "Arrangement";
  let highest = 1;
  existingEntries.forEach((entry) => {
    const name = String(entry?.name || "").trim();
    if (!name) return;
    if (name === normalizedBase) {
      highest = Math.max(highest, 1);
      return;
    }
    const numbered = name.match(/^(.*)\s+(\d+)$/);
    if (!numbered) return;
    if (String(numbered[1] || "").trim() !== normalizedBase) return;
    const nextNum = Number(numbered[2]);
    if (Number.isFinite(nextNum)) highest = Math.max(highest, nextNum);
  });
  return `${normalizedBase} ${highest + 1}`;
}

function getUniqueArrangementName(baseName, existingEntries = [], excludeId = null) {
  const rawBase = String(baseName || "").trim() || "Arrangement";
  const normalizedBase = rawBase || "Arrangement";
  const lowerBase = normalizedBase.toLowerCase();
  const normalizedExcludeId = excludeId ? String(excludeId) : null;
  const collides = existingEntries.some((entry) => {
    if (!entry) return false;
    if (normalizedExcludeId && String(entry.id || "") === normalizedExcludeId) return false;
    return String(entry.name || "").trim().toLowerCase() === lowerBase;
  });
  if (!collides) return normalizedBase;
  const filteredEntries = normalizedExcludeId
    ? existingEntries.filter((entry) => String(entry?.id || "") !== normalizedExcludeId)
    : existingEntries;
  return getNextNumberedArrangementName(normalizedBase, filteredEntries);
}

function sortSavedArrangementsMostRecent(entries = []) {
  const byMostRecent = (a, b) => {
    const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  };
  return [...entries].sort(byMostRecent);
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

function getArrangementNotationRowBarCounts(
  notationState,
  globalBarsPerRow = 4,
  forcedBarsPerRow = null,
  forcedRowsByStartBar = null
) {
  if (!notationState || typeof notationState !== "object") return [4];
  const bars = Math.max(1, Number(notationState?.bars) || 1);
  const forced = Number(forcedBarsPerRow);
  if (Number.isFinite(forced) && forced >= 1 && forced <= 4) {
    const out = [];
    let remaining = bars;
    while (remaining > 0) {
      const count = Math.max(1, Math.min(Math.round(forced), remaining));
      out.push(count);
      remaining -= count;
    }
    return out;
  }
  const barStepOffsets = Array.isArray(notationState?.barStepOffsets)
    ? notationState.barStepOffsets
    : null;
  const quarterSubdivisionsByBar = Array.isArray(notationState?.quarterSubdivisionsByBar)
    ? notationState.quarterSubdivisionsByBar
    : [];
  const grid = notationState?.grid && typeof notationState.grid === "object" ? notationState.grid : {};
  const barDemands = Array.from({ length: bars }, (_, barIndex) =>
    estimateNotationBarWidthDemand({
      grid,
      barStartStep: Number(barStepOffsets?.[barIndex] ?? 0),
      barEndStep: Number(barStepOffsets?.[barIndex + 1] ?? barStepOffsets?.[barIndex] ?? 0),
      quarterSubdivisions: quarterSubdivisionsByBar[barIndex],
      minWidth: 160,
    })
  );

  if (barDemands.length < 1) return [Math.max(1, Math.min(4, bars))];
  const fillRows = (count, perRow) => {
    const out = [];
    let remaining = Math.max(0, Number(count) || 0);
    const rowSize = [1, 2, 3, 4].includes(Number(perRow)) ? Number(perRow) : 4;
    while (remaining > 0) {
      const take = Math.max(1, Math.min(rowSize, remaining));
      out.push(take);
      remaining -= take;
    }
    return out;
  };

  const forcedMap = new Map(
    Object.entries(forcedRowsByStartBar && typeof forcedRowsByStartBar === "object" ? forcedRowsByStartBar : {})
      .map(([bar, count]) => [Math.max(0, Math.floor(Number(bar) || 0)), Math.max(1, Math.min(4, Math.round(Number(count) || 0)))])
      .filter(([bar, count]) => Number.isFinite(bar) && bar < bars && Number.isFinite(count) && count > 0)
      .sort((a, b) => a[0] - b[0])
  );
  if (forcedMap.size > 0) {
    const out = [];
    let cursor = 0;
    const entries = Array.from(forcedMap.entries());
    for (let i = 0; i < entries.length; i++) {
      const [startBar, forcedCountRaw] = entries[i];
      if (startBar < cursor) continue;
      if (startBar > cursor) {
        out.push(...fillRows(startBar - cursor, globalBarsPerRow));
        cursor = startBar;
      }
      const forcedCount = Math.max(1, Math.min(forcedCountRaw, bars - cursor));
      out.push(forcedCount);
      cursor += forcedCount;
    }
    if (cursor < bars) out.push(...fillRows(bars - cursor, globalBarsPerRow));
    return out.length ? out : [Math.max(1, Math.min(4, bars))];
  }
  return fillRows(bars, globalBarsPerRow);
}

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

const EMBED_EXAMPLES = {
  rock8: {
    id: "rock8",
    title: "Basic 8th Rock",
    preset: "ksh",
    bars: 1,
    resolution: 8,
    timeSig: { n: 4, d: 4 },
    tupletsByBar: [[null, null, null, null]],
    hits: [
      {
        instId: "hihat",
        bars: "all",
        positions: [0, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8],
      },
      { instId: "snare", bars: "all", positions: [1 / 4, 3 / 4] },
      { instId: "kick", bars: "all", positions: [0, 1 / 2, 5 / 8] },
    ],
  },
  funk16: {
    id: "funk16",
    title: "16th Funk",
    preset: "ksh",
    bars: 1,
    resolution: 16,
    timeSig: { n: 4, d: 4 },
    tupletsByBar: [[null, null, null, null]],
    hits: [
      {
        instId: "hihat",
        bars: "all",
        positions: [
          0 / 16, 1 / 16, 2 / 16, 3 / 16, 4 / 16, 5 / 16, 6 / 16, 7 / 16,
          8 / 16, 9 / 16, 10 / 16, 11 / 16, 12 / 16, 13 / 16, 14 / 16, 15 / 16,
        ],
      },
      { instId: "snare", bars: "all", positions: [1 / 4, 3 / 4] },
      { instId: "snare", bars: "all", value: CELL.GHOST, positions: [3 / 16, 11 / 16] },
      { instId: "kick", bars: "all", positions: [0, 3 / 8, 1 / 2, 13 / 16] },
    ],
  },
  shuffle: {
    id: "shuffle",
    title: "Triplet Shuffle",
    preset: "ksh",
    bars: 1,
    resolution: 8,
    timeSig: { n: 4, d: 4 },
    tupletsByBar: [[3, 3, 3, 3]],
    hits: [
      {
        instId: "hihat",
        bars: "all",
        positions: [
          0 / 12, 2 / 12, 3 / 12, 5 / 12, 6 / 12, 8 / 12, 9 / 12, 11 / 12,
        ],
      },
      { instId: "snare", bars: "all", positions: [1 / 4, 3 / 4] },
      { instId: "kick", bars: "all", positions: [0, 1 / 2, 8 / 12] },
    ],
  },
  fill: {
    id: "fill",
    title: "Groove + Fill",
    preset: "standard",
    bars: 2,
    resolution: 8,
    timeSig: { n: 4, d: 4 },
    tupletsByBar: [
      [null, null, null, null],
      [null, null, null, null],
    ],
    hits: [
      {
        instId: "hihat",
        bars: [0, 1],
        positions: [0, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8],
      },
      { instId: "snare", bars: [0, 1], positions: [1 / 4, 3 / 4] },
      { instId: "kick", bars: [0, 1], positions: [0, 1 / 2, 5 / 8] },
      { instId: "tom1", bars: [1], positions: [6 / 8] },
      { instId: "tom2", bars: [1], positions: [7 / 8] },
      { instId: "floorTom", bars: [1], positions: [15 / 16] },
    ],
  },
};

function getQuarterBeatsPerBar(ts) {
  return Math.max(1, Math.round(Number(ts?.n) || 1));
}

function getBaseSubdivPerQuarter(resolution, ts = { d: 4 }) {
  const beatValue = Math.max(1, Number(ts?.d) || 4);
  return Math.max(1, Math.round(resolution / beatValue));
}

function buildTupletOverrides(count) {
  return Array.from({ length: count }, () => null);
}

function clampTupletValue(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(12, Math.round(n)));
}

function normalizeCountRowSelectedSubdivision(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  const rounded = Math.round(n);
  return COUNT_ROW_SUBDIVISION_OPTIONS.includes(rounded) ? rounded : 3;
}

function resolveQuarterSubdivisions(tupletOverrides, baseSubdiv) {
  return (tupletOverrides || []).map((v) => clampTupletValue(v) ?? baseSubdiv);
}

function buildNotationStickingSelectionFromGridRows(gridLike, instrumentDefs, maxColumns = Infinity) {
  const next = {};
  const defs = Array.isArray(instrumentDefs) ? instrumentDefs : [];
  defs.forEach((inst) => {
    const instId = inst?.id;
    if (!instId || FOOT_INSTRUMENTS.has(instId)) return;
    const row = Array.isArray(gridLike?.[instId]) ? gridLike[instId] : [];
    for (let idx = 0; idx < Math.min(maxColumns, row.length); idx += 1) {
      if (row[idx] !== CELL.OFF) next[`${instId}:${idx}`] = true;
    }
  });
  return next;
}

function buildNotationStickingSelectionFromPayloadGrid(payloadGrid) {
  const next = {};
  ALL_INSTRUMENTS.forEach((inst) => {
    const instId = inst?.id;
    if (!instId || FOOT_INSTRUMENTS.has(instId)) return;
    const events = Array.isArray(payloadGrid?.[instId]) ? payloadGrid[instId] : [];
    events.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const idx = Math.max(0, Math.round(Number(entry[0]) || 0));
      const code = Math.max(0, Math.round(Number(entry[1]) || 0));
      if (code > 0) next[`${instId}:${idx}`] = true;
    });
  });
  return next;
}

function isPowerOfTwoSubdivision(count) {
  const normalized = Math.max(1, Math.round(Number(count) || 1));
  return (normalized & (normalized - 1)) === 0;
}

function normalizeSubdivisionOverrideForBase(rawOverride, baseSubdiv) {
  const normalized = clampTupletValue(rawOverride);
  if (normalized == null) return null;
  if (isPowerOfTwoSubdivision(normalized) && normalized === Math.max(1, Number(baseSubdiv) || 1)) {
    return null;
  }
  return normalized;
}

function sanitizeTupletOverridesForBase(rows, baseSubdiv) {
  return (Array.isArray(rows) ? rows : []).map((row) =>
    (Array.isArray(row) ? row : []).map((value) => normalizeSubdivisionOverrideForBase(value, baseSubdiv))
  );
}

function buildTupletOverridesByBar(barCount, quarterCount) {
  return Array.from({ length: Math.max(1, barCount) }, () => buildTupletOverrides(quarterCount));
}

function buildNotationStateFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const bars = Math.max(1, Math.min(64, Number(payload.bars) || 1));
  const rawRes = Number(payload.resolution);
  const resolution = [4, 8, 16, 32].includes(rawRes) ? rawRes : 8;
  const rawTs = payload.timeSig || {};
  const timeSig = {
    n: Math.max(1, Number(rawTs.n) || 4),
    d: Math.max(1, Number(rawTs.d) || 4),
  };
  const quarterCount = getQuarterBeatsPerBar(timeSig);
  const baseSubdiv = getBaseSubdivPerQuarter(resolution, timeSig);
  const tupletsByBar = Array.from({ length: bars }, (_, barIdx) =>
    Array.from({ length: quarterCount }, (_, qIdx) => {
      const raw = payload.tupletsByBar?.[barIdx]?.[qIdx];
      return clampTupletValue(raw) ?? null;
    })
  );
  const quarterSubdivisionsByBar = tupletsByBar.map((row) =>
    resolveQuarterSubdivisions(row, baseSubdiv)
  );
  const barStepOffsets = [0];
  for (let b = 0; b < bars; b++) {
    const stepsInBar = quarterSubdivisionsByBar[b].reduce(
      (sum, n) => sum + Math.max(1, Number(n) || 1),
      0
    );
    barStepOffsets.push(barStepOffsets[b] + stepsInBar);
  }
  const columns = barStepOffsets[barStepOffsets.length - 1] ?? 0;
  const kitIds = Array.isArray(payload.kitInstrumentIds)
    ? [...new Set(payload.kitInstrumentIds.filter((id) => INSTRUMENT_BY_ID[id]))]
    : [];
  const safeKitIds = kitIds.length ? kitIds : DRUMKIT_PRESETS.standard;
  const instruments = safeKitIds.map((id) => INSTRUMENT_BY_ID[id]).filter(Boolean);
  const grid = {};
  instruments.forEach((inst) => {
    const row = Array(columns).fill(CELL.OFF);
    const events = payload.grid?.[inst.id];
    if (Array.isArray(events)) {
      events.forEach((event) => {
        const idx = Number(Array.isArray(event) ? event[0] : null);
        if (!Number.isFinite(idx)) return;
        if (idx < 0 || idx >= columns) return;
        const valRaw = Number(Array.isArray(event) ? event[1] : 1);
        row[idx] = valRaw === 3 ? CELL.ACCENT : valRaw === 2 ? CELL.GHOST : CELL.ON;
      });
    }
    grid[inst.id] = row;
  });
  const notationStickingSelection =
    payload?.notationStickingSelection && typeof payload.notationStickingSelection === "object"
      ? Object.fromEntries(
          Object.entries(payload.notationStickingSelection).filter(([, value]) => value === true)
        )
      : {};
  const timeSigByBar = Array.from({ length: bars }, () => ({ ...timeSig }));
  return {
    instruments,
    grid,
    notationStickingSelection,
    resolution,
    bars,
    barsPerLine: Math.max(1, Math.min(4, bars)),
    timeSig,
    timeSigByBar,
    quarterSubdivisionsByBar,
    barStepOffsets,
  };
}

function getBarIndexForStepFromPayload(payload, stepIndex) {
  if (!payload || typeof payload !== "object") return 0;
  const bars = Math.max(1, Math.min(64, Number(payload.bars) || 1));
  const rawRes = Number(payload.resolution);
  const resolution = [4, 8, 16, 32].includes(rawRes) ? rawRes : 8;
  const rawTs = payload.timeSig || {};
  const timeSig = {
    n: Math.max(1, Number(rawTs.n) || 4),
    d: Math.max(1, Number(rawTs.d) || 4),
  };
  const quarterCount = getQuarterBeatsPerBar(timeSig);
  const baseSubdiv = getBaseSubdivPerQuarter(resolution, timeSig);
  const tupletsByBar = Array.from({ length: bars }, (_, barIdx) =>
    Array.from({ length: quarterCount }, (_, qIdx) => {
      const raw = payload.tupletsByBar?.[barIdx]?.[qIdx];
      return clampTupletValue(raw) ?? null;
    })
  );
  const quarterSubdivisionsByBar = tupletsByBar.map((row) =>
    resolveQuarterSubdivisions(row, baseSubdiv)
  );
  const barStepOffsets = [0];
  for (let b = 0; b < bars; b++) {
    const stepsInBar = quarterSubdivisionsByBar[b].reduce(
      (sum, n) => sum + Math.max(1, Number(n) || 1),
      0
    );
    barStepOffsets.push(barStepOffsets[b] + stepsInBar);
  }
  const step = Math.max(0, Number(stepIndex) || 0);
  for (let b = 0; b < bars; b++) {
    const start = barStepOffsets[b] ?? 0;
    const end = barStepOffsets[b + 1] ?? start;
    if (step >= start && step < end) return b;
  }
  return Math.max(0, bars - 1);
}

function buildStepQuarterDurationsFromNotationState(state) {
  if (!state || typeof state !== "object") return [];
  const byBar = Array.isArray(state.quarterSubdivisionsByBar) ? state.quarterSubdivisionsByBar : [];
  const out = [];
  byBar.forEach((row) => {
    const quarterRow = Array.isArray(row) ? row : [];
    quarterRow.forEach((subdivRaw) => {
      const subdiv = Math.max(1, Number(subdivRaw) || 1);
      for (let i = 0; i < subdiv; i++) out.push(1 / subdiv);
    });
  });
  return out;
}

function expandNotationStateForRepeats(state, repeats) {
  const count = Math.max(1, Number(repeats) || 1);
  if (!state || count <= 1) return state;
  const baseBars = Math.max(1, Number(state.bars) || 1);
  const baseColumns = Math.max(0, Number(state.barStepOffsets?.[baseBars] ?? 0));
  const quarterSubdivisionsByBar = [];
  for (let i = 0; i < count; i++) {
    (state.quarterSubdivisionsByBar || []).forEach((row) => {
      quarterSubdivisionsByBar.push(Array.isArray(row) ? [...row] : []);
    });
  }
  const barStepOffsets = [0];
  for (let b = 0; b < quarterSubdivisionsByBar.length; b++) {
    const stepsInBar = quarterSubdivisionsByBar[b].reduce(
      (sum, n) => sum + Math.max(1, Number(n) || 1),
      0
    );
    barStepOffsets.push(barStepOffsets[b] + stepsInBar);
  }
  const grid = {};
  (state.instruments || []).forEach((inst) => {
    const src = Array.isArray(state.grid?.[inst.id]) ? state.grid[inst.id] : [];
    const row = Array(baseColumns * count).fill(CELL.OFF);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < baseColumns; c++) {
        const v = src[c] ?? CELL.OFF;
        if (v !== CELL.OFF) row[i * baseColumns + c] = v;
      }
    }
    grid[inst.id] = row;
  });
  const notationStickingSelection = {};
  const timeSigByBar = [];
  const srcNotationStickingSelection =
    state?.notationStickingSelection && typeof state.notationStickingSelection === "object"
      ? state.notationStickingSelection
      : {};
  const srcTimeSigByBar =
    Array.isArray(state?.timeSigByBar) && state.timeSigByBar.length === baseBars
      ? state.timeSigByBar
      : Array.from({ length: baseBars }, () => ({ ...(state?.timeSig || { n: 4, d: 4 }) }));
  Object.entries(srcNotationStickingSelection).forEach(([key, enabled]) => {
    if (!enabled) return;
    const [instId, rawIdx] = String(key).split(":");
    const idx = Number(rawIdx);
    if (!instId || !Number.isFinite(idx) || idx < 0 || idx >= baseColumns) return;
    for (let i = 0; i < count; i++) {
      notationStickingSelection[`${instId}:${i * baseColumns + idx}`] = true;
    }
  });
  for (let i = 0; i < count; i++) {
    srcTimeSigByBar.forEach((ts) => {
      timeSigByBar.push({
        n: Math.max(1, Number(ts?.n) || 4),
        d: Math.max(1, Number(ts?.d) || 4),
      });
    });
  }
  return {
    ...state,
    grid,
    notationStickingSelection,
    bars: baseBars * count,
    barsPerLine: Math.max(1, Math.min(4, baseBars * count)),
    timeSigByBar,
    quarterSubdivisionsByBar,
    barStepOffsets,
  };
}

function mergeNotationStates(states) {
  const valid = (Array.isArray(states) ? states : []).filter(
    (s) => s && Array.isArray(s.instruments) && s.timeSig && Number.isFinite(s.resolution)
  );
  if (!valid.length) return null;

  const instrumentIds = [];
  const seen = new Set();
  valid.forEach((s) => {
    (s.instruments || []).forEach((inst) => {
      const id = inst?.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      instrumentIds.push(id);
    });
  });
  instrumentIds.sort(
    (a, b) =>
      ALL_INSTRUMENTS.findIndex((inst) => inst.id === a) -
      ALL_INSTRUMENTS.findIndex((inst) => inst.id === b)
  );
  const instruments = instrumentIds.map((id) => INSTRUMENT_BY_ID[id]).filter(Boolean);

  const bars = valid.reduce((sum, s) => sum + Math.max(1, Number(s.bars) || 1), 0);
  const quarterSubdivisionsByBar = [];
  valid.forEach((s) => {
    (s.quarterSubdivisionsByBar || []).forEach((row) => {
      quarterSubdivisionsByBar.push(Array.isArray(row) ? [...row] : []);
    });
  });
  const barStepOffsets = [0];
  for (let b = 0; b < quarterSubdivisionsByBar.length; b++) {
    const stepsInBar = quarterSubdivisionsByBar[b].reduce(
      (sum, n) => sum + Math.max(1, Number(n) || 1),
      0
    );
    barStepOffsets.push(barStepOffsets[b] + stepsInBar);
  }
  const columns = barStepOffsets[barStepOffsets.length - 1] ?? 0;

  const grid = {};
  instruments.forEach((inst) => {
    grid[inst.id] = Array(columns).fill(CELL.OFF);
  });

  let colOffset = 0;
  const notationStickingSelection = {};
  const timeSigByBar = [];
  valid.forEach((s) => {
    const sBars = Math.max(1, Number(s.bars) || 1);
    const sCols = Math.max(0, Number(s.barStepOffsets?.[sBars] ?? 0));
    instruments.forEach((inst) => {
      const src = Array.isArray(s.grid?.[inst.id]) ? s.grid[inst.id] : [];
      const dst = grid[inst.id];
      for (let c = 0; c < sCols; c++) {
        const v = src[c] ?? CELL.OFF;
        if (v !== CELL.OFF) dst[colOffset + c] = v;
      }
    });
    Object.entries(
      s?.notationStickingSelection && typeof s.notationStickingSelection === "object"
        ? s.notationStickingSelection
        : {}
    ).forEach(([key, enabled]) => {
      if (!enabled) return;
      const [instId, rawIdx] = String(key).split(":");
      const idx = Number(rawIdx);
      if (!instId || !Number.isFinite(idx) || idx < 0 || idx >= sCols) return;
      notationStickingSelection[`${instId}:${colOffset + idx}`] = true;
    });
    const sBarsCount = Math.max(1, Number(s.bars) || 1);
    const sTimeSigByBar =
      Array.isArray(s?.timeSigByBar) && s.timeSigByBar.length === sBarsCount
        ? s.timeSigByBar
        : Array.from({ length: sBarsCount }, () => ({ ...(s?.timeSig || { n: 4, d: 4 }) }));
    sTimeSigByBar.forEach((ts) => {
      timeSigByBar.push({
        n: Math.max(1, Number(ts?.n) || 4),
        d: Math.max(1, Number(ts?.d) || 4),
      });
    });
    colOffset += sCols;
  });

  return {
    instruments,
    grid,
    notationStickingSelection,
    resolution: valid.reduce(
      (max, state) => Math.max(max, Number(state?.resolution) || 0),
      Number(valid[0]?.resolution) || 8
    ),
    bars,
    barsPerLine: 4,
    timeSig: valid[0].timeSig,
    timeSigByBar,
    quarterSubdivisionsByBar,
    barStepOffsets,
  };
}

function sliceNotationStateByBars(state, startBar, barCount) {
  if (!state || !Number.isFinite(startBar) || !Number.isFinite(barCount) || barCount < 1) return null;
  const bars = Math.max(1, Number(state.bars) || 1);
  const safeStartBar = Math.max(0, Math.min(bars - 1, Math.floor(startBar)));
  const safeEndBar = Math.max(safeStartBar + 1, Math.min(bars, safeStartBar + Math.floor(barCount)));
  const nextBars = safeEndBar - safeStartBar;
  const srcOffsets = Array.isArray(state.barStepOffsets) ? state.barStepOffsets : [0];
  const startStep = Number(srcOffsets[safeStartBar] ?? 0) || 0;
  const endStep = Number(srcOffsets[safeEndBar] ?? startStep) || startStep;
  const quarterSubdivisionsByBar = Array.isArray(state.quarterSubdivisionsByBar)
    ? state.quarterSubdivisionsByBar.slice(safeStartBar, safeEndBar).map((row) => (Array.isArray(row) ? [...row] : []))
    : [];
  const barStepOffsets = [0];
  for (let b = 0; b < quarterSubdivisionsByBar.length; b++) {
    const stepsInBar = quarterSubdivisionsByBar[b].reduce(
      (sum, n) => sum + Math.max(1, Number(n) || 1),
      0
    );
    barStepOffsets.push(barStepOffsets[b] + stepsInBar);
  }
  const columns = Math.max(0, endStep - startStep);
  const grid = {};
  (Array.isArray(state.instruments) ? state.instruments : []).forEach((inst) => {
    const src = Array.isArray(state.grid?.[inst.id]) ? state.grid[inst.id] : [];
    grid[inst.id] = src.slice(startStep, endStep);
    if (grid[inst.id].length < columns) {
      grid[inst.id] = [...grid[inst.id], ...Array(columns - grid[inst.id].length).fill(CELL.OFF)];
    }
  });
  const notationStickingSelection = {};
  const timeSigByBar =
    Array.isArray(state?.timeSigByBar)
      ? state.timeSigByBar.slice(safeStartBar, safeEndBar).map((ts) => ({
          n: Math.max(1, Number(ts?.n) || 4),
          d: Math.max(1, Number(ts?.d) || 4),
        }))
      : Array.from({ length: nextBars }, () => ({ ...(state?.timeSig || { n: 4, d: 4 }) }));
  Object.entries(
    state?.notationStickingSelection && typeof state.notationStickingSelection === "object"
      ? state.notationStickingSelection
      : {}
  ).forEach(([key, enabled]) => {
    if (!enabled) return;
    const [instId, rawIdx] = String(key).split(":");
    const idx = Number(rawIdx);
    if (!instId || !Number.isFinite(idx) || idx < startStep || idx >= endStep) return;
    notationStickingSelection[`${instId}:${idx - startStep}`] = true;
  });
  return {
    ...state,
    grid,
    notationStickingSelection,
    bars: nextBars,
    barsPerLine: Math.max(1, Math.min(4, nextBars)),
    timeSig: timeSigByBar[0] || state?.timeSig || { n: 4, d: 4 },
    timeSigByBar,
    quarterSubdivisionsByBar,
    barStepOffsets,
  };
}

function sliceMarkerListByBars(markers, startBar, barCount) {
  const endBar = startBar + barCount;
  return (Array.isArray(markers) ? markers : [])
    .map((marker) => ({
      bar: Number(marker?.bar) || 0,
      text: String(marker?.text || ""),
    }))
    .filter((marker) => marker.text && marker.bar >= startBar && marker.bar < endBar)
    .map((marker) => ({ ...marker, bar: marker.bar - startBar }));
}

function sliceBooleanListByBars(values, startBar, barCount, fallback = false) {
  return Array.from({ length: barCount }, (_, idx) => {
    const raw = Array.isArray(values) ? values[startBar + idx] : undefined;
    return typeof raw === "boolean" ? raw : fallback;
  });
}

function sliceStringListByBars(values, startBar, barCount, fallback = "") {
  return Array.from({ length: barCount }, (_, idx) => {
    const raw = Array.isArray(values) ? values[startBar + idx] : undefined;
    return typeof raw === "string" && raw ? raw : fallback;
  });
}

function sliceStickingAssignmentsByBars(assignments, barStepOffsets, startBar, barCount) {
  const src = Array.isArray(assignments) ? assignments : [];
  const offsets = Array.isArray(barStepOffsets) ? barStepOffsets : [0];
  const startStep = Number(offsets[startBar] ?? 0) || 0;
  const endStep = Number(offsets[startBar + barCount] ?? startStep) || startStep;
  return src.slice(startStep, endStep);
}

function buildPayloadFromNotationState(state, bpm = 120) {
  if (!state || typeof state !== "object") return null;
  const bars = Math.max(1, Number(state.bars) || 1);
  const resolution = [4, 8, 16, 32].includes(Number(state.resolution))
    ? Number(state.resolution)
    : 8;
  const timeSig = {
    n: Math.max(1, Number(state.timeSig?.n) || 4),
    d: Math.max(1, Number(state.timeSig?.d) || 4),
  };
  const kitInstrumentIds = (Array.isArray(state.instruments) ? state.instruments : [])
    .map((inst) => inst?.id)
    .filter(Boolean);
  const tupletsByBar = Array.from({ length: bars }, (_, barIdx) =>
    Array.from(
      { length: Math.max(1, Number(state.quarterSubdivisionsByBar?.[barIdx]?.length) || getQuarterBeatsPerBar(timeSig)) },
      (_, qIdx) => {
        const subdiv = Number(state.quarterSubdivisionsByBar?.[barIdx]?.[qIdx]);
        const baseSubdiv = getBaseSubdivPerQuarter(resolution, timeSig);
        return Number.isFinite(subdiv) && subdiv !== baseSubdiv ? clampTupletValue(subdiv) : null;
      }
    )
  );
  const grid = {};
  (Array.isArray(state.instruments) ? state.instruments : []).forEach((inst) => {
    const row = Array.isArray(state.grid?.[inst.id]) ? state.grid[inst.id] : [];
    const events = [];
    row.forEach((cell, idx) => {
      if (cell === CELL.ACCENT) events.push([idx, 3]);
      else if (cell === CELL.GHOST) events.push([idx, 2]);
      else if (cell === CELL.ON) events.push([idx, 1]);
    });
    if (events.length) grid[inst.id] = events;
  });
  return {
    v: 1,
    kitInstrumentIds: kitInstrumentIds.length ? kitInstrumentIds : DRUMKIT_PRESETS.standard,
    bars,
    resolution,
    timeSig,
    bpm: Math.max(20, Math.min(400, Number(bpm) || 120)),
    tupletsByBar,
    grid,
  };
}

function ArrangementPageHeaderSvg({ titleLine1, titleLine2, composer, dark = true }) {
  const line1 = String(titleLine1 || "").trim();
  const line2 = String(titleLine2 || "").trim();
  const author = String(composer || "").trim();
  const textFill = dark ? "#f5f5f5" : "#000000";
  const subFill = dark ? "#d4d4d4" : "#000000";
  const fontFamily = '"Liberation Serif", serif';
  return (
    <svg
      width="770"
      height={line2 ? 136 : 92}
      viewBox={line2 ? "0 0 770 136" : "0 0 770 92"}
      className="block w-[770px] max-w-full"
      aria-hidden="true"
    >
      {author ? (
        <text
          x="770"
          y="18"
          textAnchor="end"
          fill={subFill}
          fontFamily={fontFamily}
          fontSize="12"
          fontWeight="400"
        >
          {author}
        </text>
      ) : null}
      <text
        x="385"
        y="37"
        textAnchor="middle"
        fill={textFill}
        fontFamily={fontFamily}
        fontSize="35"
        fontWeight="400"
      >
        {line1 || "Arrangement"}
      </text>
      {line2 ? (
        <text
          x="385"
          y="91"
          textAnchor="middle"
          fill={textFill}
          fontFamily={fontFamily}
          fontSize="35"
          fontWeight="400"
        >
          {line2}
        </text>
      ) : null}
    </svg>
  );
}

function computeStickingAssignmentsForNotationState(state, opts = {}) {
  if (!state) return [];
  const instruments = Array.isArray(state.instruments) ? state.instruments : [];
  const grid = state.grid || {};
  const bars = Math.max(1, Number(state.bars) || 1);
  const barStepOffsets = Array.isArray(state.barStepOffsets) ? state.barStepOffsets : [0];
  const columns = Math.max(0, Number(barStepOffsets?.[bars] ?? 0));
  const quarterSubdivisionsByBar = Array.isArray(state.quarterSubdivisionsByBar)
    ? state.quarterSubdivisionsByBar
    : [];
  const handedness = opts.stickingHandedness === "left" ? "left" : "right";
  const lead = opts.stickingLeadHand === "left" ? "L" : "R";
  const keepQuarterLeadHand = opts.stickingKeepQuarterLeadHand !== false;
  const stickingOverrides = opts.stickingOverrides || {};

  const quarterDownbeatStepSet = new Set();
  for (let b = 0; b < quarterSubdivisionsByBar.length; b++) {
    const barOffset = barStepOffsets?.[b] ?? 0;
    const row = Array.isArray(quarterSubdivisionsByBar[b]) ? quarterSubdivisionsByBar[b] : [];
    let acc = 0;
    for (let q = 0; q < row.length; q++) {
      quarterDownbeatStepSet.add(barOffset + acc);
      acc += Math.max(1, Number(row[q]) || 1);
    }
  }

  const stepStartQuarterTimes = Array(columns).fill(0);
  const beatUnitQuarterLength = 4 / Math.max(1, Number(state.timeSig?.d) || 4);
  for (let b = 0; b < quarterSubdivisionsByBar.length; b++) {
    const barOffset = barStepOffsets?.[b] ?? 0;
    const row = Array.isArray(quarterSubdivisionsByBar[b]) ? quarterSubdivisionsByBar[b] : [];
    let localStep = 0;
    let t = 0;
    for (let q = 0; q < row.length; q++) {
      const subdiv = Math.max(1, Number(row[q]) || 1);
      const dur = beatUnitQuarterLength / subdiv;
      for (let s = 0; s < subdiv; s++) {
        const idx = barOffset + localStep;
        if (idx >= 0 && idx < columns) stepStartQuarterTimes[idx] = t;
        localStep += 1;
        t += dur;
      }
    }
  }

  const handIds = instruments.map((inst) => inst?.id).filter((id) => id && !FOOT_INSTRUMENTS.has(id));
  const rightFavorIds = new Set(["ride", "rideBell"]);
  const alternationIds = new Set([
    "hihat",
    "hihatOpen",
    "snare",
    "tom1",
    "tom2",
    "floorTom",
    "crash1",
    "crash2",
  ]);
  const isCrashLike = (id) => id === "crash1" || id === "crash2";
  const historyKeyFor = (id) => (isCrashLike(id) ? "__crash_pair__" : id);
  const out = Array.from({ length: columns }, () => ({}));
  const handPos = {
    L: handedness === "left" ? 2.6 : 1.4,
    R: handedness === "left" ? 1.4 : 2.6,
  };
  const canAlternateAtSpacing = (spacingQuarter) => {
    if (!Number.isFinite(spacingQuarter)) return false;
    return keepQuarterLeadHand ? spacingQuarter < 1 : spacingQuarter <= 1;
  };
  const instLast = {};
  const handLast = { L: null, R: null };
  let lastSingle = null;
  const getForcedHand = (instId, step) => {
    if (instId === "ride") return "R";
    const v = stickingOverrides?.[`${instId}:${step}`];
    return v === "L" || v === "R" ? v : null;
  };
  const favoredHand = handedness === "left" ? "L" : "R";
  const scoreSingle = (hand, hit, step) => {
    let score = Math.abs(hit.pos - handPos[hand]) * 1.35;
    if (rightFavorIds.has(hit.id)) {
      score += hand === favoredHand ? -0.85 : 0.85;
    }
    const prev = instLast[historyKeyFor(hit.id)];
    if (prev && prev.wasSingle) {
      const prevTime = stepStartQuarterTimes[prev.step] ?? prev.step;
      const currTime = stepStartQuarterTimes[step] ?? step;
      const spacingQuarter = currTime - prevTime;
      const allowAlternation = alternationIds.has(hit.id) && canAlternateAtSpacing(spacingQuarter);
      if (allowAlternation) score += prev.hand === hand ? 1.4 : -0.45;
      if (quarterDownbeatStepSet.has(step)) {
        score += hand === lead ? -0.7 : 0.7;
      }
    } else if (!prev) {
      score += hand === lead ? -0.6 : 0.6;
    }
    return score;
  };

  for (let step = 0; step < columns; step++) {
    const hits = handIds
      .filter((id) => (grid[id]?.[step] ?? CELL.OFF) !== CELL.OFF)
      .map((id) => ({ id, pos: getHandPositionForInstrument(id, handedness) }))
      .sort((a, b) => a.pos - b.pos);
    if (!hits.length) continue;

    if (hits.length === 1) {
      const hit = hits[0];
      const historyKey = historyKeyFor(hit.id);
      const forced = getForcedHand(hit.id, step);
      const prev = instLast[historyKey];
      const prevInst = instLast[hit.id];
      const prevTime = prev ? (stepStartQuarterTimes[prev.step] ?? prev.step) : null;
      const currTime = stepStartQuarterTimes[step] ?? step;
      const spacingQuarter = prev ? (currTime - prevTime) : null;
      const allowAlternation =
        !!prev &&
        prev.wasSingle &&
        alternationIds.has(hit.id) &&
        canAlternateAtSpacing(spacingQuarter);
      const lastSingleTime = lastSingle ? (stepStartQuarterTimes[lastSingle.step] ?? lastSingle.step) : null;
      const lastSingleSpacingQuarter =
        lastSingle ? ((stepStartQuarterTimes[step] ?? step) - lastSingleTime) : null;
      const shouldAlternateFromLastSingleAcrossInstruments =
        !!lastSingle &&
        lastSingle.instId !== hit.id &&
        canAlternateAtSpacing(lastSingleSpacingQuarter);
      let hand;
      if (forced) {
        hand = forced;
      } else if (prevInst && !prevInst.wasSingle && prevInst.step === step - 1) {
        hand = prevInst.hand;
      } else if (keepQuarterLeadHand && quarterDownbeatStepSet.has(step)) {
        hand = lead;
      } else if (isCrashLike(hit.id)) {
        if (!prev || !prev.wasSingle) {
          hand = hit.id === "crash1" ? "L" : "R";
        } else if (prev.instId === hit.id) {
          hand = prev.hand;
        } else {
          hand = prev.hand === "L" ? "R" : "L";
        }
      } else if (shouldAlternateFromLastSingleAcrossInstruments) {
        hand = lastSingle.hand === "L" ? "R" : "L";
      } else if ((hit.id === "hihat" || hit.id === "hihatOpen") && (!prev || !prev.wasSingle)) {
        hand = "R";
      } else if (allowAlternation) {
        hand = prev.hand === "L" ? "R" : "L";
      } else if (!prev && lastSingle) {
        const prevSingleTime = stepStartQuarterTimes[lastSingle.step] ?? lastSingle.step;
        const currSingleTime = stepStartQuarterTimes[step] ?? step;
        const singleSpacingQuarter = currSingleTime - prevSingleTime;
        if (canAlternateAtSpacing(singleSpacingQuarter)) {
          hand = lastSingle.hand === "L" ? "R" : "L";
        } else {
          const sL = scoreSingle("L", hit, step);
          const sR = scoreSingle("R", hit, step);
          hand = Math.abs(sL - sR) <= 0.02 ? lead : sL < sR ? "L" : "R";
        }
      } else {
        const sL = scoreSingle("L", hit, step);
        const sR = scoreSingle("R", hit, step);
        hand = Math.abs(sL - sR) <= 0.02 ? lead : sL < sR ? "L" : "R";
      }
      out[step][hit.id] = hand;
      handPos[hand] = hit.pos;
      instLast[hit.id] = { hand, step, wasSingle: true };
      instLast[historyKey] = { hand, step, wasSingle: true, instId: hit.id };
      handLast[hand] = { instId: hit.id, step };
      lastSingle = { hand, step, instId: hit.id };
      continue;
    }

    const low = hits[0];
    const high = hits[1];
    const manualForcedLow = getForcedHand(low.id, step);
    const manualForcedHigh = getForcedHand(high.id, step);
    const isCrashPair =
      (low.id === "crash1" && high.id === "crash2") ||
      (low.id === "crash2" && high.id === "crash1");
    const autoForcedLow = isCrashPair ? (low.id === "crash1" ? "L" : "R") : null;
    const autoForcedHigh = isCrashPair ? (high.id === "crash1" ? "L" : "R") : null;
    const forcedLow = manualForcedLow || autoForcedLow;
    const forcedHigh = manualForcedHigh || autoForcedHigh;
    const pairings = [
      { low: "L", high: "R" },
      { low: "R", high: "L" },
    ];
    let best = pairings[0];
    let bestScore = Infinity;
    for (const p of pairings) {
      if (forcedLow && p.low !== forcedLow) continue;
      if (forcedHigh && p.high !== forcedHigh) continue;
      if (low.id === "ride" && p.low !== "R") continue;
      if (high.id === "ride" && p.high !== "R") continue;
      let score = 0;
      score += Math.abs(low.pos - handPos[p.low]) * 1.35;
      score += Math.abs(high.pos - handPos[p.high]) * 1.35;
      if (rightFavorIds.has(low.id)) score += p.low === favoredHand ? -0.7 : 0.7;
      if (rightFavorIds.has(high.id)) score += p.high === favoredHand ? -0.7 : 0.7;
      const applyHandContinuityPreference = (hand, instId, stepIdx) => {
        const prev = handLast[hand];
        if (!prev) return;
        const prevTime = stepStartQuarterTimes[prev.step] ?? prev.step;
        const currTime = stepStartQuarterTimes[stepIdx] ?? stepIdx;
        const spacingQuarter = currTime - prevTime;
        const weight = spacingQuarter <= 1 ? 1.2 : 0.7;
        score += prev.instId === instId ? -weight : weight;
      };
      applyHandContinuityPreference(p.low, low.id, step);
      applyHandContinuityPreference(p.high, high.id, step);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }

    out[step][low.id] = best.low;
    out[step][high.id] = best.high;
    handPos[best.low] = low.pos;
    handPos[best.high] = high.pos;
    instLast[low.id] = { hand: best.low, step, wasSingle: false };
    instLast[high.id] = { hand: best.high, step, wasSingle: false };
    handLast[best.low] = { instId: low.id, step };
    handLast[best.high] = { instId: high.id, step };
    if (isCrashPair) instLast.__crash_pair__ = { hand: best.high, step, wasSingle: false, instId: high.id };
    for (let i = 2; i < hits.length; i++) {
      const hit = hits[i];
      const historyKey = historyKeyFor(hit.id);
      const forced = getForcedHand(hit.id, step);
      const hand =
        forced || (Math.abs(hit.pos - handPos.L) <= Math.abs(hit.pos - handPos.R) ? "L" : "R");
      out[step][hit.id] = hand;
      handPos[hand] = hit.pos;
      instLast[hit.id] = { hand, step, wasSingle: false };
      instLast[historyKey] = { hand, step, wasSingle: false, instId: hit.id };
      handLast[hand] = { instId: hit.id, step };
    }
    lastSingle = null;
  }
  return out;
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

function remapGridByStepMeta(prevGrid, oldMeta, newMeta, bars, cellOff, allInstruments, rankFn) {
  const oldStepsPerBar = Math.max(1, oldMeta.length);
  const newStepsPerBar = Math.max(1, newMeta.length);
  const out = {};
  allInstruments.forEach((inst) => {
    const row = Array(bars * newStepsPerBar).fill(cellOff);
    for (let b = 0; b < bars; b++) {
      for (let oldStep = 0; oldStep < oldStepsPerBar; oldStep++) {
        const oldGlobal = b * oldStepsPerBar + oldStep;
        const val = prevGrid[inst.id]?.[oldGlobal] ?? cellOff;
        if (val === cellOff) continue;
        const oldEntry = oldMeta[oldStep];
        let bestIdx = 0;
        let bestDist = Infinity;
        const eps = 1e-9;
        const oldQuarter = oldEntry?.quarterIndex;
        const hasQuarter = Number.isFinite(oldQuarter);
        const oldPhase =
          oldEntry && oldEntry.subdiv > 0 ? oldEntry.subIndex / oldEntry.subdiv : null;
        const useQuarterLocal = hasQuarter && oldPhase != null;

        if (useQuarterLocal) {
          const oldSubdiv = Math.max(1, oldEntry?.subdiv || 1);
          const newSubdiv = Math.max(1, (newMeta.find((m) => m?.quarterIndex === oldQuarter)?.subdiv) || 1);
          let targetSub = 0;
          if (newSubdiv % oldSubdiv === 0) {
            // Exact integer upscale: preserve exact phase grid points (e.g. 3->6, 2->6).
            targetSub = oldEntry.subIndex * (newSubdiv / oldSubdiv);
          } else {
            const raw = oldPhase * newSubdiv;
            targetSub = Math.round(raw);
          }
          targetSub = Math.max(0, Math.min(newSubdiv - 1, targetSub));
          const mappedIdx = newMeta.findIndex(
            (m) => m?.quarterIndex === oldQuarter && m?.subIndex === targetSub
          );
          if (mappedIdx >= 0) {
            bestIdx = mappedIdx;
            bestDist = 0;
          }
        }
        if (bestDist !== 0) {
          for (let newStep = 0; newStep < newStepsPerBar; newStep++) {
            const nextEntry = newMeta[newStep];
            if (useQuarterLocal && nextEntry?.quarterIndex !== oldQuarter) continue;
            const nextPhase =
              useQuarterLocal && nextEntry?.subdiv > 0
                ? nextEntry.subIndex / nextEntry.subdiv
                : (nextEntry?.startNorm ?? (newStep / newStepsPerBar));
            const oldRef = useQuarterLocal ? oldPhase : (oldEntry?.startNorm ?? (oldStep / oldStepsPerBar));
            const d = Math.abs(nextPhase - oldRef);
            if (d + eps < bestDist || (Math.abs(d - bestDist) <= eps && newStep < bestIdx)) {
              bestDist = d;
              bestIdx = newStep;
            }
          }
        }
        const nextGlobal = b * newStepsPerBar + bestIdx;
        const cur = row[nextGlobal] ?? cellOff;
        row[nextGlobal] = rankFn(val) >= rankFn(cur) ? val : cur;
      }
    }
    out[inst.id] = row;
  });
  return out;
}

function assignPhasesToSlots(phases, slotCount) {
  const n = Math.max(1, Number(slotCount) || 1);
  const m = phases.length;
  if (m === 0) return [];
  if (m > n) {
    return phases.map((p) => Math.max(0, Math.min(n - 1, Math.round(p * n))));
  }

  const cost = (phase, slot) => {
    const slotPhase = slot / n;
    const d = slotPhase - phase;
    return d * d;
  };

  const dp = Array.from({ length: m }, () => Array(n).fill(Infinity));
  const prev = Array.from({ length: m }, () => Array(n).fill(-1));
  const eps = 1e-12;

  for (let j = 0; j < n; j++) dp[0][j] = cost(phases[0], j);

  for (let i = 1; i < m; i++) {
    for (let j = i; j < n; j++) {
      const c = cost(phases[i], j);
      let best = Infinity;
      let bestK = -1;
      for (let k = i - 1; k < j; k++) {
        const cand = dp[i - 1][k] + c;
        if (cand + eps < best || (Math.abs(cand - best) <= eps && (bestK < 0 || k < bestK))) {
          best = cand;
          bestK = k;
        }
      }
      dp[i][j] = best;
      prev[i][j] = bestK;
    }
  }

  let endJ = m - 1;
  let endCost = Infinity;
  for (let j = m - 1; j < n; j++) {
    const cand = dp[m - 1][j];
    if (cand + eps < endCost || (Math.abs(cand - endCost) <= eps && j < endJ)) {
      endCost = cand;
      endJ = j;
    }
  }

  const out = Array(m).fill(0);
  let curJ = endJ;
  for (let i = m - 1; i >= 0; i--) {
    out[i] = curJ;
    curJ = prev[i][curJ];
  }
  return out;
}

// Ghost note support (MVP)
const GHOST_ENABLED = new Set(["snare", "tom1", "tom2", "floorTom", "hihat"]);
const FOOT_INSTRUMENTS = new Set(["kick", "hihatFoot"]);
const INSTRUMENT_HAND_POSITION = {
  splash: 0.8,
  china: 3.9,
  crash2: 3.5,
  crash1: 1.0,
  ride: 3.2,
  rideBell: 3.0,
  hihatOpen: 0.2,
  hihat: 0.2,
  cowbell: 2.2,
  tom1: 2.4,
  tom2: 2.0,
  floorTom: 3.0,
  sideStick: 1.8,
  snare: 1.8,
};

function getHandPositionForInstrument(instId, handedness) {
  const base = INSTRUMENT_HAND_POSITION[instId] ?? 2;
  return handedness === "left" ? 4 - base : base;
}

// NOTE: mapping is a starting point; we'll refine staff positions later.
const NOTATION_MAP = {
  kick: { key: "f/4" },
  snare: { key: "c/5" },
  sideStick: { key: "c/5/x2", x: true },

  // Cymbals / hats use X noteheads
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

  // Toms
  tom2: { key: "d/5" },
  tom1: { key: "e/5" },
  floorTom: { key: "a/4" },
};

export default function App() {
  const [routeOptions] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const embedRaw = (params.get("embed") || "").toLowerCase();
    const embed = embedRaw === "1" || embedRaw === "true" || embedRaw === "yes";
    const exampleId = (params.get("example") || "").trim().toLowerCase();
    const shared = (params.get("s") || "").trim();
    const pathname = window.location.pathname || "/";
    const shareMatch = pathname.match(/^\/g\/([A-Za-z0-9_-]{4,64})\/?$/);
    const shareId = shareMatch ? shareMatch[1] : "";
    return { embed, exampleId, shared, shareId };
  });
  const isEmbedMode = routeOptions.embed;
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0,
  }));
  const isMobileFloatingPanels = viewportSize.width > 0 && viewportSize.width < 768;
  const showDesktopSettingsSidebar = !isEmbedMode && viewportSize.width >= 1100;
  const [settingsSidebarDefaultOpen, setSettingsSidebarDefaultOpen] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_SIDEBAR_DEFAULT_OPEN_STORAGE_KEY);
      if (raw === "false") return false;
      return true;
    } catch {
      return true;
    }
  });
  const [settingsSidebarCollapsed, setSettingsSidebarCollapsed] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (raw === "true") return true;
      if (raw === "false") return false;
      const defaultOpenRaw = window.localStorage.getItem(SETTINGS_SIDEBAR_DEFAULT_OPEN_STORAGE_KEY);
      return defaultOpenRaw === "false";
    } catch {
      return false;
    }
  });
  const useFixedDesktopFooter = false;
  const requestedExample = React.useMemo(() => {
    if (!routeOptions.exampleId) return null;
    return EMBED_EXAMPLES[routeOptions.exampleId] || null;
  }, [routeOptions.exampleId]);
  const requestedSharedState = React.useMemo(
    () => decodeShareState(routeOptions.shared),
    [routeOptions.shared]
  );
  const [resolvedSharedState, setResolvedSharedState] = useState(() => {
    const preloadedId = window.__DG_PRELOADED_SHARE_ID;
    const preloadedPayload = window.__DG_PRELOADED_SHARE_PAYLOAD;
    if (routeOptions.shareId && preloadedId === routeOptions.shareId && preloadedPayload && typeof preloadedPayload === "object") {
      return preloadedPayload;
    }
    return null;
  });
  const [sharedArrangementBeats, setSharedArrangementBeats] = useState([]);
  const [customStartupGridSettings, setCustomStartupGridSettings] = useState(() =>
    readStoredStartupGridSettings()
  );
  const initialStartupGridSettings = customStartupGridSettings || BUILT_IN_STARTUP_GRID_SETTINGS;

  const [kitInstrumentIds, setKitInstrumentIds] = useState(() => [
    ...initialStartupGridSettings.kitInstrumentIds,
  ]);
  const instruments = React.useMemo(
    () => kitInstrumentIds.map((id) => INSTRUMENT_BY_ID[id]).filter(Boolean),
    [kitInstrumentIds]
  );
  const currentGridLabelGutterWidth = React.useMemo(() => {
    return "calc(8ch + 0.2rem)";
  }, []);
  const [isKitEditorOpen, setIsKitEditorOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null); // { instId, moveTargetId }
  const [pendingPresetChange, setPendingPresetChange] = useState(null); // { presetName, targetIds, removedWithNotes }
  const [keepTracksWithNotesEnabled, setKeepTracksWithNotesEnabled] = useState(true);
  const [showPresetChangeWarningEnabled, setShowPresetChangeWarningEnabled] = useState(false);
  const [isShareActionsDialogOpen, setIsShareActionsDialogOpen] = useState(false);
  const [isTransportMenuOpen, setIsTransportMenuOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isArrangementPrintDialogOpen, setIsArrangementPrintDialogOpen] = useState(false);
  const [isMidiDialogOpen, setIsMidiDialogOpen] = useState(false);
  const [midiExportMode, setMidiExportMode] = useState("beat");
  const [pendingMidiImportMapping, setPendingMidiImportMapping] = useState(null);
  const [pendingMidiTempoPrompt, setPendingMidiTempoPrompt] = useState(null);
  const [lastMidiImportSession, setLastMidiImportSession] = useState(null);
  const [isLegalDialogOpen, setIsLegalDialogOpen] = useState(false);
  const [isPreferencesDialogOpen, setIsPreferencesDialogOpen] = useState(false);
  const [showAppVersion, setShowAppVersion] = useState(false);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [editingShortcutActionId, setEditingShortcutActionId] = useState(null);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState("sign-in");
  const [authEmailInput, setAuthEmailInput] = useState("");
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [isAuthButtonUnlocked, setIsAuthButtonUnlocked] = useState(false);
  const [pendingPersonalCloudImport, setPendingPersonalCloudImport] = useState(null);
  const [personalCloudImportPending, setPersonalCloudImportPending] = useState(false);
  const [selectedPersonalCloudImportBeatIds, setSelectedPersonalCloudImportBeatIds] = useState([]);
  const [selectedPersonalCloudImportArrangementIds, setSelectedPersonalCloudImportArrangementIds] = useState([]);
  const [selectedPersonalCloudImportFolderIds, setSelectedPersonalCloudImportFolderIds] = useState([]);
  const [personalCloudImportExpandedFolderIds, setPersonalCloudImportExpandedFolderIds] = useState([]);
  const [preferencesCategory, setPreferencesCategory] = useState(() => {
    try {
      const raw = (window.localStorage.getItem(PREFERENCES_CATEGORY_STORAGE_KEY) || "").toLowerCase();
      const allowed = new Set(["defaults", "timing", "editor", "appearance"]);
      return allowed.has(raw) ? raw : "timing";
    } catch (_) {
      return "timing";
    }
  });
  const [openTupletAppearanceEditor, setOpenTupletAppearanceEditor] = useState(null);
  const [shortcutBindings, setShortcutBindings] = useState(() => shortcutsMapFromStorage());
  const [isEditingAdvancedMenuOpen, setIsEditingAdvancedMenuOpen] = useState(false);
  const [isNotationStickingMenuOpen, setIsNotationStickingMenuOpen] = useState(false);
  const [isLoopAdvancedMenuOpen, setIsLoopAdvancedMenuOpen] = useState(false);
  const [isSidebarSettingsMenuOpen, setIsSidebarSettingsMenuOpen] = useState(false);
  const [sidebarChevronHint, setSidebarChevronHint] = useState(null);
  const [legalTab, setLegalTab] = useState("impressum"); // impressum | privacy
  const [showLegalEmail, setShowLegalEmail] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackTypes, setFeedbackTypes] = useState([]);
  const [feedbackSort, setFeedbackSort] = useState("newest");
  const [feedbackSuccessMessage, setFeedbackSuccessMessage] = useState("");
  const [feedbackVoteMap, setFeedbackVoteMap] = useState({});
  const [feedbackAdminFilter, setFeedbackAdminFilter] = useState("pending");
  const [feedbackAdminReplyDrafts, setFeedbackAdminReplyDrafts] = useState({});
  const [adminStatsRange, setAdminStatsRange] = useState("day");
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminStatsError, setAdminStatsError] = useState("");
  const [adminStatsWarnings, setAdminStatsWarnings] = useState([]);
  const [adminStats, setAdminStats] = useState({
    users: 0,
    signedUpUsers: 0,
    siteVisits: 0,
    beatShareCreates: 0,
    arrangementShareCreates: 0,
    beatShareOpens: 0,
    arrangementShareOpens: 0,
  });
  const markSidebarChevronHint = React.useCallback((section) => {
    setSidebarChevronHint(section);
  }, []);
  const clearSidebarChevronHint = React.useCallback(() => {
    setSidebarChevronHint(null);
  }, []);
  const handleSidebarChevronAreaPointerDown = React.useCallback((event) => {
    if (event.target?.closest?.("[data-sidebar-chevron-control]")) return;
    setSidebarChevronHint(null);
  }, []);
  useEffect(() => {
    if (!sidebarChevronHint) return undefined;
    const handlePointerDown = (event) => {
      if (event.target?.closest?.("[data-sidebar-chevron-area]")) return;
      setSidebarChevronHint(null);
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [sidebarChevronHint]);
  useEffect(() => {
    const onViewportChange = () => {
      setViewportSize({
        width: window.innerWidth || document.documentElement.clientWidth || 0,
        height: window.innerHeight || document.documentElement.clientHeight || 0,
      });
    };
    window.addEventListener("resize", onViewportChange);
    return () => window.removeEventListener("resize", onViewportChange);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SETTINGS_SIDEBAR_COLLAPSED_STORAGE_KEY,
        settingsSidebarCollapsed ? "true" : "false"
      );
    } catch (_) {}
  }, [settingsSidebarCollapsed]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SETTINGS_SIDEBAR_DEFAULT_OPEN_STORAGE_KEY,
        settingsSidebarDefaultOpen ? "true" : "false"
      );
    } catch (_) {}
  }, [settingsSidebarDefaultOpen]);
  const [stickingGuideEnabled, setStickingGuideEnabled] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STICKING_GUIDE_ENABLED_STORAGE_KEY);
      if (raw == null) return false;
      return raw === "1";
    } catch (_) {
      return false;
    }
  });
  const [stickingHandedness, setStickingHandedness] = useState(() => {
    try {
      const raw = (window.localStorage.getItem(STICKING_HANDEDNESS_STORAGE_KEY) || "").toLowerCase();
      return raw === "left" ? "left" : "right";
    } catch (_) {
      return "right";
    }
  });
  const [stickingLeadHand, setStickingLeadHand] = useState(() => {
    try {
      const raw = (window.localStorage.getItem(STICKING_LEAD_HAND_STORAGE_KEY) || "").toLowerCase();
      if (raw === "left" || raw === "right") return raw;
      return "right";
    } catch (_) {
      return "right";
    }
  });
  const [stickingEditModeEnabled, setStickingEditModeEnabled] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STICKING_EDIT_MODE_ENABLED_STORAGE_KEY);
      if (raw == null) return false;
      return raw === "1";
    } catch (_) {
      return false;
    }
  });
  const [notationStickingSelectionModeEnabled, setNotationStickingSelectionModeEnabled] = useState(() => {
    try {
      const raw = window.localStorage.getItem(
        NOTATION_STICKING_SELECTION_MODE_ENABLED_STORAGE_KEY
      );
      if (raw == null) return false;
      return raw === "1";
    } catch (_) {
      return false;
    }
  });
  const [stickingOverrides, setStickingOverrides] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STICKING_OVERRIDES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object") return {};
      const out = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v === "L" || v === "R") out[k] = v;
      });
      return out;
    } catch (_) {
      return {};
    }
  });
  const [stickingKeepQuarterLeadHand, setStickingKeepQuarterLeadHand] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STICKING_KEEP_QUARTER_LEAD_HAND_STORAGE_KEY);
      if (raw == null) return true;
      return raw === "1";
    } catch (_) {
      return true;
    }
  });
  const [showEditedSticking, setShowEditedSticking] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SHOW_EDITED_STICKING_STORAGE_KEY);
      if (raw == null) return false;
      return raw === "1";
    } catch (_) {
      return false;
    }
  });
  const [showNotationSticking, setShowNotationSticking] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SHOW_NOTATION_STICKING_STORAGE_KEY);
      if (raw == null) return false;
      return raw === "1";
    } catch (_) {
      return false;
    }
  });
  const [autoPrintNewBeatStickingEnabled, setAutoPrintNewBeatStickingEnabled] = useState(() => {
    try {
      const raw = window.localStorage.getItem(AUTO_PRINT_NEW_BEAT_STICKING_STORAGE_KEY);
      if (raw == null) return false;
      return raw === "1";
    } catch (_) {
      return false;
    }
  });
  const [beatAutoUpdateEnabled, setBeatAutoUpdateEnabled] = useState(() => {
    try {
      const raw = window.localStorage.getItem(BEAT_AUTO_UPDATE_ENABLED_STORAGE_KEY);
      if (raw == null) return false;
      return raw === "1";
    } catch (_) {
      return false;
    }
  });
  const [notationStickingView, setNotationStickingView] = useState(() => {
    try {
      const raw = window.localStorage.getItem(NOTATION_STICKING_VIEW_STORAGE_KEY);
      return raw === "split-rows" ? "split-rows" : "above";
    } catch (_) {
      return "above";
    }
  });
  const [notationStickingSelection, setNotationStickingSelection] = useState(() => {
    try {
      const raw = window.localStorage.getItem(NOTATION_STICKING_SELECTION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object") return {};
      const out = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v === true) out[k] = true;
      });
      return out;
    } catch (_) {
      return {};
    }
  });
  const [selectedCountRowSubdivision, setSelectedCountRowSubdivision] = useState(() => {
    try {
      const raw = window.localStorage.getItem(COUNT_ROW_SELECTED_SUBDIVISION_STORAGE_KEY);
      return normalizeCountRowSelectedSubdivision(raw);
    } catch (_) {
      return 3;
    }
  });
  const [tupletGridAppearanceByValue, setTupletGridAppearanceByValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(TUPLET_GRID_APPEARANCE_BY_VALUE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return normalizeTupletAppearanceByValue(parsed);
    } catch (_) {
      return normalizeTupletAppearanceByValue(null);
    }
  });
  const [darkenCountRowNonQuarters, setDarkenCountRowNonQuarters] = useState(() => {
    try {
      const raw = window.localStorage.getItem(COUNT_ROW_DARKEN_NON_QUARTERS_STORAGE_KEY);
      return raw == null ? false : raw !== "0";
    } catch (_) {
      return false;
    }
  });
  const [notationStickingModePreference, setNotationStickingModePreference] = useState(() =>
    showNotationSticking ? "custom" : "off"
  );
  const [isArrangementOpen, setIsArrangementOpen] = useState(false);
  const [isArrangementNotationOpen, setIsArrangementNotationOpen] = useState(false);
  const arrangementNotationViewMode = "sheet";
  const arrangementNotationPageMode = "pages";
  const [arrangementNotationBarsPerRow, setArrangementNotationBarsPerRow] = useState(() => {
    try {
      const raw = Number(window.localStorage.getItem(ARRANGEMENT_NOTATION_BARS_PER_ROW_STORAGE_KEY));
      return raw === 1 || raw === 2 || raw === 3 || raw === 4 ? raw : 2;
    } catch (_) {
      return 2;
    }
  });
  const [arrangementNotationDynamicSpacing, setArrangementNotationDynamicSpacing] = useState(() => {
    try {
      return window.localStorage.getItem(ARRANGEMENT_NOTATION_DYNAMIC_SPACING_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  });
  const [arrangementNotationGlobalMergeRests, setArrangementNotationGlobalMergeRests] = useState(() => {
    try {
      const raw = window.localStorage.getItem(ARRANGEMENT_NOTATION_GLOBAL_MERGE_RESTS_STORAGE_KEY);
      return raw == null ? true : raw === "true";
    } catch (_) {
      return true;
    }
  });
  const [arrangementNotationGlobalMergeNotes, setArrangementNotationGlobalMergeNotes] = useState(() => {
    try {
      const raw = window.localStorage.getItem(ARRANGEMENT_NOTATION_GLOBAL_MERGE_NOTES_STORAGE_KEY);
      return raw == null ? true : raw === "true";
    } catch (_) {
      return true;
    }
  });
  const [arrangementNotationGlobalDottedNotes, setArrangementNotationGlobalDottedNotes] = useState(() => {
    try {
      const raw = window.localStorage.getItem(ARRANGEMENT_NOTATION_GLOBAL_DOTTED_NOTES_STORAGE_KEY);
      return raw == null ? true : raw === "true";
    } catch (_) {
      return true;
    }
  });
  const [arrangementNotationScrollRows, setArrangementNotationScrollRows] = useState(() => {
    try {
      const raw = Number(window.localStorage.getItem(ARRANGEMENT_NOTATION_SCROLL_ROWS_STORAGE_KEY));
      return raw === 1 || raw === 2 || raw === 3 ? raw : 2;
    } catch (_) {
      return 2;
    }
  });
  const [arrangementNotationTheme, setArrangementNotationTheme] = useState(() => {
    try {
      const raw = window.localStorage.getItem(ARRANGEMENT_NOTATION_THEME_STORAGE_KEY);
      return raw === "dark" ? "dark" : "light";
    } catch (_) {
      return "light";
    }
  });
  const [arrangementNotationVirtualize, setArrangementNotationVirtualize] = useState(() => {
    try {
      const raw = window.localStorage.getItem(ARRANGEMENT_NOTATION_VIRTUALIZE_STORAGE_KEY);
      return raw === "true";
    } catch (_) {
      return false;
    }
  });
  const [arrangementNotationPreviewScale, setArrangementNotationPreviewScale] = useState(() => {
    try {
      const raw = window.localStorage.getItem(ARRANGEMENT_NOTATION_PREVIEW_SCALE_STORAGE_KEY);
      if (raw === "auto") return "auto";
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return 0.6;
      return Math.max(0.35, Math.min(1, Math.round(numeric * 100) / 100));
    } catch (_) {
      return 0.6;
    }
  });
  const [arrangementNotationPreviewScaledHeight, setArrangementNotationPreviewScaledHeight] = useState(0);
  const arrangementNotationManualPreviewScale =
    typeof arrangementNotationPreviewScale === "number" && Number.isFinite(arrangementNotationPreviewScale)
      ? arrangementNotationPreviewScale
      : 0.6;
  const arrangementNotationPanelWidth = React.useMemo(
    () => {
      if (arrangementNotationManualPreviewScale === 0.35) return 420;
      if (arrangementNotationManualPreviewScale === 0.4) return 445;
      if (arrangementNotationManualPreviewScale === 0.45) return 470;
      if (arrangementNotationManualPreviewScale === 0.5) return 495;
      if (arrangementNotationManualPreviewScale === 0.55) return 520;
      if (arrangementNotationManualPreviewScale === 0.6) return 545;
      if (arrangementNotationManualPreviewScale === 0.65) return 605;
      if (arrangementNotationManualPreviewScale === 0.7) return 651;
      if (arrangementNotationManualPreviewScale === 0.75) return 696;
      if (arrangementNotationManualPreviewScale === 0.8) return 741;
      if (arrangementNotationManualPreviewScale === 0.85) return 787;
      if (arrangementNotationManualPreviewScale === 0.9) return 832;
      if (arrangementNotationManualPreviewScale === 0.95) return 877;
      if (arrangementNotationManualPreviewScale === 1) return 923;
      return Math.max(
        520,
        Math.round(
          794 * arrangementNotationManualPreviewScale +
            96 +
            100 * (arrangementNotationManualPreviewScale - 0.7)
        )
      );
    },
    [arrangementNotationManualPreviewScale]
  );
  const arrangementNotationEffectivePreviewScale = React.useMemo(() => {
    const viewportWidth = Number(viewportSize.width) || 0;
    const availableWidth = Math.max(280, viewportWidth - 24);
    const fitScale = Math.max(0.35, Math.min(1, availableWidth / 794));
    if (arrangementNotationPreviewScale === "auto") return fitScale;
    if (!isMobileFloatingPanels) return arrangementNotationManualPreviewScale;
    return Math.min(arrangementNotationManualPreviewScale, fitScale);
  }, [arrangementNotationPreviewScale, arrangementNotationManualPreviewScale, isMobileFloatingPanels, viewportSize.width]);
  const arrangementNotationRenderedPageWidth = React.useMemo(
    () => Math.ceil(794 * arrangementNotationEffectivePreviewScale),
    [arrangementNotationEffectivePreviewScale]
  );
  const arrangementNotationShellWidth = React.useMemo(() => {
    const viewportWidth = Number(viewportSize.width) || 0;
    const preferredWidth = Math.max(
      arrangementNotationPanelWidth,
      arrangementNotationRenderedPageWidth + 12
    );
    if (viewportWidth > 0) {
      return Math.min(Math.max(320, viewportWidth - 8), preferredWidth);
    }
    return preferredWidth;
  }, [arrangementNotationPanelWidth, arrangementNotationRenderedPageWidth, viewportSize.width]);
  const arrangementNotationTopGap = React.useMemo(() => {
    const scale =
      arrangementNotationPreviewScale === "auto"
        ? Math.round(arrangementNotationEffectivePreviewScale * 100) / 100
        : arrangementNotationManualPreviewScale;
    if (scale === 0.35) return -11;
    if (scale === 0.4) return -10;
    if (scale === 0.45) return -9;
    if (scale === 0.5) return -8;
    if (scale === 0.55) return -7;
    if (scale === 0.6) return -6;
    if (scale === 0.65) return -5;
    if (scale === 0.7) return -4;
    if (scale === 0.75) return -4;
    if (scale === 0.8) return -4;
    if (scale === 0.85) return -3;
    if (scale === 0.9) return -2;
    if (scale === 0.95) return -2;
    if (scale === 1) return -1;
    return 0;
  }, [arrangementNotationPreviewScale, arrangementNotationManualPreviewScale, arrangementNotationEffectivePreviewScale]);
  const positionArrangementNotationUnderHeaderButton = React.useCallback((buttonEl) => {
    if (isMobileFloatingPanels) return;
    if (!(buttonEl instanceof HTMLElement) || typeof window === "undefined") return;
    const rect = buttonEl.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const panelWidth = arrangementNotationShellWidth;
    const panelHeight = arrangementNotationPanelRef.current?.offsetHeight || 760;
    const maxX = Math.max(margin, viewportWidth - panelWidth - margin);
    const maxY = Math.max(margin, viewportHeight - panelHeight - margin);
    const nextX = Math.max(margin, Math.min(Math.round(rect.right - panelWidth), maxX));
    const nextY = Math.max(margin, Math.min(Math.round(rect.bottom + 18), maxY));
    setArrangementNotationPos({ x: nextX, y: nextY });
  }, [arrangementNotationShellWidth, isMobileFloatingPanels]);
  const [arrangementPdfQrEnabled, setArrangementPdfQrEnabled] = useState(false);
  const [arrangementPdfWatermarkEnabled, setArrangementPdfWatermarkEnabled] = useState(true);
  useEffect(() => {
    if (!isPrintDialogOpen) return;
    setPrintQrEnabled(false);
  }, [isPrintDialogOpen]);
  useEffect(() => {
    if (!isArrangementPrintDialogOpen) return;
    setArrangementPdfQrEnabled(false);
  }, [isArrangementPrintDialogOpen]);
  const [arrangementPlaybackEnabled, setArrangementPlaybackEnabled] = useState(false);
  const [arrangementPlaybackUiActive, setArrangementPlaybackUiActive] = useState(false);
  const [arrangementPlaybackIndex, setArrangementPlaybackIndex] = useState(0);
  const [arrangementPlaybackLoopEnabled, setArrangementPlaybackLoopEnabled] = useState(false);
  const [activeArrangementGlobalBarIndex, setActiveArrangementGlobalBarIndex] = useState(-1);
  const [arrangementSelection, setArrangementSelection] = useState(null); // {start,end} row indices
  const [arrangementSelectionAnchor, setArrangementSelectionAnchor] = useState(null); // row index
  const [arrangementBarSelection, setArrangementBarSelection] = useState(null); // {start,end} global bar indices
  const [arrangementBarSelectionAnchor, setArrangementBarSelectionAnchor] = useState(null); // global bar index
  const arrangementTouchSelectionRef = React.useRef({
    pointerId: null,
    mode: null,
    barIndex: null,
    startX: null,
    startY: null,
    moved: false,
  });
  const arrangementActiveTouchPointersRef = React.useRef(new Set());
  const clearArrangementNotationSelection = React.useCallback(() => {
    arrangementTouchSelectionRef.current.pointerId = null;
    arrangementTouchSelectionRef.current.mode = null;
    arrangementTouchSelectionRef.current.barIndex = null;
    arrangementTouchSelectionRef.current.startX = null;
    arrangementTouchSelectionRef.current.startY = null;
    arrangementTouchSelectionRef.current.moved = false;
    arrangementActiveTouchPointersRef.current.clear();
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
  }, []);
  const arrangementPlayButtonRef = React.useRef(null);
  const headerSheetButtonRef = React.useRef(null);
  const blurActiveTextInput = React.useCallback(() => {
    const activeEl = document.activeElement;
    if (
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement ||
      activeEl?.isContentEditable
    ) {
      try {
        activeEl.blur();
      } catch (_) {}
    }
  }, []);
  const [arrangementPos, setArrangementPos] = useState({ x: 56, y: 112 });
  const [arrangementNotationPos, setArrangementNotationPos] = useState({ x: 56, y: 128 });
  const [isPublicSubmitDialogOpen, setIsPublicSubmitDialogOpen] = useState(false);
  const [loadedLocalBeatId, setLoadedLocalBeatId] = useState(null);
  const [currentEditorBeatKey, setCurrentEditorBeatKey] = useState("");
  const [currentArrangementEditorBeatKey, setCurrentArrangementEditorBeatKey] = useState("");
  const [arrangementSourceTab, setArrangementSourceTab] = useState("local"); // presets | local | public
  const [arrangementSourcesCollapsed, setArrangementSourcesCollapsed] = useState(false);
  const [arrangementDetailsCollapsed, setArrangementDetailsCollapsed] = useState(true);
  const [keepBeatLibrarySidebarOpen, setKeepBeatLibrarySidebarOpen] = useState(false);
  const sharedArrangementSourcePanelWidthRem = 16.25;
  const sharedArrangementDetailsPanelWidthRem = 27;
  const sharedArrangementPanelWidthRem =
    sharedArrangementSourcePanelWidthRem + sharedArrangementDetailsPanelWidthRem;
  const arrangementPanelWidth =
  arrangementDetailsCollapsed && !arrangementSourcesCollapsed
      ? 368 // max-w-[23rem]
  : arrangementSourcesCollapsed || arrangementDetailsCollapsed
        ? 432 // max-w-[27rem]
        : sharedArrangementPanelWidthRem * 16;
  const [arrangementItems, setArrangementItems] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SONG_ARRANGEMENT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return normalizeArrangementItems(parsed);
    } catch (_) {
      return [];
    }
  });
  const [savedArrangements, setSavedArrangements] = useState(() => {
    return readStoredSavedArrangements();
  });
  const [arrangementNameDraft, setArrangementNameDraft] = useState("");
  const [arrangementTitleLine1Draft, setArrangementTitleLine1Draft] = useState(() => {
    try {
      return String(window.localStorage.getItem(ARRANGEMENT_TITLE_LINE1_STORAGE_KEY) || "");
    } catch (_) {
      return "";
    }
  });
  const [arrangementTitleLine2Draft, setArrangementTitleLine2Draft] = useState(() => {
    try {
      return String(window.localStorage.getItem(ARRANGEMENT_TITLE_LINE2_STORAGE_KEY) || "");
    } catch (_) {
      return "";
    }
  });
  const [arrangementComposerDraft, setArrangementComposerDraft] = useState(() => {
    try {
      return String(window.localStorage.getItem(ARRANGEMENT_COMPOSER_STORAGE_KEY) || "");
    } catch (_) {
      return "";
    }
  });
  const [isArrangementSheetTitleEditing, setIsArrangementSheetTitleEditing] = useState(false);
  const arrangementSheetTitleEditorRef = React.useRef(null);
  const [loadedArrangementId, setLoadedArrangementId] = useState(() => {
    try {
      return String(window.localStorage.getItem(LAST_USED_ARRANGEMENT_ID_STORAGE_KEY) || "").trim() || null;
    } catch (_) {
      return null;
    }
  });
  const [arrangementPickerId, setArrangementPickerId] = useState(null);
  const arrangementPickerIdRef = React.useRef(null);
  const selectArrangementPickerId = React.useCallback((arrangementId) => {
    const nextId = arrangementId ? String(arrangementId) : null;
    arrangementPickerIdRef.current = nextId;
    setArrangementPickerId(nextId);
  }, []);
  const [arrangementPickerMenuOpen, setArrangementPickerMenuOpen] = useState(false);
  const [arrangementPickerMenuPosition, setArrangementPickerMenuPosition] = useState({ top: 0, left: 0, width: 224 });
  const [isArrangementPickerRenaming, setIsArrangementPickerRenaming] = useState(false);
  const [arrangementPickerRenameWidth, setArrangementPickerRenameWidth] = useState(null);
  const [arrangementPickerRenameHoverAction, setArrangementPickerRenameHoverAction] = useState(null);
  const [arrangementLibraryTab, setArrangementLibraryTab] = useState("local");
  const [arrangementTitleMenuOpen, setArrangementTitleMenuOpen] = useState(false);
  const [arrangementTitleMenuPosition, setArrangementTitleMenuPosition] = useState({ top: 0, left: 0 });
  const [arrangementNotationMoreMenuOpen, setArrangementNotationMoreMenuOpen] = useState(false);
  const arrangementGlobalSettingsMenuOpen = arrangementNotationMoreMenuOpen;
  const setArrangementGlobalSettingsMenuOpen = setArrangementNotationMoreMenuOpen;
  const [arrangementNotationMoreMenuPosition, setArrangementNotationMoreMenuPosition] = useState({ top: 0, left: 0, width: 256 });
  const [arrangementNotationRowMenuState, setArrangementNotationRowMenuState] = useState(null);
  const [pendingArrangementDeleteEntry, setPendingArrangementDeleteEntry] = useState(null);
  const [fileMenuPosition, setFileMenuPosition] = useState({ top: 0, left: 0 });
  const [arrangementDropActive, setArrangementDropActive] = useState(false);
  const [arrangementDropTarget, setArrangementDropTarget] = useState(null);
  const [activeArrangementSortRowId, setActiveArrangementSortRowId] = useState(null);
  const [arrangementOrderDropTargetId, setArrangementOrderDropTargetId] = useState(null);
  const [arrangementOrderTrashHover, setArrangementOrderTrashHover] = useState(false);
  const [beatNameDraft, setBeatNameDraft] = useState("");
  const [isCurrentBeatStripRenaming, setIsCurrentBeatStripRenaming] = useState(false);
  const [currentBeatStripRenameWidth, setCurrentBeatStripRenameWidth] = useState(null);
  const [currentBeatStripRenameHoverAction, setCurrentBeatStripRenameHoverAction] = useState(null);
  const [pendingCurrentBeatStripAutoRename, setPendingCurrentBeatStripAutoRename] = useState(false);
  const [unsavedBeatStripSnapshot, setUnsavedBeatStripSnapshot] = useState(null);
  const [publicSubmitTitle, setPublicSubmitTitle] = useState("");
  const [publicSubmitComposer, setPublicSubmitComposer] = useState("");
  const [publicSubmitCategory, setPublicSubmitCategory] = useState("all");
  const [publicSubmitStyle, setPublicSubmitStyle] = useState("all");
  const [lockedPublicComposer, setLockedPublicComposer] = useState(() => {
    try {
      const raw = window.localStorage.getItem(PUBLIC_SUBMIT_COMPOSER_STORAGE_KEY);
      return String(raw || "").trim();
    } catch (_) {
      return "";
    }
  });
  const [beatCategoryDraft, setBeatCategoryDraft] = useState("all");
  const [beatStyleDraft, setBeatStyleDraft] = useState("all");
  const [librarySort, setLibrarySort] = useState("oldest"); // latest | oldest
  const [libraryTimeSigFilter, setLibraryTimeSigFilter] = useState("all");
  const [libraryBpmFilterMode, setLibraryBpmFilterMode] = useState("any"); // any | exact | pm5 | pm10
  const [libraryBpmTarget, setLibraryBpmTarget] = useState(120);
  const [midiImportSplitBars, setMidiImportSplitBars] = useState(1);
  const [midiArrangementImportMode, setMidiArrangementImportMode] = useState("override-current-arrangement");
  const [localBeats, setLocalBeats] = useState(() => {
    return readStoredLocalBeats();
  });
  const [gridSettingsPresets, setGridSettingsPresets] = useState(() => readStoredGridSettingsPresets());
  const [selectedGridSettingsPresetId, setSelectedGridSettingsPresetId] = useState("");
  const [editingGridSettingsPresetId, setEditingGridSettingsPresetId] = useState("");
  const [editingGridSettingsPresetName, setEditingGridSettingsPresetName] = useState("");
  const [activeGridSettingsPresetDragId, setActiveGridSettingsPresetDragId] = useState(null);
  const [presetLibraryDropTargetId, setPresetLibraryDropTargetId] = useState(null);
  const [beatLibraryContainers, setBeatLibraryContainers] = useState(() => readStoredBeatLibraryContainers());
  const [selectedBeatLibraryBeatIds, setSelectedBeatLibraryBeatIds] = useState([]);
  const [beatLibraryBeatSelectionAnchorId, setBeatLibraryBeatSelectionAnchorId] = useState(null);
  const [selectedBeatLibraryContainerId, setSelectedBeatLibraryContainerId] = useState(() => {
    try {
      return String(window.localStorage.getItem(BEAT_LIBRARY_SELECTED_CONTAINER_STORAGE_KEY) || "all");
    } catch (_) {
      return "all";
    }
  });
  const selectedBeatLibraryContainerIdRef = React.useRef(selectedBeatLibraryContainerId);
  const selectBeatLibraryContainer = React.useCallback((containerId) => {
    const nextId = String(containerId || "all");
    selectedBeatLibraryContainerIdRef.current = nextId;
    setSelectedBeatLibraryContainerId(nextId);
  }, []);
  const clearBeatLibraryBeatSelection = React.useCallback(() => {
    setSelectedBeatLibraryBeatIds([]);
    setBeatLibraryBeatSelectionAnchorId(null);
  }, []);
  const [beatLibraryRootCollapsed, setBeatLibraryRootCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(BEAT_LIBRARY_ROOT_COLLAPSED_STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  });
  const [editingBeatLibraryContainerId, setEditingBeatLibraryContainerId] = useState(null);
  const [editingBeatLibraryContainerName, setEditingBeatLibraryContainerName] = useState("");
  const [editingBeatLibraryBeatId, setEditingBeatLibraryBeatId] = useState(null);
  const [editingBeatLibraryBeatName, setEditingBeatLibraryBeatName] = useState("");
  const [beatLibraryDropTargetId, setBeatLibraryDropTargetId] = useState(null);
  const [activeBeatLibraryDragBeatId, setActiveBeatLibraryDragBeatId] = useState(null);
  const gridSettingsPresetLastOverIdRef = React.useRef("");
  const beatLibraryLastHoverTargetRef = React.useRef("");
  const beatLibraryLastBeatOverIdRef = React.useRef("");
  const beatLibraryPendingRenameExitRef = React.useRef("");
  const beatLibraryPendingBeatRenameExitRef = React.useRef("");
  const gridSettingsPresetPendingRenameExitRef = React.useRef("");
  const beatLibraryJustDraggedContainerRef = React.useRef({ id: "", at: 0 });
  const beatLibraryExpandAllSnapshotRef = React.useRef(null);
  const pendingBeatLibraryScrollTargetIdRef = React.useRef("");
  const [localBeatPast, setLocalBeatPast] = useState([]);
  const [localBeatFuture, setLocalBeatFuture] = useState([]);
  const [publicBeats, setPublicBeats] = useState([]);
  const [publicArrangements, setPublicArrangements] = useState([]);
  const [selectedPublicArrangementId, setSelectedPublicArrangementId] = useState("");
  const [publicLibraryLoading, setPublicLibraryLoading] = useState(false);
  const [publicArrangementLibraryLoading, setPublicArrangementLibraryLoading] = useState(false);
  const [publicLibraryError, setPublicLibraryError] = useState("");
  const [personalLibraryRefreshing, setPersonalLibraryRefreshing] = useState(false);
  const [personalLibraryLastSyncAt, setPersonalLibraryLastSyncAt] = useState("");
  const [profileShareQrCount, setProfileShareQrCount] = useState(0);
  const [profileTemporaryShareCount, setProfileTemporaryShareCount] = useState(0);
  const [profileCleanedShareCount, setProfileCleanedShareCount] = useState(0);
  const [profileShareLinks, setProfileShareLinks] = useState([]);
  const [profileStatsLoading, setProfileStatsLoading] = useState(false);
  const [libraryFiltersOpen, setLibraryFiltersOpen] = useState(false);
  const [arrangementLibraryMenuOpen, setArrangementLibraryMenuOpen] = useState(false);
  const [isBeatLibraryActionsMenuOpen, setIsBeatLibraryActionsMenuOpen] = useState(false);
  const [isArrangementActionsMenuOpen, setIsArrangementActionsMenuOpen] = useState(false);
  const [libraryFiltersAnchor, setLibraryFiltersAnchor] = useState("floating");
  const libraryFiltersRef = useRef(null);
  const floatingLibraryFiltersButtonRef = useRef(null);
  const dockedLibraryFiltersButtonRef = useRef(null);
  const dockedBeatLibrarySidebarRef = useRef(null);
  const arrangementLibraryMenuRef = useRef(null);
  const arrangementLibraryMenuButtonRef = useRef(null);
  const beatLibraryActionsMenuRef = useRef(null);
  const beatLibraryActionsMenuButtonRef = useRef(null);
  const arrangementActionsMenuRef = useRef(null);
  const arrangementActionsMenuButtonRef = useRef(null);
  const currentBeatStripNameInputRef = useRef(null);
  const currentBeatStripNameButtonRef = useRef(null);
  const [libraryFiltersMenuStyle, setLibraryFiltersMenuStyle] = useState(null);
  const [arrangementLibraryMenuStyle, setArrangementLibraryMenuStyle] = useState(null);
  const [beatLibraryActionsMenuStyle, setBeatLibraryActionsMenuStyle] = useState(null);
  const [arrangementActionsMenuStyle, setArrangementActionsMenuStyle] = useState(null);
  const [mobileArrangementPanelStyle, setMobileArrangementPanelStyle] = useState(null);
  const [transportMenuPosition, setTransportMenuPosition] = useState(null);
  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      const raw = window.localStorage.getItem(USER_PRESETS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((p) => ({
          id: String(p?.id || ""),
          label: String(p?.label || ""),
          ids: Array.isArray(p?.ids) ? p.ids.filter((id) => INSTRUMENT_BY_ID[id]) : [],
        }))
        .filter((p) => p.id && p.label && p.ids.length > 0 && !DRUMKIT_PRESETS[p.id]);
    } catch (_) {
      return [];
    }
  });
  const [modifiedPresetBase, setModifiedPresetBase] = useState(null); // built-in/user preset name for "preset*" variants
  const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [presetNameInlineDraft, setPresetNameInlineDraft] = useState("");
  const availableInstrumentButtonWidthCh = React.useMemo(
    () => Math.max(...ALL_INSTRUMENTS.map((inst) => inst.label.length)) + 2,
    []
  );

  const [resolution, setResolution] = useState(() => initialStartupGridSettings.resolution); // 4, 8, 16, 32
  const [bars, setBars] = useState(() => initialStartupGridSettings.bars);
  const [barsPerLine, setBarsPerLine] = useState(4);
  const [gridBarsPerLine, setGridBarsPerLine] = useState(4);
  const [layout, setLayout] = useState("grid-top");
  const [gridNotationGap, setGridNotationGap] = useState(() => {
    const defaultGridNotationGap = isMobileFloatingPanels ? 0 : 10;
    try {
      const stored = window.localStorage.getItem(GRID_NOTATION_GAP_STORAGE_KEY);
      if (stored == null || stored === "") return defaultGridNotationGap;
      if (stored === "0" && !isMobileFloatingPanels) return defaultGridNotationGap;
      const raw = Number(stored);
      return Number.isFinite(raw) ? Math.max(0, Math.min(80, Math.round(raw))) : defaultGridNotationGap;
    } catch (_) {
      return defaultGridNotationGap;
    }
  });
  const [notationGridGapOffset, setNotationGridGapOffset] = useState(() => {
    try {
      const raw = Number(window.localStorage.getItem(NOTATION_GRID_GAP_OFFSET_STORAGE_KEY));
      return Number.isFinite(raw) ? Math.max(-40, Math.min(50, Math.round(raw))) : -30;
    } catch (_) {
      return -30;
    }
  });
  const [activeTab, setActiveTab] = useState("none"); // none | timing | notation | selection
  const [timeSig, setTimeSig] = useState(() => ({ ...initialStartupGridSettings.timeSig }));
  const [keepTiming, setKeepTiming] = useState(true);
  const [isSidebarResolutionOpen, setIsSidebarResolutionOpen] = useState(false);
  const [playabilityWarningsEnabled, setPlayabilityWarningsEnabled] = useState(true);
  const [tupletOverridesByBar, setTupletOverridesByBar] = useState(() =>
    cloneTupletOverridesByBar(
      initialStartupGridSettings.tupletsByBar,
      initialStartupGridSettings.bars,
      initialStartupGridSettings.timeSig
    )
  );

  const [bpm, setBpm] = useState(120);
  const [midiImportSnareGhostMax, setMidiImportSnareGhostMax] = useState(() => {
    try {
      const raw = Number(window.localStorage.getItem(MIDI_IMPORT_SNARE_GHOST_MAX_STORAGE_KEY));
      return Number.isFinite(raw) ? Math.max(1, Math.min(126, Math.round(raw))) : 70;
    } catch (_) {
      return 70;
    }
  });
  const [midiImportTomGhostMax, setMidiImportTomGhostMax] = useState(() => {
    try {
      const raw = Number(window.localStorage.getItem(MIDI_IMPORT_TOM_GHOST_MAX_STORAGE_KEY));
      return Number.isFinite(raw) ? Math.max(1, Math.min(126, Math.round(raw))) : 70;
    } catch (_) {
      return 70;
    }
  });
  const [midiImportHihatGhostMax, setMidiImportHihatGhostMax] = useState(() => {
    try {
      const raw = Number(window.localStorage.getItem(MIDI_IMPORT_HIHAT_GHOST_MAX_STORAGE_KEY));
      return Number.isFinite(raw) ? Math.max(1, Math.min(126, Math.round(raw))) : 70;
    } catch (_) {
      return 70;
    }
  });
  const midiImportVelocityThresholds = React.useMemo(
    () => ({
      snareGhostMax: midiImportSnareGhostMax,
      tomGhostMax: midiImportTomGhostMax,
      hihatGhostMax: midiImportHihatGhostMax,
    }),
    [midiImportSnareGhostMax, midiImportTomGhostMax, midiImportHihatGhostMax]
  );
  useEffect(() => {
    if (!libraryFiltersOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const root = libraryFiltersRef.current;
      const button = libraryFiltersButtonRef.current;
      if (root instanceof HTMLElement && root.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setLibraryFiltersOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLibraryFiltersOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [libraryFiltersOpen]);
  useEffect(() => {
    if (!arrangementLibraryMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const root = arrangementLibraryMenuRef.current;
      const button = arrangementLibraryMenuButtonRef.current;
      if (root instanceof HTMLElement && root.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setArrangementLibraryMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setArrangementLibraryMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [arrangementLibraryMenuOpen]);
  useEffect(() => {
    if (!arrangementLibraryMenuOpen) {
      setArrangementLibraryMenuStyle(null);
      return undefined;
    }
    const updatePosition = () => {
      const button = arrangementLibraryMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const rect = button.getBoundingClientRect();
      const gap = 8;
      const estimatedHeight = 180;
      const shouldOpenUp =
        window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight / 2;
      setArrangementLibraryMenuStyle({
        position: "fixed",
        zIndex: 120,
        right: Math.max(8, window.innerWidth - rect.right),
        top: shouldOpenUp ? "auto" : rect.bottom + gap,
        bottom: shouldOpenUp ? Math.max(8, window.innerHeight - rect.top + gap) : "auto",
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [arrangementLibraryMenuOpen]);
  useEffect(() => {
    if (!libraryFiltersOpen) {
      setLibraryFiltersMenuStyle(null);
      return undefined;
    }
    const updatePosition = () => {
      const button =
        libraryFiltersAnchor === "docked"
          ? dockedLibraryFiltersButtonRef.current
          : floatingLibraryFiltersButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const rect = button.getBoundingClientRect();
      const gap = 8;
      const estimatedHeight = 220;
      const shouldOpenUp = window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight / 2;
      const nextStyle = {
        position: "fixed",
        zIndex: 120,
        top: shouldOpenUp ? "auto" : rect.bottom + gap,
        bottom: shouldOpenUp ? Math.max(8, window.innerHeight - rect.top + gap) : "auto",
      };
      if (libraryFiltersAnchor === "docked") {
        const sidebarRect =
          dockedBeatLibrarySidebarRef.current instanceof HTMLElement
            ? dockedBeatLibrarySidebarRef.current.getBoundingClientRect()
            : null;
        const width = Math.min(sidebarRect?.width || 248, window.innerWidth - 16);
        nextStyle.left = Math.max(
          8,
          Math.min(sidebarRect?.left || rect.left, window.innerWidth - width - 8)
        );
        nextStyle.width = width;
      } else {
        nextStyle.right = Math.max(8, window.innerWidth - rect.right);
      }
      setLibraryFiltersMenuStyle(nextStyle);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [libraryFiltersAnchor, libraryFiltersOpen]);
  useEffect(() => {
    if (!isBeatLibraryActionsMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = beatLibraryActionsMenuRef.current;
      const button = beatLibraryActionsMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setIsBeatLibraryActionsMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsBeatLibraryActionsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBeatLibraryActionsMenuOpen]);
  useEffect(() => {
    if (!isBeatLibraryActionsMenuOpen) {
      setBeatLibraryActionsMenuStyle(null);
      return undefined;
    }
    const updatePosition = () => {
      const button = beatLibraryActionsMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const rect = button.getBoundingClientRect();
      const gap = 8;
      const estimatedHeight = 100;
      const shouldOpenUp = window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight / 2;
      setBeatLibraryActionsMenuStyle({
        position: "fixed",
        zIndex: 120,
        right: Math.max(8, window.innerWidth - rect.right),
        top: shouldOpenUp ? "auto" : rect.bottom + gap,
        bottom: shouldOpenUp ? Math.max(8, window.innerHeight - rect.top + gap) : "auto",
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isBeatLibraryActionsMenuOpen]);
  useEffect(() => {
    if (!isArrangementActionsMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = arrangementActionsMenuRef.current;
      const button = arrangementActionsMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setIsArrangementActionsMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsArrangementActionsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isArrangementActionsMenuOpen]);
  useEffect(() => {
    if (!isArrangementActionsMenuOpen) {
      setArrangementActionsMenuStyle(null);
      return undefined;
    }
    const updatePosition = () => {
      const button = arrangementActionsMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const rect = button.getBoundingClientRect();
      const gap = 8;
      const estimatedHeight = 100;
      const shouldOpenUp =
        window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight / 2;
      setArrangementActionsMenuStyle({
        position: "fixed",
        zIndex: 120,
        right: Math.max(8, window.innerWidth - rect.right),
        top: shouldOpenUp ? "auto" : rect.bottom + gap,
        bottom: shouldOpenUp ? Math.max(8, window.innerHeight - rect.top + gap) : "auto",
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isArrangementActionsMenuOpen]);
  useEffect(() => {
    if (!isMobileFloatingPanels || !isArrangementOpen) {
      setMobileArrangementPanelStyle(null);
      return undefined;
    }
    const updatePosition = () => {
      const button = gridMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) {
        setMobileArrangementPanelStyle({
          left: 8,
          top: 8,
          maxHeight: "calc(100vh - 16px)",
        });
        return;
      }
      const rect = button.getBoundingClientRect();
      const gap = 8;
      const top = Math.max(8, rect.bottom + gap);
      setMobileArrangementPanelStyle({
        left: 8,
        top,
        maxHeight: `calc(100vh - ${Math.round(top + 8)}px)`,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isArrangementOpen, isMobileFloatingPanels]);
  const [playbackRate, setPlaybackRate] = useState(() => {
    try {
      const raw = window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY);
      if (raw == null) return 1;
      return clampPlaybackRate(Number(raw));
    } catch (_) {
      return 1;
    }
  });
  const [metronomeEnabled, setMetronomeEnabled] = useState(() => {
    try {
      const raw = window.localStorage.getItem(METRONOME_ENABLED_STORAGE_KEY);
      return raw == null ? true : raw === "true";
    } catch (_) {
      return true;
    }
  });
  const [metronomeVolume, setMetronomeVolume] = useState(() => {
    try {
      const defaultVolume =
        parseStoredUnitVolume(window.localStorage.getItem(DEFAULT_METRONOME_VOLUME_STORAGE_KEY)) ??
        DEFAULT_METRONOME_VOLUME;
      const storedVolume = parseStoredUnitVolume(window.localStorage.getItem(METRONOME_VOLUME_STORAGE_KEY));
      if (storedVolume == null) return defaultVolume;
      if (storedVolume === 0 && defaultVolume === DEFAULT_METRONOME_VOLUME) return defaultVolume;
      return storedVolume;
    } catch (_) {
      return DEFAULT_METRONOME_VOLUME;
    }
  });
  const [drumVolume, setDrumVolume] = useState(1);
  const [metronomeCountInEnabled, setMetronomeCountInEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(METRONOME_COUNT_IN_ENABLED_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  });
  const [isBraveBrowser, setIsBraveBrowser] = useState(false);
  const [showBraveAudioNotice, setShowBraveAudioNotice] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLinkType, setShareLinkType] = useState("");
  const [shareLinkMode, setShareLinkMode] = useState({
    beat: "long",
    arrangement: "long",
  });
  const [shareLinkRetention, setShareLinkRetention] = useState({
    beat: "temporary",
    arrangement: "temporary",
  });
  const [usageLimitsLoading, setUsageLimitsLoading] = useState(false);
  const [usageLimitsError, setUsageLimitsError] = useState("");
  const [usageLimits, setUsageLimits] = useState(null);
  const [bpmDraft, setBpmDraft] = useState("120");
  const [menuViewportTick, setMenuViewportTick] = useState(0);
  const activeTabRef = React.useRef(activeTab);
  const arrangementDragRef = React.useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    pointerId: null,
    holdTimer: null,
    startX: 0,
    startY: 0,
  });
  const arrangementNotationDragRef = React.useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    pointerId: null,
    holdTimer: null,
    startX: 0,
    startY: 0,
  });
  const arrangementPanelRef = React.useRef(null);
  const arrangementDragBeatRef = React.useRef(null);
  const beatLibraryTreeDragRef = React.useRef(null);
  const arrangementNotationPanelRef = React.useRef(null);
  const arrangementNotationPreviewInnerRef = React.useRef(null);
  const arrangementNotationExportRef = React.useRef(null);
  const arrangementNotationVisiblePagesRef = React.useRef(null);
  const arrangementNotationPageRefs = React.useRef([]);
  const arrangementNotationScrollBucketRef = React.useRef(-1);
  const arrangementTitleMenuRef = React.useRef(null);
  const arrangementTitleMenuButtonRef = React.useRef(null);
  const arrangementPickerButtonRef = React.useRef(null);
  const arrangementPickerMenuRef = React.useRef(null);
  const arrangementPickerNameButtonRef = React.useRef(null);
  const arrangementPickerNameInputRef = React.useRef(null);
  const arrangementTrashTargetRef = React.useRef(null);
  const arrangementSortLastOverIdRef = React.useRef("");
  const arrangementSortDragOverTrashRef = React.useRef(false);
  const arrangementSortDraggedRowIdsRef = React.useRef([]);
  const arrangementOrderTrashHoverRef = React.useRef(false);
  const isFloatingPanelDragBlockedTarget = React.useCallback((target) => {
    return (
      target instanceof Element &&
      target.closest(
        '[data-no-window-drag="1"], button, input, select, textarea, a, label, summary, [role="button"]'
      )
    );
  }, []);
  const clearFloatingPanelTouchHold = React.useCallback((dragRef) => {
    const drag = dragRef.current;
    if (drag.holdTimer) window.clearTimeout(drag.holdTimer);
    drag.holdTimer = null;
    drag.pointerId = null;
    drag.startX = 0;
    drag.startY = 0;
  }, []);
  const cancelFloatingPanelDrag = React.useCallback((dragRef) => {
    dragRef.current.dragging = false;
    clearFloatingPanelTouchHold(dragRef);
  }, [clearFloatingPanelTouchHold]);
  const beginFloatingPanelDrag = React.useCallback((event, panelRef, dragRef) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (isFloatingPanelDragBlockedTarget(target)) {
      event.stopPropagation();
      return;
    }
    const panel =
      panelRef.current instanceof HTMLElement
        ? panelRef.current
        : event.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : null;
    if (!(panel instanceof HTMLElement)) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current.dragging = true;
    dragRef.current.offsetX = event.clientX - rect.left;
    dragRef.current.offsetY = event.clientY - rect.top;
    event.preventDefault();
    event.stopPropagation();
  }, [isFloatingPanelDragBlockedTarget]);
  const beginFloatingPanelTouchHold = React.useCallback((event, panelRef, dragRef) => {
    if (event.pointerType === "mouse") return;
    const target = event.target;
    if (isFloatingPanelDragBlockedTarget(target)) {
      event.stopPropagation();
      return;
    }
    clearFloatingPanelTouchHold(dragRef);
    const panel =
      panelRef.current instanceof HTMLElement
        ? panelRef.current
        : event.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : null;
    if (!(panel instanceof HTMLElement)) return;
    const drag = dragRef.current;
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.holdTimer = window.setTimeout(() => {
      const rect = panel.getBoundingClientRect();
      drag.dragging = true;
      drag.offsetX = drag.startX - rect.left;
      drag.offsetY = drag.startY - rect.top;
      drag.holdTimer = null;
    }, 120);
  }, [clearFloatingPanelTouchHold, isFloatingPanelDragBlockedTarget]);
  const arrangementNotationMoreMenuRef = React.useRef(null);
  const arrangementNotationMoreMenuButtonRef = React.useRef(null);
  const fileMenuRef = React.useRef(null);
  const fileMenuButtonRef = React.useRef(null);
  const authEmailInputRef = React.useRef(null);
  const authRecoveryFlowRef = React.useRef(false);
  const authRecoveryUrlFlowRef = React.useRef(false);
  const transportMenuRef = React.useRef(null);
  const transportMenuButtonRef = React.useRef(null);
  const bpmButtonScrubSuppressUntilRef = React.useRef(0);
  const notationStickingMenuRef = React.useRef(null);
  const notationStickingMenuButtonRef = React.useRef(null);
  const sidebarSettingsMenuRef = React.useRef(null);
  const sidebarSettingsMenuButtonRef = React.useRef(null);
  const midiImportInputRef = React.useRef(null);
  const midiWindowDragDepthRef = React.useRef(0);
  const kitOrderListRef = React.useRef(null);
  const arrangementListRef = React.useRef(null);
  const [isMidiWindowDragActive, setIsMidiWindowDragActive] = useState(false);
  const arrangementSourceListRef = React.useRef(null);
  const applyImportedBeatPayloadRef = React.useRef(null);
  const loadBeatIntoEditorRef = React.useRef(null);
  const visibleLocalBeatIdsInLibraryOrderRef = React.useRef([]);
  const midiImportPreviewSnapshotRef = React.useRef(null);
  const arrangementStartedRef = React.useRef(false);
  const arrangementPlaybackIndexRef = React.useRef(0);
  const arrangementPlaybackEditorBeatKeyRef = React.useRef("");
  const arrangementSelectionEditorBeatKeyRef = React.useRef("");
  const assignStickingOverrideHandToSelectionRef = React.useRef(null);
  const playheadRef = React.useRef(0);
  const shareCopiedTimerRef = React.useRef(null);
  const midiImportPreviewKeyRef = React.useRef("");
  const stickingSelectionCycleRef = React.useRef({ signature: "", phase: -1 });
  const pendingExampleLoadRef = React.useRef(null);
  const appliedExampleIdRef = React.useRef(null);
  const pendingSharedLoadRef = React.useRef(null);
  const appliedSharedKeyRef = React.useRef(null);
  const importedBeatLoadInProgressRef = React.useRef(false);
  const skipNextBaseGridResizeRef = React.useRef(false);
  const gridMenuButtonRef = React.useRef(null);
  const gridMenuPopupRef = React.useRef(null);
  const trackedSharedOpenKeysRef = React.useRef(new Set());
  const authUser = authSession?.user || null;
  const authUserEmail = String(authUser?.email || "").trim();
  const authUserLabel = authUserEmail || "Account";
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
  const isAdminUser = Boolean(authUser?.id && adminEmail && authUserEmail.toLowerCase() === adminEmail);
  const anonymousFeedbackFingerprint = React.useMemo(() => getAnonymousFeedbackFingerprint(), []);
  const feedbackPortalTarget = React.useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.getElementById("feedback-panel-root");
  }, []);
  const adminStatsPortalTarget = React.useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.getElementById("admin-stats-panel-root");
  }, []);
  const trackStatsEvent = React.useCallback(
    (eventType, options = {}) =>
      trackClientEvent(eventType, {
        ...options,
        authToken: String(authSession?.access_token || "").trim(),
      }),
    [authSession?.access_token]
  );
  const refreshUsageLimits = React.useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setUsageLimitsLoading(true);
      setUsageLimitsError("");
    }
    try {
      const data = await fetchUsageLimits({
        accessToken: authSession?.access_token,
      });
      setUsageLimits(data);
      setUsageLimitsError("");
      return data;
    } catch (error) {
      const message = error?.message || "Failed to load usage limits.";
      setUsageLimitsError(message);
      return null;
    } finally {
      if (!silent) setUsageLimitsLoading(false);
    }
  }, [authSession?.access_token]);
  const normalizeCloudLibraryQuotaSnapshot = React.useCallback((cloudLibrary) => {
    if (!cloudLibrary || typeof cloudLibrary !== "object") return null;
    const limitBeats = Math.max(
      0,
      Number(cloudLibrary?.limits?.beats) || PERSONAL_CLOUD_BEAT_LIMIT
    );
    const limitArrangements = Math.max(
      0,
      Number(cloudLibrary?.limits?.arrangements) || PERSONAL_CLOUD_ARRANGEMENT_LIMIT
    );
    const countBeats = Math.max(0, Number(cloudLibrary?.counts?.beats) || 0);
    const countArrangements = Math.max(0, Number(cloudLibrary?.counts?.arrangements) || 0);
    const hasBeatSignal =
      Number.isFinite(Number(cloudLibrary?.limits?.beats)) ||
      Number.isFinite(Number(cloudLibrary?.counts?.beats)) ||
      Number.isFinite(Number(cloudLibrary?.remaining?.beats));
    const hasArrangementSignal =
      Number.isFinite(Number(cloudLibrary?.limits?.arrangements)) ||
      Number.isFinite(Number(cloudLibrary?.counts?.arrangements)) ||
      Number.isFinite(Number(cloudLibrary?.remaining?.arrangements));
    if (!hasBeatSignal && !hasArrangementSignal) return null;
    return {
      limits: {
        beats: limitBeats,
        arrangements: limitArrangements,
      },
      counts: {
        beats: countBeats,
        arrangements: countArrangements,
      },
      remaining: {
        beats: Math.max(
          0,
          Number(cloudLibrary?.remaining?.beats) || (limitBeats - countBeats)
        ),
        arrangements: Math.max(
          0,
          Number(cloudLibrary?.remaining?.arrangements) || (limitArrangements - countArrangements)
        ),
      },
    };
  }, []);
  const getVerifiedCloudLibraryQuota = React.useCallback(async () => {
    if (!authUser?.id || !hasSupabaseEnabled || !supabase) return null;
    const snapshot = (await refreshUsageLimits({ silent: true })) || usageLimits;
    const normalizedSnapshot = normalizeCloudLibraryQuotaSnapshot(snapshot?.cloudLibrary);
    if (normalizedSnapshot) return normalizedSnapshot;
    try {
      const counts = await countCloudLibraryRows({ supabase, userId: authUser.id });
      const safeBeatCount = Math.max(0, Number(counts?.beats) || 0);
      const safeArrangementCount = Math.max(0, Number(counts?.arrangements) || 0);
      return {
        limits: {
          beats: PERSONAL_CLOUD_BEAT_LIMIT,
          arrangements: PERSONAL_CLOUD_ARRANGEMENT_LIMIT,
        },
        counts: {
          beats: safeBeatCount,
          arrangements: safeArrangementCount,
        },
        remaining: {
          beats: Math.max(0, PERSONAL_CLOUD_BEAT_LIMIT - safeBeatCount),
          arrangements: Math.max(0, PERSONAL_CLOUD_ARRANGEMENT_LIMIT - safeArrangementCount),
        },
      };
    } catch (_) {
      return null;
    }
  }, [
    authUser?.id,
    hasSupabaseEnabled,
    normalizeCloudLibraryQuotaSnapshot,
    refreshUsageLimits,
    supabase,
    usageLimits,
  ]);
  const ensureShortShareQuotaAvailable = React.useCallback(async () => {
    const snapshot = (await refreshUsageLimits({ silent: true })) || usageLimits;
    const shortLinks = snapshot?.shortLinks;
    if (!shortLinks || typeof shortLinks !== "object") return true;
    if (snapshot?.isSignedIn) {
      const remaining = Math.max(0, Number(shortLinks?.remaining?.month) || 0);
      if (remaining < 1) {
        throw new Error("Monthly short-link limit reached for this account. Use a long link instead.");
      }
      return true;
    }
    const remainingDay = Math.max(0, Number(shortLinks?.remaining?.day) || 0);
    const remainingMonth = Math.max(0, Number(shortLinks?.remaining?.month) || 0);
    if (remainingDay < 1) {
      throw new Error("Daily short-link limit reached for this browser. Use a long link instead.");
    }
    if (remainingMonth < 1) {
      throw new Error("Monthly short-link limit reached for this browser. Use a long link instead.");
    }
    return true;
  }, [refreshUsageLimits, usageLimits]);
  const ensureCloudBeatQuotaAvailable = React.useCallback(async () => {
    if (!authUser?.id || !hasSupabaseEnabled || !supabase) return true;
    const cloudLibrary = await getVerifiedCloudLibraryQuota();
    if (!cloudLibrary) return true;
    const remaining = Math.max(0, Number(cloudLibrary?.remaining?.beats) || 0);
    if (remaining < 1) {
      throw new Error("Personal cloud beat limit reached. Delete beats or keep working locally.");
    }
    return true;
  }, [authUser?.id, getVerifiedCloudLibraryQuota, hasSupabaseEnabled, supabase]);
  const ensureCloudArrangementQuotaAvailable = React.useCallback(async (extraNeeded = 1) => {
    if (!authUser?.id || !hasSupabaseEnabled || !supabase) return true;
    const cloudLibrary = await getVerifiedCloudLibraryQuota();
    if (!cloudLibrary) return true;
    const remaining = Math.max(0, Number(cloudLibrary?.remaining?.arrangements) || 0);
    if (remaining < Math.max(1, Number(extraNeeded) || 1)) {
      throw new Error("Personal cloud arrangement limit reached. Delete arrangements or keep working locally.");
    }
    return true;
  }, [authUser?.id, getVerifiedCloudLibraryQuota, hasSupabaseEnabled, supabase]);
  const normalizeFeedbackItem = React.useCallback((row) => {
    if (!row || typeof row !== "object") return null;
    const body = String(row.body || "").trim();
    if (!body) return null;
    const score = Math.max(
      Number(row.vote_score) || 0,
      0 - Math.max(0, Number(row.vote_count) || 0)
    );
    return {
      id: String(row.id || ""),
      body,
      createdAt: String(row.created_at || row.updated_at || ""),
      status: String(row.status || (row.is_public ? "public" : "pending")),
      isPublic: row.is_public === true,
      voteScore: Number.isFinite(score) ? score : 0,
      voteCount: Math.max(0, Number(row.vote_count) || 0),
      authorKind: String(row.author_kind || (row.user_id ? "registered" : "anonymous")),
      authorLabel: String(row.author_label || "").trim(),
      userId: row.user_id ? String(row.user_id) : "",
      feedbackTypes: (() => {
        const next = Array.isArray(row.feedback_types)
          ? row.feedback_types
          : row.feedback_type
            ? [row.feedback_type]
            : [];
        return Array.from(
          new Set(
            next
              .map((entry) => String(entry || "").trim().toLowerCase())
              .map((entry) => (entry === "feature" || entry === "idea" ? "feature_idea" : entry))
              .filter((entry) => entry === "bug" || entry === "feature_idea")
          )
        );
      })(),
      adminReply: String(row.admin_reply || "").trim(),
      resolutionStatus: String(row.resolution_status || "reviewing").trim().toLowerCase() || "reviewing",
    };
  }, []);
  const toggleFeedbackType = React.useCallback((value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized !== "bug" && normalized !== "feature_idea") return;
    setFeedbackTypes((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.includes(normalized)
        ? list.filter((entry) => entry !== normalized)
        : [...list, normalized];
    });
  }, []);
  const authProfileLastSyncLabel = React.useMemo(() => {
    const raw = String(personalLibraryLastSyncAt || "").trim();
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch (_) {
      return date.toLocaleString();
    }
  }, [personalLibraryLastSyncAt]);

  useEffect(() => {
    if (!hasSupabaseEnabled || !supabase) return undefined;
    let alive = true;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const isRecoveryLink =
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery";
    authRecoveryUrlFlowRef.current = isRecoveryLink;
    if (isRecoveryLink) {
      authRecoveryFlowRef.current = true;
      setAuthMode("new-password");
      setAuthPasswordInput("");
      setAuthMessage("");
      setIsAuthDialogOpen(true);
    }
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setAuthError(error.message || "Failed to load login state.");
          return;
        }
        setAuthSession(data?.session || null);
      })
      .catch((error) => {
        if (!alive) return;
        setAuthError(error?.message || "Failed to load login state.");
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthSession(session || null);
      setAuthPending(false);
      setAuthError("");
      if (event === "PASSWORD_RECOVERY") {
        if (!authRecoveryUrlFlowRef.current) return;
        authRecoveryFlowRef.current = true;
        setAuthMode("new-password");
        setAuthPasswordInput("");
        setAuthMessage("");
        setIsAuthDialogOpen(true);
        return;
      }
      if (authRecoveryFlowRef.current && session?.user) return;
      if (session?.user) {
        setAuthMessage("Login successful.");
        setIsAuthDialogOpen(false);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthDialogOpen) return;
    const timer = window.setTimeout(() => {
      authEmailInputRef.current?.focus();
      authEmailInputRef.current?.select?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthDialogOpen]);

  const openAuthDialog = React.useCallback(() => {
    setAuthError("");
    setAuthMessage("");
    setAuthMode("sign-in");
    setAuthEmailInput(authUserEmail || authEmailInput);
    setAuthPasswordInput("");
    setIsAuthDialogOpen(true);
  }, [authUserEmail, authEmailInput]);
  const legalRevealCountRef = React.useRef(0);
  const legalRevealTimerRef = React.useRef(null);
  const handleLegalButtonClick = React.useCallback(() => {
    setLegalTab("impressum");
    setIsLegalDialogOpen(true);
    if (authUser?.id) return;
    legalRevealCountRef.current += 1;
    if (legalRevealTimerRef.current) {
      window.clearTimeout(legalRevealTimerRef.current);
    }
    if (legalRevealCountRef.current >= 3) {
      legalRevealCountRef.current = 0;
      setIsAuthButtonUnlocked(true);
      legalRevealTimerRef.current = null;
      return;
    }
    legalRevealTimerRef.current = window.setTimeout(() => {
      legalRevealCountRef.current = 0;
      legalRevealTimerRef.current = null;
    }, 1200);
  }, [authUser?.id]);
  useEffect(() => {
    return () => {
      if (legalRevealTimerRef.current) {
        window.clearTimeout(legalRevealTimerRef.current);
      }
    };
  }, []);
  const dismissPendingPersonalCloudImport = React.useCallback(() => {
    if (authUser?.id && pendingPersonalCloudImport?.fingerprint) {
      writePersonalCloudImportDecision(authUser.id, pendingPersonalCloudImport.fingerprint, "cloud-only");
    }
    setPendingPersonalCloudImport(null);
  }, [authUser?.id, pendingPersonalCloudImport]);
  useEffect(() => {
    if (!pendingPersonalCloudImport) {
      setSelectedPersonalCloudImportBeatIds([]);
      setSelectedPersonalCloudImportArrangementIds([]);
      setSelectedPersonalCloudImportFolderIds([]);
      setPersonalCloudImportExpandedFolderIds([]);
      return;
    }
    setSelectedPersonalCloudImportBeatIds(
      pendingPersonalCloudImport.beats.map((entry) => String(entry?.id || "")).filter(Boolean)
    );
    setSelectedPersonalCloudImportArrangementIds(
      pendingPersonalCloudImport.arrangements.map((entry) => String(entry?.id || "")).filter(Boolean)
    );
    setSelectedPersonalCloudImportFolderIds(
      pendingPersonalCloudImport.folders.map((entry) => String(entry?.id || "")).filter(Boolean)
    );
    setPersonalCloudImportExpandedFolderIds(
      pendingPersonalCloudImport.folders.map((entry) => String(entry?.id || "")).filter(Boolean)
    );
  }, [pendingPersonalCloudImport]);

  const handleMagicLinkSignIn = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }
    const email = String(authEmailInput || "").trim();
    if (!email) {
      setAuthError("Enter an email address.");
      return;
    }
    setAuthPending(true);
    setAuthError("");
    setAuthMessage("");
    const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setAuthPending(false);
    if (error) {
      setAuthError(error.message || "Failed to send login link.");
      return;
    }
    setIsAuthDialogOpen(false);
  }, [authEmailInput]);

  const handlePasswordSignIn = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }
    const email = String(authEmailInput || "").trim();
    const password = String(authPasswordInput || "");
    if (!email) {
      setAuthError("Enter an email address.");
      return;
    }
    if (!password) {
      setAuthError("Enter a password.");
      return;
    }
    setAuthPending(true);
    setAuthError("");
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthPending(false);
    if (error) {
      setAuthError(error.message || "Failed to sign in.");
    }
  }, [authEmailInput, authPasswordInput]);

  const handlePasswordSignUp = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }
    const email = String(authEmailInput || "").trim();
    const password = String(authPasswordInput || "");
    if (!email) {
      setAuthError("Enter an email address.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    setAuthPending(true);
    setAuthError("");
    setAuthMessage("");
    const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    setAuthPending(false);
    if (error) {
      setAuthError(error.message || "Failed to sign up.");
      return;
    }
    setAuthMessage("Check your email to confirm your account.");
  }, [authEmailInput, authPasswordInput]);

  const handlePasswordReset = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }
    const email = String(authEmailInput || "").trim();
    if (!email) {
      setAuthError("Enter an email address.");
      return;
    }
    setAuthPending(true);
    setAuthError("");
    setAuthMessage("");
    const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setAuthPending(false);
    if (error) {
      setAuthError(error.message || "Failed to send reset email.");
      return;
    }
    setAuthMessage("Check your email to reset your password.");
  }, [authEmailInput]);
  const handleSetNewPassword = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }
    const password = String(authPasswordInput || "");
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    setAuthPending(true);
    setAuthError("");
    setAuthMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setAuthPending(false);
    if (error) {
      setAuthError(error.message || "Failed to update password.");
      return;
    }
    authRecoveryFlowRef.current = false;
    authRecoveryUrlFlowRef.current = false;
    setAuthMessage("Password updated.");
    setIsAuthDialogOpen(false);
    setAuthMode("sign-in");
    setAuthPasswordInput("");
  }, [authPasswordInput]);

  const handleSignOut = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase) return;
    setAuthPending(true);
    setAuthError("");
    const { error } = await supabase.auth.signOut();
    setAuthPending(false);
    if (error) {
      setAuthError(error.message || "Failed to sign out.");
      return;
    }
    setAuthMessage("Signed out.");
  }, []);
  const refreshProfileCloudStats = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) {
      setProfileShareQrCount(0);
      setProfileTemporaryShareCount(0);
      setProfileCleanedShareCount(0);
      setProfileShareLinks([]);
      setProfileStatsLoading(false);
      return;
    }
    setProfileStatsLoading(true);
    try {
      const stateId = getPersonalLibraryStateShareId(authUser.id);
      const rows = (await fetchOwnedShareLinkRows({
        supabase,
        ownerUserId: authUser.id,
        excludeId: stateId,
      })).filter(isUserManagedShareLinkRow);
      setProfileShareQrCount(rows.length);
      setProfileTemporaryShareCount(
        rows.filter((row) => isTemporarySharePayload(row?.payload)).length
      );
      setProfileShareLinks(
        rows
          .map(normalizeProfileShareLinkEntry)
          .filter(Boolean)
      );
      try {
        const cleanedCountRaw = window.localStorage.getItem(
          `${SHARE_LINK_CLEANUP_LAST_COUNT_STORAGE_KEY}:${authUser.id}`
        );
        const cleanedCount = Number(cleanedCountRaw || "0");
        setProfileCleanedShareCount(Number.isFinite(cleanedCount) ? Math.max(0, cleanedCount) : 0);
      } catch (_) {
        setProfileCleanedShareCount(0);
      }
    } catch (_) {
      setProfileShareQrCount(0);
      setProfileTemporaryShareCount(0);
      setProfileCleanedShareCount(0);
      setProfileShareLinks([]);
    } finally {
      setProfileStatsLoading(false);
    }
  }, [authUser?.id]);
  const openProfileShareLinkInNewTab = React.useCallback((shareId) => {
    const normalizedId = String(shareId || "").trim();
    if (!normalizedId) return;
    window.open(
      `${window.location.origin}/g/${encodeURIComponent(normalizedId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);
  const deleteProfileShareLink = React.useCallback(async (shareId) => {
    const normalizedId = String(shareId || "").trim();
    if (!normalizedId || !hasSupabaseEnabled || !supabase || !authUser?.id) return false;
    const entry = profileShareLinks.find((item) => String(item?.id || "") === normalizedId) || null;
    const label = entry?.label || "this share link";
    if (!window.confirm(`Delete ${label}?`)) return false;
    try {
      await deleteOwnedShareLink({
        supabase,
        ownerUserId: authUser.id,
        shareId: normalizedId,
      });
    } catch (error) {
      setAuthError(error?.message || "Failed to delete share link.");
      return false;
    }
    setProfileShareLinks((prev) => prev.filter((item) => String(item?.id || "") !== normalizedId));
    setProfileShareQrCount((prev) => Math.max(0, prev - 1));
    if (entry?.temporary) {
      setProfileTemporaryShareCount((prev) => Math.max(0, prev - 1));
    }
    return true;
  }, [authUser?.id, profileShareLinks]);
  const callFeedbackApi = React.useCallback(
    (method, payload = null, options = {}) =>
      requestFeedbackApi(method, payload, {
        ...options,
        anonymousFingerprint: anonymousFeedbackFingerprint,
        accessToken: authSession?.access_token,
      }),
    [anonymousFeedbackFingerprint, authSession?.access_token]
  );
  const refreshFeedbackItems = React.useCallback(async () => {
    if (!hasSupabaseEnabled) {
      setFeedbackItems([]);
      setFeedbackVoteMap({});
      setFeedbackLoading(false);
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError("");
    try {
      const data = await callFeedbackApi("GET", null, {
        query: {
          sort: feedbackSort,
          adminFilter: feedbackAdminFilter,
        },
      });
      const normalized = (Array.isArray(data?.items) ? data.items : [])
        .map(normalizeFeedbackItem)
        .filter(Boolean);
      setFeedbackItems(normalized);
      setFeedbackVoteMap(data?.myVotes && typeof data.myVotes === "object" ? data.myVotes : {});
    } catch (error) {
      setFeedbackItems([]);
      setFeedbackVoteMap({});
      setFeedbackError(error?.message || "Failed to load feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  }, [callFeedbackApi, feedbackAdminFilter, feedbackSort, hasSupabaseEnabled, normalizeFeedbackItem]);
  const submitFeedback = React.useCallback(async () => {
    const body = String(feedbackBody || "").trim();
    if (body.length < 3) {
      setFeedbackError("Feedback is too short.");
      return false;
    }
    if (body.length > 2000) {
      setFeedbackError("Feedback is too long.");
      return false;
    }
    if (!hasSupabaseEnabled) {
      setFeedbackError("Feedback is not configured yet.");
      return false;
    }
    setFeedbackSubmitting(true);
    setFeedbackError("");
    setFeedbackSuccessMessage("");
    try {
      await callFeedbackApi("POST", {
        action: "submit",
        body,
        feedbackTypes,
      });
      setFeedbackBody("");
      setFeedbackTypes([]);
      setFeedbackSuccessMessage("Feedback sent. It is private until published by admin.");
      await refreshFeedbackItems();
      return true;
    } catch (error) {
      setFeedbackError(error?.message || "Failed to submit feedback.");
      return false;
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [callFeedbackApi, feedbackBody, feedbackTypes, hasSupabaseEnabled, refreshFeedbackItems]);
  const setFeedbackItemVisibility = React.useCallback(
    async (feedbackId, makePublic) => {
      const normalizedId = String(feedbackId || "").trim();
      if (!normalizedId || !isAdminUser) return false;
      try {
        await callFeedbackApi("POST", {
          action: "moderate",
          feedbackId: normalizedId,
          makePublic,
        });
        await refreshFeedbackItems();
        return true;
      } catch (error) {
        setFeedbackError(error?.message || "Failed to update feedback visibility.");
        return false;
      }
    },
    [callFeedbackApi, isAdminUser, refreshFeedbackItems]
  );
  const updateFeedbackAdminMeta = React.useCallback(
    async (feedbackId, patch = {}) => {
      const normalizedId = String(feedbackId || "").trim();
      if (!normalizedId || !isAdminUser) return false;
      try {
        await callFeedbackApi("POST", {
          action: "moderate",
          feedbackId: normalizedId,
          ...patch,
        });
        await refreshFeedbackItems();
        return true;
      } catch (error) {
        setFeedbackError(error?.message || "Failed to update feedback.");
        return false;
      }
    },
    [callFeedbackApi, isAdminUser, refreshFeedbackItems]
  );
  const deleteFeedbackItem = React.useCallback(
    async (feedbackId) => {
      const normalizedId = String(feedbackId || "").trim();
      if (!normalizedId || !isAdminUser) return false;
      if (!window.confirm("Delete this feedback comment?")) return false;
      try {
        await callFeedbackApi("POST", {
          action: "delete",
          feedbackId: normalizedId,
        });
        setFeedbackAdminReplyDrafts((prev) => {
          const next = { ...(prev || {}) };
          delete next[normalizedId];
          return next;
        });
        await refreshFeedbackItems();
        return true;
      } catch (error) {
        setFeedbackError(error?.message || "Failed to delete feedback.");
        return false;
      }
    },
    [callFeedbackApi, isAdminUser, refreshFeedbackItems]
  );
  const voteOnFeedbackItem = React.useCallback(
    async (feedbackId, vote) => {
      const normalizedId = String(feedbackId || "").trim();
      const nextVote = Number(vote) === -1 ? -1 : 1;
      if (!normalizedId || !hasSupabaseEnabled) return false;
      const target = feedbackItems.find((item) => item.id === normalizedId);
      if (!target?.isPublic) return false;
      try {
        await callFeedbackApi("POST", {
          action: "vote",
          feedbackId: normalizedId,
          vote: nextVote,
        });
        await refreshFeedbackItems();
        return true;
      } catch (error) {
        setFeedbackError(error?.message || "Failed to vote on feedback.");
        return false;
      }
    },
    [callFeedbackApi, feedbackItems, hasSupabaseEnabled, refreshFeedbackItems]
  );
  React.useEffect(() => {
    refreshFeedbackItems();
  }, [refreshFeedbackItems]);
  React.useEffect(() => {
    refreshUsageLimits({ silent: false });
  }, [refreshUsageLimits]);
  React.useEffect(() => {
    if (!isShareActionsDialogOpen) return;
    void refreshUsageLimits({ silent: false });
  }, [isShareActionsDialogOpen, refreshUsageLimits]);
  const refreshAdminStats = React.useCallback(async () => {
    if (!isAdminUser || !hasSupabaseEnabled) {
      setAdminStatsLoading(false);
      setAdminStatsError("");
      setAdminStatsWarnings([]);
      setAdminStats({
        users: 0,
        signedUpUsers: 0,
        siteVisits: 0,
        beatShareCreates: 0,
        arrangementShareCreates: 0,
        beatShareOpens: 0,
        arrangementShareOpens: 0,
      });
      return;
    }
    setAdminStatsLoading(true);
    setAdminStatsError("");
    setAdminStatsWarnings([]);
    try {
      const data = await fetchAdminStats({
        range: adminStatsRange,
        accessToken: authSession?.access_token,
      });
      const nextStats = data?.stats && typeof data.stats === "object" ? data.stats : {};
      setAdminStatsWarnings(
        Array.isArray(data?.warnings)
          ? data.warnings.map((entry) => String(entry || "").trim()).filter(Boolean)
          : []
      );
      setAdminStats({
        users: Math.max(0, Number(nextStats.users) || 0),
        signedUpUsers: Math.max(0, Number(nextStats.signedUpUsers) || 0),
        siteVisits: Math.max(0, Number(nextStats.siteVisits) || 0),
        beatShareCreates: Math.max(0, Number(nextStats.beatShareCreates) || 0),
        arrangementShareCreates: Math.max(0, Number(nextStats.arrangementShareCreates) || 0),
        beatShareOpens: Math.max(0, Number(nextStats.beatShareOpens) || 0),
        arrangementShareOpens: Math.max(0, Number(nextStats.arrangementShareOpens) || 0),
      });
    } catch (error) {
      setAdminStatsError(error?.message || "Failed to load stats.");
      setAdminStatsWarnings([]);
    } finally {
      setAdminStatsLoading(false);
    }
  }, [adminStatsRange, authSession?.access_token, hasSupabaseEnabled, isAdminUser]);
  React.useEffect(() => {
    refreshAdminStats();
  }, [refreshAdminStats]);
  const refreshPublicArrangementLibrary = React.useCallback(async () => {
    setPublicArrangementLibraryLoading(true);
    setPublicLibraryError("");
    try {
      if (hasSupabaseEnabled && supabase) {
        const rows = await fetchPublicArrangementRows({ supabase, limit: 300 });
        setPublicArrangements(
          rows
            .filter(isPublicArrangementShareLinkRow)
            .map(normalizePublishedArrangementEntry)
            .filter(Boolean)
        );
        setPublicArrangementLibraryLoading(false);
        return;
      }
      setPublicArrangements([]);
    } catch (_) {
      setPublicLibraryError("Failed to load public arrangements");
    } finally {
      setPublicArrangementLibraryLoading(false);
    }
  }, []);
  const fetchCloudLocalBeats = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) return [];
    const rows = await fetchCloudBeatRows({ supabase, userId: authUser.id });
    return rows.map(normalizeCloudBeatRow).filter(Boolean);
  }, [authUser?.id]);
  const fetchCloudSavedArrangements = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) return [];
    const rows = await fetchCloudArrangementRows({ supabase, userId: authUser.id });
    return rows.map(normalizeCloudArrangementRow).filter(Boolean);
  }, [authUser?.id]);
  const fetchCloudBeatLibraryContainers = React.useCallback(async () => {
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) return null;
    const stateId = getPersonalLibraryStateShareId(authUser.id);
    if (!stateId) return null;
    const payload = await fetchCloudLibraryStatePayload({
      supabase,
      userId: authUser.id,
      stateId,
      shareKind: PERSONAL_LIBRARY_STATE_SHARE_LINK_KIND,
    });
    if (!payload) return null;
    return normalizeBeatLibraryContainers(payload.beatLibraryContainers);
  }, [authUser?.id]);
  const personalLibraryCloudHydratedRef = React.useRef(false);
  const lastSyncedBeatLibraryContainersJsonRef = React.useRef(
    JSON.stringify(readStoredBeatLibraryContainers())
  );
  const saveCloudBeatLibraryContainers = React.useCallback(async (containers) => {
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) return false;
    const stateId = getPersonalLibraryStateShareId(authUser.id);
    if (!stateId) return false;
    const nextContainers = normalizeBeatLibraryContainers(containers);
    await saveCloudLibraryStatePayload({
      supabase,
      userId: authUser.id,
      stateId,
      shareKind: PERSONAL_LIBRARY_STATE_SHARE_LINK_KIND,
      payloadKind: PERSONAL_LIBRARY_STATE_PAYLOAD_KIND,
      beatLibraryContainers: nextContainers,
    });
    lastSyncedBeatLibraryContainersJsonRef.current = JSON.stringify(nextContainers);
    return true;
  }, [authUser?.id]);
  const touchShareLinkAccess = React.useCallback(async (shareId, payload) => {
    if (!hasSupabaseEnabled || !supabase) return;
    try {
      await touchTemporaryShareLinkAccess({
        supabase,
        shareId,
        payload,
        isTemporarySharePayload,
        buildTouchedSharePayload,
      });
    } catch (_) {}
  }, []);
  const cleanupExpiredTemporaryShareLinks = React.useCallback(async ({ force = false } = {}) => {
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) return 0;
    const storageKey = `${SHARE_LINK_CLEANUP_LAST_RUN_STORAGE_KEY}:${authUser.id}`;
    const countStorageKey = `${SHARE_LINK_CLEANUP_LAST_COUNT_STORAGE_KEY}:${authUser.id}`;
    if (!force) {
      try {
        const lastRunMs = Number(window.localStorage.getItem(storageKey) || "0");
        if (Number.isFinite(lastRunMs) && lastRunMs > 0) {
          if (Date.now() - lastRunMs < TEMPORARY_SHARE_LINK_CLEANUP_INTERVAL_MS) return 0;
        }
      } catch (_) {}
    }
    try {
      const rows = await fetchOwnedShareLinkRows({
        supabase,
        ownerUserId: authUser.id,
      });
      const nowMs = Date.now();
      const idsToDelete = rows
        .filter((row) => isShareLinkAutoCleanupCandidate(row, nowMs))
        .map((row) => String(row?.id || ""))
        .filter(Boolean);
      await deleteOwnedShareLinksByIds({
        supabase,
        ownerUserId: authUser.id,
        shareIds: idsToDelete,
      });
      try {
        window.localStorage.setItem(storageKey, String(nowMs));
        window.localStorage.setItem(countStorageKey, String(idsToDelete.length));
      } catch (_) {}
      setProfileCleanedShareCount(idsToDelete.length);
      return idsToDelete.length;
    } catch (_) {
      return 0;
    }
  }, [authUser?.id]);
  const refreshPersonalLibraryFromCloud = React.useCallback(async (options = {}) => {
    const { alertOnError = false, pushCurrentFoldersFirst = true } = options;
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) return false;
    setPersonalLibraryRefreshing(true);
    try {
      if (pushCurrentFoldersFirst && personalLibraryCloudHydratedRef.current) {
        await saveCloudBeatLibraryContainers(beatLibraryContainersRef.current);
      }
      const [nextBeats, nextArrangements, nextBeatLibraryContainers] = await Promise.all([
        fetchCloudLocalBeats(),
        fetchCloudSavedArrangements(),
        fetchCloudBeatLibraryContainers(),
      ]);
      setLocalBeats(nextBeats);
      setSavedArrangements(nextArrangements);
      if (nextBeatLibraryContainers) {
        setBeatLibraryContainers(nextBeatLibraryContainers);
        setSelectedBeatLibraryContainerId((prev) =>
          prev === "all" ||
          nextBeatLibraryContainers.some((entry) => String(entry.id) === String(prev))
            ? prev
            : "all"
        );
        lastSyncedBeatLibraryContainersJsonRef.current = JSON.stringify(nextBeatLibraryContainers);
      }
      setPersonalLibraryLastSyncAt(new Date().toISOString());
      setAuthError("");
      return true;
    } catch (error) {
      const message = error?.message || "Failed to refresh personal library.";
      setAuthError(message);
      if (alertOnError) alert(message);
      return false;
    } finally {
      setPersonalLibraryRefreshing(false);
    }
  }, [
    authUser?.id,
    fetchCloudBeatLibraryContainers,
    fetchCloudLocalBeats,
    fetchCloudSavedArrangements,
    saveCloudBeatLibraryContainers,
  ]);
  useEffect(() => {
    if (!hasSupabaseEnabled || !supabase) return undefined;
    if (!authUser?.id) {
      const nextLocalBeats = deviceLocalBeatsRef.current;
      const nextSavedArrangements = deviceLocalArrangementsRef.current;
      const nextBeatLibraryContainers = deviceLocalBeatLibraryContainersRef.current;
      setLocalBeats(nextLocalBeats);
      setSavedArrangements(nextSavedArrangements);
      setBeatLibraryContainers(nextBeatLibraryContainers);
      writeStoredLocalBeats(nextLocalBeats);
      writeStoredSavedArrangements(nextSavedArrangements);
      writeStoredBeatLibraryContainers(nextBeatLibraryContainers);
      writeStoredDeviceLocalBeats(nextLocalBeats);
      writeStoredDeviceLocalArrangements(nextSavedArrangements);
      writeStoredDeviceLocalBeatLibraryContainers(nextBeatLibraryContainers);
      lastSyncedBeatLibraryContainersJsonRef.current = JSON.stringify(nextBeatLibraryContainers);
      personalLibraryCloudHydratedRef.current = false;
      setPersonalLibraryLastSyncAt("");
      setProfileShareQrCount(0);
      setProfileStatsLoading(false);
      return undefined;
    }
    let cancelled = false;
    personalLibraryCloudHydratedRef.current = false;
    deviceLocalBeatsRef.current = localBeatsRef.current;
    deviceLocalArrangementsRef.current = savedArrangementsRef.current;
    deviceLocalBeatLibraryContainersRef.current = beatLibraryContainersRef.current;
    writeStoredDeviceLocalBeats(deviceLocalBeatsRef.current);
    writeStoredDeviceLocalArrangements(deviceLocalArrangementsRef.current);
    writeStoredDeviceLocalBeatLibraryContainers(deviceLocalBeatLibraryContainersRef.current);
    const loadCloudLibrary = async () => {
      try {
        const [nextBeats, nextArrangements, nextBeatLibraryContainers] = await Promise.all([
          fetchCloudLocalBeats(),
          fetchCloudSavedArrangements(),
          fetchCloudBeatLibraryContainers(),
        ]);
        if (cancelled) return;
        setLocalBeats(nextBeats);
        setSavedArrangements(nextArrangements);
        if (nextBeatLibraryContainers) {
          setBeatLibraryContainers(nextBeatLibraryContainers);
          setSelectedBeatLibraryContainerId((prev) =>
            prev === "all" ||
            nextBeatLibraryContainers.some((entry) => String(entry.id) === String(prev))
              ? prev
              : "all"
          );
          lastSyncedBeatLibraryContainersJsonRef.current = JSON.stringify(nextBeatLibraryContainers);
        } else {
          lastSyncedBeatLibraryContainersJsonRef.current = JSON.stringify(
            normalizeBeatLibraryContainers(beatLibraryContainersRef.current)
          );
        }
        setPersonalLibraryLastSyncAt(new Date().toISOString());
        const offlineSnapshot = buildOfflineLocalLibrarySnapshot();
        const hasOfflineLocalContent =
          offlineSnapshot.beats.length > 0 ||
          offlineSnapshot.arrangements.length > 0 ||
          offlineSnapshot.folders.length > 0;
        if (
          hasOfflineLocalContent &&
          !hasHandledPersonalCloudImportDecision(authUser.id, offlineSnapshot.fingerprint)
        ) {
          setPendingPersonalCloudImport(offlineSnapshot);
        } else {
          setPendingPersonalCloudImport(null);
        }
        personalLibraryCloudHydratedRef.current = true;
      } catch (error) {
        if (cancelled) return;
        setAuthError(error?.message || "Failed to load cloud library.");
        setPendingPersonalCloudImport(null);
        personalLibraryCloudHydratedRef.current = true;
      }
    };
    loadCloudLibrary();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, fetchCloudBeatLibraryContainers, fetchCloudLocalBeats, fetchCloudSavedArrangements]);
  useEffect(() => {
    if (!isAuthDialogOpen || !authUser?.id) return undefined;
    refreshProfileCloudStats();
    return undefined;
  }, [isAuthDialogOpen, authUser?.id, refreshProfileCloudStats]);
  const mergeOfflineLocalLibraryIntoCloud = React.useCallback(async (snapshot, selection = {}) => {
    if (!hasSupabaseEnabled || !supabase || !authUser?.id) return false;
    const source = snapshot && typeof snapshot === "object" ? snapshot : buildOfflineLocalLibrarySnapshot();
    const selectedBeatIds = new Set(
      Array.isArray(selection?.beatIds) ? selection.beatIds.map((id) => String(id || "")) : []
    );
    const selectedArrangementIds = new Set(
      Array.isArray(selection?.arrangementIds)
        ? selection.arrangementIds.map((id) => String(id || ""))
        : []
    );
    const selectedFolderIds = new Set(
      Array.isArray(selection?.folderIds) ? selection.folderIds.map((id) => String(id || "")) : []
    );
    const localBeatsToMerge = (Array.isArray(source.beats) ? source.beats : []).filter((entry) =>
      selectedBeatIds.has(String(entry?.id || ""))
    );
    const localArrangementsToMerge = (Array.isArray(source.arrangements) ? source.arrangements : []).filter((entry) =>
      selectedArrangementIds.has(String(entry?.id || ""))
    );
    const localFoldersToMerge = (Array.isArray(source.folders) ? source.folders : []).filter((entry) =>
      selectedFolderIds.has(String(entry?.id || ""))
    );
    const cloudLibraryQuota = await getVerifiedCloudLibraryQuota();
    const remainingBeatSlots = Math.max(0, Number(cloudLibraryQuota?.remaining?.beats) || 0);
    const remainingArrangementSlots = Math.max(0, Number(cloudLibraryQuota?.remaining?.arrangements) || 0);
    if (cloudLibraryQuota && localBeatsToMerge.length > remainingBeatSlots) {
      throw new Error(
        `Personal cloud beat limit reached. You can merge ${remainingBeatSlots} more beat${remainingBeatSlots === 1 ? "" : "s"} right now.`
      );
    }
    if (cloudLibraryQuota && localArrangementsToMerge.length > remainingArrangementSlots) {
      throw new Error(
        `Personal cloud arrangement limit reached. You can merge ${remainingArrangementSlots} more arrangement${remainingArrangementSlots === 1 ? "" : "s"} right now.`
      );
    }

    let mergedFolders = normalizeBeatLibraryContainers(beatLibraryContainersRef.current);
    const folderIdMap = new Map();
    const usedFolderIds = new Set(mergedFolders.map((entry) => String(entry.id)));
    localFoldersToMerge.forEach((folder, index) => {
      const originalId = String(folder?.id || "");
      if (!originalId) return;
      const existing = mergedFolders.find((entry) => String(entry.id) === originalId) || null;
      if (existing) {
        folderIdMap.set(originalId, originalId);
        return;
      }
      let nextId = originalId;
      while (usedFolderIds.has(nextId)) {
        nextId = `folder-${Math.random().toString(36).slice(2, 10)}`;
      }
      usedFolderIds.add(nextId);
      folderIdMap.set(originalId, nextId);
      mergedFolders.push({
        id: nextId,
        name: String(folder?.name || "").trim() || `Folder ${index + 1}`,
        type: "folder",
        parentId: folder?.parentId ? String(folder.parentId) : null,
        collapsed: folder?.collapsed === true,
        order: Number.isFinite(Number(folder?.order)) ? Number(folder.order) : index,
      });
    });
    mergedFolders = mergedFolders.map((folder, index) => ({
      ...folder,
      parentId: folder.parentId ? folderIdMap.get(String(folder.parentId)) || String(folder.parentId) : null,
      order: Number.isFinite(Number(folder?.order)) ? Number(folder.order) : index,
    }));

    for (const beat of localBeatsToMerge) {
      const payload = beat?.payload && typeof beat.payload === "object" ? { ...beat.payload } : null;
      if (!payload) continue;
      const meta = getBeatLibraryMeta(beat);
      payload.libraryMeta = {
        parentId: meta.parentId && selectedFolderIds.has(String(meta.parentId))
          ? folderIdMap.get(String(meta.parentId)) || String(meta.parentId)
          : null,
        manualOrder: Number.isFinite(Number(meta.manualOrder)) ? Number(meta.manualOrder) : 0,
      };
      const now = new Date().toISOString();
      await insertCloudBeatRow({
        supabase,
        row: {
          user_id: authUser.id,
          name: String(beat?.name || "").trim() || "Untitled Beat",
          payload,
          created_at: String(beat?.createdAt || now),
          updated_at: now,
        },
      });
    }

    let arrangementNamePool = [...savedArrangementsRef.current];
    for (const entry of localArrangementsToMerge) {
      const normalizedItems = normalizeArrangementItems(entry?.items);
      const now = new Date().toISOString();
      const name = getUniqueArrangementName(
        String(entry?.name || "").trim() || "Arrangement",
        arrangementNamePool
      );
      const payload = {
        user_id: authUser.id,
        name,
        title_line_1: String(entry?.titleLine1 || ""),
        title_line_2: String(entry?.titleLine2 || ""),
        author: String(entry?.composer || ""),
        rows: normalizedItems,
        settings: {},
        created_at: String(entry?.createdAt || now),
        updated_at: now,
      };
      const data = await insertCloudArrangementRow({ supabase, row: payload });
      const normalized = normalizeCloudArrangementRow(data);
      if (normalized) arrangementNamePool = [normalized, ...arrangementNamePool];
    }

    await saveCloudBeatLibraryContainers(mergedFolders);
    writePersonalCloudImportDecision(authUser.id, source.fingerprint, "merged");
    await refreshPersonalLibraryFromCloud({
      alertOnError: true,
      pushCurrentFoldersFirst: false,
    });
    void refreshUsageLimits({ silent: true });
    return true;
  }, [authUser?.id, getVerifiedCloudLibraryQuota, refreshPersonalLibraryFromCloud, refreshUsageLimits, saveCloudBeatLibraryContainers, usageLimits]);
  const pendingPersonalCloudImportFolderChildrenByParent = React.useMemo(() => {
    const map = new Map();
    if (!pendingPersonalCloudImport) return map;
    pendingPersonalCloudImport.folders.forEach((entry) => {
      const parentKey = String(entry?.parentId || "");
      if (!map.has(parentKey)) map.set(parentKey, []);
      map.get(parentKey).push(entry);
    });
    map.forEach((items) =>
      items.sort((a, b) => {
        const orderDiff = (Number(a?.order) || 0) - (Number(b?.order) || 0);
        if (orderDiff) return orderDiff;
        return String(a?.name || "").localeCompare(String(b?.name || ""));
      })
    );
    return map;
  }, [pendingPersonalCloudImport]);
  const pendingPersonalCloudImportBeatChildrenByParent = React.useMemo(() => {
    const map = new Map();
    if (!pendingPersonalCloudImport) return map;
    pendingPersonalCloudImport.beats.forEach((entry) => {
      const parentKey = String(getBeatLibraryMeta(entry).parentId || "");
      if (!map.has(parentKey)) map.set(parentKey, []);
      map.get(parentKey).push(entry);
    });
    map.forEach((items) => items.sort(compareBeatLibraryOrder));
    return map;
  }, [pendingPersonalCloudImport]);
  const getPendingPersonalCloudImportDescendantFolderIds = React.useCallback(
    (folderId) => {
      const key = String(folderId || "");
      const result = [];
      const stack = [key];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        result.push(current);
        const children = pendingPersonalCloudImportFolderChildrenByParent.get(current) || [];
        children.forEach((entry) => {
          const childId = String(entry?.id || "");
          if (childId) stack.push(childId);
        });
      }
      return result;
    },
    [pendingPersonalCloudImportFolderChildrenByParent]
  );
  const togglePersonalCloudImportFolderExpanded = React.useCallback((folderId) => {
    const key = String(folderId || "");
    if (!key) return;
    setPersonalCloudImportExpandedFolderIds((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]
    );
  }, []);
  const togglePersonalCloudImportBeatChecked = React.useCallback((beatId, checked) => {
    const key = String(beatId || "");
    if (!key) return;
    setSelectedPersonalCloudImportBeatIds((prev) =>
      checked ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((value) => value !== key)
    );
    if (!checked) {
      const beatEntry = pendingPersonalCloudImport?.beats?.find(
        (entry) => String(entry?.id || "") === key
      );
      const parentId = beatEntry ? getBeatLibraryMeta(beatEntry).parentId : null;
      if (parentId) {
        const ancestorIds = [];
        let currentParentId = String(parentId || "");
        while (currentParentId) {
          ancestorIds.push(currentParentId);
          const nextParent = pendingPersonalCloudImport?.folders?.find(
            (entry) => String(entry?.id || "") === currentParentId
          )?.parentId;
          currentParentId = String(nextParent || "");
        }
        if (ancestorIds.length > 0) {
          setSelectedPersonalCloudImportFolderIds((prev) =>
            prev.filter((value) => !ancestorIds.includes(String(value || "")))
          );
        }
      }
    }
  }, [pendingPersonalCloudImport]);
  const togglePersonalCloudImportBeatSelection = React.useCallback((beatId) => {
    const key = String(beatId || "");
    if (!key) return;
    const checked = selectedPersonalCloudImportBeatIds.includes(key);
    togglePersonalCloudImportBeatChecked(key, !checked);
  }, [selectedPersonalCloudImportBeatIds, togglePersonalCloudImportBeatChecked]);
  const togglePersonalCloudImportFolderChecked = React.useCallback(
    (folderId, checked) => {
      const key = String(folderId || "");
      if (!key) return;
      const descendantFolderIds = getPendingPersonalCloudImportDescendantFolderIds(key);
      const descendantFolderIdSet = new Set(descendantFolderIds);
      const descendantBeatIds = (pendingPersonalCloudImport?.beats || [])
        .filter((entry) => descendantFolderIdSet.has(String(getBeatLibraryMeta(entry).parentId || "")))
        .map((entry) => String(entry?.id || ""))
        .filter(Boolean);
      setSelectedPersonalCloudImportFolderIds((prev) =>
        checked
          ? [...new Set([...prev, ...descendantFolderIds])]
          : prev.filter((value) => !descendantFolderIdSet.has(String(value || "")))
      );
      setSelectedPersonalCloudImportBeatIds((prev) =>
        checked
          ? [...new Set([...prev, ...descendantBeatIds])]
          : prev.filter((value) => !descendantBeatIds.includes(String(value || "")))
      );
    },
    [getPendingPersonalCloudImportDescendantFolderIds, pendingPersonalCloudImport]
  );
  const togglePersonalCloudImportFolderSelection = React.useCallback(
    (folderId) => {
      const key = String(folderId || "");
      if (!key) return;
      const descendantFolderIds = getPendingPersonalCloudImportDescendantFolderIds(key);
      const descendantFolderIdSet = new Set(descendantFolderIds);
      const descendantBeatIds = (pendingPersonalCloudImport?.beats || [])
        .filter((entry) => descendantFolderIdSet.has(String(getBeatLibraryMeta(entry).parentId || "")))
        .map((entry) => String(entry?.id || ""))
        .filter(Boolean);
      const fullySelected =
        descendantFolderIds.every((id) => selectedPersonalCloudImportFolderIds.includes(id)) &&
        descendantBeatIds.every((id) => selectedPersonalCloudImportBeatIds.includes(id));
      togglePersonalCloudImportFolderChecked(folderId, !fullySelected);
    },
    [
      getPendingPersonalCloudImportDescendantFolderIds,
      pendingPersonalCloudImport,
      selectedPersonalCloudImportBeatIds,
      selectedPersonalCloudImportFolderIds,
      togglePersonalCloudImportFolderChecked,
    ]
  );
  const effectiveSelectedPersonalCloudImportBeatIds = React.useMemo(() => {
    if (!pendingPersonalCloudImport) return [];
    const validBeatIds = new Set(
      pendingPersonalCloudImport.beats.map((entry) => String(entry?.id || "")).filter(Boolean)
    );
    return Array.from(
      new Set(
        selectedPersonalCloudImportBeatIds.filter((id) => validBeatIds.has(String(id || "")))
      )
    );
  }, [pendingPersonalCloudImport, selectedPersonalCloudImportBeatIds]);
  const effectiveSelectedPersonalCloudImportFolderIds = React.useMemo(() => {
    if (!pendingPersonalCloudImport) return [];
    return pendingPersonalCloudImport.folders
      .map((entry) => String(entry?.id || ""))
      .filter(Boolean)
      .filter((folderId) => {
        const descendantFolderIds = getPendingPersonalCloudImportDescendantFolderIds(folderId);
        const descendantFolderIdSet = new Set(descendantFolderIds);
        const descendantBeatIds = pendingPersonalCloudImport.beats
          .filter((beat) => descendantFolderIdSet.has(String(getBeatLibraryMeta(beat).parentId || "")))
          .map((beat) => String(beat?.id || ""))
          .filter(Boolean);
        return (
          descendantFolderIds.every((id) => selectedPersonalCloudImportFolderIds.includes(id)) &&
          descendantBeatIds.every((id) => effectiveSelectedPersonalCloudImportBeatIds.includes(id))
        );
      });
  }, [
    effectiveSelectedPersonalCloudImportBeatIds,
    getPendingPersonalCloudImportDescendantFolderIds,
    pendingPersonalCloudImport,
    selectedPersonalCloudImportFolderIds,
  ]);
  const effectiveSelectedPersonalCloudImportArrangementIds = React.useMemo(() => {
    if (!pendingPersonalCloudImport) return [];
    const validArrangementIds = new Set(
      pendingPersonalCloudImport.arrangements.map((entry) => String(entry?.id || "")).filter(Boolean)
    );
    return Array.from(
      new Set(
        selectedPersonalCloudImportArrangementIds.filter((id) =>
          validArrangementIds.has(String(id || ""))
        )
      )
    );
  }, [pendingPersonalCloudImport, selectedPersonalCloudImportArrangementIds]);
  const pendingPersonalCloudImportSelectedLibraryCount =
    effectiveSelectedPersonalCloudImportBeatIds.length + effectiveSelectedPersonalCloudImportFolderIds.length;
  const pendingPersonalCloudImportSelectedArrangementCount =
    effectiveSelectedPersonalCloudImportArrangementIds.length;
  const pendingPersonalCloudImportVisibleSelectedLibraryCount = React.useMemo(() => {
    if (!pendingPersonalCloudImport) return 0;
    let count = 0;
    const walk = (parentId = null) => {
      const parentKey = String(parentId || "");
      const childFolders = pendingPersonalCloudImportFolderChildrenByParent.get(parentKey) || [];
      const childBeats = pendingPersonalCloudImportBeatChildrenByParent.get(parentKey) || [];
      childFolders.forEach((entry) => {
        const folderId = String(entry?.id || "");
        const descendantFolderIds = getPendingPersonalCloudImportDescendantFolderIds(folderId);
        const descendantFolderIdSet = new Set(descendantFolderIds);
        const descendantBeatIds = pendingPersonalCloudImport.beats
          .filter((beat) => descendantFolderIdSet.has(String(getBeatLibraryMeta(beat).parentId || "")))
          .map((beat) => String(beat?.id || ""))
          .filter(Boolean);
        const selectedFolderCount = descendantFolderIds.filter((id) =>
          selectedPersonalCloudImportFolderIds.includes(id)
        ).length;
        const selectedBeatCount = descendantBeatIds.filter((id) =>
          selectedPersonalCloudImportBeatIds.includes(id)
        ).length;
        const totalSelectableCount = descendantFolderIds.length + descendantBeatIds.length;
        const selectedTotalCount = selectedFolderCount + selectedBeatCount;
        const checked = totalSelectableCount > 0 && selectedTotalCount === totalSelectableCount;
        const indeterminate = selectedTotalCount > 0 && selectedTotalCount < totalSelectableCount;
        if (checked || indeterminate) count += 1;
        if (personalCloudImportExpandedFolderIds.includes(folderId)) walk(folderId);
      });
      childBeats.forEach((entry) => {
        const beatId = String(entry?.id || "");
        if (selectedPersonalCloudImportBeatIds.includes(beatId)) count += 1;
      });
    };
    walk(null);
    return count;
  }, [
    getPendingPersonalCloudImportDescendantFolderIds,
    pendingPersonalCloudImport,
    pendingPersonalCloudImportBeatChildrenByParent,
    pendingPersonalCloudImportFolderChildrenByParent,
    personalCloudImportExpandedFolderIds,
    selectedPersonalCloudImportBeatIds,
    selectedPersonalCloudImportFolderIds,
  ]);
  const handleMergePendingPersonalCloudImport = React.useCallback(async () => {
    if (!pendingPersonalCloudImport) return;
    setPersonalCloudImportPending(true);
    try {
      const ok = await mergeOfflineLocalLibraryIntoCloud(pendingPersonalCloudImport, {
        beatIds: effectiveSelectedPersonalCloudImportBeatIds,
        arrangementIds: effectiveSelectedPersonalCloudImportArrangementIds,
        folderIds: effectiveSelectedPersonalCloudImportFolderIds,
      });
      if (!ok) return;
      setPendingPersonalCloudImport(null);
      setAuthMessage("Local device library merged into your personal cloud library.");
      setAuthError("");
    } catch (error) {
      setAuthError(error?.message || "Failed to merge local library into personal cloud.");
    } finally {
      setPersonalCloudImportPending(false);
    }
  }, [
    mergeOfflineLocalLibraryIntoCloud,
    effectiveSelectedPersonalCloudImportArrangementIds,
    effectiveSelectedPersonalCloudImportBeatIds,
    effectiveSelectedPersonalCloudImportFolderIds,
    pendingPersonalCloudImport,
  ]);
  const notationMenuRowRef = React.useRef(null);
  const selectionMenuRowRef = React.useRef(null);

  useEffect(() => {
    setBpmDraft(String(bpm));
  }, [bpm]);
  useEffect(() => {
    try {
      if (lockedPublicComposer) {
        window.localStorage.setItem(PUBLIC_SUBMIT_COMPOSER_STORAGE_KEY, lockedPublicComposer);
      } else {
        window.localStorage.removeItem(PUBLIC_SUBMIT_COMPOSER_STORAGE_KEY);
      }
    } catch (_) {}
  }, [lockedPublicComposer]);
  useEffect(() => {
    try {
      window.localStorage.setItem(SONG_ARRANGEMENT_STORAGE_KEY, JSON.stringify(arrangementItems));
    } catch (_) {}
  }, [arrangementItems]);
  useEffect(() => {
    try {
      if (authUser?.id) return;
      deviceLocalArrangementsRef.current = savedArrangements;
      writeStoredSavedArrangements(savedArrangements);
      writeStoredDeviceLocalArrangements(savedArrangements);
    } catch (_) {}
  }, [savedArrangements, authUser?.id]);
  useEffect(() => {
    try {
      if (loadedArrangementId) {
        window.localStorage.setItem(LAST_USED_ARRANGEMENT_ID_STORAGE_KEY, loadedArrangementId);
      } else {
        window.localStorage.removeItem(LAST_USED_ARRANGEMENT_ID_STORAGE_KEY);
      }
    } catch (_) {}
  }, [loadedArrangementId]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STICKING_GUIDE_ENABLED_STORAGE_KEY,
        stickingGuideEnabled ? "1" : "0"
      );
    } catch (_) {}
  }, [stickingGuideEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(STICKING_HANDEDNESS_STORAGE_KEY, stickingHandedness);
    } catch (_) {}
  }, [stickingHandedness]);
  useEffect(() => {
    try {
      window.localStorage.setItem(STICKING_LEAD_HAND_STORAGE_KEY, stickingLeadHand);
    } catch (_) {}
  }, [stickingLeadHand]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STICKING_EDIT_MODE_ENABLED_STORAGE_KEY,
        stickingEditModeEnabled ? "1" : "0"
      );
    } catch (_) {}
  }, [stickingEditModeEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        NOTATION_STICKING_SELECTION_MODE_ENABLED_STORAGE_KEY,
        notationStickingSelectionModeEnabled ? "1" : "0"
      );
    } catch (_) {}
  }, [notationStickingSelectionModeEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STICKING_OVERRIDES_STORAGE_KEY,
        JSON.stringify(stickingOverrides || {})
      );
    } catch (_) {}
  }, [stickingOverrides]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STICKING_KEEP_QUARTER_LEAD_HAND_STORAGE_KEY,
        stickingKeepQuarterLeadHand ? "1" : "0"
      );
    } catch (_) {}
  }, [stickingKeepQuarterLeadHand]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SHOW_EDITED_STICKING_STORAGE_KEY,
        showEditedSticking ? "1" : "0"
      );
    } catch (_) {}
  }, [showEditedSticking]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SHOW_NOTATION_STICKING_STORAGE_KEY,
        showNotationSticking ? "1" : "0"
      );
    } catch (_) {}
  }, [showNotationSticking]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        AUTO_PRINT_NEW_BEAT_STICKING_STORAGE_KEY,
        autoPrintNewBeatStickingEnabled ? "1" : "0"
      );
    } catch (_) {}
  }, [autoPrintNewBeatStickingEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        BEAT_AUTO_UPDATE_ENABLED_STORAGE_KEY,
        beatAutoUpdateEnabled ? "1" : "0"
      );
    } catch (_) {}
  }, [beatAutoUpdateEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(NOTATION_STICKING_VIEW_STORAGE_KEY, notationStickingView);
    } catch (_) {}
  }, [notationStickingView]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        NOTATION_STICKING_SELECTION_STORAGE_KEY,
        JSON.stringify(notationStickingSelection || {})
      );
    } catch (_) {}
  }, [notationStickingSelection]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        COUNT_ROW_SELECTED_SUBDIVISION_STORAGE_KEY,
        String(normalizeCountRowSelectedSubdivision(selectedCountRowSubdivision))
      );
    } catch (_) {}
  }, [selectedCountRowSubdivision]);
  useEffect(() => {
    try {
      const next = normalizeTupletAppearanceByValue(tupletGridAppearanceByValue);
      window.localStorage.setItem(
        TUPLET_GRID_APPEARANCE_BY_VALUE_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch (_) {}
  }, [tupletGridAppearanceByValue]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        COUNT_ROW_DARKEN_NON_QUARTERS_STORAGE_KEY,
        darkenCountRowNonQuarters ? "1" : "0"
      );
    } catch (_) {}
  }, [darkenCountRowNonQuarters]);
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCES_CATEGORY_STORAGE_KEY, preferencesCategory);
    } catch (_) {}
  }, [preferencesCategory]);
  useEffect(() => {
    try {
      window.localStorage.setItem(GRID_NOTATION_GAP_STORAGE_KEY, String(gridNotationGap));
    } catch (_) {}
  }, [gridNotationGap]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        NOTATION_GRID_GAP_OFFSET_STORAGE_KEY,
        String(notationGridGapOffset)
      );
    } catch (_) {}
  }, [notationGridGapOffset]);
  useEffect(() => {
    try {
      if (authUser?.id) return;
      deviceLocalBeatLibraryContainersRef.current = beatLibraryContainers;
      writeStoredBeatLibraryContainers(beatLibraryContainers);
      writeStoredDeviceLocalBeatLibraryContainers(beatLibraryContainers);
    } catch (_) {}
  }, [beatLibraryContainers, authUser?.id]);
  useEffect(() => {
    if (!authUser?.id) return;
    if (!personalLibraryCloudHydratedRef.current) return;
    const nextJson = JSON.stringify(normalizeBeatLibraryContainers(beatLibraryContainers));
    if (nextJson === lastSyncedBeatLibraryContainersJsonRef.current) return;
    const timeoutId = window.setTimeout(() => {
      saveCloudBeatLibraryContainers(beatLibraryContainers).catch((error) => {
        setAuthError(error?.message || "Failed to sync personal cloud library.");
      });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [authUser?.id, beatLibraryContainers, saveCloudBeatLibraryContainers]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        BEAT_LIBRARY_SELECTED_CONTAINER_STORAGE_KEY,
        String(selectedBeatLibraryContainerId || "all")
      );
    } catch (_) {}
    selectedBeatLibraryContainerIdRef.current = String(selectedBeatLibraryContainerId || "all");
  }, [selectedBeatLibraryContainerId]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        BEAT_LIBRARY_ROOT_COLLAPSED_STORAGE_KEY,
        beatLibraryRootCollapsed ? "1" : "0"
      );
    } catch (_) {}
  }, [beatLibraryRootCollapsed]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_BARS_PER_ROW_STORAGE_KEY,
        String(arrangementNotationBarsPerRow)
      );
    } catch (_) {}
  }, [arrangementNotationBarsPerRow]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_DYNAMIC_SPACING_STORAGE_KEY,
        arrangementNotationDynamicSpacing ? "true" : "false"
      );
    } catch (_) {}
  }, [arrangementNotationDynamicSpacing]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_GLOBAL_MERGE_RESTS_STORAGE_KEY,
        arrangementNotationGlobalMergeRests ? "true" : "false"
      );
    } catch (_) {}
  }, [arrangementNotationGlobalMergeRests]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_GLOBAL_MERGE_NOTES_STORAGE_KEY,
        arrangementNotationGlobalMergeNotes ? "true" : "false"
      );
    } catch (_) {}
  }, [arrangementNotationGlobalMergeNotes]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_GLOBAL_DOTTED_NOTES_STORAGE_KEY,
        arrangementNotationGlobalDottedNotes ? "true" : "false"
      );
    } catch (_) {}
  }, [arrangementNotationGlobalDottedNotes]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_SCROLL_ROWS_STORAGE_KEY,
        String(arrangementNotationScrollRows)
      );
    } catch (_) {}
  }, [arrangementNotationScrollRows]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_THEME_STORAGE_KEY,
        arrangementNotationTheme
      );
    } catch (_) {}
  }, [arrangementNotationTheme]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_VIRTUALIZE_STORAGE_KEY,
        arrangementNotationVirtualize ? "true" : "false"
      );
    } catch (_) {}
  }, [arrangementNotationVirtualize]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ARRANGEMENT_NOTATION_PREVIEW_SCALE_STORAGE_KEY,
        arrangementNotationPreviewScale === "auto"
          ? "auto"
          : String(arrangementNotationPreviewScale)
      );
    } catch (_) {}
  }, [arrangementNotationPreviewScale]);
  useEffect(() => {
    try {
      window.localStorage.setItem(ARRANGEMENT_TITLE_LINE1_STORAGE_KEY, arrangementTitleLine1Draft);
    } catch (_) {}
  }, [arrangementTitleLine1Draft]);
  useEffect(() => {
    try {
      window.localStorage.setItem(ARRANGEMENT_TITLE_LINE2_STORAGE_KEY, arrangementTitleLine2Draft);
    } catch (_) {}
  }, [arrangementTitleLine2Draft]);
  useEffect(() => {
    try {
      window.localStorage.setItem(ARRANGEMENT_COMPOSER_STORAGE_KEY, arrangementComposerDraft);
    } catch (_) {}
  }, [arrangementComposerDraft]);
  useEffect(() => {
    if (!arrangementTitleLine1Draft.trim() && !arrangementTitleLine2Draft.trim()) return;
    const nextName = getArrangementNameFromTitles(
      arrangementTitleLine1Draft,
      arrangementTitleLine2Draft,
      ""
    );
    if (nextName && nextName !== arrangementNameDraft) {
      setArrangementNameDraft(nextName);
    }
  }, [arrangementNameDraft, arrangementTitleLine1Draft, arrangementTitleLine2Draft]);
  React.useEffect(() => {
    if (!arrangementTitleMenuOpen) return undefined;
    const updateMenuPosition = () => {
      const button = arrangementTitleMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = 288;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));
      const top = Math.max(8, rect.bottom + 8);
      setArrangementTitleMenuPosition({ top, left });
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = arrangementTitleMenuRef.current;
      const button = arrangementTitleMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setArrangementTitleMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setArrangementTitleMenuOpen(false);
    };
    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [arrangementTitleMenuOpen]);
  React.useEffect(() => {
    if (!arrangementPickerMenuOpen) return undefined;
    const updateMenuPosition = () => {
      const button = arrangementPickerButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const menuWidth = Math.max(224, Math.min(320, viewportWidth - 16));
      const maxMenuHeight = Math.max(160, viewportHeight - rect.bottom - 16);
      const left = Math.max(8, Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 8));
      const top = Math.max(8, rect.bottom + 8);
      setArrangementPickerMenuPosition({
        top,
        left,
        width: menuWidth,
        maxHeight: Math.max(160, maxMenuHeight),
      });
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = arrangementPickerMenuRef.current;
      const button = arrangementPickerButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setArrangementPickerMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setArrangementPickerMenuOpen(false);
    };
    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [arrangementPickerMenuOpen]);
  React.useEffect(() => {
    if (!arrangementNotationMoreMenuOpen) return undefined;
    const updateMenuPosition = () => {
      const button = arrangementNotationMoreMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const menu = arrangementNotationMoreMenuRef.current;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const menuWidth = Math.max(180, Math.min(256, viewportWidth - 16));
      const menuHeight = menu instanceof HTMLElement ? menu.offsetHeight : 360;
      const left = Math.max(8, Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 8));
      const preferredTop = rect.bottom + 8;
      const maxTop = Math.max(8, viewportHeight - menuHeight - 8);
      const top =
        preferredTop <= maxTop
          ? preferredTop
          : Math.max(8, Math.min(rect.top - menuHeight - 8, maxTop));
      setArrangementNotationMoreMenuPosition({ top, left, width: menuWidth });
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = arrangementNotationMoreMenuRef.current;
      const button = arrangementNotationMoreMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setArrangementNotationMoreMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setArrangementNotationMoreMenuOpen(false);
    };
    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [arrangementNotationMoreMenuOpen]);
  React.useEffect(() => {
    if (!arrangementNotationRowMenuState) return;
    const rowIndex = arrangementNotationRowMenuState.rowIndex;
    const normalizedSelection =
      arrangementSelection &&
      Number.isFinite(arrangementSelection.start) &&
      Number.isFinite(arrangementSelection.end)
        ? {
            start: Math.min(arrangementSelection.start, arrangementSelection.end),
            end: Math.max(arrangementSelection.start, arrangementSelection.end),
          }
        : null;
    if (
      !Number.isFinite(rowIndex) ||
      normalizedSelection?.start !== rowIndex ||
      normalizedSelection?.end !== rowIndex
    ) {
      setArrangementNotationRowMenuState(null);
    }
  }, [arrangementNotationRowMenuState, arrangementSelection]);
  React.useEffect(() => {
    if (!isShareActionsDialogOpen) return undefined;
    const updateMenuPosition = () => {
      const button = fileMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = 248;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const left = Math.max(8, Math.min(rect.right - menuWidth - 24, viewportWidth - menuWidth - 8));
      const top = Math.max(8, rect.bottom + 8);
      setFileMenuPosition({ top, left });
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = fileMenuRef.current;
      const button = fileMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setIsShareActionsDialogOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsShareActionsDialogOpen(false);
    };
    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isShareActionsDialogOpen]);
  React.useEffect(() => {
    if (!isTransportMenuOpen) return undefined;
    const updateMenuPosition = () => {
      const button = transportMenuButtonRef.current;
      if (!(button instanceof HTMLElement)) return;
      const menu = transportMenuRef.current;
      const rect = button.getBoundingClientRect();
      const menuWidth = 224;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const menuHeight = menu instanceof HTMLElement ? menu.offsetHeight : 360;
      const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));
      const preferredTop = rect.bottom + 8;
      const maxTop = Math.max(8, viewportHeight - menuHeight - 8);
      const top =
        preferredTop <= maxTop
          ? preferredTop
          : Math.max(8, Math.min(rect.top - menuHeight - 8, maxTop));
      setTransportMenuPosition({ top, left, width: menuWidth });
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = transportMenuRef.current;
      const button = transportMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setIsTransportMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsTransportMenuOpen(false);
    };
    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isTransportMenuOpen]);
  React.useEffect(() => {
    if (!isNotationStickingMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = notationStickingMenuRef.current;
      const button = notationStickingMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      setIsNotationStickingMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsNotationStickingMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNotationStickingMenuOpen]);
  React.useEffect(() => {
    if (!isSidebarSettingsMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = sidebarSettingsMenuRef.current;
      const button = sidebarSettingsMenuButtonRef.current;
      if (menu instanceof HTMLElement && menu.contains(target)) return;
      if (button instanceof HTMLElement && button.contains(target)) return;
      if (target instanceof Element && target.closest("[data-sidebar-settings-menu-trigger='1']")) return;
      setIsSidebarSettingsMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsSidebarSettingsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarSettingsMenuOpen]);
  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(playbackRate));
    } catch (_) {}
  }, [playbackRate]);
  useEffect(() => {
    try {
      window.localStorage.setItem(METRONOME_ENABLED_STORAGE_KEY, metronomeEnabled ? "true" : "false");
    } catch (_) {}
  }, [metronomeEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(METRONOME_VOLUME_STORAGE_KEY, String(metronomeVolume));
    } catch (_) {}
  }, [metronomeVolume]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        METRONOME_COUNT_IN_ENABLED_STORAGE_KEY,
        metronomeCountInEnabled ? "true" : "false"
      );
    } catch (_) {}
  }, [metronomeCountInEnabled]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        MIDI_IMPORT_SNARE_GHOST_MAX_STORAGE_KEY,
        String(midiImportSnareGhostMax)
      );
    } catch (_) {}
  }, [midiImportSnareGhostMax]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        MIDI_IMPORT_TOM_GHOST_MAX_STORAGE_KEY,
        String(midiImportTomGhostMax)
      );
    } catch (_) {}
  }, [midiImportTomGhostMax]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        MIDI_IMPORT_HIHAT_GHOST_MAX_STORAGE_KEY,
        String(midiImportHihatGhostMax)
      );
    } catch (_) {}
  }, [midiImportHihatGhostMax]);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!authUser?.id || !hasSupabaseEnabled || !supabase) return;
    void cleanupExpiredTemporaryShareLinks();
  }, [authUser?.id, cleanupExpiredTemporaryShareLinks]);

  useEffect(() => {
    if (!routeOptions.shareId) {
      setResolvedSharedState(null);
      return;
    }
    if (resolvedSharedState && typeof resolvedSharedState === "object") return;
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const isAnonymousKvShareId = String(routeOptions.shareId || "").startsWith("a-");
        if (!isAnonymousKvShareId && hasSupabaseEnabled && supabase) {
          const row = await fetchShareLinkRowById({
            supabase,
            shareId: routeOptions.shareId,
          });
          if (!cancelled) {
            const payload = row?.payload;
            if (payload && typeof payload === "object") {
              setResolvedSharedState(payload);
              void touchShareLinkAccess(row?.id || routeOptions.shareId, payload);
              return;
            }
          }
        }
        const res = await fetch(`/api/share/${encodeURIComponent(routeOptions.shareId)}`, {
          method: "GET",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const payload = data?.payload;
        if (payload && typeof payload === "object") setResolvedSharedState(payload);
      } catch (_) {}
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeOptions.shareId, resolvedSharedState, touchShareLinkAccess]);

  useEffect(() => {
    return () => {
      if (shareCopiedTimerRef.current) {
        window.clearTimeout(shareCopiedTimerRef.current);
        shareCopiedTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onViewportChange = () => setMenuViewportTick((t) => t + 1);
    // Run once on mount so small screens can auto-collapse immediately.
    onViewportChange();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
    };
  }, []);

  const rowHasWrapped = React.useCallback((rowEl) => {
    if (!rowEl) return false;
    const children = Array.from(rowEl.children || []).filter(
      (el) => el instanceof HTMLElement && el.offsetParent !== null
    );
    if (children.length <= 1) return false;
    const tops = children.map((child) => child.getBoundingClientRect().top);
    const minTop = Math.min(...tops);
    const maxTop = Math.max(...tops);
    // Allow tiny layout jitter; only treat as wrapped when there's a clear second row.
    return maxTop - minTop > 6;
  }, []);

  useEffect(() => {
    const currentTab = activeTabRef.current;
    if (currentTab === "none") return;
    const rows =
      currentTab === "selection"
            ? [selectionMenuRowRef.current]
            : [];
    if (rows.some((row) => rowHasWrapped(row))) {
      setActiveTab("none");
    }
  }, [menuViewportTick, rowHasWrapped]);

  useEffect(() => {
    if (activeTab !== "timing") return undefined;
    const handlePointerDown = (event) => {
      const popup = gridMenuPopupRef.current;
      const button = gridMenuButtonRef.current;
      const target = event.target;
      if (
        (popup instanceof HTMLElement && popup.contains(target)) ||
        (button instanceof HTMLElement && button.contains(target))
      ) {
        return;
      }
      setActiveTab((current) => (current === "timing" ? "none" : current));
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveTab((current) => (current === "timing" ? "none" : current));
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab]);

  const clampBpm = (n) => Math.min(400, Math.max(20, n));
  const stepBpm = (delta) => setBpm((v) => clampBpm(v + delta));
  const tapTempoTimesRef = React.useRef([]);
  const roundTempoForImport = React.useCallback((n) => {
    const numeric = Number(n);
    if (!Number.isFinite(numeric)) return 120;
    return Math.round(clampBpm(numeric) * 10) / 10;
  }, [clampBpm]);
  const handleTapTempo = React.useCallback(() => {
    const now = performance.now();
    const prev = tapTempoTimesRef.current;
    if (prev.length > 0 && now - prev[prev.length - 1] > 2000) {
      tapTempoTimesRef.current = [now];
      return;
    }
    const next = [...prev, now].slice(-12);
    tapTempoTimesRef.current = next;
    if (next.length < 3) return;
    let sum = 0;
    for (let i = 1; i < next.length; i++) sum += next[i] - next[i - 1];
    const avgMs = sum / (next.length - 1);
    if (!Number.isFinite(avgMs) || avgMs <= 0) return;
    setBpm(clampBpm(Math.round(60000 / avgMs)));
  }, []);

  const bpmRepeatRef = React.useRef({ timer: null, interval: null });
  const midiTempoMultiplierRepeatRef = React.useRef({ timer: null, interval: null });
  const bpmScrubRef = React.useRef({
    active: false,
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startBpm: 120,
    lastBpm: 120,
    target: null,
  });
  const playbackRateScrubRef = React.useRef({
    active: false,
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startRate: 1,
    lastRate: 1,
  });
  const stopBpmRepeat = React.useCallback(() => {
    const r = bpmRepeatRef.current;
    if (r.timer) window.clearTimeout(r.timer);
    if (r.interval) window.clearInterval(r.interval);
    r.timer = null;
    r.interval = null;
  }, []);
  const startBpmRepeat = React.useCallback(
    (delta) => {
      stopBpmRepeat();
      stepBpm(delta); // immediate step
      bpmRepeatRef.current.timer = window.setTimeout(() => {
        bpmRepeatRef.current.interval = window.setInterval(() => stepBpm(delta), 50);
      }, 130);
    },
    [stopBpmRepeat]
  );
  const handleBpmScrubPointerDown = React.useCallback((e) => {
    if (e.button != null && e.button !== 0) return;
    const scrub = bpmScrubRef.current;
    scrub.active = true;
    scrub.dragging = false;
    scrub.pointerId = e.pointerId;
    scrub.startX = e.clientX;
    scrub.startY = e.clientY;
    scrub.startBpm = bpm;
    scrub.lastBpm = bpm;
    scrub.target = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
  }, [bpm]);
  const handlePlaybackRateScrubPointerDown = React.useCallback((e) => {
    if (e.button != null && e.button !== 0) return;
    const scrub = playbackRateScrubRef.current;
    scrub.active = true;
    scrub.dragging = false;
    scrub.pointerId = e.pointerId;
    scrub.startX = e.clientX;
    scrub.startY = e.clientY;
    scrub.startRate = playbackRate;
    scrub.lastRate = playbackRate;
  }, [playbackRate]);
  useEffect(() => {
    const onPointerMove = (e) => {
      const scrub = bpmScrubRef.current;
      if (!scrub.active) return;
      const dy = scrub.startY - e.clientY;
      const dx = e.clientX - scrub.startX;
      if (!scrub.dragging) {
        if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return;
        scrub.dragging = true;
      }
      const nextBpm = clampBpm(scrub.startBpm + Math.trunc(dy / 4));
      if (nextBpm !== scrub.lastBpm) {
        scrub.lastBpm = nextBpm;
        setBpm(nextBpm);
      }
      e.preventDefault();
    };
    const onPlaybackRatePointerMove = (e) => {
      const scrub = playbackRateScrubRef.current;
      if (!scrub.active) return;
      const dy = scrub.startY - e.clientY;
      const dx = e.clientX - scrub.startX;
      if (!scrub.dragging) {
        if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return;
        scrub.dragging = true;
      }
      const nextRate = clampPlaybackRate(scrub.startRate + dy / 500);
      if (Math.abs(nextRate - scrub.lastRate) > 0.0001) {
        scrub.lastRate = nextRate;
        setPlaybackRate(nextRate);
      }
      e.preventDefault();
    };
    const finish = () => {
      const scrub = bpmScrubRef.current;
      if (scrub.dragging && scrub.target instanceof HTMLInputElement) {
        try {
          scrub.target.blur();
        } catch (_) {}
      }
      if (
        scrub.dragging &&
        scrub.target instanceof HTMLElement &&
        scrub.target === transportMenuButtonRef.current
      ) {
        bpmButtonScrubSuppressUntilRef.current = performance.now() + 250;
      }
      scrub.active = false;
      scrub.dragging = false;
      scrub.pointerId = null;
      scrub.target = null;
      const rateScrub = playbackRateScrubRef.current;
      rateScrub.active = false;
      rateScrub.dragging = false;
      rateScrub.pointerId = null;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointermove", onPlaybackRatePointerMove, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointermove", onPlaybackRatePointerMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, []);
  const [selection, setSelection] = useState(null);
  const [selectionFinalized, setSelectionFinalized] = useState(0);
  const lastHandledSelectionFinalizedRef = React.useRef(0);
  const lastHandledNotationStickingSelectionFinalizedRef = React.useRef(0);
  const tupletBaselineGridRef = React.useRef(null);
  const tupletBaselineSubsByBarRef = React.useRef(null);
  const applyingTupletRemapRef = React.useRef(false);
  const skipSelectionResetRef = React.useRef(0);
  const wrappedMoveCellsRef = React.useRef(null);
  const movePayloadRef = React.useRef(null);
  const moveInitialPayloadRef = React.useRef(null);
  const moveBaseGridRef = React.useRef(null);
  const gridClipboardRef = React.useRef(null);
  const [wrappedSelectionCells, setWrappedSelectionCells] = useState(null);
  // { rowStart, rowEnd, start, endExclusive } (row indices into active instruments)
  const [loopRule, setLoopRule] = useState(null);


  
  const selectionCellCount = selection
    ? (Math.max(0, (selection.endExclusive ?? 0) - (selection.start ?? 0)) *
       Math.max(1, (selection.rowEnd ?? selection.rowStart ?? 0) - (selection.rowStart ?? 0) + 1))
    : 0;
  const canClearSelection = selectionCellCount >= 2;
  const canLoopSelection = selectionCellCount >= 2;
// Keyboard shortcut: Backspace/Delete clears current selection (like Clear button)

  // Used to apply loop rules only when the user finishes a selection gesture (prevents mid-drag activation).
  useEffect(() => {
    const handler = () => setSelectionFinalized((x) => x + 1);
    window.addEventListener("dg-selection-finalized", handler);
    return () => window.removeEventListener("dg-selection-finalized", handler);
  }, []);
useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && selection && !loopRule) {
        const el = e.target;
        const tag = (el?.tagName || "").toLowerCase();
        const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
        if (isTyping) return;
        e.preventDefault();
        setLoopRule(null);
        setSelection(null);
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selection) {
        if (e.pointerType !== "mouse") e.preventDefault();
        setBaseGridWithUndo((prev) => {
          const next = {};
          for (const instId of Object.keys(prev)) next[instId] = [...prev[instId]];
          const start = selection.start;
          const end = selection.endExclusive;
          for (let r = selection.rowStart; r <= selection.rowEnd; r++) {
            const instId = instruments[r]?.id;
            if (!instId) continue;
            for (let c = start; c < end; c++) next[instId][c] = CELL.OFF;
          }
          return next;
        });
        setLoopRule(null);
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, loopRule, instruments]);
  useEffect(() => {
    if (!selection && !loopRule) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (
        pendingPresetChange ||
        isKitEditorOpen ||
        isArrangementOpen ||
        isArrangementNotationOpen ||
        isPublicSubmitDialogOpen ||
        isShareActionsDialogOpen ||
        isPrintDialogOpen ||
        isArrangementPrintDialogOpen ||
        isMidiDialogOpen ||
        isLegalDialogOpen ||
        isPreferencesDialogOpen
      ) return;
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      setLoopRule(null);
      setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selection,
    loopRule,
    pendingPresetChange,
    isKitEditorOpen,
    isArrangementOpen,
    isArrangementNotationOpen,
    isPublicSubmitDialogOpen,
    isShareActionsDialogOpen,
    isPrintDialogOpen,
    isArrangementPrintDialogOpen,
    isMidiDialogOpen,
    isLegalDialogOpen,
    isPreferencesDialogOpen,
  ]);

  useEffect(() => {
    if (!loadedLocalBeatId) return;
    const stillExists = localBeats.some((b) => String(b?.id || "") === String(loadedLocalBeatId));
    if (!stillExists) setLoadedLocalBeatId(null);
  }, [loadedLocalBeatId, localBeats]);
  useEffect(() => {
    if (!isArrangementOpen) return;
    const margin = 8;
    const nextX = Math.max(margin, window.innerWidth - arrangementPanelWidth - margin);
    setArrangementPos((prev) => ({ ...prev, x: nextX }));
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setIsArrangementOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isArrangementOpen, arrangementPanelWidth]);
  useEffect(() => {
    if (!isArrangementNotationOpen) return;
    const margin = 8;
    const panelWidth = arrangementNotationShellWidth;
    const panelHeight = arrangementNotationPanelRef.current?.offsetHeight || 760;
    const maxX = Math.max(margin, window.innerWidth - panelWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - panelHeight - margin);
    setArrangementNotationPos((prev) => ({
      x: Math.max(margin, Math.min(Number(prev?.x) || margin, maxX)),
      y: Math.max(margin, Math.min(Number(prev?.y) || margin, maxY)),
    }));
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setIsArrangementNotationOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isArrangementNotationOpen, arrangementNotationShellWidth]);
  useEffect(() => {
    if (!isArrangementNotationOpen) return;
    const node = arrangementNotationPreviewInnerRef.current;
    if (!(node instanceof HTMLElement)) return;
    let raf = 0;
    const measure = () => {
      const nextHeight = Math.ceil(node.scrollHeight * arrangementNotationEffectivePreviewScale);
      setArrangementNotationPreviewScaledHeight((prev) =>
        Math.abs(prev - nextHeight) < 1 ? prev : nextHeight
      );
    };
    const scheduleMeasure = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };
    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(node);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [
    isArrangementNotationOpen,
    arrangementNotationEffectivePreviewScale,
    arrangementNotationViewMode,
    arrangementNotationPageMode,
    arrangementNotationBarsPerRow,
    arrangementNotationTheme,
  ]);
  useEffect(() => {
    if (isArrangementOpen) return;
    setIsPublicSubmitDialogOpen(false);
  }, [isArrangementOpen]);
  useEffect(() => {
    if (!isPublicSubmitDialogOpen) return;
    const raf = window.requestAnimationFrame(() => {
      publicSubmitTitleInputRef.current?.focus();
      publicSubmitTitleInputRef.current?.select?.();
    });
    const onKeyDown = async (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsPublicSubmitDialogOpen(false);
        return;
      }
      if (e.key !== "Enter") return;
      const activeEl = document.activeElement;
      if (activeEl === publicSubmitTitleInputRef.current) {
        e.preventDefault();
        if (!lockedPublicComposer) publicSubmitComposerInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isPublicSubmitDialogOpen, lockedPublicComposer]);
  useEffect(() => {
    if (!isArrangementOpen) return;
    const onPointerMove = (e) => {
      const drag = arrangementDragRef.current;
      if (drag.dragging) {
        if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
        const minX = 8;
        const minY = 8;
        const nextX = Math.max(minX, e.clientX - drag.offsetX);
        const nextY = Math.max(minY, e.clientY - drag.offsetY);
        setArrangementPos({ x: nextX, y: nextY });
        return;
      }
      if (drag.pointerId == null || e.pointerId !== drag.pointerId || !drag.holdTimer) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (dx * dx + dy * dy > 36) clearFloatingPanelTouchHold(arrangementDragRef);
    };
    const stopDrag = (e) => {
      const drag = arrangementDragRef.current;
      if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
      cancelFloatingPanelDrag(arrangementDragRef);
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      cancelFloatingPanelDrag(arrangementDragRef);
    };
    const onBlur = () => cancelFloatingPanelDrag(arrangementDragRef);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [isArrangementOpen, arrangementPanelWidth, cancelFloatingPanelDrag, clearFloatingPanelTouchHold]);
  useEffect(() => {
    if (!isArrangementNotationOpen) return;
    const onPointerMove = (e) => {
      const drag = arrangementNotationDragRef.current;
      if (drag.dragging) {
        if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
        const minY = 8;
        const nextX = e.clientX - drag.offsetX;
        const nextY = Math.max(minY, e.clientY - drag.offsetY);
        setArrangementNotationPos({ x: nextX, y: nextY });
        return;
      }
      if (drag.pointerId == null || e.pointerId !== drag.pointerId || !drag.holdTimer) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (dx * dx + dy * dy > 36) clearFloatingPanelTouchHold(arrangementNotationDragRef);
    };
    const stopDrag = (e) => {
      const drag = arrangementNotationDragRef.current;
      if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
      cancelFloatingPanelDrag(arrangementNotationDragRef);
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      cancelFloatingPanelDrag(arrangementNotationDragRef);
    };
    const onBlur = () => cancelFloatingPanelDrag(arrangementNotationDragRef);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [isArrangementNotationOpen, cancelFloatingPanelDrag, clearFloatingPanelTouchHold]);

  useEffect(() => {
    if (!isLegalDialogOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setIsLegalDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLegalDialogOpen]);
  useEffect(() => {
    if (!isPreferencesDialogOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setIsPreferencesDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPreferencesDialogOpen]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SHORTCUT_BINDINGS_STORAGE_KEY,
        JSON.stringify(shortcutBindings || {})
      );
    } catch (_) {}
  }, [shortcutBindings]);
  useEffect(() => {
    if (!editingShortcutActionId) return;
    const onKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setEditingShortcutActionId(null);
        return;
      }
      const binding = bindingFromKeyboardEvent(e);
      if (!binding) return;
      setShortcutBindings((prev) => ({
        ...(prev || {}),
        [editingShortcutActionId]: binding,
      }));
      setEditingShortcutActionId(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [editingShortcutActionId]);

  useEffect(() => {
    if (!isMidiDialogOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setIsMidiDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMidiDialogOpen]);

  
  const [defaultLoopRepeats, setDefaultLoopRepeats] = useState(() => {
    try {
      const raw = window.localStorage.getItem(DEFAULT_LOOP_REPEATS_STORAGE_KEY);
      return LOOP_REPEATS_ORDER.includes(String(raw)) ? String(raw) : "off";
    } catch (_) {
      return "off";
    }
  });
  const [defaultMetronomeVolume, setDefaultMetronomeVolume] = useState(() => {
    try {
      return (
        parseStoredUnitVolume(window.localStorage.getItem(DEFAULT_METRONOME_VOLUME_STORAGE_KEY)) ??
        DEFAULT_METRONOME_VOLUME
      );
    } catch (_) {
      return DEFAULT_METRONOME_VOLUME;
    }
  });
  const [gridSelectionHoldDelayMs, setGridSelectionHoldDelayMs] = useState(() => {
    try {
      const raw = String(window.localStorage.getItem(GRID_SELECTION_HOLD_SPEED_STORAGE_KEY) || "").toLowerCase();
      if (raw === "fast") return 300;
      if (raw === "slow") return 500;
      const value = Number(raw);
      if (!Number.isFinite(value)) return 350;
      return Math.max(300, Math.min(800, Math.round(value)));
    } catch (_) {
      return 350;
    }
  });
  const activeShortcutKeysRef = React.useRef(new Set());
  useEffect(() => {
    const activeKeys = activeShortcutKeysRef.current;
    const rememberKey = (event) => {
      const code = String(event.code || "");
      if (code.startsWith("Key")) {
        activeKeys.add(code.slice(3).toUpperCase());
      }
    };
    const forgetKey = (event) => {
      const code = String(event.code || "");
      if (code.startsWith("Key")) {
        activeKeys.delete(code.slice(3).toUpperCase());
      }
    };
    const clearKeys = () => activeKeys.clear();
    window.addEventListener("keydown", rememberKey, true);
    window.addEventListener("keyup", forgetKey, true);
    window.addEventListener("blur", clearKeys);
    return () => {
      window.removeEventListener("keydown", rememberKey, true);
      window.removeEventListener("keyup", forgetKey, true);
      window.removeEventListener("blur", clearKeys);
    };
  }, []);
  const getShortcutBinding = React.useCallback(
    (actionId) =>
      String(
        shortcutBindings?.[actionId] ||
          SHORTCUTS.find((entry) => entry.id === actionId)?.defaultBinding ||
          ""
      ),
    [shortcutBindings]
  );
  const matchesShortcut = React.useCallback(
    (event, actionId) => {
      const binding = getShortcutBinding(actionId);
      return (
        bindingFromKeyboardEvent(event) === binding ||
        matchesChordShortcut(event, binding, activeShortcutKeysRef.current)
      );
    },
    [getShortcutBinding]
  );
  // Whether new selections should auto-generate a loop.
  const [loopRepeats, setLoopRepeats] = useState(defaultLoopRepeats); // "off" | "all" | "1".."8"
  const [wrapSelectionMoveEnabled, setWrapSelectionMoveEnabled] = useState(true);
  const [moveOverlapMode, setMoveOverlapMode] = useState("active-to-empty");
  const [loopOverlapMode, setLoopOverlapMode] = useState("all-to-all");
  const [loopRespectPlayability, setLoopRespectPlayability] = useState(true);
  const [moveOverrideBehavior, setMoveOverrideBehavior] = useState("temporary");
  const lastNonAllLoopRepeats = React.useRef("1");
  const lastNonOffGlobalTupletRef = React.useRef(3);
  React.useEffect(() => {
    // Remember the last non-"all" value so clicking the center can toggle all <-> last value.
    if (loopRepeats !== "all") lastNonAllLoopRepeats.current = loopRepeats;
  }, [loopRepeats]);
  useEffect(() => {
    try {
      window.localStorage.setItem(DEFAULT_LOOP_REPEATS_STORAGE_KEY, defaultLoopRepeats);
    } catch (_) {}
  }, [defaultLoopRepeats]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEFAULT_METRONOME_VOLUME_STORAGE_KEY,
        String(defaultMetronomeVolume)
      );
    } catch (_) {}
  }, [defaultMetronomeVolume]);
  useEffect(() => {
    try {
      window.localStorage.setItem(GRID_SELECTION_HOLD_SPEED_STORAGE_KEY, String(gridSelectionHoldDelayMs));
    } catch (_) {}
  }, [gridSelectionHoldDelayMs]);
  const loopModeEnabled =
    loopRepeats !== "off" && !stickingEditModeEnabled && !notationStickingSelectionModeEnabled;

// If selection collapses to a single cell while looping is active, drop the loop.
  useEffect(() => {
    if (!loopRule) return;
    const width = selection ? (selection.endExclusive - selection.start) : 0;
    if (width < 2) {
      setLoopRule(null);
    }
  }, [selection, loopRule]);
  // When looping is enabled, apply/refresh the loop rule ONLY after a selection gesture finishes.
  // (Selection changes during drag shouldn't activate looping mid-drag.)
  useEffect(() => {
    if (!loopModeEnabled) return;
    if (!selection) return;
    if (selectionFinalized <= 0) return;
    if (selectionFinalized === lastHandledSelectionFinalizedRef.current) return;

    const width = selection.endExclusive - selection.start;
    if (width < 2) return; // keep waiting; selection may still settle for this finalized gesture

    setLoopRule((prev) => {
      const next = {
        rowStart: selection.rowStart,
        rowEnd: selection.rowEnd,
        start: selection.start,
        length: width,
      };
      if (
        prev &&
        prev.rowStart === next.rowStart &&
        prev.rowEnd === next.rowEnd &&
        prev.start === next.start &&
        prev.length === next.length
      ) {
        return prev;
      }
      return next;
    });
    lastHandledSelectionFinalizedRef.current = selectionFinalized;
  }, [loopModeEnabled, selectionFinalized, selection]);
  useEffect(() => {
    if (!loopModeEnabled) return;
    if (!selection) return;
    if (selectionFinalized <= 0) return;

    const width = selection.endExclusive - selection.start;
    if (width < 2) return;

    setLoopRule((prev) => {
      const next = {
        rowStart: selection.rowStart,
        rowEnd: selection.rowEnd,
        start: selection.start,
        length: width,
      };
      if (
        prev &&
        prev.rowStart === next.rowStart &&
        prev.rowEnd === next.rowEnd &&
        prev.start === next.start &&
        prev.length === next.length
      ) {
        return prev;
      }
      return next;
    });
  }, [loopModeEnabled, selection, selectionFinalized]);
useEffect(() => {
    if (loopModeEnabled) return;
    if (loopRule) setLoopRule(null);
  }, [loopModeEnabled, loopRule]);
  useEffect(() => {
    if (!stickingEditModeEnabled) return;
    if (loopRule) setLoopRule(null);
  }, [stickingEditModeEnabled, loopRule]);
  useEffect(() => {
    if (!notationStickingSelectionModeEnabled) return;
    if (loopRule) setLoopRule(null);
  }, [notationStickingSelectionModeEnabled, loopRule]);
// { rowStart, rowEnd, start, length }
  const [mergeRests, setMergeRests] = useState(true);
  const [mergeNotes, setMergeNotes] = useState(true);
  const [dottedNotes, setDottedNotes] = useState(true);
  const [flatBeams, setFlatBeams] = useState(true);
  const [printTitle, setPrintTitle] = useState("");
  const [printComposer, setPrintComposer] = useState("");
  const [printWatermarkEnabled, setPrintWatermarkEnabled] = useState(true);
  const [printQrEnabled, setPrintQrEnabled] = useState(false);
  const [isNotationPngDialogOpen, setIsNotationPngDialogOpen] = useState(false);
  const [notationPngColor, setNotationPngColor] = useState("black");
  const beatNameInputRef = useRef(null);
  const publicSubmitTitleInputRef = useRef(null);
  const publicSubmitComposerInputRef = useRef(null);
  const printTitleInputRef = useRef(null);
  const printComposerInputRef = useRef(null);
  const beatPdfExportRef = React.useRef(null);
// "fast" (>=16ths) | "all"
  useEffect(() => {
    if (!isPrintDialogOpen) return;
    const onKeyDown = async (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsPrintDialogOpen(false);
        return;
      }
      if (e.key !== "Enter") return;

      const activeEl = document.activeElement;
      if (activeEl === printTitleInputRef.current) {
        e.preventDefault();
        printComposerInputRef.current?.focus();
        return;
      }
      if (activeEl === printComposerInputRef.current) {
        e.preventDefault();
        try {
          await beatPdfExportRef.current?.();
          setIsPrintDialogOpen(false);
        } catch (err) {
          console.error(err);
          alert(err?.message || "Failed to export PDF");
        }
        return;
      }
      const tag = (activeEl?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || activeEl?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      try {
        await beatPdfExportRef.current?.();
        setIsPrintDialogOpen(false);
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to export PDF");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPrintDialogOpen]);

  const quarterBeatsPerBar = getQuarterBeatsPerBar(timeSig);
  const baseSubdivPerQuarter = getBaseSubdivPerQuarter(resolution, timeSig);
  const normalizedTupletOverridesByBar = React.useMemo(() => {
    return Array.from({ length: bars }, (_, barIdx) =>
      Array.from({ length: quarterBeatsPerBar }, (_, qIdx) => {
        const raw = tupletOverridesByBar[barIdx]?.[qIdx];
        return clampTupletValue(raw) ?? null;
      })
    );
  }, [tupletOverridesByBar, bars, quarterBeatsPerBar]);
  const quarterSubdivisionsByBar = React.useMemo(
    () =>
      normalizedTupletOverridesByBar.map((row) =>
        resolveQuarterSubdivisions(row, baseSubdivPerQuarter)
      ),
    [normalizedTupletOverridesByBar, baseSubdivPerQuarter]
  );
  const stepsPerBarByBar = React.useMemo(
    () =>
      quarterSubdivisionsByBar.map((row) =>
        Math.max(1, row.reduce((sum, n) => sum + Math.max(1, Number(n) || 1), 0))
      ),
    [quarterSubdivisionsByBar]
  );
  const barStepOffsets = React.useMemo(() => {
    const out = [0];
    for (let i = 0; i < stepsPerBarByBar.length; i++) out.push(out[i] + stepsPerBarByBar[i]);
    return out;
  }, [stepsPerBarByBar]);
  const stepsPerBar = stepsPerBarByBar[0] ?? Math.max(1, Math.round((timeSig.n * resolution) / timeSig.d));
  const columns = barStepOffsets[barStepOffsets.length - 1] ?? 0;

  useEffect(() => {
    setTupletOverridesByBar((prev) =>
      Array.from({ length: bars }, (_, barIdx) =>
        Array.from({ length: quarterBeatsPerBar }, (_, qIdx) => {
          const raw = prev[barIdx]?.[qIdx];
          return clampTupletValue(raw) ?? null;
        })
      )
    );
  }, [bars, quarterBeatsPerBar]);

  useEffect(() => {
    if (skipSelectionResetRef.current > 0) {
      skipSelectionResetRef.current -= 1;
      return;
    }
    wrappedMoveCellsRef.current = null;
    movePayloadRef.current = null;
    moveInitialPayloadRef.current = null;
    moveBaseGridRef.current = null;
    setWrappedSelectionCells(null);
  }, [selection]);

  useEffect(() => {
    wrappedMoveCellsRef.current = null;
    movePayloadRef.current = null;
    moveInitialPayloadRef.current = null;
    moveBaseGridRef.current = null;
    setWrappedSelectionCells(null);
  }, [moveOverlapMode, moveOverrideBehavior]);

  const moveSelectionByDelta = React.useCallback(
    (dr, dc) => {
      if (!selection) return false;
      const width = selection.endExclusive - selection.start;
      const height = selection.rowEnd - selection.rowStart + 1;
      const rowCount = instruments.length;
      if (rowCount < 1 || columns < 1) return false;
      const sourceRectCoords = Array.from({ length: height }, (_, rOff) =>
        Array.from({ length: width }, (_, cOff) => ({
          row: selection.rowStart + rOff,
          col: selection.start + cOff,
        }))
      ).flat();
      const sourceCoords = wrappedMoveCellsRef.current || sourceRectCoords;
      const outOfBounds = sourceCoords.some(({ row, col }) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        return nextRow < 0 || nextRow >= rowCount || nextCol < 0 || nextCol >= columns;
      });
      if (outOfBounds && !wrapSelectionMoveEnabled) return false;
      const targetCoords = wrapSelectionMoveEnabled
        ? sourceCoords.map(({ row, col }) => ({
            row: (row + dr + rowCount) % rowCount,
            col: (col + dc + columns) % columns,
          }))
        : sourceCoords.map(({ row, col }) => ({
            row: row + dr,
            col: col + dc,
          }));

      setLoopRule(null);
      setBaseGridWithUndo((prev) => {
        const cloneGrid = (g) => {
          const out = {};
          for (const instId of Object.keys(g)) out[instId] = [...g[instId]];
          return out;
        };
        const isTemporaryOverride = moveOverrideBehavior === "temporary";
        if (isTemporaryOverride && !moveBaseGridRef.current) {
          const base = cloneGrid(prev);
          for (const { row, col } of sourceCoords) {
            const instId = instruments[row]?.id;
            if (!instId) continue;
            base[instId][col] = CELL.OFF;
          }
          moveBaseGridRef.current = base;
        }
        const baseGridForMove = isTemporaryOverride && moveBaseGridRef.current ? moveBaseGridRef.current : prev;
        const next = cloneGrid(baseGridForMove);

        if (!Array.isArray(moveInitialPayloadRef.current) || moveInitialPayloadRef.current.length !== sourceCoords.length) {
          moveInitialPayloadRef.current = sourceCoords.map(({ row, col }) => {
            const instId = instruments[row]?.id;
            if (!instId) return CELL.OFF;
            return prev[instId]?.[col] ?? CELL.OFF;
          });
        }
        const payload = moveInitialPayloadRef.current;

        const ops = targetCoords.map((target, i) => {
          const source = sourceCoords[i];
          const movedVal = payload[i];
          const targetInstId = instruments[target.row]?.id;
          const targetVal = targetInstId ? (baseGridForMove[targetInstId]?.[target.col] ?? CELL.OFF) : CELL.OFF;
          let shouldWrite = true;
          let shouldClearSource = true;

          if (moveOverlapMode === "all-to-all") {
            shouldWrite = true;
            shouldClearSource = true;
          } else if (moveOverlapMode === "active-to-all") {
            shouldWrite = movedVal !== CELL.OFF;
            shouldClearSource = movedVal !== CELL.OFF;
          } else if (moveOverlapMode === "active-to-empty") {
            shouldWrite = movedVal !== CELL.OFF && targetVal === CELL.OFF;
            shouldClearSource = movedVal !== CELL.OFF;
          }

          return { source, target, movedVal, shouldWrite, shouldClearSource };
        });

        if (!isTemporaryOverride) {
          for (const op of ops) {
            if (!op.shouldClearSource) continue;
            const instId = instruments[op.source.row]?.id;
            if (!instId) continue;
            next[instId][op.source.col] = CELL.OFF;
          }
        }

        for (const op of ops) {
          const targetInstId = instruments[op.target.row]?.id;
          if (!targetInstId) continue;
          if (!op.shouldWrite) continue;
          next[targetInstId][op.target.col] = op.movedVal;
        }

        return next;
      });
      movePayloadRef.current = moveInitialPayloadRef.current;
      if (moveOverrideBehavior !== "temporary") moveBaseGridRef.current = null;
      wrappedMoveCellsRef.current = targetCoords;
      setWrappedSelectionCells(targetCoords);
      return true;
    },
    [selection, instruments, columns, wrapSelectionMoveEnabled, moveOverlapMode, moveOverrideBehavior]
  );
  useEffect(() => {
    if (!selection) return;
    const onKey = (e) => {
      const deltaByKey = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const delta = deltaByKey[e.key];
      if (!delta) return;
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      moveSelectionByDelta(delta[0], delta[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, moveSelectionByDelta]);

  const clearAll = React.useCallback(() => {
    const currentGrid = baseGridRef.current || {};
    const isAlreadyEmpty = ALL_INSTRUMENTS.every((inst) =>
      (currentGrid[inst.id] || []).every((v) => v === CELL.OFF)
    );
    if (isAlreadyEmpty) {
      const hasAnyTuplet = normalizedTupletOverridesByBar.some((row) => row.some((v) => v != null));
      if (hasAnyTuplet) {
        setTupletOverridesByBar(
          Array.from({ length: bars }, () => Array.from({ length: quarterBeatsPerBar }, () => null))
        );
      }
      tupletBaselineGridRef.current = null;
      tupletBaselineSubsByBarRef.current = null;
      return;
    }
    setBaseGridWithUndo(() => {
      const g = {};
      ALL_INSTRUMENTS.forEach((i) => (g[i.id] = Array(columns).fill(CELL.OFF)));
      return g;
    });
    setSelection(null);
    setLoopRule(null);
  }, [normalizedTupletOverridesByBar, bars, quarterBeatsPerBar, columns]);

  const clearSelection = React.useCallback(() => {
    if (!selection || selectionCellCount < 2) return;
    setBaseGridWithUndo((prev) => {
      const next = {};
      ALL_INSTRUMENTS.forEach((i) => (next[i.id] = [...(prev[i.id] || [])]));
      for (let r = selection.rowStart; r <= selection.rowEnd; r++) {
        const instId = instruments[r]?.id;
        if (!instId) continue;
        for (let c = selection.start; c < selection.endExclusive; c++) {
          next[instId][c] = CELL.OFF;
        }
      }
      return next;
    });
    setSelection(null);
  }, [selection, selectionCellCount, instruments]);
  const clearGridSelectionOnly = React.useCallback(() => {
    setLoopRule(null);
    setSelection(null);
    setWrappedSelectionCells(null);
  }, []);

  const rankCell = React.useCallback((v) => (v === CELL.ACCENT ? 3 : v === CELL.ON ? 2 : v === CELL.GHOST ? 1 : 0), []);
  const cloneGridState = React.useCallback((g) => {
    const out = {};
    ALL_INSTRUMENTS.forEach((inst) => {
      out[inst.id] = [...(g?.[inst.id] || [])];
    });
    return out;
  }, []);
  const buildSelectionClipboard = React.useCallback(() => {
    if (!selection) return null;
    const width = Math.max(0, selection.endExclusive - selection.start);
    const height = Math.max(1, selection.rowEnd - selection.rowStart + 1);
    if (width < 1 || height < 1) return null;
    const sourceGrid = baseGridRef.current || {};
    const cells = [];
    for (let rOff = 0; rOff < height; rOff++) {
      const rowIndex = selection.rowStart + rOff;
      const instId = instruments[rowIndex]?.id;
      if (!instId) continue;
      for (let cOff = 0; cOff < width; cOff++) {
        const colIndex = selection.start + cOff;
        cells.push({
          rowOffset: rOff,
          colOffset: cOff,
          value: sourceGrid[instId]?.[colIndex] ?? CELL.OFF,
        });
      }
    }
    return { width, height, cells };
  }, [selection, instruments]);
  const applyClipboardAt = React.useCallback((clipboard, anchorRow, anchorCol) => {
    if (!clipboard?.cells?.length) return false;
    const startRow = Math.max(0, Math.floor(Number(anchorRow) || 0));
    const startCol = Math.max(0, Math.floor(Number(anchorCol) || 0));
    setLoopRule(null);
    setBaseGridWithUndo((prev) => {
      const next = cloneGridState(prev);
      clipboard.cells.forEach((cell) => {
        const rowIndex = startRow + cell.rowOffset;
        const colIndex = startCol + cell.colOffset;
        if (rowIndex < 0 || rowIndex >= instruments.length) return;
        if (colIndex < 0 || colIndex >= columns) return;
        const instId = instruments[rowIndex]?.id;
        if (!instId) return;
        next[instId][colIndex] = cell.value;
      });
      return next;
    });
    const endRow = Math.min(instruments.length - 1, startRow + Math.max(0, clipboard.height - 1));
    const endColExclusive = Math.min(columns, startCol + Math.max(1, clipboard.width));
    setSelection({
      rowStart: startRow,
      rowEnd: endRow,
      start: startCol,
      endExclusive: endColExclusive,
    });
    return true;
  }, [cloneGridState, columns, instruments]);
  const copySelectionToClipboard = React.useCallback(() => {
    const clipboard = buildSelectionClipboard();
    if (!clipboard) return false;
    gridClipboardRef.current = clipboard;
    return true;
  }, [buildSelectionClipboard]);
  const hoveredGridCellRef = React.useRef(null);
  const getSelectionDuplicateAnchor = React.useCallback((clipboard) => {
    if (!clipboard || !selection) return null;
    return {
      row: selection.rowStart,
      col: selection.start + clipboard.width,
    };
  }, [selection]);
  const getClipboardPasteAnchor = React.useCallback((clipboard) => {
    const hovered = hoveredGridCellRef.current;
    if (
      hovered &&
      Number.isFinite(hovered.row) &&
      Number.isFinite(hovered.col)
    ) {
      return {
        row: hovered.row,
        col: hovered.col,
      };
    }
    return getSelectionDuplicateAnchor(clipboard);
  }, [getSelectionDuplicateAnchor]);
  const pasteSelectionFromClipboard = React.useCallback(() => {
    const clipboard = gridClipboardRef.current;
    if (!clipboard) return false;
    const anchor = getClipboardPasteAnchor(clipboard);
    if (!anchor) return false;
    return applyClipboardAt(clipboard, anchor.row, anchor.col);
  }, [applyClipboardAt, getClipboardPasteAnchor]);
  const duplicateSelection = React.useCallback(() => {
    const clipboard = buildSelectionClipboard();
    if (!clipboard || !selection) return false;
    gridClipboardRef.current = clipboard;
    const anchor = getSelectionDuplicateAnchor(clipboard);
    if (!anchor) return false;
    return applyClipboardAt(clipboard, anchor.row, anchor.col);
  }, [applyClipboardAt, buildSelectionClipboard, getSelectionDuplicateAnchor, selection]);
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      if (matchesShortcut(e, "copy_selection")) {
        if (!selection) return;
        e.preventDefault();
        copySelectionToClipboard();
        return;
      }
      if (matchesShortcut(e, "paste_selection")) {
        if (!gridClipboardRef.current) return;
        e.preventDefault();
        pasteSelectionFromClipboard();
        return;
      }
      if (matchesShortcut(e, "duplicate_selection")) {
        if (!selection) return;
        e.preventDefault();
        duplicateSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, copySelectionToClipboard, pasteSelectionFromClipboard, duplicateSelection, matchesShortcut]);

  const remapGridBySubdivisions = React.useCallback(
    (prevGrid, oldSubsByBar, newSubsByBar) => {
      const oldStepsByBar = oldSubsByBar.map((subs) => buildStepMeta(subs));
      const newStepsByBar = newSubsByBar.map((subs) => buildStepMeta(subs));
      const oldOffsets = [0];
      for (let i = 0; i < oldStepsByBar.length; i++) oldOffsets.push(oldOffsets[i] + oldStepsByBar[i].length);
      const newOffsets = [0];
      for (let i = 0; i < newStepsByBar.length; i++) newOffsets.push(newOffsets[i] + newStepsByBar[i].length);
      const out = {};
      ALL_INSTRUMENTS.forEach((inst) => {
        const row = Array(newOffsets[newOffsets.length - 1] || 0).fill(CELL.OFF);
        for (let b = 0; b < Math.min(oldStepsByBar.length, newStepsByBar.length); b++) {
          const oldMeta = oldStepsByBar[b];
          const newMeta = newStepsByBar[b];
          const oldStart = oldOffsets[b];
          const newStart = newOffsets[b];
          const oldQuarterCount = Math.max(1, oldSubsByBar[b]?.length || 0);
          const newQuarterCount = Math.max(1, newSubsByBar[b]?.length || 0);
          const quarterCount = Math.min(oldQuarterCount, newQuarterCount);

          for (let q = 0; q < quarterCount; q++) {
            const events = [];
            for (let oldStep = 0; oldStep < oldMeta.length; oldStep++) {
              const m = oldMeta[oldStep];
              if (!m || m.quarterIndex !== q) continue;
              const oldGlobal = oldStart + oldStep;
              const val = prevGrid[inst.id]?.[oldGlobal] ?? CELL.OFF;
              if (val === CELL.OFF) continue;
              const subdiv = Math.max(1, m.subdiv || 1);
              events.push({
                phase: m.subIndex / subdiv,
                val,
                srcSub: m.subIndex,
              });
            }
            if (!events.length) continue;
            events.sort((a, b) => (a.phase - b.phase) || (a.srcSub - b.srcSub));

            const newSubdiv = Math.max(1, Number(newSubsByBar[b]?.[q]) || 1);
            const slots = assignPhasesToSlots(events.map((e) => e.phase), newSubdiv);

            for (let i = 0; i < events.length; i++) {
              const targetSub = Math.max(0, Math.min(newSubdiv - 1, slots[i]));
              const mappedIdx = newMeta.findIndex(
                (m) => m?.quarterIndex === q && m?.subIndex === targetSub
              );
              if (mappedIdx < 0) continue;
              const nextGlobal = newStart + mappedIdx;
              const cur = row[nextGlobal] ?? CELL.OFF;
              row[nextGlobal] = rankCell(events[i].val) >= rankCell(cur) ? events[i].val : cur;
            }
          }
        }
        out[inst.id] = row;
      });
      return out;
    },
    [rankCell]
  );
  const remapNotationStickingSelectionBySubdivisions = React.useCallback(
    (prevSelection, prevGrid, oldSubsByBar, newSubsByBar) => {
      if (!prevSelection || typeof prevSelection !== "object") return {};
      const oldStepsByBar = oldSubsByBar.map((subs) => buildStepMeta(subs));
      const newStepsByBar = newSubsByBar.map((subs) => buildStepMeta(subs));
      const oldOffsets = [0];
      for (let i = 0; i < oldStepsByBar.length; i++) oldOffsets.push(oldOffsets[i] + oldStepsByBar[i].length);
      const newOffsets = [0];
      for (let i = 0; i < newStepsByBar.length; i++) newOffsets.push(newOffsets[i] + newStepsByBar[i].length);
      const next = {};

      ALL_INSTRUMENTS.forEach((inst) => {
        const instId = inst.id;
        const prevRow = prevGrid?.[instId] || [];
        for (let b = 0; b < Math.min(oldStepsByBar.length, newStepsByBar.length); b++) {
          const oldMeta = oldStepsByBar[b];
          const newMeta = newStepsByBar[b];
          const oldStart = oldOffsets[b];
          const newStart = newOffsets[b];
          const oldQuarterCount = Math.max(1, oldSubsByBar[b]?.length || 0);
          const newQuarterCount = Math.max(1, newSubsByBar[b]?.length || 0);
          const quarterCount = Math.min(oldQuarterCount, newQuarterCount);

          for (let q = 0; q < quarterCount; q++) {
            const events = [];
            for (let oldStep = 0; oldStep < oldMeta.length; oldStep++) {
              const m = oldMeta[oldStep];
              if (!m || m.quarterIndex !== q) continue;
              const oldGlobal = oldStart + oldStep;
              if (prevSelection[`${instId}:${oldGlobal}`] !== true) continue;
              if ((prevRow[oldGlobal] ?? CELL.OFF) === CELL.OFF) continue;
              const subdiv = Math.max(1, m.subdiv || 1);
              events.push({
                phase: m.subIndex / subdiv,
                srcSub: m.subIndex,
              });
            }
            if (!events.length) continue;
            events.sort((a, b) => (a.phase - b.phase) || (a.srcSub - b.srcSub));

            const newSubdiv = Math.max(1, Number(newSubsByBar[b]?.[q]) || 1);
            const slots = assignPhasesToSlots(events.map((e) => e.phase), newSubdiv);

            for (let i = 0; i < events.length; i++) {
              const targetSub = Math.max(0, Math.min(newSubdiv - 1, slots[i]));
              const mappedIdx = newMeta.findIndex(
                (m) => m?.quarterIndex === q && m?.subIndex === targetSub
              );
              if (mappedIdx < 0) continue;
              const nextGlobal = newStart + mappedIdx;
              next[`${instId}:${nextGlobal}`] = true;
            }
          }
        }
      });

      return next;
    },
    []
  );
  const remapGridQuarterBySubdivisions = React.useCallback(
    (prevGrid, oldSubsByBar, newSubsByBar, barIdx, quarterIdx) => {
      const oldStepsByBar = oldSubsByBar.map((subs) => buildStepMeta(subs));
      const newStepsByBar = newSubsByBar.map((subs) => buildStepMeta(subs));
      const oldOffsets = [0];
      for (let i = 0; i < oldStepsByBar.length; i++) oldOffsets.push(oldOffsets[i] + oldStepsByBar[i].length);
      const newOffsets = [0];
      for (let i = 0; i < newStepsByBar.length; i++) newOffsets.push(newOffsets[i] + newStepsByBar[i].length);

      const oldMeta = oldStepsByBar[barIdx] || [];
      const newMeta = newStepsByBar[barIdx] || [];
      const oldBarStart = oldOffsets[barIdx] || 0;
      const newBarStart = newOffsets[barIdx] || 0;
      const oldQuarterStartLocal = oldMeta.findIndex((m) => m?.quarterIndex === quarterIdx);
      const newQuarterStartLocal = newMeta.findIndex((m) => m?.quarterIndex === quarterIdx);
      if (oldQuarterStartLocal < 0 || newQuarterStartLocal < 0) {
        return remapGridBySubdivisions(prevGrid, oldSubsByBar, newSubsByBar);
      }
      const oldQuarterLength = Math.max(1, Number(oldSubsByBar?.[barIdx]?.[quarterIdx]) || 1);
      const newQuarterLength = Math.max(1, Number(newSubsByBar?.[barIdx]?.[quarterIdx]) || 1);
      const oldQuarterStart = oldBarStart + oldQuarterStartLocal;
      const newQuarterStart = newBarStart + newQuarterStartLocal;
      const oldQuarterEnd = oldQuarterStart + oldQuarterLength;
      const newQuarterEnd = newQuarterStart + newQuarterLength;
      const newTotalColumns = newOffsets[newOffsets.length - 1] || 0;
      const out = {};

      ALL_INSTRUMENTS.forEach((inst) => {
        const prevRow = prevGrid?.[inst.id] || [];
        const row = Array(newTotalColumns).fill(CELL.OFF);

        if (oldQuarterStart > 0) {
          row.splice(0, oldQuarterStart, ...prevRow.slice(0, oldQuarterStart));
        }

        const events = [];
        for (let oldStep = 0; oldStep < oldMeta.length; oldStep++) {
          const m = oldMeta[oldStep];
          if (!m || m.quarterIndex !== quarterIdx) continue;
          const oldGlobal = oldBarStart + oldStep;
          const val = prevRow[oldGlobal] ?? CELL.OFF;
          if (val === CELL.OFF) continue;
          const subdiv = Math.max(1, m.subdiv || 1);
          events.push({
            phase: m.subIndex / subdiv,
            val,
            srcSub: m.subIndex,
          });
        }
        if (events.length) {
          events.sort((a, b) => (a.phase - b.phase) || (a.srcSub - b.srcSub));
          const slots = assignPhasesToSlots(events.map((e) => e.phase), newQuarterLength);
          for (let i = 0; i < events.length; i++) {
            const targetSub = Math.max(0, Math.min(newQuarterLength - 1, slots[i]));
            const mappedIdx = newMeta.findIndex(
              (m) => m?.quarterIndex === quarterIdx && m?.subIndex === targetSub
            );
            if (mappedIdx < 0) continue;
            const nextGlobal = newBarStart + mappedIdx;
            const cur = row[nextGlobal] ?? CELL.OFF;
            row[nextGlobal] = rankCell(events[i].val) >= rankCell(cur) ? events[i].val : cur;
          }
        }

        const oldSuffix = prevRow.slice(oldQuarterEnd);
        if (oldSuffix.length > 0) {
          row.splice(newQuarterEnd, oldSuffix.length, ...oldSuffix);
        }
        out[inst.id] = row;
      });

      return out;
    },
    [rankCell, remapGridBySubdivisions]
  );
  const remapNotationStickingSelectionQuarterBySubdivisions = React.useCallback(
    (prevSelection, prevGrid, oldSubsByBar, newSubsByBar, barIdx, quarterIdx) => {
      if (!prevSelection || typeof prevSelection !== "object") return {};
      const selectedEntries = Object.entries(prevSelection).filter(([, enabled]) => enabled === true);
      if (!selectedEntries.length) return {};
      const oldStepsByBar = oldSubsByBar.map((subs) => buildStepMeta(subs));
      const newStepsByBar = newSubsByBar.map((subs) => buildStepMeta(subs));
      const oldOffsets = [0];
      for (let i = 0; i < oldStepsByBar.length; i++) oldOffsets.push(oldOffsets[i] + oldStepsByBar[i].length);
      const newOffsets = [0];
      for (let i = 0; i < newStepsByBar.length; i++) newOffsets.push(newOffsets[i] + newStepsByBar[i].length);

      const oldMeta = oldStepsByBar[barIdx] || [];
      const newMeta = newStepsByBar[barIdx] || [];
      const oldBarStart = oldOffsets[barIdx] || 0;
      const newBarStart = newOffsets[barIdx] || 0;
      const oldQuarterStartLocal = oldMeta.findIndex((m) => m?.quarterIndex === quarterIdx);
      const newQuarterStartLocal = newMeta.findIndex((m) => m?.quarterIndex === quarterIdx);
      if (oldQuarterStartLocal < 0 || newQuarterStartLocal < 0) {
        return remapNotationStickingSelectionBySubdivisions(prevSelection, prevGrid, oldSubsByBar, newSubsByBar);
      }
      const oldQuarterLength = Math.max(1, Number(oldSubsByBar?.[barIdx]?.[quarterIdx]) || 1);
      const newQuarterLength = Math.max(1, Number(newSubsByBar?.[barIdx]?.[quarterIdx]) || 1);
      const oldQuarterStart = oldBarStart + oldQuarterStartLocal;
      const newQuarterStart = newBarStart + newQuarterStartLocal;
      const oldQuarterEnd = oldQuarterStart + oldQuarterLength;
      const newQuarterEnd = newQuarterStart + newQuarterLength;
      const next = {};

      selectedEntries.forEach(([key, enabled]) => {
        if (enabled !== true) return;
        const [instId, rawIdx] = String(key).split(":");
        const idx = Number(rawIdx);
        if (!instId || !Number.isFinite(idx)) return;
        if (idx < oldQuarterStart) {
          next[`${instId}:${idx}`] = true;
          return;
        }
        if (idx >= oldQuarterEnd) {
          next[`${instId}:${idx + (newQuarterLength - oldQuarterLength)}`] = true;
        }
      });

      ALL_INSTRUMENTS.forEach((inst) => {
        const instId = inst.id;
        const prevRow = prevGrid?.[instId] || [];
        const events = [];
        for (let oldStep = 0; oldStep < oldMeta.length; oldStep++) {
          const m = oldMeta[oldStep];
          if (!m || m.quarterIndex !== quarterIdx) continue;
          const oldGlobal = oldBarStart + oldStep;
          if (prevSelection[`${instId}:${oldGlobal}`] !== true) continue;
          if ((prevRow[oldGlobal] ?? CELL.OFF) === CELL.OFF) continue;
          const subdiv = Math.max(1, m.subdiv || 1);
          events.push({
            phase: m.subIndex / subdiv,
            srcSub: m.subIndex,
          });
        }
        if (!events.length) return;
        events.sort((a, b) => (a.phase - b.phase) || (a.srcSub - b.srcSub));
        const slots = assignPhasesToSlots(events.map((e) => e.phase), newQuarterLength);
        for (let i = 0; i < events.length; i++) {
          const targetSub = Math.max(0, Math.min(newQuarterLength - 1, slots[i]));
          const mappedIdx = newMeta.findIndex(
            (m) => m?.quarterIndex === quarterIdx && m?.subIndex === targetSub
          );
          if (mappedIdx < 0) continue;
          const nextGlobal = newBarStart + mappedIdx;
          next[`${instId}:${nextGlobal}`] = true;
        }
      });

      return next;
    },
    [remapNotationStickingSelectionBySubdivisions]
  );

  const handleResolutionChange = (newRes) => {
    tupletBaselineGridRef.current = null;
    tupletBaselineSubsByBarRef.current = null;
    const oldSubsByBar = quarterSubdivisionsByBar;
    const nextBase = getBaseSubdivPerQuarter(newRes, timeSig);
    // Keep explicit tuplet values stable across resolution changes.
    // Example: triplet (3) should remain triplet when switching 8th <-> 16th.
    const nextOverridesByBar = sanitizeTupletOverridesForBase(normalizedTupletOverridesByBar, nextBase);
    const nextSubsByBar = nextOverridesByBar.map((row) =>
      resolveQuarterSubdivisions(row, nextBase)
    );

    if (keepTiming) {
      setBaseGridWithUndo((prev) => remapGridBySubdivisions(prev, oldSubsByBar, nextSubsByBar));
      setNotationStickingSelection((prev) =>
        remapNotationStickingSelectionBySubdivisions(
          prev,
          baseGridRef.current,
          oldSubsByBar,
          nextSubsByBar
        )
      );
    }
    setTupletOverridesByBar(nextOverridesByBar);
    setResolution(newRes);
  };

  const handleTimeSigChange = (newTS) => {
    tupletBaselineGridRef.current = null;
    tupletBaselineSubsByBarRef.current = null;
    const oldSubsByBar = quarterSubdivisionsByBar;
    const nextQuarterCount = getQuarterBeatsPerBar(newTS);
    const nextOverridesByBar = Array.from({ length: bars }, (_, barIdx) =>
      Array.from({ length: nextQuarterCount }, (_, idx) =>
        clampTupletValue(normalizedTupletOverridesByBar[barIdx]?.[idx]) ?? null
      )
    );
    const nextBase = getBaseSubdivPerQuarter(resolution, newTS);
    const nextSubsByBar = nextOverridesByBar.map((row) =>
      resolveQuarterSubdivisions(row, nextBase)
    );
    if (keepTiming) {
      setBaseGridWithUndo((prev) => remapGridBySubdivisions(prev, oldSubsByBar, nextSubsByBar));
      setNotationStickingSelection((prev) =>
        remapNotationStickingSelectionBySubdivisions(
          prev,
          baseGridRef.current,
          oldSubsByBar,
          nextSubsByBar
        )
      );
    }
    setTupletOverridesByBar(nextOverridesByBar);
    setTimeSig(newTS);
  };
  const stepTimeSigNumerator = (delta) => {
    const nextN = Math.max(2, Math.min(15, Number(timeSig.n || 4) + delta));
    if (nextN === timeSig.n) return;
    handleTimeSigChange({ n: nextN, d: timeSig.d === 8 ? 8 : 4 });
  };
  const stepTimeSigDenominator = (delta) => {
    const order = [4, 8];
    const idx = order.indexOf(timeSig.d);
    const safeIdx = idx < 0 ? 0 : idx;
    const nextD = order[(safeIdx + delta + order.length) % order.length];
    if (nextD === timeSig.d) return;
    handleTimeSigChange({ n: Math.max(2, Math.min(15, Number(timeSig.n) || 4)), d: nextD });
  };

  const setTupletAt = React.useCallback(
    (barIdx, beatIdx, nextValue) => {
      if (barIdx < 0 || barIdx >= bars) return;
      if (beatIdx < 0 || beatIdx >= quarterBeatsPerBar) return;
      const oldSubsByBar = quarterSubdivisionsByBar;
      const nextEffective = clampTupletValue(nextValue) ?? baseSubdivPerQuarter;
      const nextVal = nextEffective === baseSubdivPerQuarter ? null : nextEffective;
      const currentVal = normalizedTupletOverridesByBar[barIdx]?.[beatIdx] ?? null;
      if ((currentVal ?? null) === (nextVal ?? null)) return;
      const nextOverridesByBar = normalizedTupletOverridesByBar.map((row) => [...row]);
      nextOverridesByBar[barIdx][beatIdx] = nextVal;
      const nextSubsByBar = nextOverridesByBar.map((row) =>
        resolveQuarterSubdivisions(row, baseSubdivPerQuarter)
      );
      const hasAnyGridContent = ALL_INSTRUMENTS.some((inst) =>
        (baseGridRef.current?.[inst.id] || []).some((val) => val !== CELL.OFF)
      );
      const hasAnyNotationSelection = Object.values(notationStickingSelection || {}).some((value) => value === true);
      if (keepTiming) {
        if (!hasAnyGridContent && !hasAnyNotationSelection) {
          tupletBaselineGridRef.current = null;
          tupletBaselineSubsByBarRef.current = null;
          setTupletOverridesByBar(nextOverridesByBar);
          return;
        }
        applyingTupletRemapRef.current = true;
        if (!tupletBaselineGridRef.current || !tupletBaselineSubsByBarRef.current) {
          pushGridHistoryRef.current();
          tupletBaselineGridRef.current = cloneGridState(baseGridRef.current);
          tupletBaselineSubsByBarRef.current = oldSubsByBar.map((row) => [...row]);
        }
        setBaseGrid(
          remapGridQuarterBySubdivisions(
            tupletBaselineGridRef.current,
            tupletBaselineSubsByBarRef.current,
            nextSubsByBar,
            barIdx,
            beatIdx
          )
        );
        setNotationStickingSelection((prev) =>
          remapNotationStickingSelectionQuarterBySubdivisions(
            prev,
            tupletBaselineGridRef.current || baseGridRef.current,
            tupletBaselineSubsByBarRef.current || oldSubsByBar,
            nextSubsByBar,
            barIdx,
            beatIdx
          )
        );
      } else {
        tupletBaselineGridRef.current = null;
        tupletBaselineSubsByBarRef.current = null;
      }
      setTupletOverridesByBar(nextOverridesByBar);
    },
    [
      bars,
      quarterBeatsPerBar,
      quarterSubdivisionsByBar,
      normalizedTupletOverridesByBar,
      baseSubdivPerQuarter,
      keepTiming,
      notationStickingSelection,
      cloneGridState,
      remapGridQuarterBySubdivisions,
      remapNotationStickingSelectionQuarterBySubdivisions,
    ]
  );
  const resetTupletAt = React.useCallback(
    (barIdx, beatIdx) => {
      if (barIdx < 0 || barIdx >= bars) return;
      if (beatIdx < 0 || beatIdx >= quarterBeatsPerBar) return;
      const existingOverride = normalizedTupletOverridesByBar[barIdx]?.[beatIdx] ?? null;
      if (existingOverride == null) return;
      const oldSubsByBar = quarterSubdivisionsByBar;
      const nextOverridesByBar = normalizedTupletOverridesByBar.map((row) => [...row]);
      nextOverridesByBar[barIdx][beatIdx] = null;
      const nextSubsByBar = nextOverridesByBar.map((row) =>
        resolveQuarterSubdivisions(row, baseSubdivPerQuarter)
      );
      const hasAnyGridContent = ALL_INSTRUMENTS.some((inst) =>
        (baseGridRef.current?.[inst.id] || []).some((val) => val !== CELL.OFF)
      );
      const hasAnyNotationSelection = Object.values(notationStickingSelection || {}).some((value) => value === true);
      if (keepTiming) {
        if (!hasAnyGridContent && !hasAnyNotationSelection) {
          tupletBaselineGridRef.current = null;
          tupletBaselineSubsByBarRef.current = null;
          setTupletOverridesByBar(nextOverridesByBar);
          return;
        }
        applyingTupletRemapRef.current = true;
        if (!tupletBaselineGridRef.current || !tupletBaselineSubsByBarRef.current) {
          pushGridHistoryRef.current();
          tupletBaselineGridRef.current = cloneGridState(baseGridRef.current);
          tupletBaselineSubsByBarRef.current = oldSubsByBar.map((row) => [...row]);
        }
        setBaseGrid(
          remapGridQuarterBySubdivisions(
            tupletBaselineGridRef.current,
            tupletBaselineSubsByBarRef.current,
            nextSubsByBar,
            barIdx,
            beatIdx
          )
        );
        setNotationStickingSelection((prev) =>
          remapNotationStickingSelectionQuarterBySubdivisions(
            prev,
            tupletBaselineGridRef.current || baseGridRef.current,
            tupletBaselineSubsByBarRef.current || oldSubsByBar,
            nextSubsByBar,
            barIdx,
            beatIdx
          )
        );
      } else {
        tupletBaselineGridRef.current = null;
        tupletBaselineSubsByBarRef.current = null;
      }
      setTupletOverridesByBar(nextOverridesByBar);
    },
    [
      bars,
      quarterBeatsPerBar,
      normalizedTupletOverridesByBar,
      quarterSubdivisionsByBar,
      baseSubdivPerQuarter,
      keepTiming,
      notationStickingSelection,
      cloneGridState,
      remapGridQuarterBySubdivisions,
      remapNotationStickingSelectionQuarterBySubdivisions,
    ]
  );
  const globalTupletValue = React.useMemo(() => {
    const values = normalizedTupletOverridesByBar.flatMap((row) => row.map((v) => v ?? null));
    if (values.length === 0) return null;
    const first = values[0] ?? null;
    return values.every((v) => (v ?? null) === first) ? first : "mixed";
  }, [normalizedTupletOverridesByBar]);
  React.useEffect(() => {
    if (typeof globalTupletValue === "number" && globalTupletValue > 0) {
      lastNonOffGlobalTupletRef.current = globalTupletValue;
    }
  }, [globalTupletValue]);
  const setGlobalTupletValue = React.useCallback(
    (nextVal) => {
      const normalized = clampTupletValue(nextVal) ?? null;
      const oldSubsByBar = quarterSubdivisionsByBar;
      const nextOverridesByBar = Array.from({ length: bars }, () =>
        Array.from({ length: quarterBeatsPerBar }, () => normalized)
      );
      const nextSubsByBar = nextOverridesByBar.map((row) =>
        resolveQuarterSubdivisions(row, baseSubdivPerQuarter)
      );
      if (keepTiming) {
        applyingTupletRemapRef.current = true;
        setBaseGridWithUndo((prev) => remapGridBySubdivisions(prev, oldSubsByBar, nextSubsByBar));
        setNotationStickingSelection((prev) =>
          remapNotationStickingSelectionBySubdivisions(
            prev,
            baseGridRef.current,
            oldSubsByBar,
            nextSubsByBar
          )
        );
      } else {
        tupletBaselineGridRef.current = null;
        tupletBaselineSubsByBarRef.current = null;
      }
      setTupletOverridesByBar(nextOverridesByBar);
    },
    [
      quarterSubdivisionsByBar,
      bars,
      quarterBeatsPerBar,
      baseSubdivPerQuarter,
      keepTiming,
      remapGridBySubdivisions,
      remapNotationStickingSelectionBySubdivisions,
    ]
  );
  const stepGlobalTupletValue = React.useCallback(
    (dir = 1) => {
      const idx = TUPLET_OPTIONS.findIndex((v) => v === globalTupletValue);
      const startIdx = idx < 0 ? 0 : idx;
      const nextIdx = (startIdx + dir + TUPLET_OPTIONS.length) % TUPLET_OPTIONS.length;
      setGlobalTupletValue(TUPLET_OPTIONS[nextIdx]);
    },
    [globalTupletValue, setGlobalTupletValue]
  );
  const toggleGlobalTupletOffLast = React.useCallback(() => {
    if (globalTupletValue == null) {
      setGlobalTupletValue(lastNonOffGlobalTupletRef.current || 3);
      return;
    }
    if (typeof globalTupletValue === "number" && globalTupletValue > 0) {
      lastNonOffGlobalTupletRef.current = globalTupletValue;
      setGlobalTupletValue(null);
      return;
    }
    // Mixed -> off, then next click returns to last remembered value.
    setGlobalTupletValue(null);
  }, [globalTupletValue, setGlobalTupletValue]);



  const [baseGrid, setBaseGrid] = useState(() => {
    const g = {};
    ALL_INSTRUMENTS.forEach((i) => (g[i.id] = Array(columns).fill(CELL.OFF)));
    return g;
  });

  
  // Grid-only undo/redo (minimal): tracks baseGrid snapshots only.
  const [gridPast, setGridPast] = useState([]);
  const [gridFuture, setGridFuture] = useState([]);
  const [unifiedPast, setUnifiedPast] = useState([]);
  const [unifiedFuture, setUnifiedFuture] = useState([]);

  const localBeatsRef = React.useRef(localBeats);
  const arrangementItemsRef = React.useRef(arrangementItems);
  const savedArrangementsRef = React.useRef(savedArrangements);
  const beatLibraryContainersRef = React.useRef(beatLibraryContainers);
  const deviceLocalBeatsRef = React.useRef(readStoredDeviceLocalBeats());
  const deviceLocalArrangementsRef = React.useRef(readStoredDeviceLocalArrangements());
  const deviceLocalBeatLibraryContainersRef = React.useRef(readStoredDeviceLocalBeatLibraryContainers());
  const arrangementNameDraftRef = React.useRef(arrangementNameDraft);
  const arrangementTitleLine1DraftRef = React.useRef(arrangementTitleLine1Draft);
  const arrangementTitleLine2DraftRef = React.useRef(arrangementTitleLine2Draft);
  const arrangementComposerDraftRef = React.useRef(arrangementComposerDraft);
  const loadedArrangementIdRef = React.useRef(loadedArrangementId);
  const loadedLocalBeatIdRef = React.useRef(loadedLocalBeatId);
  const isLoadedLocalBeatNotationSelectionDirtyRef = React.useRef(false);
  const flushLoadedLocalBeatNotationSelectionRef = React.useRef(async () => {});
  const beatNameDraftRef = React.useRef(beatNameDraft);
  const beatCategoryDraftRef = React.useRef(beatCategoryDraft);
  const beatStyleDraftRef = React.useRef(beatStyleDraft);
  const localBeatPastRef = React.useRef([]);
  const localBeatFutureRef = React.useRef([]);
  const gridPastRef = React.useRef([]);
  const gridFutureRef = React.useRef([]);
  const unifiedPastRef = React.useRef([]);
  const unifiedFutureRef = React.useRef([]);
  const pushUnifiedHistoryRef = React.useRef(() => {});
  const pushGridHistoryRef = React.useRef(() => {});
  const baseGridRef = React.useRef(null);
  const tupletOverridesRef = React.useRef(tupletOverridesByBar);

  React.useEffect(() => {
    localBeatsRef.current = localBeats;
  }, [localBeats]);
  React.useEffect(() => {
    arrangementItemsRef.current = arrangementItems;
  }, [arrangementItems]);
  React.useEffect(() => {
    savedArrangementsRef.current = savedArrangements;
  }, [savedArrangements]);
  React.useEffect(() => {
    beatLibraryContainersRef.current = beatLibraryContainers;
  }, [beatLibraryContainers]);
  React.useEffect(() => {
    arrangementNameDraftRef.current = arrangementNameDraft;
  }, [arrangementNameDraft]);
  React.useEffect(() => {
    arrangementTitleLine1DraftRef.current = arrangementTitleLine1Draft;
  }, [arrangementTitleLine1Draft]);
  React.useEffect(() => {
    arrangementTitleLine2DraftRef.current = arrangementTitleLine2Draft;
  }, [arrangementTitleLine2Draft]);
  React.useEffect(() => {
    arrangementComposerDraftRef.current = arrangementComposerDraft;
  }, [arrangementComposerDraft]);
  React.useEffect(() => {
    loadedArrangementIdRef.current = loadedArrangementId;
  }, [loadedArrangementId]);
  React.useEffect(() => {
    loadedLocalBeatIdRef.current = loadedLocalBeatId;
  }, [loadedLocalBeatId]);
  React.useEffect(() => {
    beatNameDraftRef.current = beatNameDraft;
  }, [beatNameDraft]);
  React.useEffect(() => {
    beatCategoryDraftRef.current = beatCategoryDraft;
  }, [beatCategoryDraft]);
  React.useEffect(() => {
    beatStyleDraftRef.current = beatStyleDraft;
  }, [beatStyleDraft]);

  React.useEffect(() => {
    baseGridRef.current = baseGrid;
  }, [baseGrid]);
  React.useEffect(() => {
    tupletOverridesRef.current = tupletOverridesByBar;
  }, [tupletOverridesByBar]);

  React.useEffect(() => {
    if (applyingTupletRemapRef.current) {
      applyingTupletRemapRef.current = false;
      return;
    }
    // Any non-tuplet grid edit ends the tuplet-cycling compare session.
    tupletBaselineGridRef.current = null;
    tupletBaselineSubsByBarRef.current = null;
  }, [baseGrid]);
  useEffect(() => {
    setStickingOverrides((prev) => {
      const entries = Object.entries(prev || {});
      if (!entries.length) return prev;
      let changed = false;
      const next = {};
      for (const [key, hand] of entries) {
        const parts = key.split(":");
        if (parts.length !== 2) {
          changed = true;
          continue;
        }
        const [instId, idxRaw] = parts;
        const idx = Number(idxRaw);
        if (!Number.isInteger(idx) || idx < 0 || idx >= columns) {
          changed = true;
          continue;
        }
        if (FOOT_INSTRUMENTS.has(instId)) {
          changed = true;
          continue;
        }
        if ((baseGrid[instId]?.[idx] ?? CELL.OFF) === CELL.OFF) {
          changed = true;
          continue;
        }
        if (hand !== "L" && hand !== "R") {
          changed = true;
          continue;
        }
        next[key] = hand;
      }
      return changed ? next : prev;
    });
  }, [baseGrid, columns]);

  const snapshotGrid = React.useCallback((g) => {
    const snap = {};
    ALL_INSTRUMENTS.forEach((i) => {
      snap[i.id] = [...(g?.[i.id] || [])];
    });
    return snap;
  }, []);
  const snapshotTuplets = React.useCallback((t) => {
    return (t || []).map((row) => [...row]);
  }, []);
  const snapshotEditorState = React.useCallback(
    (gridState, tupletState) => ({
      grid: snapshotGrid(gridState),
      tuplets: snapshotTuplets(tupletState),
    }),
    [snapshotGrid, snapshotTuplets]
  );

  const syncHistoryState = React.useCallback(() => {
    setGridPast([...gridPastRef.current]);
    setGridFuture([...gridFutureRef.current]);
  }, []);

  const pushGridHistory = React.useCallback(() => {
    pushUnifiedHistoryRef.current("editor");
    gridPastRef.current = [
      ...gridPastRef.current,
      snapshotEditorState(baseGridRef.current, tupletOverridesRef.current),
    ];
    // clear redo stack on new edit
    gridFutureRef.current = [];
    // optional cap to keep memory bounded
    if (gridPastRef.current.length > 200) {
      gridPastRef.current = gridPastRef.current.slice(gridPastRef.current.length - 200);
    }
    syncHistoryState();
  }, [snapshotEditorState, syncHistoryState]);
  React.useEffect(() => {
    pushGridHistoryRef.current = pushGridHistory;
  }, [pushGridHistory]);

  const undoGrid = React.useCallback(() => {
    if (gridPastRef.current.length === 0) return;
    const prev = gridPastRef.current[gridPastRef.current.length - 1];
    gridPastRef.current = gridPastRef.current.slice(0, -1);
    gridFutureRef.current = [
      snapshotEditorState(baseGridRef.current, tupletOverridesRef.current),
      ...gridFutureRef.current,
    ];
    setBaseGrid(prev?.grid || {});
    if (Array.isArray(prev?.tuplets)) setTupletOverridesByBar(prev.tuplets);
    syncHistoryState();
  }, [snapshotEditorState, syncHistoryState]);

  const redoGrid = React.useCallback(() => {
    if (gridFutureRef.current.length === 0) return;
    const next = gridFutureRef.current[0];
    gridFutureRef.current = gridFutureRef.current.slice(1);
    gridPastRef.current = [
      ...gridPastRef.current,
      snapshotEditorState(baseGridRef.current, tupletOverridesRef.current),
    ];
    setBaseGrid(next?.grid || {});
    if (Array.isArray(next?.tuplets)) setTupletOverridesByBar(next.tuplets);
    syncHistoryState();
  }, [snapshotEditorState, syncHistoryState]);

  const setBaseGridWithUndo = React.useCallback(
    (updater) => {
      pushGridHistory();
      setBaseGrid(updater);
    },
    [pushGridHistory]
  );

  const cloneLocalBeatList = React.useCallback((beats) => {
    if (!Array.isArray(beats)) return [];
    return beats.map((beat) => {
      try {
        return structuredClone(beat);
      } catch (_) {
        try {
          return JSON.parse(JSON.stringify(beat));
        } catch (_) {
          return beat;
        }
      }
    });
  }, []);
  const cloneSavedArrangementList = React.useCallback((items) => {
    if (!Array.isArray(items)) return [];
    return items.map((entry) => {
      try {
        return structuredClone(entry);
      } catch (_) {
        try {
          return JSON.parse(JSON.stringify(entry));
        } catch (_) {
          return entry;
        }
      }
    });
  }, []);
  const cloneBeatLibraryContainerList = React.useCallback((items) => {
    if (!Array.isArray(items)) return [];
    return items.map((entry) => {
      try {
        return structuredClone(entry);
      } catch (_) {
        try {
          return JSON.parse(JSON.stringify(entry));
        } catch (_) {
          return entry;
        }
      }
    });
  }, []);
  const snapshotLibraryState = React.useCallback(() => {
    return {
      localBeats: cloneLocalBeatList(localBeatsRef.current),
      beatLibraryContainers: cloneBeatLibraryContainerList(beatLibraryContainers),
      arrangementItems: normalizeArrangementItems(arrangementItemsRef.current),
      savedArrangements: cloneSavedArrangementList(savedArrangementsRef.current),
      arrangementNameDraft: String(arrangementNameDraftRef.current || ""),
      arrangementTitleLine1Draft: String(arrangementTitleLine1DraftRef.current || ""),
      arrangementTitleLine2Draft: String(arrangementTitleLine2DraftRef.current || ""),
      arrangementComposerDraft: String(arrangementComposerDraftRef.current || ""),
      loadedArrangementId: loadedArrangementIdRef.current || null,
      loadedLocalBeatId: loadedLocalBeatIdRef.current || null,
      beatNameDraft: String(beatNameDraftRef.current || ""),
      beatCategoryDraft: String(beatCategoryDraftRef.current || "all"),
      beatStyleDraft: String(beatStyleDraftRef.current || "all"),
      selectedBeatLibraryContainerId: String(selectedBeatLibraryContainerId || "all"),
      beatLibraryRootCollapsed: Boolean(beatLibraryRootCollapsed),
    };
  }, [
    beatLibraryContainers,
    beatLibraryRootCollapsed,
    cloneBeatLibraryContainerList,
    cloneLocalBeatList,
    cloneSavedArrangementList,
    selectedBeatLibraryContainerId,
  ]);
  const applyLibraryState = React.useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const nextLocalBeats = cloneLocalBeatList(snapshot.localBeats);
    const nextBeatLibraryContainers = cloneBeatLibraryContainerList(snapshot.beatLibraryContainers);
    const nextArrangementItems = normalizeArrangementItems(snapshot.arrangementItems);
    const nextSavedArrangements = cloneSavedArrangementList(snapshot.savedArrangements);
    localBeatsRef.current = nextLocalBeats;
    arrangementItemsRef.current = nextArrangementItems;
    savedArrangementsRef.current = nextSavedArrangements;
    loadedArrangementIdRef.current = snapshot.loadedArrangementId || null;
    loadedLocalBeatIdRef.current = snapshot.loadedLocalBeatId || null;
    arrangementNameDraftRef.current = String(snapshot.arrangementNameDraft || "");
    arrangementTitleLine1DraftRef.current = String(snapshot.arrangementTitleLine1Draft || "");
    arrangementTitleLine2DraftRef.current = String(snapshot.arrangementTitleLine2Draft || "");
    arrangementComposerDraftRef.current = String(snapshot.arrangementComposerDraft || "");
    beatNameDraftRef.current = String(snapshot.beatNameDraft || "");
    beatCategoryDraftRef.current = String(snapshot.beatCategoryDraft || "all");
    beatStyleDraftRef.current = String(snapshot.beatStyleDraft || "all");
    setLocalBeats(nextLocalBeats);
    setBeatLibraryContainers(nextBeatLibraryContainers);
    selectBeatLibraryContainer(String(snapshot.selectedBeatLibraryContainerId || "all"));
    setBeatLibraryRootCollapsed(Boolean(snapshot.beatLibraryRootCollapsed));
    setEditingBeatLibraryContainerId(null);
    setEditingBeatLibraryContainerName("");
    setEditingBeatLibraryBeatId(null);
    setEditingBeatLibraryBeatName("");
    setBeatLibraryDropTargetId(null);
    setArrangementItems(nextArrangementItems);
    setSavedArrangements(nextSavedArrangements);
    setLoadedArrangementId(snapshot.loadedArrangementId || null);
    setLoadedLocalBeatId(snapshot.loadedLocalBeatId || null);
    setArrangementNameDraft(String(snapshot.arrangementNameDraft || ""));
    setArrangementTitleLine1Draft(String(snapshot.arrangementTitleLine1Draft || ""));
    setArrangementTitleLine2Draft(String(snapshot.arrangementTitleLine2Draft || ""));
    setArrangementComposerDraft(String(snapshot.arrangementComposerDraft || ""));
    setBeatNameDraft(String(snapshot.beatNameDraft || ""));
    setBeatCategoryDraft(String(snapshot.beatCategoryDraft || "all"));
    setBeatStyleDraft(String(snapshot.beatStyleDraft || "all"));
  }, [cloneBeatLibraryContainerList, cloneLocalBeatList, cloneSavedArrangementList]);
  const syncUnifiedHistoryState = React.useCallback(() => {
    setUnifiedPast([...unifiedPastRef.current]);
    setUnifiedFuture([...unifiedFutureRef.current]);
  }, []);
  const snapshotUnifiedHistoryEntry = React.useCallback(
    (kind) => {
      const includeEditor = kind === "editor" || kind === "both";
      const includeLibrary = kind === "library" || kind === "both";
      return {
        kind,
        ...(includeEditor
          ? { editor: snapshotEditorState(baseGridRef.current, tupletOverridesRef.current) }
          : {}),
        ...(includeLibrary ? { library: snapshotLibraryState() } : {}),
      };
    },
    [snapshotEditorState, snapshotLibraryState]
  );
  const applyCombinedHistoryState = React.useCallback(
    (snapshot) => {
      if (!snapshot || typeof snapshot !== "object") return;
      if (snapshot.editor) {
        setBaseGrid(snapshot.editor.grid || {});
        if (Array.isArray(snapshot.editor.tuplets)) setTupletOverridesByBar(snapshot.editor.tuplets);
      }
      if (snapshot.library) applyLibraryState(snapshot.library);
    },
    [applyLibraryState]
  );
  const pushUnifiedHistory = React.useCallback((kind) => {
    unifiedPastRef.current = [...unifiedPastRef.current, snapshotUnifiedHistoryEntry(kind)];
    unifiedFutureRef.current = [];
    if (unifiedPastRef.current.length > 200) {
      unifiedPastRef.current = unifiedPastRef.current.slice(unifiedPastRef.current.length - 200);
    }
    syncUnifiedHistoryState();
  }, [snapshotUnifiedHistoryEntry, syncUnifiedHistoryState]);
  React.useEffect(() => {
    pushUnifiedHistoryRef.current = pushUnifiedHistory;
  }, [pushUnifiedHistory]);

  const syncLocalBeatHistoryState = React.useCallback(() => {
    setLocalBeatPast([...localBeatPastRef.current]);
    setLocalBeatFuture([...localBeatFutureRef.current]);
  }, []);

  const pushLocalBeatHistory = React.useCallback(() => {
    pushUnifiedHistoryRef.current("library");
    localBeatPastRef.current = [
      ...localBeatPastRef.current,
      snapshotLibraryState(),
    ];
    localBeatFutureRef.current = [];
    if (localBeatPastRef.current.length > 200) {
      localBeatPastRef.current = localBeatPastRef.current.slice(localBeatPastRef.current.length - 200);
    }
    syncLocalBeatHistoryState();
  }, [snapshotLibraryState, syncLocalBeatHistoryState]);

  const setLocalBeatsWithUndo = React.useCallback(
    (updater) => {
      pushLocalBeatHistory();
      setLocalBeats((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        const normalized = Array.isArray(next) ? next : [];
        localBeatsRef.current = normalized;
        return normalized;
      });
    },
    [pushLocalBeatHistory]
  );
  const clearAllLocalBeats = React.useCallback(() => {
    pushLocalBeatHistory();
    localBeatsRef.current = [];
    setLocalBeats([]);
    setLoadedLocalBeatId(null);
    setArrangementItems((prev) => {
      const next = normalizeArrangementItems(prev.filter((item) => item?.source !== "local"));
      arrangementItemsRef.current = next;
      return next;
    });
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
    setArrangementPlaybackEnabled(false);
    setArrangementPlaybackIndex(0);
  }, [pushLocalBeatHistory]);
  const cleanupArrangementsForDeletedLocalBeatIds = React.useCallback(async (beatIds) => {
    const deletedIds = Array.from(
      new Set((Array.isArray(beatIds) ? beatIds : []).map((id) => String(id || "")).filter(Boolean))
    );
    if (!deletedIds.length) return;
    const deletedIdSet = new Set(deletedIds);
    const now = new Date().toISOString();
    const currentSaved = savedArrangementsRef.current || [];
    const nextSaved = [];
    const deletedArrangementIds = new Set();
    const updatedArrangementRowsById = new Map();

    currentSaved.forEach((entry) => {
      const existingItems = normalizeArrangementItems(entry?.items);
      const nextItems = existingItems.filter(
        (item) => !(item?.source === "local" && deletedIdSet.has(String(item?.beatId || "")))
      );
      if (!nextItems.length) {
        deletedArrangementIds.add(String(entry?.id || ""));
        return;
      }
      if (nextItems.length !== existingItems.length) {
        updatedArrangementRowsById.set(String(entry?.id || ""), nextItems);
        nextSaved.push({
          ...entry,
          items: nextItems,
          updatedAt: now,
        });
        return;
      }
      nextSaved.push(entry);
    });

    if (authUser?.id && hasSupabaseEnabled && supabase) {
      try {
        await Promise.all([
          updateCloudArrangementRows({
            supabase,
            userId: authUser.id,
            updates: Array.from(updatedArrangementRowsById.entries())
              .filter(([arrangementId]) => isUuidLike(arrangementId))
              .map(([arrangementId, rows]) => ({
                arrangementId,
                patch: {
                  rows,
                  updated_at: now,
                },
              })),
          }),
          deleteCloudArrangementRows({
            supabase,
            userId: authUser.id,
            arrangementIds: Array.from(deletedArrangementIds).filter(isUuidLike),
          }),
        ]);
      } catch (error) {
        alert(error?.message || "Failed to update arrangements after beat deletion");
        return;
      }
    }

    savedArrangementsRef.current = nextSaved;
    setSavedArrangements(nextSaved);

    setArrangementItems((prev) => {
      const next = normalizeArrangementItems(prev).filter(
        (item) => !(item?.source === "local" && deletedIdSet.has(String(item?.beatId || "")))
      );
      arrangementItemsRef.current = next;
      return next;
    });

    if (deletedArrangementIds.has(String(loadedArrangementIdRef.current || ""))) {
      const nextSelectedEntry = sortSavedArrangementsMostRecent(nextSaved)[0] || null;
      if (arrangementPlaybackEnabled) {
        setArrangementPlaybackEnabled(false);
        setArrangementPlaybackIndex(0);
      }
      if (nextSelectedEntry) {
        const nextItems = normalizeArrangementItems(nextSelectedEntry.items);
        arrangementItemsRef.current = nextItems;
        loadedArrangementIdRef.current = nextSelectedEntry.id || null;
        setArrangementItems(nextItems);
        setArrangementSelection(null);
        setArrangementSelectionAnchor(null);
        setArrangementBarSelection(null);
        setArrangementBarSelectionAnchor(null);
        setArrangementNameDraft(
          getArrangementNameFromTitles(
            nextSelectedEntry.titleLine1,
            nextSelectedEntry.titleLine2,
            String(nextSelectedEntry.name || "")
          )
        );
        setArrangementTitleLine1Draft(String(nextSelectedEntry.titleLine1 || ""));
        setArrangementTitleLine2Draft(String(nextSelectedEntry.titleLine2 || ""));
        setArrangementComposerDraft(String(nextSelectedEntry.composer || ""));
        setLoadedArrangementId(nextSelectedEntry.id || null);
        selectArrangementPickerId(nextSelectedEntry.id || null);
      } else {
        arrangementItemsRef.current = [];
        loadedArrangementIdRef.current = null;
        setArrangementItems([]);
        setArrangementSelection(null);
        setArrangementSelectionAnchor(null);
        setArrangementBarSelection(null);
        setArrangementBarSelectionAnchor(null);
        setArrangementNameDraft("");
        setArrangementTitleLine1Draft("");
        setArrangementTitleLine2Draft("");
        setArrangementComposerDraft("");
        setLoadedArrangementId(null);
        selectArrangementPickerId("");
      }
      return;
    }

    if (updatedArrangementRowsById.has(String(loadedArrangementIdRef.current || ""))) {
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
    }
  }, [authUser?.id, arrangementPlaybackEnabled, selectArrangementPickerId]);
  const clearAllLocalLibrary = React.useCallback(() => {
    pushLocalBeatHistory();
    localBeatsRef.current = [];
    savedArrangementsRef.current = [];
    arrangementItemsRef.current = [];
    arrangementNameDraftRef.current = "";
    setLocalBeats([]);
    setBeatLibraryContainers([]);
    selectBeatLibraryContainer("all");
    setBeatLibraryRootCollapsed(false);
    setEditingBeatLibraryContainerId(null);
    setEditingBeatLibraryContainerName("");
    setEditingBeatLibraryBeatId(null);
    setEditingBeatLibraryBeatName("");
    setBeatLibraryDropTargetId(null);
    setSavedArrangements([]);
    setArrangementItems([]);
    setLoadedLocalBeatId(null);
    setLoadedArrangementId(null);
    setArrangementNameDraft("");
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
    setArrangementPlaybackEnabled(false);
    setArrangementPlaybackIndex(0);
    setLoopRepeats("off");
  }, [pushLocalBeatHistory]);
  const deleteLocalBeatById = React.useCallback(async (beatId) => {
    const key = String(beatId || "");
    if (!key) return;
    if (authUser?.id && hasSupabaseEnabled && supabase && isUuidLike(key)) {
      try {
        await deleteCloudBeatRow({ supabase, userId: authUser.id, beatId: key });
      } catch (error) {
        alert(error?.message || "Failed to delete beat");
        return false;
      }
    }
    setLocalBeatsWithUndo((prev) => prev.filter((beat) => String(beat?.id) !== key));
    await cleanupArrangementsForDeletedLocalBeatIds([key]);
    return true;
  }, [authUser?.id, cleanupArrangementsForDeletedLocalBeatIds, setLocalBeatsWithUndo]);
  const deleteLocalBeatsByIds = React.useCallback(async (beatIds) => {
    const ids = Array.from(new Set((Array.isArray(beatIds) ? beatIds : []).map((id) => String(id || "")).filter(Boolean)));
    if (!ids.length) return true;
    if (authUser?.id && hasSupabaseEnabled && supabase) {
      try {
        await deleteCloudBeatRows({
          supabase,
          userId: authUser.id,
          beatIds: ids.filter(isUuidLike),
        });
      } catch (error) {
        alert(error?.message || "Failed to delete beats");
        return false;
      }
    }
    const idSet = new Set(ids);
    setLocalBeatsWithUndo((prev) => prev.filter((beat) => !idSet.has(String(beat?.id || ""))));
    await cleanupArrangementsForDeletedLocalBeatIds(ids);
    return true;
  }, [authUser?.id, cleanupArrangementsForDeletedLocalBeatIds, setLocalBeatsWithUndo]);
  const handleDeleteLocalBeatClick = React.useCallback(async (event, beatId) => {
    event.stopPropagation();
    if (event.metaKey || event.ctrlKey) {
      clearAllLocalBeats();
      return;
    }
    await deleteLocalBeatById(beatId);
  }, [clearAllLocalBeats, deleteLocalBeatById]);
  const handleDeletePublicBeatClick = React.useCallback(async (event, beatId) => {
    event.stopPropagation();
    if (!isAdminUser || !authUser?.id || !hasSupabaseEnabled || !supabase) {
      setPublicLibraryError("Admin login required.");
      return;
    }
    try {
      await deleteOwnedPublicShareRow({
        supabase,
        ownerUserId: authUser.id,
        id: beatId,
      });
    } catch (error) {
      setPublicLibraryError(error?.message || "Failed to delete public beat");
      return;
    }
    setPublicBeats((prev) => prev.filter((beat) => String(beat?.publishedShareId || beat?.id) !== String(beatId)));
  }, [isAdminUser, authUser?.id]);
  const handleMainTrashClick = React.useCallback((event) => {
    if (event.metaKey || event.ctrlKey) {
      clearAllLocalLibrary();
      return;
    }
    if (canClearSelection) clearSelection();
    else clearAll();
  }, [canClearSelection, clearAll, clearAllLocalLibrary, clearSelection]);

  const undoLocalBeatHistory = React.useCallback(() => {
    if (localBeatPastRef.current.length === 0) return;
    const prev = localBeatPastRef.current[localBeatPastRef.current.length - 1];
    localBeatPastRef.current = localBeatPastRef.current.slice(0, -1);
    localBeatFutureRef.current = [
      snapshotLibraryState(),
      ...localBeatFutureRef.current,
    ];
    applyLibraryState(prev);
    syncLocalBeatHistoryState();
  }, [snapshotLibraryState, applyLibraryState, syncLocalBeatHistoryState]);

  const redoLocalBeatHistory = React.useCallback(() => {
    if (localBeatFutureRef.current.length === 0) return;
    const next = localBeatFutureRef.current[0];
    localBeatFutureRef.current = localBeatFutureRef.current.slice(1);
    localBeatPastRef.current = [
      ...localBeatPastRef.current,
      snapshotLibraryState(),
    ];
    applyLibraryState(next);
    syncLocalBeatHistoryState();
  }, [snapshotLibraryState, applyLibraryState, syncLocalBeatHistoryState]);
  const setArrangementItemsWithUndo = React.useCallback(
    (updater) => {
      pushLocalBeatHistory();
      setArrangementItems((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        const normalized = normalizeArrangementItems(next);
        arrangementItemsRef.current = normalized;
        return normalized;
      });
    },
    [pushLocalBeatHistory]
  );

  useEffect(() => {
    const tupletsMatchFor = (overridesByBar) =>
      overridesByBar.every((row, barIdx) =>
        row.every(
          (val, qIdx) =>
            (normalizedTupletOverridesByBar[barIdx]?.[qIdx] ?? null) === (val ?? null)
        )
      );

    const shared = pendingSharedLoadRef.current;
    if (shared) {
      if (bars !== shared.bars) return;
      if (resolution !== shared.resolution) return;
      if (timeSig.n !== shared.timeSig.n || timeSig.d !== shared.timeSig.d) return;
      if (!tupletsMatchFor(shared.tupletsByBar)) return;

      const nextGrid = {};
      ALL_INSTRUMENTS.forEach((inst) => {
        nextGrid[inst.id] = Array(columns).fill(CELL.OFF);
      });

      Object.entries(shared.grid || {}).forEach(([instId, events]) => {
        if (!INSTRUMENT_BY_ID[instId] || !Array.isArray(events)) return;
        events.forEach((event) => {
          if (!Array.isArray(event) || event.length < 2) return;
          const idx = Number(event[0]);
          const code = Number(event[1]);
          if (!Number.isFinite(idx) || idx < 0 || idx >= columns) return;
          const nextVal = code === 3 ? CELL.ACCENT : code === 2 ? CELL.GHOST : code === 1 ? CELL.ON : CELL.OFF;
          if (nextVal !== CELL.OFF) nextGrid[instId][Math.floor(idx)] = nextVal;
        });
      });

      gridPastRef.current = [];
      gridFutureRef.current = [];
      unifiedPastRef.current = [];
      unifiedFutureRef.current = [];
      setBaseGrid(nextGrid);
      setStickingOverrides(shared.stickingOverrides || {});
      setNotationStickingSelection(shared.notationStickingSelection || {});
      syncHistoryState();
      syncUnifiedHistoryState();
      pendingSharedLoadRef.current = null;
      importedBeatLoadInProgressRef.current = false;
      return;
    }

    const example = pendingExampleLoadRef.current;
    if (!example) return;
    if (bars !== example.bars) return;
    if (resolution !== example.resolution) return;
    if (timeSig.n !== example.timeSig.n || timeSig.d !== example.timeSig.d) return;
    if (!tupletsMatchFor(example.tupletsByBar)) return;

    const rank = (v) => (v === CELL.ACCENT ? 3 : v === CELL.ON ? 2 : v === CELL.GHOST ? 1 : 0);
    const nextGrid = {};
    ALL_INSTRUMENTS.forEach((inst) => {
      nextGrid[inst.id] = Array(columns).fill(CELL.OFF);
    });

    const placeHit = (instId, barIdx, pos, value = CELL.ON) => {
      if (!INSTRUMENT_BY_ID[instId]) return;
      if (barIdx < 0 || barIdx >= bars) return;
      const stepsInBar = stepsPerBarByBar[barIdx] || 0;
      if (stepsInBar < 1) return;
      const normalizedPos = Math.max(0, Math.min(0.999999, Number(pos) || 0));
      const stepInBar = Math.max(
        0,
        Math.min(stepsInBar - 1, Math.round(normalizedPos * stepsInBar))
      );
      const globalStep = (barStepOffsets[barIdx] || 0) + stepInBar;
      const current = nextGrid[instId][globalStep] ?? CELL.OFF;
      if (rank(value) >= rank(current)) nextGrid[instId][globalStep] = value;
    };

    for (const hit of example.hits || []) {
      const targetBars =
        hit.bars === "all"
          ? Array.from({ length: bars }, (_, idx) => idx)
          : Array.isArray(hit.bars)
            ? hit.bars
            : [0];
      for (const barIdx of targetBars) {
        for (const pos of hit.positions || []) {
          placeHit(hit.instId, barIdx, pos, hit.value || CELL.ON);
        }
      }
    }

    gridPastRef.current = [];
    gridFutureRef.current = [];
    unifiedPastRef.current = [];
    unifiedFutureRef.current = [];
    setBaseGrid(nextGrid);
    syncHistoryState();
    syncUnifiedHistoryState();
    pendingExampleLoadRef.current = null;
  }, [
    bars,
    resolution,
    timeSig,
    columns,
    barStepOffsets,
    stepsPerBarByBar,
    normalizedTupletOverridesByBar,
    syncHistoryState,
    syncUnifiedHistoryState,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
    } catch (_) {}
  }, [savedPresets]);
  useEffect(() => {
    try {
      if (authUser?.id) return;
      deviceLocalBeatsRef.current = localBeats;
      writeStoredLocalBeats(localBeats);
      writeStoredDeviceLocalBeats(localBeats);
    } catch (_) {}
  }, [localBeats, authUser?.id]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        GRID_SETTINGS_PRESET_LIBRARY_STORAGE_KEY,
        JSON.stringify(gridSettingsPresets)
      );
    } catch (_) {}
  }, [gridSettingsPresets]);

  const {
    getPresetIds,
    getPresetLabel,
    selectedPresetLabel,
    selectedSavedPreset,
    applyKitIds,
    confirmPresetKeepNotedTracks,
    confirmPresetDeleteAnyway,
    stepPreset,
    savePresetAsNew,
    renameSelectedPresetInline,
    deleteSelectedPreset,
    requestRemoveInstrument,
    confirmRemoveDeleteNotes,
    confirmRemoveMoveNotes,
    toggleInstrumentInKit,
    kitOrderSensors,
    onKitOrderDragEnd,
    restrictKitDragToList,
  } = useKitEditorState({
    kitInstrumentIds,
    setKitInstrumentIds,
    savedPresets,
    setSavedPresets,
    modifiedPresetBase,
    setModifiedPresetBase,
    pendingRemoval,
    setPendingRemoval,
    pendingPresetChange,
    setPendingPresetChange,
    keepTracksWithNotesEnabled,
    showPresetChangeWarningEnabled,
    isKitEditorOpen,
    setIsKitEditorOpen,
    isSaveAsDialogOpen,
    setIsSaveAsDialogOpen,
    saveAsName,
    setSaveAsName,
    presetNameInlineDraft,
    setPresetNameInlineDraft,
    baseGrid,
    setBaseGridWithUndo,
    columns,
    setSelection,
    setLoopRule,
    kitOrderListRef,
    drumkitPresets: DRUMKIT_PRESETS,
    builtinPresetOrder: BUILTIN_PRESET_ORDER,
    presetLabels: PRESET_LABELS,
    instrumentById: INSTRUMENT_BY_ID,
    cell: CELL,
  });
  const applyGridSettingsPreset = React.useCallback((preset) => {
    if (!preset) return;
    const nextBars = Math.max(1, Number(preset.bars) || 1);
    const nextResolution = [4, 8, 16, 32].includes(Number(preset.resolution))
      ? Number(preset.resolution)
      : 8;
    const nextTimeSig = {
      n: Math.max(2, Math.min(15, Number(preset?.timeSig?.n) || 4)),
      d: Number(preset?.timeSig?.d) === 8 ? 8 : 4,
    };
    const nextBpm = Math.max(20, Math.min(400, Number(preset?.bpm) || 120));
    const tupletsByBar = buildEmptyTupletOverridesForPreset(nextBars, nextTimeSig);
    const oldSubsByBar = quarterSubdivisionsByBar;
    const nextBase = getBaseSubdivPerQuarter(nextResolution, nextTimeSig);
    const nextSubsByBar = tupletsByBar.map((row) =>
      resolveQuarterSubdivisions(row, nextBase)
    );

    tupletBaselineGridRef.current = null;
    tupletBaselineSubsByBarRef.current = null;
    setModifiedPresetBase(null);
    setPendingPresetChange(null);
    setPendingRemoval(null);
    setSelection(null);
    setLoopRule(null);
    setLoopRepeats("off");
    setLoadedLocalBeatId(null);
    setBpm(nextBpm);
    setBpmDraft(String(nextBpm));
    setBaseGridWithUndo((prev) => remapGridBySubdivisions(prev, oldSubsByBar, nextSubsByBar));
    setNotationStickingSelection((prev) =>
      remapNotationStickingSelectionBySubdivisions(
        prev,
        baseGridRef.current,
        oldSubsByBar,
        nextSubsByBar
      )
    );
    setBars(nextBars);
    setResolution(nextResolution);
    setTimeSig(nextTimeSig);
    setTupletOverridesByBar(tupletsByBar);
  }, [
    bars,
    resolution,
    timeSig,
    quarterSubdivisionsByBar,
    setBaseGridWithUndo,
    remapGridBySubdivisions,
    remapNotationStickingSelectionBySubdivisions,
  ]);
  const activeGridSettingsPreset = React.useMemo(() => {
    return (
      gridSettingsPresets.find((preset) => {
        if (bars !== preset.bars || resolution !== preset.resolution) return false;
        if (timeSig.n !== preset.timeSig.n || timeSig.d !== preset.timeSig.d) return false;
        const expectedTuplets = preset.tupletsByBar || [];
        if (normalizedTupletOverridesByBar.length !== expectedTuplets.length) return false;
        return expectedTuplets.every((row, barIdx) =>
          row.every((val, qIdx) => (normalizedTupletOverridesByBar[barIdx]?.[qIdx] ?? null) === (val ?? null))
        );
      }) || null
    );
  }, [bars, resolution, timeSig, normalizedTupletOverridesByBar, gridSettingsPresets]);
  const makeNextGridSettingsPresetName = React.useCallback(() => {
    const used = new Set(
      gridSettingsPresets.map((preset) => {
        const match = String(preset?.name || "").trim().match(/^Preset\s+(\d+)$/i);
        return match ? Number(match[1]) : null;
      }).filter(Number.isFinite)
    );
    let next = 1;
    while (used.has(next)) next += 1;
    return `Preset ${next}`;
  }, [gridSettingsPresets]);
  const saveCurrentGridSettingsPreset = React.useCallback(() => {
    const nextPreset = normalizeGridSettingsPresetEntry(
      {
        id: `grid-preset-${Math.random().toString(36).slice(2, 10)}`,
        name: makeNextGridSettingsPresetName(),
        bars,
        resolution,
        timeSig,
        bpm,
      },
      gridSettingsPresets.length
    );
    if (!nextPreset) return;
    setGridSettingsPresets((prev) => [nextPreset, ...prev]);
    setSelectedGridSettingsPresetId(nextPreset.id);
  }, [bars, resolution, timeSig, bpm, gridSettingsPresets.length, makeNextGridSettingsPresetName]);
  const saveCurrentStartupGridSettings = React.useCallback(() => {
    const nextSettings = normalizeStartupGridSettings({
      bars,
      resolution,
      timeSig,
      tupletsByBar: normalizedTupletOverridesByBar,
      kitInstrumentIds,
    });
    if (!nextSettings) return;
    setCustomStartupGridSettings(nextSettings);
    try {
      window.localStorage.setItem(
        STARTUP_GRID_SETTINGS_STORAGE_KEY,
        JSON.stringify(nextSettings)
      );
    } catch (_) {}
  }, [bars, resolution, timeSig, normalizedTupletOverridesByBar, kitInstrumentIds]);
  const resetStartupGridSettings = React.useCallback(() => {
    setCustomStartupGridSettings(null);
    try {
      window.localStorage.removeItem(STARTUP_GRID_SETTINGS_STORAGE_KEY);
    } catch (_) {}
  }, []);
  const deleteSelectedGridSettingsPreset = React.useCallback(() => {
    const targetId = String(selectedGridSettingsPresetId || "");
    if (!targetId) return;
    setGridSettingsPresets((prev) => prev.filter((preset) => String(preset?.id || "") !== targetId));
    setSelectedGridSettingsPresetId("");
    if (String(editingGridSettingsPresetId || "") === targetId) {
      setEditingGridSettingsPresetId("");
      setEditingGridSettingsPresetName("");
    }
  }, [selectedGridSettingsPresetId, editingGridSettingsPresetId]);
  const startEditingGridSettingsPreset = React.useCallback((presetId) => {
    const target = gridSettingsPresets.find((preset) => String(preset?.id || "") === String(presetId || ""));
    if (!target) return;
    gridSettingsPresetPendingRenameExitRef.current = "";
    setEditingGridSettingsPresetId(String(target.id));
    setEditingGridSettingsPresetName(String(target.name || ""));
    setSelectedGridSettingsPresetId(String(target.id));
  }, [gridSettingsPresets]);
  const commitEditingGridSettingsPreset = React.useCallback(() => {
    const targetId = String(editingGridSettingsPresetId || "");
    if (!targetId) return;
    gridSettingsPresetPendingRenameExitRef.current = "";
    const nextName = String(editingGridSettingsPresetName || "").trim();
    if (!nextName) {
      setEditingGridSettingsPresetId("");
      setEditingGridSettingsPresetName("");
      return;
    }
    setGridSettingsPresets((prev) =>
      prev.map((preset) =>
        String(preset?.id || "") === targetId ? { ...preset, name: nextName } : preset
      )
    );
    setEditingGridSettingsPresetId("");
    setEditingGridSettingsPresetName("");
  }, [editingGridSettingsPresetId, editingGridSettingsPresetName]);
  const cancelEditingGridSettingsPreset = React.useCallback(() => {
    gridSettingsPresetPendingRenameExitRef.current = "";
    setEditingGridSettingsPresetId("");
    setEditingGridSettingsPresetName("");
  }, []);
  const stepGridSettingsPreset = React.useCallback((delta) => {
    if (!gridSettingsPresets.length) return;
    const currentIdx = activeGridSettingsPreset
      ? gridSettingsPresets.findIndex((preset) => preset.id === activeGridSettingsPreset.id)
      : -1;
    const safeIdx = currentIdx < 0 ? (delta >= 0 ? -1 : 0) : currentIdx;
    const nextIdx =
      delta >= 0
        ? (safeIdx + 1 + gridSettingsPresets.length) % gridSettingsPresets.length
        : (safeIdx - 1 + gridSettingsPresets.length) % gridSettingsPresets.length;
    applyGridSettingsPreset(gridSettingsPresets[nextIdx]);
  }, [activeGridSettingsPreset, applyGridSettingsPreset, gridSettingsPresets]);
  const activeGridSettingsPresetDrag = React.useMemo(
    () =>
      gridSettingsPresets.find((preset) => String(preset?.id || "") === String(activeGridSettingsPresetDragId || "")) || null,
    [activeGridSettingsPresetDragId, gridSettingsPresets]
  );
  const detectGridSettingsPresetDropCollision = React.useCallback((args) => {
    const pointer = args?.pointerCoordinates;
    const trashEl = beatLibraryTrashTargetRef.current;
    if (pointer && trashEl) {
      const rect = trashEl.getBoundingClientRect();
      if (
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      ) {
        const trashContainer = args?.droppableContainers?.find(
          (entry) => String(entry?.id || "") === "__trash__"
        );
        if (trashContainer) {
          return [{ id: "__trash__", data: { droppableContainer: trashContainer, value: Number.MAX_SAFE_INTEGER } }];
        }
      }
    }
    const pointerHits = pointerWithin(args);
    const trashHit = pointerHits.find((entry) => String(entry?.id || "") === "__trash__");
    if (trashHit) return [trashHit];
    return closestCenter(args);
  }, []);
  const handleGridSettingsPresetDragStart = React.useCallback((event) => {
    const activeId = String(event?.active?.id || "");
    if (!activeId.startsWith("preset:")) return;
    setActiveGridSettingsPresetDragId(activeId.slice(7));
    gridSettingsPresetLastOverIdRef.current = "";
  }, []);
  const handleGridSettingsPresetDragOver = React.useCallback((event) => {
    const overId = String(event?.over?.id || "");
    if (overId.startsWith("preset:")) gridSettingsPresetLastOverIdRef.current = overId.slice(7);
    setPresetLibraryDropTargetId(overId || null);
  }, []);
  const handleGridSettingsPresetDragCancel = React.useCallback(() => {
    setActiveGridSettingsPresetDragId(null);
    setPresetLibraryDropTargetId(null);
    gridSettingsPresetLastOverIdRef.current = "";
  }, []);
  const handleGridSettingsPresetDragEnd = React.useCallback((event) => {
    const activeId = String(event?.active?.id || "");
    const overId = String(event?.over?.id || "");
    setActiveGridSettingsPresetDragId(null);
    setPresetLibraryDropTargetId(null);
    gridSettingsPresetLastOverIdRef.current = "";
    if (!activeId.startsWith("preset:") || !overId) return;
    const draggedId = activeId.slice(7);
    if (overId === "__trash__") {
      setGridSettingsPresets((prev) =>
        prev.filter((preset) => String(preset?.id || "") !== draggedId)
      );
      setSelectedGridSettingsPresetId((prev) => (String(prev || "") === draggedId ? "" : prev));
      if (String(editingGridSettingsPresetId || "") === draggedId) {
        setEditingGridSettingsPresetId("");
        setEditingGridSettingsPresetName("");
      }
      return;
    }
    if (!overId.startsWith("preset:")) return;
    const targetId = overId.slice(7);
    if (!targetId || targetId === draggedId) return;
    setGridSettingsPresets((prev) => {
      const oldIndex = prev.findIndex((preset) => String(preset?.id || "") === draggedId);
      const newIndex = prev.findIndex((preset) => String(preset?.id || "") === targetId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, [editingGridSettingsPresetId]);
  useEffect(() => {
    if (routeOptions.shared || routeOptions.shareId) return;
    if (!requestedExample) return;
    if (appliedExampleIdRef.current === requestedExample.id) return;

    const nextBars = Math.max(1, Number(requestedExample.bars) || 1);
    const nextTimeSig = requestedExample.timeSig || { n: 4, d: 4 };
    const quarterCount = getQuarterBeatsPerBar(nextTimeSig);
    const defaultTuplets = Array.from({ length: nextBars }, () =>
      Array.from({ length: quarterCount }, () => null)
    );
    const tupletsByBar = Array.from({ length: nextBars }, (_, barIdx) =>
      Array.from({ length: quarterCount }, (_, qIdx) => {
        const raw = requestedExample.tupletsByBar?.[barIdx]?.[qIdx];
        return clampTupletValue(raw) ?? null;
      })
    );
    const nextKitIds =
      requestedExample.kitIds ||
      getPresetIds(requestedExample.preset) ||
      DRUMKIT_PRESETS.standard;

    pendingExampleLoadRef.current = {
      ...requestedExample,
      bars: nextBars,
      resolution: Math.max(4, Number(requestedExample.resolution) || 8),
      timeSig: nextTimeSig,
      tupletsByBar: tupletsByBar.length ? tupletsByBar : defaultTuplets,
    };
    appliedExampleIdRef.current = requestedExample.id;

    setModifiedPresetBase(null);
    setPendingPresetChange(null);
    setPendingRemoval(null);
    setSelection(null);
    setLoopRule(null);
    setActiveTab("none");
    setLoopRepeats("off");
    setKitInstrumentIds([...nextKitIds]);
    setBars(nextBars);
    setResolution(Math.max(4, Number(requestedExample.resolution) || 8));
    setTimeSig(nextTimeSig);
    setTupletOverridesByBar(tupletsByBar);
  }, [requestedExample, getPresetIds, routeOptions.shared, routeOptions.shareId]);

  const getBeatBpm = React.useCallback((beat) => {
    const direct = Number(beat?.bpm);
    if (Number.isFinite(direct) && direct >= 20 && direct <= 400) return Math.round(direct);
    const payloadBpm = Number(beat?.payload?.bpm);
    if (Number.isFinite(payloadBpm) && payloadBpm >= 20 && payloadBpm <= 400) return Math.round(payloadBpm);
    return null;
  }, []);
  const bpmPassesLibraryFilter = React.useCallback(
    (beatBpm) => {
      if (libraryBpmFilterMode === "any") return true;
      if (!Number.isFinite(beatBpm)) return false;
      if (libraryBpmFilterMode === "exact") return beatBpm === libraryBpmTarget;
      if (libraryBpmFilterMode === "pm5") return Math.abs(beatBpm - libraryBpmTarget) <= 5;
      if (libraryBpmFilterMode === "pm10") return Math.abs(beatBpm - libraryBpmTarget) <= 10;
      return true;
    },
    [libraryBpmFilterMode, libraryBpmTarget]
  );
  const getLibrarySortLabel = React.useCallback(
    (sortMode) => LIBRARY_SORT_MODES.find((m) => m.id === sortMode)?.label || "Creation date: newest",
    []
  );
  const cycleLibrarySort = React.useCallback(() => {
    setLibrarySort((prev) => {
      const idx = LIBRARY_SORT_MODES.findIndex((m) => m.id === prev);
      const nextIdx = idx < 0 ? 0 : (idx + 1) % LIBRARY_SORT_MODES.length;
      return LIBRARY_SORT_MODES[nextIdx].id;
    });
  }, []);
  const cycleLibraryBpmFilterMode = React.useCallback(() => {
    setLibraryBpmFilterMode((prev) => {
      const idx = LIBRARY_BPM_FILTER_MODES.findIndex((m) => m.id === prev);
      const nextIdx = idx < 0 ? 0 : (idx + 1) % LIBRARY_BPM_FILTER_MODES.length;
      return LIBRARY_BPM_FILTER_MODES[nextIdx].id;
    });
  }, []);
  const createBeatLibraryContainer = React.useCallback((type, options = {}) => {
    const normalizedType = BEAT_LIBRARY_CONTAINER_TYPES.some((entry) => entry.id === type) ? type : "folder";
    const explicitParentId =
      options && Object.prototype.hasOwnProperty.call(options, "parentId")
        ? options.parentId
        : undefined;
    const selectedContainer =
      selectedBeatLibraryContainerId !== "all"
        ? beatLibraryContainers.find((entry) => String(entry.id) === String(selectedBeatLibraryContainerId)) || null
        : null;
    const parentId =
      explicitParentId !== undefined
        ? explicitParentId
          ? String(explicitParentId)
          : null
        : selectedContainer
          ? selectedContainer.collapsed
            ? selectedContainer.parentId || null
            : selectedContainer.id
          : null;
    const siblings = beatLibraryContainers.filter((entry) => (entry.parentId || null) === parentId);
    const nextOrder =
      siblings.reduce((max, entry) => Math.max(max, Number(entry.order) || 0), 0) + 1;
    const nextContainer = {
      id: `beatlib-${Math.random().toString(36).slice(2, 10)}`,
      name: `${BEAT_LIBRARY_CONTAINER_TYPES.find((entry) => entry.id === normalizedType)?.label || "Folder"} ${siblings.length + 1}`,
      type: normalizedType,
      parentId,
      collapsed: false,
      order: nextOrder,
    };
    setBeatLibraryContainers((prev) => [...prev, nextContainer]);
    return nextContainer;
  }, [beatLibraryContainers, selectedBeatLibraryContainerId]);
  const toggleBeatLibraryContainerCollapsed = React.useCallback((containerId) => {
    beatLibraryExpandAllSnapshotRef.current = null;
    setBeatLibraryContainers((prev) =>
      prev.map((entry) =>
        entry.id === containerId ? { ...entry, collapsed: !entry.collapsed } : entry
      )
    );
  }, []);
  const toggleBeatLibraryRootCollapsedManual = React.useCallback(() => {
    beatLibraryExpandAllSnapshotRef.current = null;
    setBeatLibraryRootCollapsed((prev) => !prev);
  }, []);
  const toggleBeatLibraryExpandAll = React.useCallback(() => {
    selectBeatLibraryContainer("all");
    const snapshot = beatLibraryExpandAllSnapshotRef.current;
    if (snapshot) {
      setBeatLibraryRootCollapsed(Boolean(snapshot.rootCollapsed));
      setBeatLibraryContainers((prev) =>
        prev.map((entry) => {
          const saved = snapshot.collapsedById[String(entry.id)];
          return typeof saved === "boolean" ? { ...entry, collapsed: saved } : entry;
        })
      );
      beatLibraryExpandAllSnapshotRef.current = null;
      return;
    }
    beatLibraryExpandAllSnapshotRef.current = {
      rootCollapsed: beatLibraryRootCollapsed,
      collapsedById: Object.fromEntries(
        beatLibraryContainers.map((entry) => [String(entry.id), Boolean(entry.collapsed)])
      ),
    };
    setBeatLibraryRootCollapsed(false);
    setBeatLibraryContainers((prev) => prev.map((entry) => ({ ...entry, collapsed: false })));
  }, [beatLibraryContainers, beatLibraryRootCollapsed]);
  const deleteBeatLibraryContainer = React.useCallback(
    async (containerId) => {
      const key = String(containerId || "");
      if (!key || key === "all") return;
      const target = beatLibraryContainers.find((entry) => String(entry.id) === key);
      if (!target) return;
      const descendantIds = new Set([key]);
      const walk = (parentId) => {
        beatLibraryContainers.forEach((entry) => {
          if (String(entry.parentId || "") !== String(parentId)) return;
          descendantIds.add(String(entry.id));
          walk(entry.id);
        });
      };
      walk(key);
      const affectedBeats = localBeats.filter((beat) =>
        descendantIds.has(String(getBeatLibraryMeta(beat).parentId || ""))
      );

      const reparentBeat = (beat) => {
        const meta = getBeatLibraryMeta(beat);
        if (!descendantIds.has(String(meta.parentId || ""))) return beat;
        const nextLibraryMeta = {
          ...meta,
          parentId: null,
        };
        const nextPayload =
          beat?.payload && typeof beat.payload === "object"
            ? {
                ...beat.payload,
                libraryMeta: nextLibraryMeta,
              }
            : beat.payload;
        return {
          ...beat,
          payload: nextPayload,
          libraryMeta: nextLibraryMeta,
        };
      };

      if (authUser?.id && hasSupabaseEnabled && supabase && affectedBeats.length > 0) {
        try {
          await updateCloudBeatRows({
            supabase,
            userId: authUser.id,
            updates: affectedBeats
              .filter((beat) => isUuidLike(beat?.id))
              .map((beat) => {
                const nextBeat = reparentBeat(beat);
                return {
                  beatId: String(beat.id),
                  patch: {
                    payload: nextBeat.payload,
                    updated_at: new Date().toISOString(),
                  },
                };
              }),
          });
        } catch (error) {
          alert(error?.message || "Failed to update beats in deleted folder");
          return;
        }
      }

      setLocalBeatsWithUndo((prev) => prev.map(reparentBeat));
      setBeatLibraryContainers((prev) =>
        prev.filter((entry) => !descendantIds.has(String(entry.id)))
      );
      selectBeatLibraryContainer("all");
    },
    [authUser?.id, beatLibraryContainers, localBeats, setLocalBeatsWithUndo]
  );
  const deleteBeatLibraryContainerWithContents = React.useCallback(
    async (containerId) => {
      const key = String(containerId || "");
      if (!key || key === "all") return;
      const target = beatLibraryContainers.find((entry) => String(entry.id) === key);
      if (!target) return;
      const descendantIds = new Set([key]);
      const walk = (parentId) => {
        beatLibraryContainers.forEach((entry) => {
          if (String(entry.parentId || "") !== String(parentId)) return;
          descendantIds.add(String(entry.id));
          walk(entry.id);
        });
      };
      walk(key);
      const affectedBeats = localBeats.filter((beat) =>
        descendantIds.has(String(getBeatLibraryMeta(beat).parentId || ""))
      );

      if (authUser?.id && hasSupabaseEnabled && supabase && affectedBeats.length > 0) {
        try {
          await deleteCloudBeatRows({
            supabase,
            userId: authUser.id,
            beatIds: affectedBeats.map((beat) => String(beat?.id || "")).filter(isUuidLike),
          });
        } catch (error) {
          alert(error?.message || "Failed to delete beats in folder");
          return;
        }
      }

      setLocalBeatsWithUndo((prev) =>
        prev.filter((beat) => !descendantIds.has(String(getBeatLibraryMeta(beat).parentId || "")))
      );
      setBeatLibraryContainers((prev) =>
        prev.filter((entry) => !descendantIds.has(String(entry.id)))
      );
      selectBeatLibraryContainer("all");
      clearBeatLibraryBeatSelection();
    },
    [authUser?.id, beatLibraryContainers, localBeats, setLocalBeatsWithUndo, clearBeatLibraryBeatSelection, selectBeatLibraryContainer]
  );
  const startEditingBeatLibraryContainer = React.useCallback(
    (containerId) => {
      const key = String(containerId || "");
      if (!key || key === "all") return;
      const target = beatLibraryContainers.find((entry) => String(entry.id) === key);
      if (!target) return;
      setEditingBeatLibraryContainerId(key);
      setEditingBeatLibraryContainerName(String(target.name || ""));
    },
    [beatLibraryContainers]
  );
  const cancelEditingBeatLibraryContainer = React.useCallback(() => {
    setEditingBeatLibraryContainerId(null);
    setEditingBeatLibraryContainerName("");
  }, []);
  const commitEditingBeatLibraryContainer = React.useCallback(() => {
    const key = String(editingBeatLibraryContainerId || "");
    const nextName = editingBeatLibraryContainerName.trim();
    if (!key) return;
    if (!nextName) {
      cancelEditingBeatLibraryContainer();
      return;
    }
    setBeatLibraryContainers((prev) =>
      prev.map((entry) => (String(entry.id) === key ? { ...entry, name: nextName } : entry))
    );
    cancelEditingBeatLibraryContainer();
  }, [editingBeatLibraryContainerId, editingBeatLibraryContainerName, cancelEditingBeatLibraryContainer]);
  const startEditingBeatLibraryBeat = React.useCallback(
    (beatId) => {
      const key = String(beatId || "");
      if (!key) return;
      const target = localBeats.find((beat) => String(beat?.id || "") === key);
      if (!target) return;
      setEditingBeatLibraryBeatId(key);
      setEditingBeatLibraryBeatName(String(target.name || ""));
    },
    [localBeats]
  );
  const cancelEditingBeatLibraryBeat = React.useCallback(() => {
    setEditingBeatLibraryBeatId(null);
    setEditingBeatLibraryBeatName("");
  }, []);
  const commitEditingBeatLibraryBeat = React.useCallback(async () => {
    const key = String(editingBeatLibraryBeatId || "");
    const nextName = editingBeatLibraryBeatName.trim();
    if (!key) return;
    if (!nextName) {
      cancelEditingBeatLibraryBeat();
      return;
    }
    const targetBeat = localBeats.find((beat) => String(beat?.id || "") === key);
    if (!targetBeat) {
      cancelEditingBeatLibraryBeat();
      return;
    }
    cancelEditingBeatLibraryBeat();
    setLocalBeatsWithUndo((prev) =>
      prev.map((beat) =>
        String(beat?.id || "") === key
          ? {
              ...beat,
              name: nextName,
            }
          : beat
      )
    );
    if (String(loadedLocalBeatId || "") === key) {
      setBeatNameDraft(nextName);
    }
    if (authUser?.id && hasSupabaseEnabled && supabase && isUuidLike(key)) {
      try {
        await updateCloudBeatRow({
          supabase,
          userId: authUser.id,
          beatId: key,
          patch: {
            name: nextName,
            updated_at: new Date().toISOString(),
          },
        });
      } catch (error) {
        alert(error?.message || "Failed to rename beat");
        return;
      }
    }
  }, [
    authUser?.id,
    editingBeatLibraryBeatId,
    editingBeatLibraryBeatName,
    cancelEditingBeatLibraryBeat,
    localBeats,
    loadedLocalBeatId,
    setLocalBeatsWithUndo,
  ]);
  const beginBeatLibraryTreeDrag = React.useCallback((item) => {
    if (!item || typeof item !== "object") return;
    beatLibraryTreeDragRef.current = item;
    beatLibraryLastHoverTargetRef.current = "";
  }, []);
  const clearBeatLibraryTreeDrag = React.useCallback(() => {
    beatLibraryTreeDragRef.current = null;
    beatLibraryLastHoverTargetRef.current = "";
    setBeatLibraryDropTargetId(null);
  }, []);
  const moveBeatToLibraryContainer = React.useCallback(
    async (beatId, targetParentId) => {
      const key = String(beatId || "");
      if (!key) return;
      const normalizedTargetParentId = targetParentId ? String(targetParentId) : null;
      const targetBeat = localBeats.find((beat) => String(beat?.id) === key);
      if (!targetBeat) return;
      const currentMeta = getBeatLibraryMeta(targetBeat);
      if ((currentMeta.parentId || null) === normalizedTargetParentId) return;
      const nextLibraryMeta = {
        ...currentMeta,
        parentId: normalizedTargetParentId,
      };
      const nextPayload =
        targetBeat?.payload && typeof targetBeat.payload === "object"
          ? {
              ...targetBeat.payload,
              libraryMeta: nextLibraryMeta,
            }
          : targetBeat.payload;

      if (authUser?.id && hasSupabaseEnabled && supabase && isUuidLike(key)) {
        try {
          await updateCloudBeatRow({
            supabase,
            userId: authUser.id,
            beatId: key,
            patch: {
              payload: nextPayload,
              updated_at: new Date().toISOString(),
            },
          });
        } catch (error) {
          alert(error?.message || "Failed to move beat");
          return;
        }
      }

      setLocalBeatsWithUndo((prev) =>
        prev.map((beat) =>
          String(beat?.id) === key
            ? {
                ...beat,
                payload: nextPayload,
                libraryMeta: nextLibraryMeta,
              }
            : beat
        )
      );
    },
    [authUser?.id, localBeats, setLocalBeatsWithUndo]
  );
  const moveBeatsToLibraryContainer = React.useCallback(
    async (beatIds, targetParentId) => {
      const orderedIds = Array.from(
        new Set((Array.isArray(beatIds) ? beatIds : []).map((id) => String(id || "")).filter(Boolean))
      );
      if (!orderedIds.length) return [];
      const normalizedTargetParentId = targetParentId ? String(targetParentId) : null;
      const beatById = new Map(
        localBeats.map((beat) => [String(beat?.id || ""), beat])
      );
      const updatedById = new Map();
      orderedIds.forEach((id, index) => {
        const beat = beatById.get(id);
        if (!beat) return;
        const nextLibraryMeta = {
          ...getBeatLibraryMeta(beat),
          parentId: normalizedTargetParentId,
          manualOrder: index + 1,
        };
        const nextPayload =
          beat?.payload && typeof beat.payload === "object"
            ? {
                ...beat.payload,
                libraryMeta: nextLibraryMeta,
              }
            : beat.payload;
        updatedById.set(id, {
          ...beat,
          payload: nextPayload,
          libraryMeta: nextLibraryMeta,
        });
      });
      if (!updatedById.size) return [];

      if (authUser?.id && hasSupabaseEnabled && supabase) {
        try {
          await updateCloudBeatRows({
            supabase,
            userId: authUser.id,
            updates: Array.from(updatedById.values())
              .filter((beat) => isUuidLike(beat?.id))
              .map((beat) => ({
                beatId: String(beat.id),
                patch: {
                  payload: beat.payload,
                  updated_at: new Date().toISOString(),
                },
              })),
          });
        } catch (error) {
          alert(error?.message || "Failed to move beats");
          return [];
        }
      }

      setLocalBeatsWithUndo((prev) =>
        prev.map((beat) => updatedById.get(String(beat?.id || "")) || beat)
      );
      return Array.from(updatedById.keys());
    },
    [authUser?.id, localBeats, setLocalBeatsWithUndo]
  );
  const reorderBeatInLibrary = React.useCallback(
    async (draggedBeatId, targetBeatId) => {
      const draggedKey = String(draggedBeatId || "");
      const targetKey = String(targetBeatId || "");
      if (!draggedKey || !targetKey || draggedKey === targetKey) return;
      const draggedBeat = localBeats.find((beat) => String(beat?.id || "") === draggedKey);
      const targetBeat = localBeats.find((beat) => String(beat?.id || "") === targetKey);
      if (!draggedBeat || !targetBeat) return;
      const targetParentId = getBeatLibraryMeta(targetBeat).parentId || null;
      const siblingBeats = localBeats
        .filter((beat) => (getBeatLibraryMeta(beat).parentId || null) === targetParentId)
        .sort(compareBeatLibraryOrder);
      const draggedNext = {
        ...draggedBeat,
        payload:
          draggedBeat?.payload && typeof draggedBeat.payload === "object"
            ? {
                ...draggedBeat.payload,
                libraryMeta: {
                  ...getBeatLibraryMeta(draggedBeat),
                  parentId: targetParentId,
                },
              }
            : draggedBeat.payload,
        libraryMeta: {
          ...getBeatLibraryMeta(draggedBeat),
          parentId: targetParentId,
        },
      };
      const orderedBeats = siblingBeats.map((beat) =>
        String(beat?.id || "") === draggedKey ? draggedNext : beat
      );
      if (!orderedBeats.some((beat) => String(beat?.id || "") === draggedKey)) {
        orderedBeats.push(draggedNext);
      }
      const oldIndex = orderedBeats.findIndex((beat) => String(beat?.id || "") === draggedKey);
      const newIndex = orderedBeats.findIndex((beat) => String(beat?.id || "") === targetKey);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reorderedBeats = arrayMove(orderedBeats, oldIndex, newIndex);
      const updatedById = new Map(
        reorderedBeats.map((beat, index) => {
          const nextLibraryMeta = {
            ...getBeatLibraryMeta(beat),
            parentId: targetParentId,
            manualOrder: index + 1,
          };
          const nextPayload =
            beat?.payload && typeof beat.payload === "object"
              ? {
                  ...beat.payload,
                  libraryMeta: nextLibraryMeta,
                }
              : beat.payload;
          return [
            String(beat?.id || ""),
            {
              ...beat,
              payload: nextPayload,
              libraryMeta: nextLibraryMeta,
            },
          ];
        })
      );

      if (authUser?.id && hasSupabaseEnabled && supabase) {
        try {
          await updateCloudBeatRows({
            supabase,
            userId: authUser.id,
            updates: Array.from(updatedById.values())
              .filter((beat) => isUuidLike(beat?.id))
              .map((beat) => ({
                beatId: String(beat.id),
                patch: {
                  payload: beat.payload,
                  updated_at: new Date().toISOString(),
                },
              })),
          });
        } catch (error) {
          alert(error?.message || "Failed to reorder beats");
          return;
        }
      }

      setLocalBeatsWithUndo((prev) =>
        prev.map((beat) => updatedById.get(String(beat?.id || "")) || beat)
      );
    },
    [authUser?.id, localBeats, setLocalBeatsWithUndo]
  );
  const beatLibraryOrderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );
  const beatLibraryMoveUpTargetRef = React.useRef(null);
  const beatLibraryTrashTargetRef = React.useRef(null);
  const beatLibraryFolderExpandTimerRef = React.useRef(null);
  const beatLibraryPendingExpandFolderIdRef = React.useRef(null);
  const clearBeatLibraryFolderExpandTimer = React.useCallback(() => {
    if (beatLibraryFolderExpandTimerRef.current) {
      window.clearTimeout(beatLibraryFolderExpandTimerRef.current);
      beatLibraryFolderExpandTimerRef.current = null;
    }
    beatLibraryPendingExpandFolderIdRef.current = null;
  }, []);
  const scheduleBeatLibraryFolderExpand = React.useCallback(
    (containerId, shouldExpand) => {
      const key = String(containerId || "");
      if (!shouldExpand || !key) {
        clearBeatLibraryFolderExpandTimer();
        return;
      }
      if (beatLibraryPendingExpandFolderIdRef.current === key) return;
      clearBeatLibraryFolderExpandTimer();
      beatLibraryPendingExpandFolderIdRef.current = key;
      beatLibraryFolderExpandTimerRef.current = window.setTimeout(() => {
        setBeatLibraryContainers((prev) =>
          prev.map((entry) =>
            String(entry.id || "") === key && entry.collapsed
              ? { ...entry, collapsed: false }
              : entry
          )
        );
        beatLibraryFolderExpandTimerRef.current = null;
        beatLibraryPendingExpandFolderIdRef.current = null;
      }, 350);
    },
    [clearBeatLibraryFolderExpandTimer]
  );
  const detectBeatLibraryDropCollision = React.useCallback((args) => {
    const pointer = args?.pointerCoordinates;
    const topEl = beatLibraryMoveUpTargetRef.current;
    if (pointer && topEl) {
      const rect = topEl.getBoundingClientRect();
      if (
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      ) {
        const topContainer = args?.droppableContainers?.find(
          (entry) => String(entry?.id || "") === "__up__"
        );
        if (topContainer) {
          return [{ id: "__up__", data: { droppableContainer: topContainer, value: Number.MAX_SAFE_INTEGER } }];
        }
      }
    }
    const trashEl = beatLibraryTrashTargetRef.current;
    if (pointer && trashEl) {
      const rect = trashEl.getBoundingClientRect();
      if (
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      ) {
        const trashContainer = args?.droppableContainers?.find(
          (entry) => String(entry?.id || "") === "__trash__"
        );
        if (trashContainer) {
          return [{ id: "__trash__", data: { droppableContainer: trashContainer, value: Number.MAX_SAFE_INTEGER } }];
        }
      }
    }
    const pointerHits = pointerWithin(args);
    const topHit = pointerHits.find((entry) => String(entry?.id || "") === "__up__");
    if (topHit) return [topHit];
    const trashHit = pointerHits.find((entry) => String(entry?.id || "") === "__trash__");
    if (trashHit) return [trashHit];
    return closestCenter(args);
  }, []);
  const handleBeatLibrarySortDragStart = React.useCallback((event) => {
    const activeId = String(event?.active?.id || "");
    if (!activeId.startsWith("beat:")) return;
    const beatId = activeId.slice(5);
    const selectedIds = selectedBeatLibraryBeatIds.includes(beatId)
      ? visibleLocalBeatIdsInLibraryOrderRef.current.filter((id) => selectedBeatLibraryBeatIds.includes(id))
      : [beatId];
    beatLibraryTreeDragRef.current = {
      kind: "beat",
      beatId,
      beatIds: selectedIds,
    };
    setActiveBeatLibraryDragBeatId(beatId);
    beatLibraryLastHoverTargetRef.current = "";
    beatLibraryLastBeatOverIdRef.current = "";
    clearBeatLibraryFolderExpandTimer();
  }, [clearBeatLibraryFolderExpandTimer, selectedBeatLibraryBeatIds]);
  const handleBeatLibrarySortDragOver = React.useCallback((event) => {
    const overId = String(event?.over?.id || "");
    if (overId.startsWith("beat:")) beatLibraryLastBeatOverIdRef.current = overId.slice(5);
    setBeatLibraryDropTargetId(overId || null);
  }, []);
  const handleBeatLibrarySortDragEnd = React.useCallback(async (event) => {
    const activeId = String(event?.active?.id || "");
    const overId = String(event?.over?.id || "");
    const dragged = beatLibraryTreeDragRef.current;
    beatLibraryTreeDragRef.current = null;
    setActiveBeatLibraryDragBeatId(null);
    beatLibraryLastHoverTargetRef.current = "";
    beatLibraryLastBeatOverIdRef.current = "";
    setBeatLibraryDropTargetId(null);
    clearBeatLibraryFolderExpandTimer();
    if (!activeId.startsWith("beat:") || !overId) return;
    const draggedBeatId = activeId.slice(5);
    const draggedBeatIds =
      dragged?.kind === "beat" && Array.isArray(dragged?.beatIds)
        ? dragged.beatIds
        : [draggedBeatId];
    if (overId === "__trash__") {
      await deleteLocalBeatsByIds(draggedBeatIds);
      return;
    }
    if (overId === "__up__") {
      const selectedContainer =
        selectedBeatLibraryContainerId === "all"
          ? null
          : beatLibraryContainers.find(
              (entry) => String(entry.id || "") === String(selectedBeatLibraryContainerId || "")
            ) || null;
      const targetParentId = selectedContainer?.parentId ? String(selectedContainer.parentId) : null;
      await moveBeatsToLibraryContainer(draggedBeatIds, targetParentId);
      return;
    }
    if (overId === "all") {
      await moveBeatsToLibraryContainer(draggedBeatIds, null);
      return;
    }
    if (overId.startsWith("beat:")) {
      const targetBeatId = overId.slice(5);
      if (draggedBeatId === targetBeatId) return;
      await reorderBeatInLibrary(draggedBeatId, targetBeatId);
      return;
    }
    await moveBeatsToLibraryContainer(draggedBeatIds, overId);
  }, [beatLibraryContainers, clearBeatLibraryFolderExpandTimer, deleteLocalBeatsByIds, moveBeatsToLibraryContainer, reorderBeatInLibrary, selectedBeatLibraryContainerId]);
  const handleBeatLibrarySortDragCancel = React.useCallback(() => {
    beatLibraryTreeDragRef.current = null;
    setActiveBeatLibraryDragBeatId(null);
    beatLibraryLastHoverTargetRef.current = "";
    beatLibraryLastBeatOverIdRef.current = "";
    setBeatLibraryDropTargetId(null);
    clearBeatLibraryFolderExpandTimer();
  }, [clearBeatLibraryFolderExpandTimer]);
  const moveBeatLibraryContainer = React.useCallback(
    (containerId, targetParentId) => {
      const key = String(containerId || "");
      if (!key) return;
      const normalizedTargetParentId = targetParentId ? String(targetParentId) : null;
      if (normalizedTargetParentId === key) return;
      const descendantIds = new Set([key]);
      const walk = (parentId) => {
        beatLibraryContainers.forEach((entry) => {
          if (String(entry.parentId || "") !== String(parentId)) return;
          descendantIds.add(String(entry.id));
          walk(entry.id);
        });
      };
      walk(key);
      if (normalizedTargetParentId && descendantIds.has(normalizedTargetParentId)) return;
      setBeatLibraryContainers((prev) =>
        prev.map((entry) =>
          String(entry.id) === key
            ? {
                ...entry,
                parentId: normalizedTargetParentId,
              }
            : entry
        )
      );
    },
    [beatLibraryContainers]
  );
  const handleBeatLibraryTreeDrop = React.useCallback(
    async (targetParentId) => {
      const dragged = beatLibraryTreeDragRef.current;
      beatLibraryTreeDragRef.current = null;
      beatLibraryLastHoverTargetRef.current = "";
      beatLibraryLastBeatOverIdRef.current = "";
      setBeatLibraryDropTargetId(null);
      clearBeatLibraryFolderExpandTimer();
      if (!dragged || typeof dragged !== "object") return;
      const normalizedTargetParentId = targetParentId ? String(targetParentId) : null;
      if (dragged.kind === "container") {
        moveBeatLibraryContainer(dragged.containerId, normalizedTargetParentId);
        return;
      }
      if (dragged.kind === "beat") {
        await moveBeatsToLibraryContainer(
          Array.isArray(dragged.beatIds) && dragged.beatIds.length ? dragged.beatIds : [dragged.beatId],
          normalizedTargetParentId
        );
      }
    },
    [clearBeatLibraryFolderExpandTimer, moveBeatLibraryContainer, moveBeatsToLibraryContainer]
  );
  const handleBeatLibraryBeatDrop = React.useCallback(
    async (targetBeatId) => {
      const dragged = beatLibraryTreeDragRef.current;
      beatLibraryTreeDragRef.current = null;
      beatLibraryLastHoverTargetRef.current = "";
      setBeatLibraryDropTargetId(null);
      if (!dragged || typeof dragged !== "object") return;
      if (dragged.kind === "beat") {
        await reorderBeatInLibrary(dragged.beatId, targetBeatId);
      }
    },
    [reorderBeatInLibrary]
  );
  const handleBeatLibraryTrashDrop = React.useCallback(async () => {
    const dragged = beatLibraryTreeDragRef.current;
    beatLibraryTreeDragRef.current = null;
    setBeatLibraryDropTargetId(null);
    if (!dragged || typeof dragged !== "object") return;
    if (dragged.kind === "container") {
      await deleteBeatLibraryContainerWithContents(dragged.containerId);
      return;
    }
    if (dragged.kind === "beat") {
      await deleteLocalBeatsByIds(
        Array.isArray(dragged.beatIds) && dragged.beatIds.length ? dragged.beatIds : [dragged.beatId]
      );
    }
  }, [deleteBeatLibraryContainerWithContents, deleteLocalBeatsByIds]);
  const libraryBpmValues = React.useMemo(() => {
    const source = arrangementSourceTab === "public" ? publicBeats : localBeats;
    const values = source
      .map((beat) => getBeatBpm(beat))
      .filter((v) => Number.isFinite(v))
      .map((v) => Math.round(v));
    return Array.from(new Set(values)).sort((a, b) => a - b);
  }, [arrangementSourceTab, publicBeats, localBeats, getBeatBpm]);
  const stepLibraryBpmTarget = React.useCallback(
    (delta) => {
      const direction = delta >= 0 ? 1 : -1;
      const values = libraryBpmValues;
      if (!values.length) return;
      setLibraryBpmTarget((prev) => {
        if (direction > 0) {
          const higher = values.find((v) => v > prev);
          return higher ?? values[values.length - 1];
        }
        for (let i = values.length - 1; i >= 0; i--) {
          if (values[i] < prev) return values[i];
        }
        return values[0];
      });
    },
    [libraryBpmValues]
  );
  const getBpmFilterLabel = React.useCallback(() => {
    if (libraryBpmFilterMode === "any") return "Any";
    if (libraryBpmFilterMode === "exact") return `${libraryBpmTarget}`;
    if (libraryBpmFilterMode === "pm5") return `${libraryBpmTarget}±5`;
    if (libraryBpmFilterMode === "pm10") return `${libraryBpmTarget}±10`;
    return "Any";
  }, [libraryBpmFilterMode, libraryBpmTarget]);
  const libraryBpmRepeatRef = React.useRef({ timer: null, interval: null });
  const stopLibraryBpmRepeat = React.useCallback(() => {
    const r = libraryBpmRepeatRef.current;
    if (r.timer) window.clearTimeout(r.timer);
    if (r.interval) window.clearInterval(r.interval);
    r.timer = null;
    r.interval = null;
  }, []);
  const startLibraryBpmRepeat = React.useCallback(
    (delta) => {
      stopLibraryBpmRepeat();
      stepLibraryBpmTarget(delta);
      libraryBpmRepeatRef.current.timer = window.setTimeout(() => {
        libraryBpmRepeatRef.current.interval = window.setInterval(
          () => stepLibraryBpmTarget(delta),
          50
        );
      }, 130);
    },
    [stopLibraryBpmRepeat, stepLibraryBpmTarget]
  );
  useEffect(() => () => stopLibraryBpmRepeat(), [stopLibraryBpmRepeat]);
  const allTimeSigCategories = React.useMemo(() => {
    const fromLocal = localBeats.map((b) => String(b?.timeSigCategory || "")).filter(Boolean);
    const fromPublic = publicBeats.map((b) => String(b?.timeSigCategory || "")).filter(Boolean);
    return Array.from(new Set([...fromLocal, ...fromPublic])).sort();
  }, [localBeats, publicBeats]);
  const selectedBeatLibraryContainer = React.useMemo(
    () =>
      selectedBeatLibraryContainerId === "all"
        ? null
        : beatLibraryContainers.find((entry) => entry.id === selectedBeatLibraryContainerId) || null,
    [beatLibraryContainers, selectedBeatLibraryContainerId]
  );
  const selectedBeatLibraryContainerPath = React.useMemo(() => {
    if (!selectedBeatLibraryContainer) return [];
    const byId = new Map(beatLibraryContainers.map((entry) => [String(entry.id), entry]));
    const path = [];
    let current = selectedBeatLibraryContainer;
    while (current) {
      path.unshift(current);
      const parentId = current.parentId ? String(current.parentId) : "";
      current = parentId ? byId.get(parentId) || null : null;
    }
    return path;
  }, [beatLibraryContainers, selectedBeatLibraryContainer]);
  const beatLibraryImmediateParentEntry = React.useMemo(() => {
    if (selectedBeatLibraryContainerPath.length < 2) return null;
    return selectedBeatLibraryContainerPath[selectedBeatLibraryContainerPath.length - 2] || null;
  }, [selectedBeatLibraryContainerPath]);
  const beatLibraryCurrentEntry = React.useMemo(() => {
    if (!selectedBeatLibraryContainerPath.length) return null;
    return selectedBeatLibraryContainerPath[selectedBeatLibraryContainerPath.length - 1] || null;
  }, [selectedBeatLibraryContainerPath]);
  const renderBeatLibraryBreadcrumb = React.useCallback((variant = "docked") => {
    const isFloatingVariant = variant === "floating";
    const currentName = String(beatLibraryCurrentEntry?.name || "");
    const currentLabel = beatLibraryCurrentEntry
      ? truncatePrefixToLastText(currentName, isFloatingVariant ? 10 : 9, 3, 3)
      : "All beats";
    const currentFitsFully = !beatLibraryCurrentEntry || currentLabel === currentName;
    const parentMaxWidthClass = currentFitsFully
      ? isFloatingVariant
        ? "max-w-[5rem]"
        : "max-w-[4.1rem]"
      : isFloatingVariant
        ? "max-w-[3.5rem]"
        : "max-w-[2.85rem]";
    const parentLabel = truncateToLastText(
      beatLibraryImmediateParentEntry ? beatLibraryImmediateParentEntry.name : "All beats",
      currentFitsFully ? (isFloatingVariant ? 11 : 10) : isFloatingVariant ? 9 : 8,
      currentFitsFully ? (isFloatingVariant ? 7 : 6) : isFloatingVariant ? 5 : 4
    );
    const parentDropId = beatLibraryImmediateParentEntry ? String(beatLibraryImmediateParentEntry.id) : "all";
    return (
      <div className="min-w-0 overflow-hidden text-[11px] text-neutral-500">
        <div className="flex min-w-0 items-center gap-0.5 whitespace-nowrap">
          {!beatLibraryCurrentEntry ? (
            <button
              type="button"
              onClick={() => selectBeatLibraryContainer("all")}
              onDragOver={(e) => {
                if (beatLibraryTreeDragRef.current?.kind === "container") return;
                e.preventDefault();
                setBeatLibraryDropTargetId("all");
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              }}
              onDragLeave={() => {
                if (beatLibraryTreeDragRef.current?.kind === "container") return;
                setBeatLibraryDropTargetId((prev) => (prev === "all" ? null : prev));
              }}
              onDrop={(e) => {
                if (beatLibraryTreeDragRef.current?.kind === "container") return;
                e.preventDefault();
                e.stopPropagation();
                handleBeatLibraryTreeDrop(null);
              }}
              className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap rounded-sm px-0 py-0 text-left hover:text-neutral-300 ${
                beatLibraryDropTargetId === "all"
                  ? "text-cyan-100 border-b border-cyan-400/70"
                  : selectedBeatLibraryContainerId === "all"
                    ? "text-neutral-400"
                    : ""
              }`}
              title="All beats"
            >
              <span className="block truncate">All beats</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => selectBeatLibraryContainer(parentDropId)}
                onDragOver={(e) => {
                  if (beatLibraryTreeDragRef.current?.kind === "container") return;
                  e.preventDefault();
                  setBeatLibraryDropTargetId(parentDropId);
                  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={() => {
                  if (beatLibraryTreeDragRef.current?.kind === "container") return;
                  setBeatLibraryDropTargetId((prev) => (prev === parentDropId ? null : prev));
                }}
                onDrop={(e) => {
                  if (beatLibraryTreeDragRef.current?.kind === "container") return;
                  e.preventDefault();
                  e.stopPropagation();
                  handleBeatLibraryTreeDrop(beatLibraryImmediateParentEntry ? beatLibraryImmediateParentEntry.id : null);
                }}
                title={String(beatLibraryImmediateParentEntry?.name || "All beats")}
                className={`${parentMaxWidthClass} min-w-0 shrink overflow-hidden whitespace-nowrap rounded-sm px-0 py-0 text-left hover:text-neutral-300 ${
                  beatLibraryDropTargetId === parentDropId
                    ? "bg-cyan-900/25 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                    : ""
                }`}
              >
                <span className="block overflow-hidden text-clip whitespace-nowrap">{parentLabel}</span>
              </button>
              <span className="shrink-0 px-0.5 text-neutral-600">/</span>
              <button
                type="button"
                onClick={() => selectBeatLibraryContainer(beatLibraryCurrentEntry.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setBeatLibraryDropTargetId(String(beatLibraryCurrentEntry.id));
                  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={() =>
                  setBeatLibraryDropTargetId((prev) =>
                    prev === String(beatLibraryCurrentEntry.id) ? null : prev
                  )
                }
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBeatLibraryTreeDrop(beatLibraryCurrentEntry.id);
                }}
                title={String(beatLibraryCurrentEntry.name || "")}
                className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap rounded-sm px-0 py-0 text-left hover:text-neutral-300 ${
                  beatLibraryDropTargetId === String(beatLibraryCurrentEntry.id)
                    ? "bg-cyan-900/25 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                    : "text-neutral-400"
                }`}
              >
                <span className="block overflow-hidden pr-0.5 text-clip whitespace-nowrap">{currentLabel}</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }, [
    beatLibraryCurrentEntry,
    beatLibraryDropTargetId,
    beatLibraryImmediateParentEntry,
    handleBeatLibraryTreeDrop,
    selectBeatLibraryContainer,
    selectedBeatLibraryContainerId,
  ]);
  const beatLibraryContainerChildren = React.useMemo(() => {
    const byParent = new Map();
    [...beatLibraryContainers]
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || a.name.localeCompare(b.name))
      .forEach((entry) => {
        const key = entry.parentId || "__root__";
        const list = byParent.get(key) || [];
        list.push(entry);
        byParent.set(key, list);
      });
    return byParent;
  }, [beatLibraryContainers]);
  const beatLibraryVisibleContainers = React.useMemo(() => {
    const out = [];
    const walk = (parentId, depth) => {
      const entries = beatLibraryContainerChildren.get(parentId || "__root__") || [];
      entries.forEach((entry) => {
        out.push({ ...entry, depth });
        if (!entry.collapsed) walk(entry.id, depth + 1);
      });
    };
    walk(null, 0);
    return out;
  }, [beatLibraryContainerChildren]);
  const beatLibraryDescendantIds = React.useMemo(() => {
    if (!selectedBeatLibraryContainerId || selectedBeatLibraryContainerId === "all") return null;
    const ids = new Set([selectedBeatLibraryContainerId]);
    const walk = (parentId) => {
      const entries = beatLibraryContainerChildren.get(parentId) || [];
      entries.forEach((entry) => {
        ids.add(entry.id);
        walk(entry.id);
      });
    };
    walk(selectedBeatLibraryContainerId);
    return ids;
  }, [beatLibraryContainerChildren, selectedBeatLibraryContainerId]);
  const filteredLocalBeats = React.useMemo(() => {
    const list = localBeats.filter((beat) => {
      if (libraryTimeSigFilter !== "all" && beat?.timeSigCategory !== libraryTimeSigFilter) return false;
      if (beatStyleDraft !== "all" && String(beat?.style || "") !== beatStyleDraft) return false;
      if (beatCategoryDraft !== "all" && String(beat?.category || "") !== beatCategoryDraft) return false;
      if (!bpmPassesLibraryFilter(getBeatBpm(beat))) return false;
      return true;
    });
    const byTime = (a, b) =>
      new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime();
    const byBpm = (a, b) => (getBeatBpm(a) ?? -1) - (getBeatBpm(b) ?? -1);
    return [...list].sort((a, b) => {
      if (librarySort === "oldest") return byTime(a, b);
      if (librarySort === "bpm-asc") return byBpm(a, b);
      if (librarySort === "bpm-desc") return byBpm(b, a);
      return byTime(b, a);
    });
  }, [
    localBeats,
    libraryTimeSigFilter,
    beatStyleDraft,
    beatCategoryDraft,
    librarySort,
    getBeatBpm,
    bpmPassesLibraryFilter,
  ]);
  const filteredPublicBeats = React.useMemo(() => {
    const list = publicBeats.filter((beat) => {
      if (libraryTimeSigFilter !== "all" && beat?.timeSigCategory !== libraryTimeSigFilter) return false;
      if (beatStyleDraft !== "all" && String(beat?.style || "") !== beatStyleDraft) return false;
      if (beatCategoryDraft !== "all" && String(beat?.category || "") !== beatCategoryDraft) return false;
      if (!bpmPassesLibraryFilter(getBeatBpm(beat))) return false;
      return true;
    });
    const byTime = (a, b) =>
      new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime();
    const byBpm = (a, b) => (getBeatBpm(a) ?? -1) - (getBeatBpm(b) ?? -1);
    return [...list].sort((a, b) => {
      if (librarySort === "oldest") return byTime(a, b);
      if (librarySort === "bpm-asc") return byBpm(a, b);
      if (librarySort === "bpm-desc") return byBpm(b, a);
      return byTime(b, a);
    });
  }, [
    publicBeats,
    libraryTimeSigFilter,
    beatStyleDraft,
    beatCategoryDraft,
    librarySort,
    getBeatBpm,
    bpmPassesLibraryFilter,
  ]);
  const currentBeatLibraryParentId = selectedBeatLibraryContainerId !== "all" ? String(selectedBeatLibraryContainerId) : null;
  const currentBeatLibraryUpperParentId = React.useMemo(
    () => (selectedBeatLibraryContainer?.parentId ? String(selectedBeatLibraryContainer.parentId) : null),
    [selectedBeatLibraryContainer]
  );
  const currentBeatLibraryFolders = React.useMemo(
    () =>
      beatLibraryContainers.filter(
        (entry) => String(entry.parentId || "") === String(currentBeatLibraryParentId || "")
      ),
    [beatLibraryContainers, currentBeatLibraryParentId]
  );
  const visibleLocalBeatIdsInLibraryOrder = React.useMemo(() => {
    const walk = (parentId) => {
      const ids = [];
      const childBeats = filteredLocalBeats
        .filter((beat) => String(getBeatLibraryMeta(beat).parentId || "") === String(parentId || ""))
        .sort(compareBeatLibraryOrder);
      childBeats.forEach((beat) => {
        ids.push(String(beat?.id || ""));
      });
      const childFolders = beatLibraryContainers
        .filter((entry) => String(entry.parentId || "") === String(parentId || ""))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || a.name.localeCompare(b.name));
      childFolders.forEach((entry) => {
        if (!entry.collapsed) {
          ids.push(...walk(entry.id));
        }
      });
      return ids;
    };
    return walk(currentBeatLibraryParentId);
  }, [beatLibraryContainers, currentBeatLibraryParentId, filteredLocalBeats]);
  const allLocalBeatIdsInLibraryOrder = React.useMemo(() => {
    const walk = (parentId) => {
      const ids = [];
      const childBeats = filteredLocalBeats
        .filter((beat) => String(getBeatLibraryMeta(beat).parentId || "") === String(parentId || ""))
        .sort(compareBeatLibraryOrder);
      childBeats.forEach((beat) => {
        ids.push(String(beat?.id || ""));
      });
      const childFolders = beatLibraryContainers
        .filter((entry) => String(entry.parentId || "") === String(parentId || ""))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || a.name.localeCompare(b.name));
      childFolders.forEach((entry) => {
        ids.push(...walk(entry.id));
      });
      return ids;
    };
    return walk(null);
  }, [beatLibraryContainers, filteredLocalBeats]);
  useEffect(() => {
    visibleLocalBeatIdsInLibraryOrderRef.current = visibleLocalBeatIdsInLibraryOrder;
  }, [visibleLocalBeatIdsInLibraryOrder]);
  useEffect(() => {
    if (!isCurrentBeatStripRenaming) return;
    const input = currentBeatStripNameInputRef.current;
    if (!(input instanceof HTMLInputElement)) return;
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }, [isCurrentBeatStripRenaming]);
  useEffect(() => {
    if (!pendingCurrentBeatStripAutoRename || isCurrentBeatStripRenaming) return;
    const button = currentBeatStripNameButtonRef.current;
    if (!(button instanceof HTMLElement)) return;
    const frame = window.requestAnimationFrame(() => {
      const width = Math.ceil(button.getBoundingClientRect().width);
      setCurrentBeatStripRenameWidth(width > 0 ? width : null);
      setIsCurrentBeatStripRenaming(true);
      setPendingCurrentBeatStripAutoRename(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [beatNameDraft, loadedLocalBeatId, isCurrentBeatStripRenaming, pendingCurrentBeatStripAutoRename]);
  const handleBeatLibraryBeatSelect = React.useCallback(
    async (beat, extend = false) => {
      const beatId = String(beat?.id || "");
      if (!beatId) return;
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
      setCurrentArrangementEditorBeatKey("");
      if (extend && beatLibraryBeatSelectionAnchorId) {
        const anchorIndex = visibleLocalBeatIdsInLibraryOrder.findIndex(
          (id) => id === String(beatLibraryBeatSelectionAnchorId || "")
        );
        const targetIndex = visibleLocalBeatIdsInLibraryOrder.findIndex((id) => id === beatId);
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          setSelectedBeatLibraryBeatIds(visibleLocalBeatIdsInLibraryOrder.slice(start, end + 1));
          setBeatLibraryBeatSelectionAnchorId(beatId);
          await loadBeatIntoEditorRef.current?.("local", beat);
          return;
        }
      }
      setSelectedBeatLibraryBeatIds([beatId]);
      setBeatLibraryBeatSelectionAnchorId(beatId);
      await loadBeatIntoEditorRef.current?.("local", beat);
    },
    [
      beatLibraryBeatSelectionAnchorId,
      visibleLocalBeatIdsInLibraryOrder,
      setArrangementSelection,
      setArrangementSelectionAnchor,
      setArrangementBarSelection,
      setArrangementBarSelectionAnchor,
    ]
  );
  const handlePublicBeatSelect = React.useCallback(
    async (beat) => {
      if (!beat?.id) return;
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
      setCurrentArrangementEditorBeatKey("");
      await loadBeatIntoEditorRef.current?.("public", beat);
    },
    []
  );
  const currentBeatLibraryBeats = React.useMemo(
    () =>
      filteredLocalBeats
        .filter((beat) => {
          const direct = beat?.libraryMeta && typeof beat.libraryMeta === "object" ? beat.libraryMeta : null;
          const payloadMeta =
            beat?.payload?.libraryMeta && typeof beat.payload.libraryMeta === "object"
              ? beat.payload.libraryMeta
              : null;
          const meta = direct || payloadMeta || null;
          return String(meta?.parentId || "") === String(currentBeatLibraryParentId || "");
        })
        .sort(compareBeatLibraryOrder),
    [filteredLocalBeats, currentBeatLibraryParentId]
  );
  const getBeatBySourceRef = React.useCallback(
    (source, beatId) => {
      const list = source === "public" ? publicBeats : source === "shared" ? sharedArrangementBeats : localBeats;
      return list.find((b) => String(b?.id || "") === String(beatId || "")) || null;
    },
    [publicBeats, sharedArrangementBeats, localBeats]
  );
  const arrangementRows = React.useMemo(() => {
    const currentGlobalPrintStickingMode =
      !showNotationSticking
        ? "off"
        : notationStickingSelectionModeEnabled
          ? "custom"
          : notationStickingModePreference === "all"
            ? "all"
            : "custom";
    const rows = arrangementItems.map((item) => {
      const beat = getBeatBySourceRef(item.source, item.beatId);
      const beatBars = Math.max(1, Number(beat?.payload?.bars) || 1);
      const beatTimeSig = beat?.timeSigCategory || "4/4";
      const beatBpm = getBeatBpm(beat);
      const [nRaw, dRaw] = String(beatTimeSig).split("/");
      const n = Math.max(1, Number(nRaw) || 4);
      const d = Math.max(1, Number(dRaw) || 4);
      const barSeconds = beatBpm ? (60 / beatBpm) * ((n * 4) / d) : 0;
      return {
        ...item,
        beat,
        beatBars,
        beatTimeSig,
        beatBpm,
        sectionBars: beatBars * item.repeats,
        sectionSeconds: barSeconds * beatBars * item.repeats,
        showNotationBeatName: Boolean(item?.showNotationBeatName),
        notationCustomText: String(item?.notationCustomText || ""),
        notationDynamicSpacingCustom: item?.notationDynamicSpacingCustom === true,
        notationDynamicSpacingOverride:
          typeof item?.notationDynamicSpacingOverride === "boolean"
            ? item.notationDynamicSpacingOverride
            : (typeof item?.notationDynamicSpacing === "boolean" ? item.notationDynamicSpacing : null),
        notationJoinWithNext: Boolean(item?.notationJoinWithNext),
        notationBarsPerRowCustom: item?.notationBarsPerRowCustom === true,
        notationBarsPerRowOverride: Number.isFinite(Number(item?.notationBarsPerRowOverride))
          ? Math.max(1, Math.min(4, Math.round(Number(item.notationBarsPerRowOverride))))
          : null,
        notationSpacingPreset:
          item?.notationSpacingPreset === "large" ||
          item?.notationSpacingPreset === "tight"
            ? item.notationSpacingPreset
            : "normal",
        notationMergeRestsCustom: item?.notationMergeRestsCustom === true,
        notationMergeRestsOverride:
          typeof item?.notationMergeRestsOverride === "boolean" ? item.notationMergeRestsOverride : null,
        notationMergeNotesCustom: item?.notationMergeNotesCustom === true,
        notationMergeNotesOverride:
          typeof item?.notationMergeNotesOverride === "boolean" ? item.notationMergeNotesOverride : null,
        notationDottedNotesCustom: item?.notationDottedNotesCustom === true,
        notationDottedNotesOverride:
          typeof item?.notationDottedNotesOverride === "boolean" ? item.notationDottedNotesOverride : null,
        notationPrintStickingCustom: item?.notationPrintStickingCustom === true,
        notationPrintStickingFollowBeat: item?.notationPrintStickingFollowBeat === true,
        notationPrintStickingOverride:
          typeof item?.notationPrintStickingOverride === "boolean" ? item.notationPrintStickingOverride : null,
        notationPrintStickingModeOverride:
          item?.notationPrintStickingModeOverride === "all" || item?.notationPrintStickingModeOverride === "custom"
            ? item.notationPrintStickingModeOverride
            : null,
      };
    });
    let runningBarNumber = 1;
    let carryBarsRemaining = 0;
    return rows.map((row) => {
      const effectiveBarsPerRow = row?.notationBarsPerRowCustom &&
        Number.isFinite(Number(row?.notationBarsPerRowOverride))
        ? Math.max(1, Math.min(4, Math.round(Number(row.notationBarsPerRowOverride))))
        : arrangementNotationBarsPerRow;
      const effectiveDynamicSpacing =
        row?.notationDynamicSpacingCustom === true && typeof row?.notationDynamicSpacingOverride === "boolean"
          ? row.notationDynamicSpacingOverride
          : arrangementNotationDynamicSpacing;
      const effectiveMergeRests =
        row?.notationMergeRestsCustom === true && typeof row?.notationMergeRestsOverride === "boolean"
          ? row.notationMergeRestsOverride
          : row?.notationMergeRestsFollowBeat === true && typeof row?.beat?.payload?.mergeRests === "boolean"
            ? row.beat.payload.mergeRests
          : arrangementNotationGlobalMergeRests;
      const effectiveMergeNotes =
        row?.notationMergeNotesCustom === true && typeof row?.notationMergeNotesOverride === "boolean"
          ? row.notationMergeNotesOverride
          : row?.notationMergeNotesFollowBeat === true && typeof row?.beat?.payload?.mergeNotes === "boolean"
            ? row.beat.payload.mergeNotes
          : arrangementNotationGlobalMergeNotes;
      const effectiveDottedNotes =
        row?.notationDottedNotesCustom === true && typeof row?.notationDottedNotesOverride === "boolean"
          ? row.notationDottedNotesOverride
          : row?.notationDottedNotesFollowBeat === true && typeof row?.beat?.payload?.dottedNotes === "boolean"
            ? row.beat.payload.dottedNotes
          : arrangementNotationGlobalDottedNotes;
      const effectivePrintStickingMode =
        row?.notationPrintStickingCustom === true
          ? row?.notationPrintStickingOverride === false
            ? "off"
            : row?.notationPrintStickingModeOverride === "all"
              ? "all"
              : "custom"
          : row?.notationPrintStickingFollowBeat === true
            ? getNotationPrintStickingModeFromPayload(row?.beat?.payload, currentGlobalPrintStickingMode)
          : currentGlobalPrintStickingMode;
      const effectivePrintSticking = effectivePrintStickingMode !== "off";
      const sectionBars = Math.max(1, Number(row?.sectionBars) || 1);
      const controlDisabled = carryBarsRemaining > 0 && carryBarsRemaining >= sectionBars;
      const nextRow = {
        ...row,
        startBarNumber: runningBarNumber,
        notationBarsPerRowControlDisabled: controlDisabled,
        notationDynamicSpacingEffective: effectiveDynamicSpacing,
        notationMergeRestsEffective: effectiveMergeRests,
        notationMergeNotesEffective: effectiveMergeNotes,
        notationDottedNotesEffective: effectiveDottedNotes,
        notationPrintStickingEffective: effectivePrintSticking,
        notationPrintStickingModeEffective: effectivePrintStickingMode,
      };
      runningBarNumber += sectionBars;
      if (controlDisabled) {
        carryBarsRemaining = Math.max(0, carryBarsRemaining - sectionBars);
      } else {
        carryBarsRemaining = Math.max(0, effectiveBarsPerRow - sectionBars);
      }
      return nextRow;
    });
  }, [arrangementItems, getBeatBySourceRef, getBeatBpm, arrangementNotationBarsPerRow, arrangementNotationDynamicSpacing, arrangementNotationGlobalMergeRests, arrangementNotationGlobalMergeNotes, arrangementNotationGlobalDottedNotes, showNotationSticking, notationStickingSelectionModeEnabled, notationStickingModePreference]);
  const getArrangementNotationLabel = React.useCallback((row) => {
    const customText = String(row?.notationCustomText || "").trim();
    if (customText) return customText;
    if (row?.showNotationBeatName) return String(row?.beat?.name || "Untitled Beat");
    return "";
  }, []);
  const arrangementGlobalNotationStickingMode = React.useMemo(() => {
    if (!showNotationSticking) return "off";
    if (notationStickingModePreference === "all") return "all";
    if (notationStickingSelectionModeEnabled) return "custom";
    return notationStickingModePreference === "off" ? "off" : "custom";
  }, [
    showNotationSticking,
    notationStickingModePreference,
    notationStickingSelectionModeEnabled,
  ]);
  const arrangementNotationSections = React.useMemo(() => {
    const out = [];
    let globalBarOffset = 0;
    let prevBpm = null;
    arrangementRows.forEach((row, idx) => {
      const rowPrintStickingMode =
        row?.notationPrintStickingModeEffective === "all"
          ? "all"
          : row?.notationPrintStickingModeEffective === "off"
            ? "off"
            : "custom";
      const currentBeatCustomSelection =
        row?.source === "local" &&
        String(row?.beat?.id || "") === String(loadedLocalBeatId || "")
          ? notationStickingSelection
          : undefined;
      const effectiveBeatPayload = buildEffectiveNotationPayloadFromBeat(row?.beat, {
        printStickingMode: rowPrintStickingMode,
        notationStickingSelection: currentBeatCustomSelection,
        showNotationSticking: row?.notationPrintStickingEffective === true,
      });
      const baseNotationState = buildNotationStateFromPayload(effectiveBeatPayload);
      const notationState = expandNotationStateForRepeats(baseNotationState, row?.repeats);
      if (!notationState) return;
      const stickingAssignments = computeStickingAssignmentsForNotationState(notationState, {
        stickingHandedness,
        stickingLeadHand,
        stickingKeepQuarterLeadHand,
      });
      const bpmNum = Number.isFinite(row?.beatBpm) ? Math.round(Number(row.beatBpm)) : null;
      const showTempoAtStart = bpmNum != null && (globalBarOffset === 0 || prevBpm !== bpmNum);
      const notationLabel = getArrangementNotationLabel(row);
      const effectiveBarsPerRow = row?.notationBarsPerRowCustom &&
        Number.isFinite(Number(row?.notationBarsPerRowOverride))
        ? Math.max(1, Math.min(4, Math.round(Number(row.notationBarsPerRowOverride))))
        : arrangementNotationBarsPerRow;
      const barsPerRow = getArrangementNotationRowBarCounts(
        notationState,
        arrangementNotationBarsPerRow,
        effectiveBarsPerRow
      );
      out.push({
        id: row.id || `${idx}`,
        index: idx,
        name: row?.beat?.name || "Untitled Beat",
        repeats: Math.max(1, Number(row?.repeats) || 1),
        beatBars: Math.max(1, Number(row?.beatBars) || 1),
        sectionBars: Math.max(1, Number(row?.sectionBars) || 1),
        beatTimeSig: row?.beatTimeSig || "4/4",
        beatBpm: row?.beatBpm,
        notation: notationState,
        stickingAssignments,
        startBarOffset: globalBarOffset,
        barsPerLine: Math.max(...barsPerRow),
        barsPerRow,
        notationJoinWithNext: row?.notationJoinWithNext === true,
        notationDynamicSpacingCustom: row?.notationDynamicSpacingCustom === true,
        notationDynamicSpacingOverride: row?.notationDynamicSpacingOverride ?? null,
        notationDynamicSpacing: row?.notationDynamicSpacingEffective === true,
        notationSpacingPreset: row?.notationSpacingPreset || "normal",
        notationMergeRestsCustom: row?.notationMergeRestsCustom === true,
        notationMergeRestsOverride: row?.notationMergeRestsOverride ?? null,
        notationMergeRests: row?.notationMergeRestsEffective === true,
        notationMergeNotesCustom: row?.notationMergeNotesCustom === true,
        notationMergeNotesOverride: row?.notationMergeNotesOverride ?? null,
        notationMergeNotes: row?.notationMergeNotesEffective === true,
        notationDottedNotesCustom: row?.notationDottedNotesCustom === true,
        notationDottedNotesOverride: row?.notationDottedNotesOverride ?? null,
        notationDottedNotes: row?.notationDottedNotesEffective === true,
        notationPrintStickingCustom: row?.notationPrintStickingCustom === true,
        notationPrintStickingOverride: row?.notationPrintStickingOverride ?? null,
        notationPrintStickingModeOverride: row?.notationPrintStickingModeOverride ?? null,
        notationPrintStickingMode: row?.notationPrintStickingModeEffective || "off",
        notationPrintSticking: row?.notationPrintStickingEffective === true,
        notationBarsPerRowCustom: row?.notationBarsPerRowCustom === true,
        notationBarsPerRowOverride: row?.notationBarsPerRowOverride ?? null,
        notationBarsPerRowEffective: effectiveBarsPerRow,
        sectionMarkers: notationLabel ? [{ bar: 0, text: notationLabel }] : [],
        tempoMarkers: showTempoAtStart ? [{ bar: 0, text: `♩ = ${bpmNum}` }] : [],
      });
      globalBarOffset += Math.max(1, Number(row?.sectionBars) || 1);
      prevBpm = bpmNum;
    });
    return out;
  }, [
    arrangementRows,
    stickingHandedness,
    stickingLeadHand,
    stickingKeepQuarterLeadHand,
    loadedLocalBeatId,
    notationStickingSelection,
    getArrangementNotationLabel,
    arrangementNotationBarsPerRow,
  ]);
  const arrangementNotationBlocks = React.useMemo(() => {
    const chunks = [];
    const buildMergedBlock = (sections, startBarOffset) => {
      const current = Array.isArray(sections) ? sections : [];
      if (!current.length) return null;
      const merged = mergeNotationStates(current.map((s) => s.notation));
      if (!merged) return null;
      const sectionMarkers = [];
      const tempoMarkers = [];
      const dynamicSpacingByBar = [];
      const spacingPresetByBar = [];
      const mergeRestsByBar = [];
      const mergeNotesByBar = [];
      const dottedNotesByBar = [];
      const showNotationStickingByBar = [];
      const exactBarsPerRow = [];
      let localBarCursor = 0;
      let carryBarsRemaining = 0;
      current.forEach((s) => {
        const localBar = Math.max(0, (s.startBarOffset || 0) - startBarOffset);
        (s.sectionMarkers || []).forEach((m) => {
          sectionMarkers.push({ bar: localBar + (Number(m?.bar) || 0), text: String(m?.text || "") });
        });
        (s.tempoMarkers || []).forEach((m) => {
          tempoMarkers.push({ bar: localBar + (Number(m?.bar) || 0), text: String(m?.text || "") });
        });
        for (let i = 0; i < Math.max(1, Number(s?.sectionBars) || 1); i++) {
          dynamicSpacingByBar[localBar + i] = s?.notationDynamicSpacing === true;
          spacingPresetByBar[localBar + i] = s?.notationSpacingPreset || "normal";
          mergeRestsByBar[localBar + i] = s?.notationMergeRests === true;
          mergeNotesByBar[localBar + i] = s?.notationMergeNotes === true;
          dottedNotesByBar[localBar + i] = s?.notationDottedNotes === true;
          showNotationStickingByBar[localBar + i] = s?.notationPrintSticking === true;
        }
        const forcedCount = Math.max(
          1,
          Math.min(4, Math.round(Number(s?.notationBarsPerRowEffective) || arrangementNotationBarsPerRow))
        );
        let remainingSectionBars = Math.max(1, Number(s?.sectionBars) || 1);
        while (remainingSectionBars > 0) {
          if (carryBarsRemaining > 0) {
            const consumed = Math.min(carryBarsRemaining, remainingSectionBars);
            carryBarsRemaining -= consumed;
            remainingSectionBars -= consumed;
            localBarCursor += consumed;
            continue;
          }
          const rowCount = Math.max(1, Math.min(forcedCount, (merged.bars || 0) - localBarCursor));
          exactBarsPerRow.push(rowCount);
          const consumed = Math.min(rowCount, remainingSectionBars);
          remainingSectionBars -= consumed;
          localBarCursor += consumed;
          carryBarsRemaining = Math.max(0, rowCount - consumed);
        }
      });
      const barsPerRow =
        exactBarsPerRow.length &&
        exactBarsPerRow.reduce((sum, value) => sum + value, 0) === Math.max(1, Number(merged.bars) || 1)
          ? exactBarsPerRow
          : getArrangementNotationRowBarCounts(merged, arrangementNotationBarsPerRow);
      return {
        ...merged,
        startBarOffset,
        barsPerRow,
        barsPerLine: Math.max(...barsPerRow),
        sectionMarkers,
        tempoMarkers,
        dynamicSpacingByBar,
        spacingPresetByBar,
        mergeRestsByBar,
        mergeNotesByBar,
        dottedNotesByBar,
        showNotationStickingByBar,
        blockSections: current,
        stickingAssignments: computeStickingAssignmentsForNotationState(merged, {
          stickingHandedness,
          stickingLeadHand,
          stickingKeepQuarterLeadHand,
        }),
      };
    };

    const unified = buildMergedBlock(
      arrangementNotationSections,
      arrangementNotationSections[0]?.startBarOffset || 0
    );
    return unified ? [unified] : [];
  }, [
    arrangementNotationSections,
    stickingHandedness,
    stickingLeadHand,
    stickingKeepQuarterLeadHand,
    arrangementNotationBarsPerRow,
  ]);
  const arrangementPlayableEntries = React.useMemo(() => {
    const out = [];
    arrangementRows.forEach((row, rowIndex) => {
      if (!row?.beat?.payload) return;
      const count = Math.max(1, Number(row.repeats) || 1);
      for (let i = 0; i < count; i++) out.push({ rowIndex, row, repeatIndex: i });
    });
    return out;
  }, [arrangementRows]);
  const normalizedArrangementSelection = React.useMemo(() => {
    if (!arrangementSelection) return null;
    const start = Math.max(0, Math.min(arrangementSelection.start, arrangementSelection.end));
    const end = Math.max(0, Math.max(arrangementSelection.start, arrangementSelection.end));
    if (start >= arrangementRows.length || end >= arrangementRows.length) return null;
    return { start, end };
  }, [arrangementSelection, arrangementRows.length]);
  const normalizedArrangementLoopSelection = React.useMemo(() => {
    if (!normalizedArrangementSelection) return null;
    return normalizedArrangementSelection.start === normalizedArrangementSelection.end
      ? null
      : normalizedArrangementSelection;
  }, [normalizedArrangementSelection]);
  const arrangementTotals = React.useMemo(() => {
    const totalBars = arrangementRows.reduce((sum, row) => sum + row.sectionBars, 0);
    const totalSeconds = arrangementRows.reduce((sum, row) => sum + row.sectionSeconds, 0);
    return { totalBars, totalSeconds };
  }, [arrangementRows]);
  const normalizedArrangementBarSelection = React.useMemo(() => {
    if (!arrangementBarSelection) return null;
    const maxBar = Math.max(0, arrangementTotals.totalBars - 1);
    const start = Math.max(0, Math.min(arrangementBarSelection.start, arrangementBarSelection.end));
    const end = Math.max(0, Math.max(arrangementBarSelection.start, arrangementBarSelection.end));
    if (start > maxBar || end > maxBar) return null;
    return { start, end };
  }, [arrangementBarSelection, arrangementTotals.totalBars]);
  const normalizedArrangementBarLoopSelection = React.useMemo(() => {
    if (!normalizedArrangementBarSelection) return null;
    return normalizedArrangementBarSelection.start === normalizedArrangementBarSelection.end
      ? null
      : normalizedArrangementBarSelection;
  }, [normalizedArrangementBarSelection]);
  const currentArrangementEditorBarRange = React.useMemo(() => {
    const beatKey = String(currentArrangementEditorBeatKey || "");
    if (!beatKey) return null;
    const row = arrangementRows.find(
      (entry) => `${String(entry?.source || "local")}:${String(entry?.beat?.id || "")}` === beatKey
    );
    if (!row) return null;
    const start = Math.max(0, Number(row.startBarNumber || 1) - 1);
    const count = Math.max(1, Number(row.sectionBars) || 1);
    return { start, end: start + count - 1 };
  }, [arrangementRows, currentArrangementEditorBeatKey]);
  const selectedArrangementSourceBeatKey = React.useMemo(() => {
    if (!normalizedArrangementSelection) return "";
    const row = arrangementRows[normalizedArrangementSelection.start];
    if (!row?.source || row?.beatId == null) return "";
    const source = row.source === "public" ? "public" : "local";
    return `${source}:${String(row.beatId)}`;
  }, [normalizedArrangementSelection, arrangementRows]);
  const clearArrangementSelection = React.useCallback(() => {
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
  }, []);
  const getArrangementRowBarRange = React.useCallback((rowIndex) => {
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= arrangementRows.length) return null;
    const row = arrangementRows[rowIndex];
    if (!row) return null;
    const start = Math.max(0, Number(row.startBarNumber || 1) - 1);
    const count = Math.max(1, Number(row.sectionBars) || 1);
    return { start, end: start + count - 1 };
  }, [arrangementRows]);
  const findArrangementRowIndexForBar = React.useCallback((barIndex) => {
    if (!Number.isFinite(barIndex) || barIndex < 0) return -1;
    return arrangementRows.findIndex((row) => {
      const start = Math.max(0, Number(row.startBarNumber || 1) - 1);
      const count = Math.max(1, Number(row.sectionBars) || 1);
      return barIndex >= start && barIndex < start + count;
    });
  }, [arrangementRows]);
  const activeArrangementPlayingRowIndex = React.useMemo(() => {
    const entry = arrangementPlayableEntries[arrangementPlaybackIndex];
    return Number.isFinite(entry?.rowIndex) ? entry.rowIndex : -1;
  }, [arrangementPlayableEntries, arrangementPlaybackIndex]);
  const buildArrangementRowNotationSeedFromBeat = React.useCallback((source, beatId, beatOverride = null) => {
    const beat = beatOverride || getBeatBySourceRef(source, beatId);
    const payload = beat?.payload && typeof beat.payload === "object" ? beat.payload : null;
    return {
      notationMergeRestsCustom: false,
      notationMergeRestsFollowBeat: typeof payload?.mergeRests === "boolean",
      notationMergeRestsOverride: null,
      notationMergeNotesCustom: false,
      notationMergeNotesFollowBeat: typeof payload?.mergeNotes === "boolean",
      notationMergeNotesOverride: null,
      notationDottedNotesCustom: false,
      notationDottedNotesFollowBeat: typeof payload?.dottedNotes === "boolean",
      notationDottedNotesOverride: null,
      notationPrintStickingFollowBeat: true,
    };
  }, [getBeatBySourceRef]);
  const arrangementAddBeat = React.useCallback((source, beatId, beatOverride = null) => {
    const normalizedSource = source === "public" ? "public" : "local";
    const normalizedBeatId = String(beatId);
    const notationSeed = buildArrangementRowNotationSeedFromBeat(normalizedSource, normalizedBeatId, beatOverride);
    setArrangementItemsWithUndo((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.source === normalizedSource &&
        String(last.beatId) === normalizedBeatId
      ) {
        return prev.map((row, idx) =>
          idx === prev.length - 1
            ? { ...row, repeats: Math.max(1, Math.min(64, (Number(row.repeats) || 1) + 1)) }
            : row
        );
      }
      return [
        ...prev,
        {
          id: `arr-${Math.random().toString(36).slice(2, 10)}`,
          source: normalizedSource,
          beatId: normalizedBeatId,
          repeats: 1,
          showNotationBeatName: false,
          notationCustomText: "",
          notationJoinWithNext: false,
          notationBarsPerRowCustom: false,
          notationBarsPerRowOverride: null,
          ...notationSeed,
          notationPrintStickingCustom: false,
          notationPrintStickingOverride: null,
          notationPrintStickingModeOverride: null,
        },
      ];
    });
  }, [buildArrangementRowNotationSeedFromBeat, setArrangementItemsWithUndo]);
  const arrangementAddBeatEntries = React.useCallback((entries) => {
    const normalizedEntries = Array.isArray(entries)
      ? entries
          .map((entry) => ({
            source: entry?.source === "public" ? "public" : "local",
            beatId: String(entry?.beatId || ""),
          }))
          .filter((entry) => entry.beatId)
      : [];
    if (!normalizedEntries.length) return;
    setArrangementItemsWithUndo((prev) => [
      ...prev,
      ...normalizedEntries.map((entry) => ({
        id: `arr-${Math.random().toString(36).slice(2, 10)}`,
        source: entry.source,
        beatId: entry.beatId,
        repeats: 1,
        showNotationBeatName: false,
        notationCustomText: "",
        notationJoinWithNext: false,
        notationBarsPerRowCustom: false,
        notationBarsPerRowOverride: null,
        ...buildArrangementRowNotationSeedFromBeat(entry.source, entry.beatId),
        notationPrintStickingCustom: false,
        notationPrintStickingOverride: null,
        notationPrintStickingModeOverride: null,
      })),
    ]);
  }, [buildArrangementRowNotationSeedFromBeat, setArrangementItemsWithUndo]);
  const arrangementInsertBeatAt = React.useCallback((source, beatId, insertIndex) => {
    const normalizedSource = source === "public" ? "public" : "local";
    const normalizedBeatId = String(beatId || "");
    const notationSeed = buildArrangementRowNotationSeedFromBeat(normalizedSource, normalizedBeatId);
    setArrangementItemsWithUndo((prev) => {
      const nextIndex = Math.max(0, Math.min(prev.length, Math.floor(Number(insertIndex) || 0)));
      const out = [...prev];
      out.splice(nextIndex, 0, {
        id: `arr-${Math.random().toString(36).slice(2, 10)}`,
        source: normalizedSource,
        beatId: normalizedBeatId,
        repeats: 1,
        showNotationBeatName: false,
        notationCustomText: "",
        notationJoinWithNext: false,
        notationBarsPerRowCustom: false,
        notationBarsPerRowOverride: null,
        ...notationSeed,
        notationPrintStickingCustom: false,
        notationPrintStickingOverride: null,
        notationPrintStickingModeOverride: null,
      });
      return out;
    });
  }, [buildArrangementRowNotationSeedFromBeat, setArrangementItemsWithUndo]);
  const beginArrangementBeatDrag = React.useCallback((source, beatId) => {
    arrangementDragBeatRef.current = {
      source: source === "public" ? "public" : "local",
      beatId: String(beatId || ""),
    };
  }, []);
  const clearArrangementBeatDrag = React.useCallback(() => {
    arrangementDragBeatRef.current = null;
    setArrangementDropActive(false);
    setArrangementDropTarget(null);
  }, []);
  const dropDraggedBeatIntoArrangement = React.useCallback((insertIndex = null) => {
    const dragged = arrangementDragBeatRef.current;
    if (!dragged?.beatId) {
      setArrangementDropActive(false);
      setArrangementDropTarget(null);
      return;
    }
    if (Number.isFinite(insertIndex)) arrangementInsertBeatAt(dragged.source, dragged.beatId, insertIndex);
    else arrangementAddBeat(dragged.source, dragged.beatId);
    arrangementDragBeatRef.current = null;
    setArrangementDropActive(false);
    setArrangementDropTarget(null);
    setArrangementDetailsCollapsed(false);
  }, [arrangementAddBeat, arrangementInsertBeatAt]);
  const arrangementMoveRow = React.useCallback((rowId, delta) => {
    setArrangementItemsWithUndo((prev) => {
      const idx = prev.findIndex((row) => row.id === rowId);
      if (idx < 0) return prev;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const out = [...prev];
      const [row] = out.splice(idx, 1);
      out.splice(nextIdx, 0, row);
      return out;
    });
  }, [setArrangementItemsWithUndo]);
  const arrangementNudgeRepeats = React.useCallback((rowId, delta) => {
    setArrangementItemsWithUndo((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, repeats: Math.max(1, Math.min(64, (Number(row.repeats) || 1) + delta)) }
          : row
      )
    );
  }, [setArrangementItemsWithUndo]);
  const arrangementRemoveRow = React.useCallback((rowId) => {
    setArrangementItemsWithUndo((prev) => prev.filter((row) => row.id !== rowId));
  }, [setArrangementItemsWithUndo]);
  const arrangementRemoveSelectedRows = React.useCallback(() => {
    if (!normalizedArrangementSelection) return;
    setArrangementItemsWithUndo((prev) =>
      prev.filter((_, index) => index < normalizedArrangementSelection.start || index > normalizedArrangementSelection.end)
    );
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
  }, [normalizedArrangementSelection, setArrangementItemsWithUndo]);
  const clearSheetArrangementBeats = React.useCallback(() => {
    if (normalizedArrangementSelection) {
      const selectedCount =
        normalizedArrangementSelection.end - normalizedArrangementSelection.start + 1;
      const confirmed = window.confirm(
        `Clear ${selectedCount} selected ${selectedCount === 1 ? "beat" : "beats"} from the sheet?`
      );
      if (!confirmed) return;
      arrangementRemoveSelectedRows();
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
      return;
    }
    if (arrangementItems.length < 1) return;
    const confirmed = window.confirm("Clear all beats from the sheet?");
    if (!confirmed) return;
    setArrangementItemsWithUndo(() => []);
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
  }, [
    arrangementItems.length,
    arrangementRemoveSelectedRows,
    normalizedArrangementSelection,
    setArrangementItemsWithUndo,
  ]);
  const arrangementUpdateRowNotationOptions = React.useCallback((rowId, updates) => {
    setArrangementItemsWithUndo((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "showNotationBeatName")
                ? { showNotationBeatName: Boolean(updates.showNotationBeatName) }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationCustomText")
                ? { notationCustomText: String(updates.notationCustomText || "") }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationDynamicSpacing")
                ? {
                    notationDynamicSpacingCustom:
                      typeof updates.notationDynamicSpacing === "boolean",
                    notationDynamicSpacingOverride:
                      typeof updates.notationDynamicSpacing === "boolean"
                        ? updates.notationDynamicSpacing
                        : null,
                  }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationSpacingPreset")
                ? {
                    notationSpacingPreset:
                      updates.notationSpacingPreset === "large" ||
                      updates.notationSpacingPreset === "tight"
                        ? updates.notationSpacingPreset
                        : "normal",
                  }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationJoinWithNext")
                ? { notationJoinWithNext: Boolean(updates.notationJoinWithNext) }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationBarsPerRowOverride")
                ? {
                    notationBarsPerRowCustom:
                      updates.notationBarsPerRowOverride != null &&
                      updates.notationBarsPerRowOverride !== "" &&
                      Number.isFinite(Number(updates.notationBarsPerRowOverride)),
                    notationBarsPerRowOverride: (() => {
                      if (
                        updates.notationBarsPerRowOverride == null ||
                        updates.notationBarsPerRowOverride === ""
                      ) {
                        return null;
                      }
                      const value = Number(updates.notationBarsPerRowOverride);
                      if (!Number.isFinite(value)) return null;
                      const rounded = Math.round(value);
                      if (rounded <= 1) return 1;
                      if (rounded === 2) return 2;
                      if (rounded === 3) return 3;
                      if (rounded >= 4) return 4;
                      return 2;
                    })(),
                  }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationMergeRests")
                ? {
                    notationMergeRestsCustom: typeof updates.notationMergeRests === "boolean",
                    notationMergeRestsFollowBeat: updates.notationMergeRests === "beat",
                    notationMergeRestsOverride:
                      typeof updates.notationMergeRests === "boolean"
                        ? updates.notationMergeRests
                        : null,
                  }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationMergeNotes")
                ? {
                    notationMergeNotesCustom: typeof updates.notationMergeNotes === "boolean",
                    notationMergeNotesFollowBeat: updates.notationMergeNotes === "beat",
                    notationMergeNotesOverride:
                      typeof updates.notationMergeNotes === "boolean"
                        ? updates.notationMergeNotes
                        : null,
                  }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationDottedNotes")
                ? {
                    notationDottedNotesCustom: typeof updates.notationDottedNotes === "boolean",
                    notationDottedNotesFollowBeat: updates.notationDottedNotes === "beat",
                    notationDottedNotesOverride:
                      typeof updates.notationDottedNotes === "boolean"
                        ? updates.notationDottedNotes
                        : null,
                  }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(updates || {}, "notationPrintSticking")
                ? {
                    notationPrintStickingCustom:
                      updates.notationPrintSticking === "off" ||
                      updates.notationPrintSticking === "all" ||
                      updates.notationPrintSticking === "custom",
                    notationPrintStickingFollowBeat:
                      updates.notationPrintSticking === "beat",
                    notationPrintStickingOverride:
                      updates.notationPrintSticking === "off"
                        ? false
                        : updates.notationPrintSticking === "all" || updates.notationPrintSticking === "custom"
                          ? true
                          : null,
                    notationPrintStickingModeOverride:
                      updates.notationPrintSticking === "all" || updates.notationPrintSticking === "custom"
                        ? updates.notationPrintSticking
                        : null,
                  }
                : {}),
            }
          : row
      )
    );
  }, [setArrangementItemsWithUndo]);
  const updateBeatRhythmSpellingFromSheet = React.useCallback(async (row, updates) => {
    if (!row || row.source !== "local" || !row.beatId) return;
    const rhythmUpdates = {};
    if (typeof updates?.mergeRests === "boolean") rhythmUpdates.mergeRests = updates.mergeRests;
    if (typeof updates?.mergeNotes === "boolean") rhythmUpdates.mergeNotes = updates.mergeNotes;
    if (typeof updates?.dottedNotes === "boolean") rhythmUpdates.dottedNotes = updates.dottedNotes;
    const printStickingMode =
      updates?.printStickingMode === "all" || updates?.printStickingMode === "off" || updates?.printStickingMode === "custom"
        ? updates.printStickingMode
        : null;
    if (!Object.keys(rhythmUpdates).length && !printStickingMode) return;

    const beatId = String(row.beatId);
    const currentBeat =
      localBeatsRef.current.find((beat) => String(beat?.id || "") === beatId) || row.beat || null;
    if (!currentBeat?.payload) return;
    const storedNotationSelection =
      currentBeat?.notationStickingSelection && typeof currentBeat.notationStickingSelection === "object"
        ? Object.fromEntries(
            Object.entries(currentBeat.notationStickingSelection).filter(([, value]) => value === true)
          )
        : currentBeat?.payload?.notationStickingSelection && typeof currentBeat.payload.notationStickingSelection === "object"
          ? Object.fromEntries(
              Object.entries(currentBeat.payload.notationStickingSelection).filter(([, value]) => value === true)
            )
          : null;
    const nextPayload = {
      ...(currentBeat.payload && typeof currentBeat.payload === "object" ? currentBeat.payload : {}),
      ...rhythmUpdates,
    };
    if (printStickingMode === "off") {
      nextPayload.showNotationSticking = false;
      delete nextPayload.notationStickingSelection;
    } else if (printStickingMode === "all") {
      nextPayload.showNotationSticking = true;
      delete nextPayload.notationStickingSelection;
    } else if (printStickingMode === "custom") {
      nextPayload.showNotationSticking = true;
      if (storedNotationSelection && Object.keys(storedNotationSelection).length > 0) {
        nextPayload.notationStickingSelection = storedNotationSelection;
      }
    }
    const nextUpdatedAt = new Date().toISOString();
    setLocalBeatsWithUndo((prev) =>
      prev.map((beat) =>
        String(beat?.id || "") === beatId
          ? {
              ...beat,
              updatedAt: nextUpdatedAt,
              notationStickingSelection:
                printStickingMode === "all" || printStickingMode === "off"
                  ? {}
                  : storedNotationSelection && Object.keys(storedNotationSelection).length > 0
                    ? storedNotationSelection
                    : beat?.notationStickingSelection,
              payload: nextPayload,
            }
          : beat
      )
    );
    if (String(loadedLocalBeatId || "") === beatId) {
      if (typeof rhythmUpdates.mergeRests === "boolean") setMergeRests(rhythmUpdates.mergeRests);
      if (typeof rhythmUpdates.mergeNotes === "boolean") setMergeNotes(rhythmUpdates.mergeNotes);
      if (typeof rhythmUpdates.dottedNotes === "boolean") setDottedNotes(rhythmUpdates.dottedNotes);
      if (printStickingMode === "off") {
        setNotationStickingModePreference("off");
        setShowNotationSticking(false);
        setNotationStickingSelectionModeEnabled(false);
      } else if (printStickingMode === "all") {
        setNotationStickingModePreference("all");
        setShowNotationSticking(true);
        setNotationStickingSelectionModeEnabled(false);
      } else if (printStickingMode === "custom") {
        setNotationStickingModePreference("custom");
        if (storedNotationSelection && Object.keys(storedNotationSelection).length > 0) {
          setNotationStickingSelection(storedNotationSelection);
        }
        setShowNotationSticking(true);
        setNotationStickingSelectionModeEnabled(false);
      }
    }

    if (authUser?.id && hasSupabaseEnabled && supabase && isUuidLike(beatId)) {
      try {
        await updateCloudBeatRow({
          supabase,
          userId: authUser.id,
          beatId,
          patch: {
          payload: nextPayload,
          updated_at: nextUpdatedAt,
          },
        });
      } catch (error) {
        alert(error?.message || "Failed to update beat rhythm spelling");
      }
    }
  }, [
    authUser?.id,
    hasSupabaseEnabled,
    loadedLocalBeatId,
    setLocalBeatsWithUndo,
    setNotationStickingModePreference,
    setNotationStickingSelection,
    setNotationStickingSelectionModeEnabled,
    setShowNotationSticking,
    setMergeNotes,
    setMergeRests,
    setDottedNotes,
    supabase,
  ]);
  const saveArrangementSnapshot = React.useCallback(async (options = {}) => {
    const normalizedItems = normalizeArrangementItems(arrangementItems);
    const {
      mode = "auto",
      nameOverride = "",
      titleLine1Override = null,
      titleLine2Override = null,
      composerOverride = null,
      excludeId = null,
    } = options;
    const now = new Date().toISOString();
    const fallbackName = getNextNumberedArrangementName("Arrangement", savedArrangements);
    const effectiveTitleLine1 =
      titleLine1Override == null ? String(arrangementTitleLine1Draft || "") : String(titleLine1Override || "");
    const effectiveTitleLine2 =
      titleLine2Override == null ? String(arrangementTitleLine2Draft || "") : String(titleLine2Override || "");
    const effectiveComposer =
      composerOverride == null ? String(arrangementComposerDraft || "") : String(composerOverride || "");
    const derivedName = getArrangementNameFromTitles(
      effectiveTitleLine1,
      effectiveTitleLine2,
      fallbackName
    );
    const loadedEntry = loadedArrangementId
      ? savedArrangements.find((entry) => entry.id === loadedArrangementId) || null
      : null;
    const byId = loadedArrangementId
      ? savedArrangements.find((entry) => entry.id === loadedArrangementId)
      : null;
    const target =
      mode === "update"
        ? byId || null
        : mode === "saveAs"
          ? null
          : byId || null;
    const name =
      mode === "saveAs"
        ? getUniqueArrangementName(
            String(nameOverride || "").trim() || derivedName,
            savedArrangements,
            excludeId || null
          )
        : getUniqueArrangementName(derivedName, savedArrangements, target?.id || null);
    const nextTitleLine1 =
      name !== derivedName
        ? name
        : effectiveTitleLine1;
    const nextTitleLine2 =
      name !== derivedName
        ? ""
        : effectiveTitleLine2;
    const nextId = target?.id || `arrlib-${Math.random().toString(36).slice(2, 10)}`;
    const nextEntry = {
      id: nextId,
      name,
      titleLine1: nextTitleLine1,
      titleLine2: nextTitleLine2,
      composer: effectiveComposer,
      createdAt: target?.createdAt || now,
      updatedAt: now,
      items: normalizedItems,
    };
    const targetHasCloudId = Boolean(target?.id && isUuidLike(String(target.id)));
    if (authUser?.id && hasSupabaseEnabled && supabase) {
      if (!(targetHasCloudId && mode === "update")) {
        try {
          await ensureCloudArrangementQuotaAvailable(1);
        } catch (error) {
          alert(error?.message || "Personal cloud arrangement limit reached.");
          return;
        }
      }
      const payload = {
        user_id: authUser.id,
        name: nextEntry.name,
        title_line_1: nextEntry.titleLine1,
        title_line_2: nextEntry.titleLine2,
        author: nextEntry.composer,
        rows: normalizedItems,
        settings: {},
        updated_at: now,
      };
      let data = null;
      try {
        data =
          targetHasCloudId && mode === "update"
            ? await updateCloudArrangementRow({
                supabase,
                userId: authUser.id,
                arrangementId: String(target.id),
                patch: payload,
                select: true,
              })
            : await insertCloudArrangementRow({
                supabase,
                row: { ...payload, created_at: now },
              });
      } catch (error) {
        alert(error?.message || "Failed to save arrangement");
        return;
      }
      const savedEntry = normalizeCloudArrangementRow(data);
      if (!savedEntry) return;
      pushLocalBeatHistory();
      setSavedArrangements((prev) => {
        const idx = prev.findIndex((entry) => entry.id === savedEntry.id);
        if (idx < 0) return [savedEntry, ...prev];
        const out = [...prev];
        out[idx] = savedEntry;
        return out;
      });
      setArrangementNameDraft(
        getArrangementNameFromTitles(
          savedEntry.titleLine1,
          savedEntry.titleLine2,
          savedEntry.name
        )
      );
      setArrangementTitleLine1Draft(savedEntry.titleLine1);
      setArrangementTitleLine2Draft(savedEntry.titleLine2);
      setArrangementComposerDraft(savedEntry.composer);
      setLoadedArrangementId(savedEntry.id);
      void refreshUsageLimits({ silent: true });
      return;
    }
    pushLocalBeatHistory();
    setSavedArrangements((prev) => {
      const idx = prev.findIndex((entry) => entry.id === nextId);
      if (idx < 0) return [nextEntry, ...prev];
      const out = [...prev];
      out[idx] = nextEntry;
      return out;
    });
    setArrangementNameDraft(
      getArrangementNameFromTitles(
        nextEntry.titleLine1,
        nextEntry.titleLine2,
        nextEntry.name
      )
    );
    setArrangementTitleLine1Draft(nextEntry.titleLine1);
    setArrangementTitleLine2Draft(nextEntry.titleLine2);
    setArrangementComposerDraft(nextEntry.composer);
    setLoadedArrangementId(nextId);
  }, [authUser?.id, arrangementItems, arrangementTitleLine1Draft, arrangementTitleLine2Draft, arrangementComposerDraft, savedArrangements, loadedArrangementId, pushLocalBeatHistory, ensureCloudArrangementQuotaAvailable, refreshUsageLimits]);
	  const createNewArrangement = React.useCallback(async () => {
	    const now = new Date().toISOString();
	    const nextId = `arrlib-${Math.random().toString(36).slice(2, 10)}`;
	    const defaultName = getNextNumberedArrangementName("Arrangement", savedArrangements);
	    const defaultTitleLine1 = "Untitled";
	    const nextEntry = {
	      id: nextId,
	      name: defaultName,
	      titleLine1: defaultTitleLine1,
	      titleLine2: "",
      composer: "",
      createdAt: now,
      updatedAt: now,
      items: [],
    };
    if (authUser?.id && hasSupabaseEnabled && supabase) {
      try {
        await ensureCloudArrangementQuotaAvailable(1);
      } catch (error) {
        alert(error?.message || "Personal cloud arrangement limit reached.");
        return;
      }
      let data = null;
      try {
        data = await insertCloudArrangementRow({
          supabase,
          row: {
	            user_id: authUser.id,
	            name: nextEntry.name,
	            title_line_1: defaultTitleLine1,
	            title_line_2: "",
            author: "",
            rows: [],
            settings: {},
            created_at: now,
            updated_at: now,
          },
        });
      } catch (error) {
        alert(error?.message || "Failed to create arrangement");
        return;
      }
      const savedEntry = normalizeCloudArrangementRow(data);
      if (!savedEntry) return;
      pushLocalBeatHistory();
      setSavedArrangements((prev) => [savedEntry, ...prev]);
      setArrangementItems([]);
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
      setArrangementNameDraft(
        getArrangementNameFromTitles(savedEntry.titleLine1, savedEntry.titleLine2, savedEntry.name)
      );
      setArrangementTitleLine1Draft(savedEntry.titleLine1);
      setArrangementTitleLine2Draft("");
      setArrangementComposerDraft("");
      setLoadedArrangementId(savedEntry.id);
      selectArrangementPickerId(savedEntry.id);
      setArrangementSourcesCollapsed(false);
      setArrangementDetailsCollapsed(false);
      setArrangementSourceTab("local");
      setIsArrangementOpen(true);
      void refreshUsageLimits({ silent: true });
      return;
    }
    pushLocalBeatHistory();
    setSavedArrangements((prev) => [nextEntry, ...prev]);
    setArrangementItems([]);
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
    setArrangementNameDraft(
      getArrangementNameFromTitles(
        nextEntry.titleLine1,
        nextEntry.titleLine2,
        nextEntry.name
      )
    );
    setArrangementTitleLine1Draft(nextEntry.titleLine1);
    setArrangementTitleLine2Draft("");
    setArrangementComposerDraft("");
    setLoadedArrangementId(nextId);
    selectArrangementPickerId(nextId);
    setArrangementSourcesCollapsed(false);
    setArrangementDetailsCollapsed(false);
    setArrangementSourceTab("local");
    setIsArrangementOpen(true);
  }, [authUser?.id, pushLocalBeatHistory, savedArrangements.length, ensureCloudArrangementQuotaAvailable, refreshUsageLimits]);
  const loadSavedArrangement = React.useCallback(
    (entry) => {
      if (!entry || !Array.isArray(entry.items)) return;
      if (arrangementPlaybackEnabled) {
        setArrangementPlaybackEnabled(false);
        setArrangementPlaybackIndex(0);
      }
      pushLocalBeatHistory();
      setArrangementItems(normalizeArrangementItems(entry.items));
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
      setArrangementNameDraft(
        getArrangementNameFromTitles(entry.titleLine1, entry.titleLine2, String(entry.name || ""))
      );
      setArrangementTitleLine1Draft(String(entry.titleLine1 || ""));
      setArrangementTitleLine2Draft(String(entry.titleLine2 || ""));
      setArrangementComposerDraft(String(entry.composer || ""));
      setLoadedArrangementId(entry.id || null);
      selectArrangementPickerId(entry.id || null);
    },
    [arrangementPlaybackEnabled, pushLocalBeatHistory]
  );
  const deleteSavedArrangement = React.useCallback(async (entryId) => {
    const existingEntry =
      savedArrangementsRef.current.find((entry) => String(entry?.id || "") === String(entryId || "")) || null;
    if (authUser?.id && hasSupabaseEnabled && supabase && isUuidLike(String(entryId || ""))) {
      try {
        await deleteCloudArrangementRow({
          supabase,
          userId: authUser.id,
          arrangementId: String(entryId),
        });
      } catch (error) {
        alert(error?.message || "Failed to delete arrangement");
        return;
      }
    }
    const nextRemaining = savedArrangementsRef.current.filter((entry) => entry.id !== entryId);
    const nextRemainingSorted = sortSavedArrangementsMostRecent(nextRemaining);
    const nextSelectedEntry = nextRemainingSorted[0] || null;
    pushLocalBeatHistory();
    savedArrangementsRef.current = nextRemaining;
    setSavedArrangements(nextRemaining);
    if (String(loadedArrangementIdRef.current || "") === String(entryId || "")) {
      if (nextSelectedEntry) {
        if (arrangementPlaybackEnabled) {
          setArrangementPlaybackEnabled(false);
          setArrangementPlaybackIndex(0);
        }
        setArrangementItems(normalizeArrangementItems(nextSelectedEntry.items));
        setArrangementSelection(null);
        setArrangementSelectionAnchor(null);
        setArrangementBarSelection(null);
        setArrangementBarSelectionAnchor(null);
        setArrangementNameDraft(
          getArrangementNameFromTitles(
            nextSelectedEntry.titleLine1,
            nextSelectedEntry.titleLine2,
            String(nextSelectedEntry.name || "")
          )
        );
        setArrangementTitleLine1Draft(String(nextSelectedEntry.titleLine1 || ""));
        setArrangementTitleLine2Draft(String(nextSelectedEntry.titleLine2 || ""));
        setArrangementComposerDraft(String(nextSelectedEntry.composer || ""));
        setLoadedArrangementId(nextSelectedEntry.id || null);
        loadedArrangementIdRef.current = nextSelectedEntry.id || null;
        selectArrangementPickerId(nextSelectedEntry.id || null);
      } else {
        setArrangementItems([]);
        setArrangementSelection(null);
        setArrangementSelectionAnchor(null);
        setArrangementBarSelection(null);
        setArrangementBarSelectionAnchor(null);
        setArrangementNameDraft("Arrangement");
        setArrangementTitleLine1Draft("");
        setArrangementTitleLine2Draft("");
        setArrangementComposerDraft("");
        setLoadedArrangementId(null);
        loadedArrangementIdRef.current = null;
        selectArrangementPickerId(null);
      }
    } else if (arrangementPickerIdRef.current === entryId) {
      selectArrangementPickerId(nextSelectedEntry?.id || null);
    }
  }, [authUser?.id, arrangementPlaybackEnabled, pushLocalBeatHistory, selectArrangementPickerId]);
  const requestDeleteSavedArrangement = React.useCallback((entry) => {
    if (!entry?.id) return;
    setPendingArrangementDeleteEntry(entry);
  }, []);
  const loadBeatIntoEditor = React.useCallback(async (source, beat) => {
    const freshestBeat =
      source === "local"
        ? localBeatsRef.current.find((entry) => String(entry?.id || "") === String(beat?.id || "")) || beat
        : beat;
    const mirroredNotationStickingSelection =
      freshestBeat?.notationStickingSelection &&
      typeof freshestBeat.notationStickingSelection === "object"
        ? Object.fromEntries(
            Object.entries(freshestBeat.notationStickingSelection).filter(([, value]) => value === true)
          )
        : null;
    const effectivePayload =
      freshestBeat?.payload && typeof freshestBeat.payload === "object"
        ? {
            ...freshestBeat.payload,
            name: String(freshestBeat.name || freshestBeat.payload.name || ""),
            category: String(freshestBeat.category || freshestBeat.payload.category || "Groove"),
            style: String(freshestBeat.style || freshestBeat.payload.style || "all"),
            ...(mirroredNotationStickingSelection && Object.keys(mirroredNotationStickingSelection).length > 0
              ? { notationStickingSelection: mirroredNotationStickingSelection }
              : {}),
          }
        : null;
    if (!effectivePayload) return;
    if (
      loadedLocalBeatIdRef.current &&
      isLoadedLocalBeatNotationSelectionDirtyRef.current &&
      String(loadedLocalBeatIdRef.current) !== String(freshestBeat?.id || "")
    ) {
      await flushLoadedLocalBeatNotationSelectionRef.current?.();
    }
    const normalizedSource = source === "public" ? "public" : source === "shared" ? "shared" : "local";
    flushSync(() => {
      setCurrentEditorBeatKey(`${normalizedSource}:${String(freshestBeat?.id || "")}`);
      applyImportedBeatPayloadRef.current?.(
        effectivePayload,
        `${normalizedSource}:${freshestBeat.id}:${freshestBeat.updatedAt || freshestBeat.createdAt || ""}`
      );
      if (normalizedSource === "local") {
        setLoadedLocalBeatId(freshestBeat.id);
      } else {
        setLoadedLocalBeatId(null);
      }
    });
  }, []);
  useEffect(() => {
    loadBeatIntoEditorRef.current = loadBeatIntoEditor;
  }, [loadBeatIntoEditor]);
  const buildCurrentArrangementSharePayload = React.useCallback(() => {
    const normalizedItems = normalizeArrangementItems(arrangementItems);
    const sharedBeats = [];
    const sharedBeatIdByRowBeat = new Map();
    normalizedItems.forEach((item, idx) => {
      const beat = getBeatBySourceRef(item.source, item.beatId);
      if (!beat?.payload) return;
      const sourceKey = `${item.source}:${item.beatId}`;
      if (sharedBeatIdByRowBeat.has(sourceKey)) return;
      const sharedBeatId = `shared-${idx + 1}`;
      sharedBeatIdByRowBeat.set(sourceKey, sharedBeatId);
      const payload = buildEffectiveNotationPayloadFromBeat(beat);
      const safePayload = payload ? JSON.parse(JSON.stringify(payload)) : null;
      if (!safePayload) return;
      sharedBeats.push({
        id: sharedBeatId,
        name: String(beat.name || `Beat ${idx + 1}`),
        category: String(beat.category || "Groove"),
        style: beat.style ? String(beat.style) : undefined,
        timeSigCategory: String(
          beat.timeSigCategory ||
          `${Number(safePayload.timeSig?.n) || 4}/${Number(safePayload.timeSig?.d) || 4}`
        ),
        bpm: Number.isFinite(Number(beat.bpm)) ? Math.round(Number(beat.bpm)) : Number(safePayload.bpm) || bpm,
        payload: safePayload,
        source: "shared",
      });
    });
    return {
      v: 1,
      kind: "arrangement",
      name: getArrangementNameFromTitles(
        arrangementTitleLine1Draft,
        arrangementTitleLine2Draft,
        arrangementNameDraft || "Arrangement"
      ),
      titleLine1: arrangementTitleLine1Draft.trim(),
      titleLine2: arrangementTitleLine2Draft.trim(),
      composer: arrangementComposerDraft.trim(),
      beats: sharedBeats,
      items: normalizedItems
        .map((item) => {
          const sharedBeatId = sharedBeatIdByRowBeat.get(`${item.source}:${item.beatId}`);
          if (!sharedBeatId) return null;
          return {
            ...item,
            source: "shared",
            beatId: sharedBeatId,
          };
        })
        .filter(Boolean),
    };
  }, [
    arrangementItems,
    getBeatBySourceRef,
    arrangementTitleLine1Draft,
    arrangementTitleLine2Draft,
    arrangementComposerDraft,
    buildEffectiveNotationPayloadFromBeat,
    bpm,
  ]);
  const applyImportedMidiTempoMultiplier = React.useCallback((sourceImported, rawMultiplier = 1) => {
    const safeMultiplier = Math.max(0.25, Math.min(4, Number(rawMultiplier) || 1));
    if (!sourceImported || Math.abs(safeMultiplier - 1) < 0.0001 || !sourceImported?.hasTempo) {
      return sourceImported;
    }
    const scaleBpm = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return value;
      return roundTempoForImport(numeric * safeMultiplier);
    };
    return sourceImported.kind === "arrangement"
      ? {
          ...sourceImported,
          sections: (sourceImported.sections || []).map((section) => ({
            ...section,
            bpm: scaleBpm(section?.bpm),
            payload: section?.payload
              ? { ...section.payload, bpm: scaleBpm(section?.payload?.bpm ?? section?.bpm) }
              : section.payload,
          })),
        }
      : {
          ...sourceImported,
          payload: sourceImported?.payload
            ? { ...sourceImported.payload, bpm: scaleBpm(sourceImported?.payload?.bpm) }
            : sourceImported.payload,
        };
  }, [roundTempoForImport]);
  const buildPreparedImportedMidiResult = React.useCallback((imported, bpmOverride = null, tempoMultiplier = 1) => {
    const scaledImported = applyImportedMidiTempoMultiplier(imported, tempoMultiplier);
    const overrideBpm = bpmOverride != null && Number.isFinite(Number(bpmOverride))
      ? clampBpm(Math.round(Number(bpmOverride)))
      : null;
    return overrideBpm == null
      ? scaledImported
      : scaledImported.kind === "arrangement"
        ? {
            ...scaledImported,
            sections: (scaledImported.sections || []).map((section) => ({
              ...section,
              bpm: overrideBpm,
              payload: section?.payload
                ? { ...section.payload, bpm: overrideBpm }
                : section.payload,
            })),
          }
        : {
            ...scaledImported,
            payload: scaledImported?.payload
              ? { ...scaledImported.payload, bpm: overrideBpm }
              : scaledImported.payload,
          };
  }, [applyImportedMidiTempoMultiplier, clampBpm]);
  const getSuggestedImportedMidiBpm = React.useCallback((imported, fallbackBpm, tempoMultiplier = 1) => {
    const scaledImported = applyImportedMidiTempoMultiplier(imported, tempoMultiplier);
    const candidate =
      scaledImported?.kind === "arrangement"
        ? Number(scaledImported?.sections?.[0]?.bpm ?? scaledImported?.sections?.[0]?.payload?.bpm)
        : Number(scaledImported?.payload?.bpm);
    if (Number.isFinite(candidate) && candidate >= 20 && candidate <= 400) {
      return roundTempoForImport(candidate);
    }
    return roundTempoForImport(Number(fallbackBpm) || 120);
  }, [applyImportedMidiTempoMultiplier, roundTempoForImport]);
  const getImportedMidiBpmOverride = React.useCallback((imported, requestedBpm, fallbackBpm, tempoMultiplier = 1) => {
    const nextBpm = roundTempoForImport(Number(requestedBpm) || fallbackBpm || 120);
    if (!imported?.hasTempo) return nextBpm;
    const suggestedBpm = getSuggestedImportedMidiBpm(imported, fallbackBpm, tempoMultiplier);
    return nextBpm === suggestedBpm ? null : nextBpm;
  }, [getSuggestedImportedMidiBpm, roundTempoForImport]);
  const updatePendingMidiTempoMultiplier = React.useCallback((delta) => {
    setPendingMidiTempoPrompt((prev) => {
      if (!prev) return prev;
      const prevMultiplier = Math.max(0.25, Math.min(4, Number(prev.tempoMultiplier) || 1));
      const nextMultiplier = Math.max(0.25, Math.min(4, Math.round((prevMultiplier + delta) * 100) / 100));
      const prevSuggested = getSuggestedImportedMidiBpm(prev.imported, bpm, prevMultiplier);
      const nextSuggested = getSuggestedImportedMidiBpm(prev.imported, bpm, nextMultiplier);
      const prevBpmValue = roundTempoForImport(Number(prev.bpm) || prevSuggested || bpm);
      return {
        ...prev,
        tempoMultiplier: nextMultiplier,
        bpm: Math.abs(prevBpmValue - prevSuggested) < 0.001 ? nextSuggested : prev.bpm,
      };
    });
  }, [bpm, getSuggestedImportedMidiBpm, roundTempoForImport]);
  const resetPendingMidiTempoMultiplier = React.useCallback(() => {
    setPendingMidiTempoPrompt((prev) => {
      if (!prev) return prev;
      const prevMultiplier = Math.max(0.25, Math.min(4, Number(prev.tempoMultiplier) || 1));
      const prevSuggested = getSuggestedImportedMidiBpm(prev.imported, bpm, prevMultiplier);
      const nextSuggested = getSuggestedImportedMidiBpm(prev.imported, bpm, 1);
      const prevBpmValue = roundTempoForImport(Number(prev.bpm) || prevSuggested || bpm);
      return {
        ...prev,
        tempoMultiplier: 1,
        bpm: Math.abs(prevBpmValue - prevSuggested) < 0.001 ? nextSuggested : prev.bpm,
      };
    });
  }, [bpm, getSuggestedImportedMidiBpm, roundTempoForImport]);
  const stopMidiTempoMultiplierRepeat = React.useCallback(() => {
    const r = midiTempoMultiplierRepeatRef.current;
    if (r.timer) window.clearTimeout(r.timer);
    if (r.interval) window.clearInterval(r.interval);
    r.timer = null;
    r.interval = null;
  }, []);
  const startMidiTempoMultiplierRepeat = React.useCallback((delta) => {
    stopMidiTempoMultiplierRepeat();
    updatePendingMidiTempoMultiplier(delta);
    midiTempoMultiplierRepeatRef.current.timer = window.setTimeout(() => {
      midiTempoMultiplierRepeatRef.current.interval = window.setInterval(
        () => updatePendingMidiTempoMultiplier(delta),
        50
      );
    }, 130);
  }, [stopMidiTempoMultiplierRepeat, updatePendingMidiTempoMultiplier]);
  useEffect(() => () => stopMidiTempoMultiplierRepeat(), [stopMidiTempoMultiplierRepeat]);
  const clearMidiImportPreviewSession = React.useCallback(() => {
    midiImportPreviewSnapshotRef.current = null;
    midiImportPreviewKeyRef.current = "";
  }, []);
  const restoreMidiImportPreviewSnapshot = React.useCallback(() => {
    const snapshot = midiImportPreviewSnapshotRef.current;
    if (!snapshot?.payload || !midiImportPreviewKeyRef.current) {
      midiImportPreviewKeyRef.current = "";
      return;
    }
    applyImportedBeatPayloadRef.current?.(
      snapshot.payload,
      `midi-preview-restore:${Date.now()}`
    );
    setBeatNameDraft(snapshot.beatNameDraft);
    setBeatCategoryDraft(snapshot.beatCategoryDraft);
    setBeatStyleDraft(snapshot.beatStyleDraft);
    setLoadedLocalBeatId(snapshot.loadedLocalBeatId);
    setPrintTitle(snapshot.printTitle);
    setPrintComposer(snapshot.printComposer);
    midiImportPreviewKeyRef.current = "";
  }, []);
  const cancelPendingMidiImport = React.useCallback(() => {
    restoreMidiImportPreviewSnapshot();
    clearMidiImportPreviewSession();
    setPendingMidiImportMapping(null);
    setPendingMidiTempoPrompt(null);
  }, [clearMidiImportPreviewSession, restoreMidiImportPreviewSnapshot]);
  const normalizeMidiArrangementImportMode = React.useCallback((value) => {
    return value === "override-current-arrangement" || value === "current-arrangement"
      ? "override-current-arrangement"
      : "new-arrangement";
  }, []);
  const applyImportedMidiResult = React.useCallback((imported, fileMeta, bpmOverride = null, options = {}) => {
    const replaceLastImport = options?.replaceLastImport === true;
    const arrangementImportMode = normalizeMidiArrangementImportMode(options?.arrangementImportMode);
    const importedTitleLine1 = String(options?.titleLine1 || "").trim();
    const importedTitleLine2 = String(options?.titleLine2 || "").trim();
    const importedAuthor = String(options?.author || "").trim();
    const safeFileName = String(fileMeta?.fileName || "import.mid");
    const safeLastModified = fileMeta?.lastModified || "";
    const preparedImported = buildPreparedImportedMidiResult(imported, bpmOverride);
    if (preparedImported.kind === "arrangement" && Array.isArray(preparedImported.sections) && preparedImported.sections.length > 0) {
      const now = new Date().toISOString();
      const importedArrangementName = getArrangementNameFromTitles(
        importedTitleLine1,
        importedTitleLine2,
        preparedImported.title || safeFileName.replace(/\.[^.]+$/, "") || `Arrangement ${savedArrangements.length + 1}`
      );
      const reusableImportFolderId =
        replaceLastImport && lastMidiImportSession?.generatedFolderId
          ? beatLibraryContainersRef.current.find(
              (entry) => String(entry?.id || "") === String(lastMidiImportSession.generatedFolderId)
            )?.id || null
          : null;
      const importFolderId =
        reusableImportFolderId ||
        createBeatLibraryContainer("folder", { parentId: null })?.id ||
        `beatlib-${Math.random().toString(36).slice(2, 10)}`;
      setBeatLibraryContainers((prev) =>
        prev.map((entry) =>
          String(entry?.id || "") === String(importFolderId)
            ? { ...entry, name: importedArrangementName }
            : entry
        )
      );
      pushLocalBeatHistory();
      const previousImportedBeatIds =
        replaceLastImport && Array.isArray(lastMidiImportSession?.generatedBeatIds)
          ? new Set(lastMidiImportSession.generatedBeatIds)
          : null;
      const sectionBeats = preparedImported.sections.map((section, idx) => {
        const manualOrder = idx + 1;
        const libraryMeta = {
          parentId: String(importFolderId),
          manualOrder,
        };
        return {
          id: `local-${Math.random().toString(36).slice(2, 10)}`,
          name: importedArrangementName,
          category: "Groove",
          style: undefined,
          timeSigCategory: `${section.timeSig?.n || 4}/${section.timeSig?.d || 4}`,
          bpm: Math.max(20, Math.min(400, Number(section.bpm) || 120)),
          createdAt: now,
          payload: {
            ...(section.payload && typeof section.payload === "object" ? section.payload : {}),
            libraryMeta,
          },
          libraryMeta,
          source: "local",
        };
      });
      const nextArrangementId =
        arrangementImportMode === "new-arrangement"
          ? (
              replaceLastImport && lastMidiImportSession?.generatedArrangementId
                ? String(lastMidiImportSession.generatedArrangementId)
                : `arrlib-${Math.random().toString(36).slice(2, 10)}`
            )
          : null;
      const nextArrangementRows = sectionBeats.map((beat) => ({
        id: `arr-${Math.random().toString(36).slice(2, 10)}`,
        source: "local",
        beatId: beat.id,
        repeats: 1,
        showNotationBeatName: false,
        notationCustomText: "",
        notationJoinWithNext: false,
        notationBarsPerRowCustom: false,
        notationBarsPerRowOverride: null,
      }));
      setLocalBeats((prev) => {
        const base = previousImportedBeatIds ? prev.filter((beat) => !previousImportedBeatIds.has(beat.id)) : prev;
        return [...sectionBeats, ...base].slice(0, 500);
      });
      if (arrangementImportMode === "override-current-arrangement") {
        setArrangementItemsWithUndo(() => nextArrangementRows);
        setArrangementSelection(null);
        setArrangementSelectionAnchor(null);
        setArrangementBarSelection(null);
        setArrangementBarSelectionAnchor(null);
      } else {
        const existingArrangement =
          replaceLastImport && lastMidiImportSession?.generatedArrangementId
            ? savedArrangements.find((entry) => entry.id === lastMidiImportSession.generatedArrangementId) || null
            : null;
        const nextArrangementEntry = {
          id: nextArrangementId,
          name: importedArrangementName,
          titleLine1: importedTitleLine1 || preparedImported.title || importedArrangementName,
          titleLine2: importedTitleLine2,
          composer: importedAuthor || preparedImported.composer || "",
          createdAt: existingArrangement?.createdAt || now,
          updatedAt: now,
          items: nextArrangementRows,
        };
        setSavedArrangements((prev) => {
          const idx = prev.findIndex((entry) => entry.id === nextArrangementId);
          if (idx < 0) return [nextArrangementEntry, ...prev];
          const out = [...prev];
          out[idx] = nextArrangementEntry;
          return out;
        });
        setArrangementItems(nextArrangementRows);
        setArrangementSelection(null);
        setArrangementSelectionAnchor(null);
        setArrangementBarSelection(null);
        setArrangementBarSelectionAnchor(null);
        setArrangementNameDraft(
          getArrangementNameFromTitles(
            nextArrangementEntry.titleLine1,
            nextArrangementEntry.titleLine2,
            nextArrangementEntry.name
          )
        );
        setArrangementTitleLine1Draft(nextArrangementEntry.titleLine1);
        setArrangementTitleLine2Draft(nextArrangementEntry.titleLine2);
        setArrangementComposerDraft(nextArrangementEntry.composer);
        setLoadedArrangementId(nextArrangementId);
      }
      setArrangementSourcesCollapsed(false);
      setArrangementDetailsCollapsed(false);
      setArrangementSourceTab("local");
      setIsArrangementOpen(true);
      if (sectionBeats[0]?.payload) {
        const importedBpm = Math.max(20, Math.min(400, Number(sectionBeats[0].bpm) || 120));
        setBpm(importedBpm);
        setBpmDraft(String(importedBpm));
        applyImportedBeatPayloadRef.current?.(
          sectionBeats[0].payload,
          `midi-import-arrangement:${safeFileName}:${safeLastModified}:0`
        );
        setLoadedLocalBeatId(sectionBeats[0].id);
        setBeatNameDraft(sectionBeats[0].name);
      } else {
        setLoadedLocalBeatId(null);
      }
      setLastMidiImportSession((prev) => ({
        ...(prev || {}),
        arrayBuffer: prev?.arrayBuffer || null,
        fileName: safeFileName,
        lastModified: safeLastModified,
        title: importedTitleLine1 || preparedImported.title || prev?.title || "",
        titleLine1: importedTitleLine1 || prev?.titleLine1 || preparedImported.title || "",
        titleLine2: importedTitleLine2 || prev?.titleLine2 || "",
        author: importedAuthor || prev?.author || preparedImported.composer || "",
        composer: importedAuthor || preparedImported.composer || prev?.composer || "",
        splitBars: prev?.splitBars || midiImportSplitBars,
        bpm: Math.max(20, Math.min(400, Number(sectionBeats[0]?.bpm) || Number(bpmOverride) || 120)),
        noteAssignments: prev?.noteAssignments || {},
        noteVelocityModes: prev?.noteVelocityModes || {},
        arrangementImportMode,
        kind: "arrangement",
        generatedBeatIds: sectionBeats.map((beat) => beat.id),
        generatedFolderId: String(importFolderId),
        generatedArrangementId:
          arrangementImportMode === "new-arrangement"
            ? (
                replaceLastImport && lastMidiImportSession?.generatedArrangementId
                  ? String(lastMidiImportSession.generatedArrangementId)
                  : nextArrangementId
              )
            : null,
        generatedArrangementRowIds: nextArrangementRows.map((row) => row.id),
      }));
    } else {
      if (Number.isFinite(Number(preparedImported?.payload?.bpm))) {
        const importedBpm = roundTempoForImport(preparedImported.payload.bpm);
        setBpm(importedBpm);
        setBpmDraft(String(importedBpm));
      }
      applyImportedBeatPayloadRef.current?.(
        preparedImported.payload,
        `midi-import:${safeFileName}:${safeLastModified}`
      );
      setLoadedLocalBeatId(null);
      if (preparedImported.title) {
        setBeatNameDraft(preparedImported.title);
        setPrintTitle(preparedImported.title);
      }
      setLastMidiImportSession((prev) => ({
        ...(prev || {}),
        arrayBuffer: prev?.arrayBuffer || null,
        fileName: safeFileName,
        lastModified: safeLastModified,
        title: importedTitleLine1 || preparedImported.title || prev?.title || "",
        titleLine1: importedTitleLine1 || prev?.titleLine1 || preparedImported.title || "",
        titleLine2: importedTitleLine2 || prev?.titleLine2 || "",
        author: importedAuthor || prev?.author || preparedImported.composer || "",
        composer: importedAuthor || preparedImported.composer || prev?.composer || "",
        splitBars: prev?.splitBars || midiImportSplitBars,
        bpm: Math.max(20, Math.min(400, Number(preparedImported?.payload?.bpm) || Number(bpmOverride) || 120)),
        noteAssignments: prev?.noteAssignments || {},
        noteVelocityModes: prev?.noteVelocityModes || {},
        arrangementImportMode,
        kind: "beat",
        generatedBeatIds: [],
        generatedFolderId: null,
        generatedArrangementId: null,
        generatedArrangementRowIds: [],
      }));
    }
    if (importedAuthor || preparedImported.composer) setPrintComposer(importedAuthor || preparedImported.composer);
    if (importedTitleLine1 || preparedImported.title) setPrintTitle(importedTitleLine1 || preparedImported.title);
    clearMidiImportPreviewSession();
    setPendingMidiImportMapping(null);
    setPendingMidiTempoPrompt(null);
    setIsShareActionsDialogOpen(false);
  }, [buildPreparedImportedMidiResult, clearMidiImportPreviewSession, lastMidiImportSession, midiImportSplitBars, normalizeMidiArrangementImportMode, pushLocalBeatHistory, roundTempoForImport, savedArrangements, setArrangementItemsWithUndo]);
  const buildPendingMidiImportMappingState = React.useCallback((session, imported) => {
    const assignments = {};
    const velocityModes = {};
    (imported.mappingEntries || []).forEach((entry) => {
      const key = String(entry.sourceKey || entry.note);
      assignments[key] = String(entry.instrumentId || "");
      velocityModes[key] = String(entry.velocityMode || "auto");
    });
    Object.entries(session?.noteAssignments || {}).forEach(([key, value]) => {
      assignments[String(key)] = String(value || "");
    });
    Object.entries(session?.noteVelocityModes || {}).forEach(([key, value]) => {
      velocityModes[String(key)] = String(value || "auto");
    });
    (imported.unmappedNotes || []).forEach((entry) => {
      if (!Object.prototype.hasOwnProperty.call(assignments, String(entry.note))) {
        assignments[String(entry.note)] = "";
        velocityModes[String(entry.note)] = "auto";
      }
    });
    const importedKind = imported.kind === "needs-mapping"
      ? String(imported.previewKind || "beat")
      : String(imported.kind || "beat");
    const previewTotalBars = importedKind === "arrangement"
      ? (
          imported.kind === "arrangement"
            ? (imported.sections || []).reduce(
                (sum, section) => sum + Math.max(1, Number(section?.payload?.bars) || 1),
                0
              )
            : Math.max(1, Math.round(Number(imported.previewTotalBars) || 1))
        )
      : 1;
    return {
      arrayBuffer: session?.arrayBuffer || null,
      fileName: session?.fileName || "import.mid",
      lastModified: session?.lastModified || "",
      title: imported.title || session?.title || "",
      titleLine1:
        session?.titleLine1 != null
          ? String(session.titleLine1)
          : String(imported.title || session?.title || ""),
      titleLine2: String(session?.titleLine2 || ""),
      author:
        session?.author != null
          ? String(session.author)
          : String(imported.composer || session?.composer || ""),
      composer: imported.composer || session?.composer || "",
      applyMode: session?.applyMode || "new",
      arrangementImportMode: normalizeMidiArrangementImportMode(session?.arrangementImportMode),
      bpm: session?.bpm || "",
      timingShiftSixteenths: Math.max(-15, Math.min(15, Math.round(Number(session?.timingShiftSixteenths) || 0))),
      suggestedShiftSixteenths: Math.max(-15, Math.min(15, Math.round(Number(imported?.suggestedShiftSixteenths) || 0))),
      importedKind,
      previewBarNumber: Math.max(1, Math.round(Number(session?.previewBarNumber) || 1)),
      previewTotalBars: Math.max(1, Math.round(Number(session?.previewTotalBars) || previewTotalBars || 1)),
      presetId: "manual",
      usedInstrumentIds: Array.isArray(imported.usedInstrumentIds) ? imported.usedInstrumentIds : [],
      trackConflicts: imported.trackConflicts || [],
      mappingEntries: imported.mappingEntries || [],
      unmappedNotes: imported.unmappedNotes || [],
      noteAssignments: assignments,
      noteVelocityModes: velocityModes,
    };
  }, [normalizeMidiArrangementImportMode]);
  const reopenLastMidiImportMapping = React.useCallback(() => {
    if (!lastMidiImportSession?.arrayBuffer) return;
    const imported = importDrumMidi({
      arrayBuffer: lastMidiImportSession.arrayBuffer,
      instruments: ALL_INSTRUMENTS,
      arrangementSplitBars: lastMidiImportSession.splitBars || midiImportSplitBars,
      noteAssignments: lastMidiImportSession.noteAssignments || {},
      noteVelocityModes: lastMidiImportSession.noteVelocityModes || {},
      timingShiftSixteenths: lastMidiImportSession.timingShiftSixteenths || 0,
      velocityThresholds: midiImportVelocityThresholds,
    });
    setPendingMidiImportMapping(buildPendingMidiImportMappingState({
      ...lastMidiImportSession,
      applyMode: "update-last",
    }, imported));
    setPendingMidiTempoPrompt(null);
    setIsShareActionsDialogOpen(false);
  }, [
    buildPendingMidiImportMappingState,
    lastMidiImportSession,
    midiImportSplitBars,
    midiImportVelocityThresholds,
  ]);
  const reopenLastMidiImportSettings = React.useCallback(() => {
    if (!lastMidiImportSession?.arrayBuffer) return;
    const imported = importDrumMidi({
      arrayBuffer: lastMidiImportSession.arrayBuffer,
      instruments: ALL_INSTRUMENTS,
      arrangementSplitBars: lastMidiImportSession.splitBars || midiImportSplitBars,
      noteAssignments: lastMidiImportSession.noteAssignments || {},
      noteVelocityModes: lastMidiImportSession.noteVelocityModes || {},
      timingShiftSixteenths: lastMidiImportSession.timingShiftSixteenths || 0,
      velocityThresholds: midiImportVelocityThresholds,
    });
    if (imported.kind === "needs-mapping") {
      setPendingMidiImportMapping(
        buildPendingMidiImportMappingState(
          {
            ...lastMidiImportSession,
            applyMode: "update-last",
            arrangementImportMode: normalizeMidiArrangementImportMode(
              lastMidiImportSession.arrangementImportMode
            ),
          },
          imported
        )
      );
      setPendingMidiTempoPrompt(null);
      setIsShareActionsDialogOpen(false);
      return;
    }
    setPendingMidiImportMapping(null);
    setPendingMidiTempoPrompt({
      imported,
      arrayBuffer: lastMidiImportSession.arrayBuffer,
      noteAssignments: lastMidiImportSession.noteAssignments || {},
      noteVelocityModes: lastMidiImportSession.noteVelocityModes || {},
      previewBarNumber: 1,
      timingShiftSixteenths: lastMidiImportSession.timingShiftSixteenths || 0,
      applyMode: "update-last",
      arrangementImportMode: normalizeMidiArrangementImportMode(
        lastMidiImportSession.arrangementImportMode
      ),
      titleLine1: lastMidiImportSession.titleLine1 || imported.title || "",
      titleLine2: lastMidiImportSession.titleLine2 || "",
      author: lastMidiImportSession.author || imported.composer || "",
      splitBars: Math.max(
        1,
        Math.min(8, Math.round(Number(lastMidiImportSession.splitBars) || midiImportSplitBars))
      ),
      fileMeta: {
        fileName: lastMidiImportSession.fileName || "import.mid",
        lastModified: lastMidiImportSession.lastModified || "",
      },
      tempoMultiplier: Math.max(0.25, Math.min(4, Number(lastMidiImportSession.tempoMultiplier) || 1)),
      bpm:
        Number(lastMidiImportSession.bpm) ||
        getSuggestedImportedMidiBpm(
          imported,
          bpm,
          Math.max(0.25, Math.min(4, Number(lastMidiImportSession.tempoMultiplier) || 1))
        ),
    });
    setIsShareActionsDialogOpen(false);
  }, [
    bpm,
    buildPendingMidiImportMappingState,
    getSuggestedImportedMidiBpm,
    lastMidiImportSession,
    midiImportSplitBars,
    midiImportVelocityThresholds,
    normalizeMidiArrangementImportMode,
  ]);
  const pendingMidiImportMappingLooksReady = React.useMemo(() => {
    if (!pendingMidiImportMapping) return false;
    const entries = pendingMidiImportMapping.mappingEntries || [];
    if (!entries.length) return false;
    return entries.every((entry) =>
      String(
        pendingMidiImportMapping.noteAssignments?.[String(entry.sourceKey || entry.note)] ||
          pendingMidiImportMapping.noteAssignments?.[String(entry.note)] ||
          ""
      ).trim()
    );
  }, [pendingMidiImportMapping]);
  const handleMidiImportFile = React.useCallback(
    async (file) => {
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const imported = importDrumMidi({
        arrayBuffer: buffer,
        instruments: ALL_INSTRUMENTS,
        arrangementSplitBars: midiImportSplitBars,
        timingShiftSixteenths: 0,
        velocityThresholds: midiImportVelocityThresholds,
      });
      setPendingMidiImportMapping(buildPendingMidiImportMappingState({
        arrayBuffer: buffer,
        fileName: file.name,
        lastModified: file.lastModified || "",
        title: imported.title || "",
        titleLine1: imported.title || "",
        titleLine2: "",
        author: imported.composer || "",
        composer: imported.composer || "",
        applyMode: "new",
        arrangementImportMode: midiArrangementImportMode,
        splitBars: midiImportSplitBars,
        timingShiftSixteenths: 0,
        noteAssignments: {},
        noteVelocityModes: {},
      }, imported));
      setIsShareActionsDialogOpen(false);
    },
    [buildPendingMidiImportMappingState, midiArrangementImportMode, midiImportSplitBars, midiImportVelocityThresholds]
  );
  useEffect(() => {
    const hasDraggedFiles = (event) =>
      Array.from(event?.dataTransfer?.types || []).includes("Files");
    const handleDragEnter = (event) => {
      if (!hasDraggedFiles(event)) return;
      midiWindowDragDepthRef.current += 1;
      event.preventDefault();
      setIsMidiWindowDragActive(true);
    };
    const handleDragOver = (event) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      if (!isMidiWindowDragActive) setIsMidiWindowDragActive(true);
    };
    const handleDragLeave = (event) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      midiWindowDragDepthRef.current = Math.max(0, midiWindowDragDepthRef.current - 1);
      if (midiWindowDragDepthRef.current === 0) {
        setIsMidiWindowDragActive(false);
      }
    };
    const handleDrop = async (event) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      midiWindowDragDepthRef.current = 0;
      setIsMidiWindowDragActive(false);
      const files = Array.from(event.dataTransfer?.files || []);
      const midiFile = files.find((file) => isMidiLikeFile(file));
      if (!midiFile) return;
      try {
        await handleMidiImportFile(midiFile);
      } catch (error) {
        console.error(error);
        alert(error?.message || "Failed to import MIDI");
      }
    };
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleMidiImportFile, isMidiWindowDragActive]);
  const confirmPendingMidiImportMapping = React.useCallback(() => {
    if (!pendingMidiImportMapping?.arrayBuffer) return;
    const imported = importDrumMidi({
      arrayBuffer: pendingMidiImportMapping.arrayBuffer,
      instruments: ALL_INSTRUMENTS,
      arrangementSplitBars: midiImportSplitBars,
      noteAssignments: pendingMidiImportMapping.noteAssignments || {},
      noteVelocityModes: pendingMidiImportMapping.noteVelocityModes || {},
      timingShiftSixteenths: pendingMidiImportMapping.timingShiftSixteenths || 0,
      velocityThresholds: midiImportVelocityThresholds,
    });
    if (imported.kind === "needs-mapping") {
      setPendingMidiImportMapping((prev) => (
        prev
          ? {
              ...prev,
              unmappedNotes: imported.unmappedNotes || prev.unmappedNotes,
              trackConflicts: imported.trackConflicts || prev.trackConflicts || [],
              mappingEntries: imported.mappingEntries || prev.mappingEntries || [],
            }
          : prev
      ));
      return;
    }
    if (pendingMidiImportMapping.applyMode === "update-last") {
      const nextBpm = roundTempoForImport(
        Number(pendingMidiImportMapping.bpm) ||
          Number(lastMidiImportSession?.bpm) ||
          getSuggestedImportedMidiBpm(imported, bpm)
      );
      setLastMidiImportSession((prev) => ({
        ...(prev || {}),
        arrayBuffer: pendingMidiImportMapping.arrayBuffer,
        fileName: pendingMidiImportMapping.fileName || prev?.fileName || "import.mid",
        lastModified: pendingMidiImportMapping.lastModified || prev?.lastModified || "",
        title: imported.title || prev?.title || "",
        titleLine1: pendingMidiImportMapping.titleLine1 || prev?.titleLine1 || imported.title || "",
        titleLine2: pendingMidiImportMapping.titleLine2 || prev?.titleLine2 || "",
        author: pendingMidiImportMapping.author || prev?.author || imported.composer || "",
        composer: imported.composer || prev?.composer || "",
        splitBars:
          Math.max(1, Math.min(8, Math.round(Number(prev?.splitBars) || midiImportSplitBars))),
        timingShiftSixteenths: pendingMidiImportMapping.timingShiftSixteenths || 0,
        bpm: nextBpm,
        noteAssignments: pendingMidiImportMapping.noteAssignments || {},
        noteVelocityModes: pendingMidiImportMapping.noteVelocityModes || {},
        arrangementImportMode: normalizeMidiArrangementImportMode(
          pendingMidiImportMapping.arrangementImportMode || prev?.arrangementImportMode
        ),
        kind: imported.kind === "arrangement" ? "arrangement" : "beat",
        generatedBeatIds: prev?.generatedBeatIds || [],
        generatedArrangementId: prev?.generatedArrangementId || null,
        generatedArrangementRowIds: prev?.generatedArrangementRowIds || [],
      }));
      setPendingMidiImportMapping(null);
      applyImportedMidiResult(
        imported,
        {
          fileName: pendingMidiImportMapping.fileName,
          lastModified: pendingMidiImportMapping.lastModified || "",
        },
        nextBpm,
        {
          replaceLastImport: true,
          arrangementImportMode: normalizeMidiArrangementImportMode(
            pendingMidiImportMapping.arrangementImportMode
          ),
          titleLine1: pendingMidiImportMapping.titleLine1 || "",
          titleLine2: pendingMidiImportMapping.titleLine2 || "",
          author: pendingMidiImportMapping.author || "",
        }
      );
      return;
    }
    setPendingMidiImportMapping(null);
      setPendingMidiTempoPrompt({
      imported,
      arrayBuffer: pendingMidiImportMapping.arrayBuffer,
      noteAssignments: pendingMidiImportMapping.noteAssignments || {},
        noteVelocityModes: pendingMidiImportMapping.noteVelocityModes || {},
        previewBarNumber: Math.max(1, Math.round(Number(pendingMidiImportMapping.previewBarNumber) || 1)),
        timingShiftSixteenths: pendingMidiImportMapping.timingShiftSixteenths || 0,
        applyMode: pendingMidiImportMapping.applyMode || "new",
        arrangementImportMode: normalizeMidiArrangementImportMode(
          pendingMidiImportMapping.arrangementImportMode
        ),
        titleLine1: pendingMidiImportMapping.titleLine1 || imported.title || "",
        titleLine2: pendingMidiImportMapping.titleLine2 || "",
        author: pendingMidiImportMapping.author || imported.composer || "",
        splitBars:
          Math.max(1, Math.min(8, Math.round(Number(pendingMidiImportMapping.splitBars) || midiImportSplitBars))),
        fileMeta: {
          fileName: pendingMidiImportMapping.fileName,
          lastModified: pendingMidiImportMapping.lastModified || "",
        },
      tempoMultiplier: 1,
      bpm: getSuggestedImportedMidiBpm(imported, bpm, 1),
    });
  }, [
    applyImportedMidiResult,
    bpm,
    clampBpm,
    getSuggestedImportedMidiBpm,
    lastMidiImportSession,
    midiImportSplitBars,
    midiImportVelocityThresholds,
    pendingMidiImportMapping,
  ]);
  const confirmPendingMidiTempoPrompt = React.useCallback(() => {
    if (!pendingMidiTempoPrompt?.imported) return;
    const nextBpm = roundTempoForImport(Number(pendingMidiTempoPrompt.bpm) || bpm);
    const bpmOverride = getImportedMidiBpmOverride(
      pendingMidiTempoPrompt.imported,
      pendingMidiTempoPrompt.bpm,
      bpm,
      pendingMidiTempoPrompt.tempoMultiplier
    );
    const importedForApply =
      applyImportedMidiTempoMultiplier(
        pendingMidiTempoPrompt.imported.kind === "arrangement"
          ? importDrumMidi({
              arrayBuffer: pendingMidiTempoPrompt.arrayBuffer,
              instruments: ALL_INSTRUMENTS,
              arrangementSplitBars:
                Math.max(1, Math.min(8, Math.round(Number(pendingMidiTempoPrompt.splitBars) || midiImportSplitBars))),
              noteAssignments: pendingMidiTempoPrompt.noteAssignments || {},
              noteVelocityModes: pendingMidiTempoPrompt.noteVelocityModes || {},
              timingShiftSixteenths: pendingMidiTempoPrompt.timingShiftSixteenths || 0,
              velocityThresholds: midiImportVelocityThresholds,
            })
          : pendingMidiTempoPrompt.imported,
        pendingMidiTempoPrompt.tempoMultiplier
      );
    if (importedForApply.kind === "needs-mapping") return;
    setLastMidiImportSession({
      arrayBuffer: pendingMidiTempoPrompt.arrayBuffer,
      fileName: pendingMidiTempoPrompt.fileMeta?.fileName || "import.mid",
      lastModified: pendingMidiTempoPrompt.fileMeta?.lastModified || "",
      title: importedForApply.title || "",
      titleLine1: pendingMidiTempoPrompt.titleLine1 || importedForApply.title || "",
      titleLine2: pendingMidiTempoPrompt.titleLine2 || "",
      author: pendingMidiTempoPrompt.author || importedForApply.composer || "",
      composer: importedForApply.composer || "",
      splitBars:
        Math.max(1, Math.min(8, Math.round(Number(pendingMidiTempoPrompt.splitBars) || midiImportSplitBars))),
      timingShiftSixteenths: pendingMidiTempoPrompt.timingShiftSixteenths || 0,
      tempoMultiplier: Math.max(0.25, Math.min(4, Number(pendingMidiTempoPrompt.tempoMultiplier) || 1)),
      bpm: nextBpm,
      noteAssignments: pendingMidiTempoPrompt.noteAssignments || {},
      noteVelocityModes: pendingMidiTempoPrompt.noteVelocityModes || {},
      arrangementImportMode: normalizeMidiArrangementImportMode(
        pendingMidiTempoPrompt.arrangementImportMode
      ),
    });
    setLastMidiImportSession((prev) => ({
      ...(prev || {}),
      arrayBuffer: pendingMidiTempoPrompt.arrayBuffer,
      fileName: pendingMidiTempoPrompt.fileMeta?.fileName || "import.mid",
      lastModified: pendingMidiTempoPrompt.fileMeta?.lastModified || "",
      title: importedForApply.title || "",
      titleLine1: pendingMidiTempoPrompt.titleLine1 || prev?.titleLine1 || importedForApply.title || "",
      titleLine2: pendingMidiTempoPrompt.titleLine2 || prev?.titleLine2 || "",
      author: pendingMidiTempoPrompt.author || prev?.author || importedForApply.composer || "",
      composer: importedForApply.composer || "",
      splitBars:
        Math.max(1, Math.min(8, Math.round(Number(pendingMidiTempoPrompt.splitBars) || midiImportSplitBars))),
      tempoMultiplier: Math.max(0.25, Math.min(4, Number(pendingMidiTempoPrompt.tempoMultiplier) || 1)),
      bpm: nextBpm,
      noteAssignments: pendingMidiTempoPrompt.noteAssignments || {},
      noteVelocityModes: pendingMidiTempoPrompt.noteVelocityModes || {},
      arrangementImportMode: normalizeMidiArrangementImportMode(
        pendingMidiTempoPrompt.arrangementImportMode
      ),
      kind: prev?.kind || "beat",
      generatedBeatIds: prev?.generatedBeatIds || [],
      generatedArrangementId: prev?.generatedArrangementId || null,
      generatedArrangementRowIds: prev?.generatedArrangementRowIds || [],
    }));
    applyImportedMidiResult(
      importedForApply,
      pendingMidiTempoPrompt.fileMeta || {},
      bpmOverride,
      {
        replaceLastImport: pendingMidiTempoPrompt.applyMode === "update-last",
        arrangementImportMode: normalizeMidiArrangementImportMode(
          pendingMidiTempoPrompt.arrangementImportMode
        ),
        titleLine1: pendingMidiTempoPrompt.titleLine1 || "",
        titleLine2: pendingMidiTempoPrompt.titleLine2 || "",
        author: pendingMidiTempoPrompt.author || "",
      }
    );
  }, [
    applyImportedMidiResult,
    bpm,
    clampBpm,
    getImportedMidiBpmOverride,
    midiImportSplitBars,
    midiImportVelocityThresholds,
    pendingMidiTempoPrompt,
    applyImportedMidiTempoMultiplier,
  ]);
  const pendingMidiImportVelocityRanges = React.useMemo(() => {
    const arrayBuffer = pendingMidiImportMapping?.arrayBuffer || pendingMidiTempoPrompt?.arrayBuffer;
    if (!arrayBuffer) return null;
    const noteAssignments = pendingMidiImportMapping?.noteAssignments || pendingMidiTempoPrompt?.noteAssignments || {};
    try {
      const imported = importDrumMidi({
        arrayBuffer,
        instruments: ALL_INSTRUMENTS,
        arrangementSplitBars:
          Math.max(
            1,
            Math.min(
              8,
              Math.round(
                Number(pendingMidiImportMapping?.splitBars || pendingMidiTempoPrompt?.splitBars || midiImportSplitBars)
              ) || midiImportSplitBars
            )
          ),
        noteAssignments,
        noteVelocityModes:
          pendingMidiImportMapping?.noteVelocityModes || pendingMidiTempoPrompt?.noteVelocityModes || {},
        timingShiftSixteenths:
          pendingMidiImportMapping?.timingShiftSixteenths || pendingMidiTempoPrompt?.timingShiftSixteenths || 0,
        velocityThresholds: midiImportVelocityThresholds,
      });
      return imported?.velocityRanges || null;
    } catch (_) {
      return null;
    }
  }, [midiImportSplitBars, midiImportVelocityThresholds, pendingMidiImportMapping, pendingMidiTempoPrompt]);
  const applyMidiImportMappingPreset = React.useCallback((presetId) => {
    setPendingMidiImportMapping((prev) => {
      if (!prev) return prev;
      const preset = MIDI_IMPORT_MAPPING_PRESET_BY_ID[presetId] || MIDI_IMPORT_MAPPING_PRESET_BY_ID.manual;
      if (preset.id === "manual") {
        return { ...prev, presetId: "manual" };
      }
      const nextAssignments = { ...(prev.noteAssignments || {}) };
      (prev.mappingEntries || []).forEach((entry) => {
        const mappedId = preset.assignments?.[entry.note];
        if (mappedId) {
          nextAssignments[String(entry.sourceKey || entry.note)] = mappedId;
        }
      });
      (prev.unmappedNotes || []).forEach((entry) => {
        const mappedId = preset.assignments?.[entry.note];
        if (mappedId && !Object.prototype.hasOwnProperty.call(nextAssignments, String(entry.note))) {
          nextAssignments[String(entry.note)] = mappedId;
        }
      });
      return {
        ...prev,
        presetId: preset.id,
        noteAssignments: nextAssignments,
      };
    });
  }, []);
  const handleArrangementRowSelect = React.useCallback((rowIndex, extend = false) => {
    if (!Number.isFinite(rowIndex) || rowIndex < 0) return;
    const normalizedCurrentSelection =
      arrangementSelection &&
      Number.isFinite(arrangementSelection.start) &&
      Number.isFinite(arrangementSelection.end)
        ? {
            start: Math.min(arrangementSelection.start, arrangementSelection.end),
            end: Math.max(arrangementSelection.start, arrangementSelection.end),
          }
        : null;
    if (
      !extend &&
      normalizedCurrentSelection &&
      normalizedCurrentSelection.start === rowIndex &&
      normalizedCurrentSelection.end === rowIndex
    ) {
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
      return;
    }
    if (!extend) {
      setArrangementSelection(null);
      setArrangementBarSelection(null);
    }
    if (extend && Number.isFinite(arrangementSelectionAnchor)) {
      const startRow = Math.min(arrangementSelectionAnchor, rowIndex);
      const endRow = Math.max(arrangementSelectionAnchor, rowIndex);
      const startRange = getArrangementRowBarRange(startRow);
      const endRange = getArrangementRowBarRange(endRow);
      setArrangementSelection({
        start: arrangementSelectionAnchor,
        end: rowIndex,
      });
      if (startRange && endRange) {
        setArrangementBarSelection({
          start: startRange.start,
          end: endRange.end,
        });
        setArrangementBarSelectionAnchor(startRange.start);
      }
      return;
    }
    setArrangementSelectionAnchor(rowIndex);
    setArrangementSelection({ start: rowIndex, end: rowIndex });
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
  }, [arrangementSelection, arrangementSelectionAnchor, getArrangementRowBarRange]);
  const handleArrangementNotationBarSelect = React.useCallback((barIndex, extend = false) => {
    if (!Number.isFinite(barIndex) || barIndex < 0) return;
    if (!extend) {
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
    }
    if (extend && Number.isFinite(arrangementBarSelectionAnchor)) {
      const startBar = Math.min(arrangementBarSelectionAnchor, barIndex);
      const endBar = Math.max(arrangementBarSelectionAnchor, barIndex);
      const startRow = findArrangementRowIndexForBar(startBar);
      const endRow = findArrangementRowIndexForBar(endBar);
      setArrangementBarSelection({
        start: arrangementBarSelectionAnchor,
        end: barIndex,
      });
      if (startRow >= 0 && endRow >= 0) {
        setArrangementSelection({
          start: startRow,
          end: endRow,
        });
        setArrangementSelectionAnchor(startRow);
      }
      return;
    }
    const rowIndex = findArrangementRowIndexForBar(barIndex);
    setArrangementBarSelectionAnchor(barIndex);
    setArrangementBarSelection({ start: barIndex, end: barIndex });
    if (rowIndex >= 0) {
      setArrangementSelectionAnchor(rowIndex);
      setArrangementSelection({ start: rowIndex, end: rowIndex });
    } else {
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
    }
  }, [arrangementBarSelectionAnchor, findArrangementRowIndexForBar]);
  const handleArrangementRowTouchSelect = React.useCallback((rowIndex, pointerId) => {
    const touch = arrangementTouchSelectionRef.current;
    const extend =
      Number.isFinite(pointerId) &&
      Number.isFinite(touch.pointerId) &&
      touch.pointerId !== pointerId &&
      touch.mode === "row" &&
      Number.isFinite(arrangementSelectionAnchor);
    handleArrangementRowSelect(rowIndex, extend);
    if (!Number.isFinite(touch.pointerId)) touch.pointerId = pointerId;
    touch.mode = "row";
  }, [arrangementSelectionAnchor, handleArrangementRowSelect]);
  const handleArrangementNotationBarTouchSelect = React.useCallback((barIndex, pointerId, clientX = null, clientY = null) => {
    if (!Number.isFinite(barIndex) || barIndex < 0) return;
    const touch = arrangementTouchSelectionRef.current;
    if (!Number.isFinite(pointerId)) return;
    arrangementActiveTouchPointersRef.current.add(pointerId);
    if (
      Number.isFinite(touch.pointerId) &&
      !arrangementActiveTouchPointersRef.current.has(touch.pointerId)
    ) {
      touch.pointerId = null;
      touch.mode = null;
      touch.barIndex = null;
      touch.startX = null;
      touch.startY = null;
      touch.moved = false;
    }
    if (!Number.isFinite(touch.pointerId)) {
      touch.pointerId = pointerId;
      touch.mode = "bar-arm";
      touch.barIndex = barIndex;
      touch.startX = Number.isFinite(clientX) ? clientX : null;
      touch.startY = Number.isFinite(clientY) ? clientY : null;
      touch.moved = false;
      return;
    }
    if (touch.pointerId === pointerId) return;
    if (arrangementActiveTouchPointersRef.current.size < 2) return;
    if (touch.mode !== "bar-arm" || !Number.isFinite(touch.barIndex)) return;
    const startBar = Math.min(touch.barIndex, barIndex);
    const endBar = Math.max(touch.barIndex, barIndex);
    const startRow = findArrangementRowIndexForBar(startBar);
    const endRow = findArrangementRowIndexForBar(endBar);
    setArrangementBarSelectionAnchor(touch.barIndex);
    setArrangementBarSelection({ start: touch.barIndex, end: barIndex });
    if (startRow >= 0 && endRow >= 0) {
      setArrangementSelection({ start: startRow, end: endRow });
      setArrangementSelectionAnchor(startRow);
    } else {
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
    }
    touch.pointerId = null;
    touch.mode = null;
    touch.barIndex = null;
    touch.startX = null;
    touch.startY = null;
    touch.moved = false;
  }, [findArrangementRowIndexForBar]);
  const openArrangementNotationRowMenuAtBar = React.useCallback((barIndex, clientX, clientY) => {
    if (!Number.isFinite(barIndex) || barIndex < 0) return false;
    const rowIndex = findArrangementRowIndexForBar(barIndex);
    if (!Number.isFinite(rowIndex) || rowIndex < 0) return false;
    const selectedRowIndex = normalizedArrangementSelection?.start;
    if (!Number.isFinite(selectedRowIndex) || selectedRowIndex !== rowIndex) return false;
    const menuWidth = 224;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const left = Math.max(8, Math.min(Number(clientX) - menuWidth / 2, viewportWidth - menuWidth - 8));
    const top = Math.max(8, Number(clientY) + 8);
    setArrangementNotationRowMenuState({
      rowIndex,
      position: { top, left },
    });
    return true;
  }, [findArrangementRowIndexForBar, normalizedArrangementSelection]);
  useEffect(() => {
    const trackTouchSelectionMove = (event) => {
      if (event.pointerType === "mouse") return;
      const touch = arrangementTouchSelectionRef.current;
      if (touch.pointerId !== event.pointerId) return;
      if (touch.mode !== "bar-arm") return;
      if (!Number.isFinite(touch.startX) || !Number.isFinite(touch.startY)) return;
      const dx = Math.abs((Number(event.clientX) || 0) - touch.startX);
      const dy = Math.abs((Number(event.clientY) || 0) - touch.startY);
      if (dx > 8 || dy > 8) touch.moved = true;
    };
    const resetTouchSelection = (event) => {
      if (event.pointerType === "mouse") return;
      arrangementActiveTouchPointersRef.current.delete(event.pointerId);
      const touch = arrangementTouchSelectionRef.current;
      if (touch.pointerId === event.pointerId) {
        if (
          touch.mode === "bar-arm" &&
          Number.isFinite(touch.barIndex) &&
          !touch.moved
        ) {
          handleArrangementNotationBarSelect(touch.barIndex, false);
        }
        touch.pointerId = null;
        touch.mode = null;
        touch.barIndex = null;
        touch.startX = null;
        touch.startY = null;
        touch.moved = false;
      }
    };
    window.addEventListener("pointermove", trackTouchSelectionMove, { passive: true });
    window.addEventListener("pointerup", resetTouchSelection);
    window.addEventListener("pointercancel", resetTouchSelection);
    return () => {
      window.removeEventListener("pointermove", trackTouchSelectionMove);
      window.removeEventListener("pointerup", resetTouchSelection);
      window.removeEventListener("pointercancel", resetTouchSelection);
    };
  }, [handleArrangementNotationBarSelect]);
  const selectedSavedArrangementEntry = React.useMemo(() => {
    if (!savedArrangements.length || !loadedArrangementId) return null;
    return savedArrangements.find((entry) => entry.id === loadedArrangementId) || null;
  }, [savedArrangements, loadedArrangementId]);
  const selectedLocalBeatForTrash = React.useMemo(() => {
    if (selectedBeatLibraryBeatIds.length === 1) {
      const selectedId = String(selectedBeatLibraryBeatIds[0] || "");
      const selectedBeat = localBeats.find((entry) => String(entry?.id || "") === selectedId) || null;
      if (selectedBeat) return selectedBeat;
    }
    const loadedBeat =
      loadedLocalBeatId != null
        ? localBeats.find((entry) => String(entry?.id || "") === String(loadedLocalBeatId || "")) || null
        : null;
    if (loadedBeat) return loadedBeat;
    if (!String(selectedArrangementSourceBeatKey || "").startsWith("local:")) return null;
    const beatId = String(selectedArrangementSourceBeatKey || "").slice("local:".length);
    if (!beatId) return null;
    return localBeats.find((entry) => String(entry?.id || "") === beatId) || null;
  }, [loadedLocalBeatId, localBeats, selectedArrangementSourceBeatKey, selectedBeatLibraryBeatIds]);
  const handleBeatLibrarySidebarTrashClick = React.useCallback(async () => {
    if (selection) {
      clearGridSelectionOnly();
      return;
    }
    if (selectedBeatLibraryBeatIds.length > 0) {
      const orderedSelectedIds = visibleLocalBeatIdsInLibraryOrder.filter((id) =>
        selectedBeatLibraryBeatIds.includes(id)
      );
      if (!orderedSelectedIds.length) return;
      const confirmLabel =
        orderedSelectedIds.length === 1
          ? `"${String(
              localBeats.find((beat) => String(beat?.id || "") === orderedSelectedIds[0])?.name || "this beat"
            )}"`
          : `${orderedSelectedIds.length} selected beats`;
      if (!window.confirm(`Delete ${confirmLabel}?`)) return;
      await deleteLocalBeatsByIds(orderedSelectedIds);
      clearBeatLibraryBeatSelection();
      return;
    }
    if (selectedLocalBeatForTrash?.id) {
      const beatName = String(selectedLocalBeatForTrash.name || "this beat");
      if (!window.confirm(`Delete "${beatName}"?`)) return;
      await deleteLocalBeatById(selectedLocalBeatForTrash.id);
      return;
    }
    const currentContainerId = selectedBeatLibraryContainerIdRef.current || "all";
    if (currentContainerId !== "all") {
      const folderName =
        beatLibraryContainers.find((entry) => String(entry.id) === String(currentContainerId))?.name ||
        "this folder";
      if (!window.confirm(`Delete "${folderName}"?`)) return;
      deleteBeatLibraryContainer(currentContainerId);
    }
  }, [
    beatLibraryContainers,
    clearBeatLibraryBeatSelection,
    clearGridSelectionOnly,
    deleteBeatLibraryContainer,
    deleteLocalBeatById,
    deleteLocalBeatsByIds,
    localBeats,
    selectedBeatLibraryBeatIds,
    selectedLocalBeatForTrash,
    selection,
    visibleLocalBeatIdsInLibraryOrder,
  ]);
  const arrangementDisplayName = React.useMemo(
    () =>
      getArrangementNameFromTitles(
        arrangementTitleLine1Draft,
        arrangementTitleLine2Draft,
        arrangementNameDraft || selectedSavedArrangementEntry?.name || "Arrangement"
      ),
    [
      arrangementTitleLine1Draft,
      arrangementTitleLine2Draft,
      arrangementNameDraft,
      selectedSavedArrangementEntry,
    ]
  );
  const sortedSavedArrangements = React.useMemo(() => {
    return sortSavedArrangementsMostRecent(savedArrangements);
  }, [savedArrangements]);
  const arrangementPickerEntry = React.useMemo(() => {
    if (!sortedSavedArrangements.length) return null;
    const effectivePickerId = arrangementPickerId || loadedArrangementId || "";
    if (!effectivePickerId) return sortedSavedArrangements[0] || null;
    return (
      sortedSavedArrangements.find((entry) => entry.id === effectivePickerId) ||
      sortedSavedArrangements[0] ||
      null
    );
  }, [arrangementPickerId, loadedArrangementId, sortedSavedArrangements]);
  const canRenameCurrentArrangement = Boolean(loadedArrangementId);
  const finalizeArrangementPickerRename = React.useCallback(() => {
    setArrangementPickerRenameHoverAction(null);
    setArrangementPickerRenameWidth(null);
    setIsArrangementPickerRenaming(false);
  }, []);
  const beginArrangementPickerRename = React.useCallback(() => {
    if (!canRenameCurrentArrangement) return;
    const width =
      arrangementPickerNameButtonRef.current instanceof HTMLElement
        ? Math.ceil(arrangementPickerNameButtonRef.current.getBoundingClientRect().width)
        : null;
    setArrangementNameDraft(arrangementDisplayName || "Arrangement");
    setArrangementPickerMenuOpen(false);
    setArrangementPickerRenameHoverAction("rename");
    setArrangementPickerRenameWidth(width && width > 0 ? width : null);
    setIsArrangementPickerRenaming(true);
  }, [arrangementDisplayName, canRenameCurrentArrangement]);
  const cancelArrangementPickerRename = React.useCallback(() => {
    setArrangementNameDraft(arrangementDisplayName || "Arrangement");
    finalizeArrangementPickerRename();
  }, [arrangementDisplayName, finalizeArrangementPickerRename]);
  const commitArrangementPickerRename = React.useCallback(async () => {
    if (!loadedArrangementId) {
      finalizeArrangementPickerRename();
      return;
    }
    const nextName = String(arrangementNameDraft || "").trim() || "Arrangement";
    setArrangementNameDraft(nextName);
    setArrangementTitleLine1Draft(nextName);
    setArrangementTitleLine2Draft("");
    arrangementNameDraftRef.current = nextName;
    arrangementTitleLine1DraftRef.current = nextName;
    arrangementTitleLine2DraftRef.current = "";
    await saveArrangementSnapshot({
      mode: "update",
      nameOverride: nextName,
      titleLine1Override: nextName,
      titleLine2Override: "",
    });
    finalizeArrangementPickerRename();
  }, [
    arrangementNameDraft,
    finalizeArrangementPickerRename,
    loadedArrangementId,
    saveArrangementSnapshot,
  ]);
  const saveArrangementPickerAsNew = React.useCallback(async () => {
    const nextName = String(arrangementNameDraft || "").trim() || "Arrangement";
    setArrangementNameDraft(nextName);
    setArrangementTitleLine1Draft(nextName);
    setArrangementTitleLine2Draft("");
    arrangementNameDraftRef.current = nextName;
    arrangementTitleLine1DraftRef.current = nextName;
    arrangementTitleLine2DraftRef.current = "";
    await saveArrangementSnapshot({
      mode: "saveAs",
      nameOverride: nextName,
      titleLine1Override: nextName,
      titleLine2Override: "",
      excludeId: loadedArrangementId || null,
    });
    finalizeArrangementPickerRename();
  }, [
    arrangementNameDraft,
    finalizeArrangementPickerRename,
    loadedArrangementId,
    saveArrangementSnapshot,
  ]);
  useEffect(() => {
    const seen = new Map();
    const duplicates = [];
    savedArrangements.forEach((entry, index) => {
      const id = String(entry?.id || "");
      if (!id) return;
      const existing = seen.get(id);
      if (existing != null) {
        duplicates.push({
          id,
          firstIndex: existing,
          secondIndex: index,
          firstName: String(savedArrangements[existing]?.name || ""),
          secondName: String(entry?.name || ""),
        });
        return;
      }
      seen.set(id, index);
    });
    if (duplicates.length) {
      console.warn("[arrangement-delete] duplicate arrangement ids detected", duplicates);
    }
  }, [savedArrangements]);
  useEffect(() => {
    if (!sortedSavedArrangements.length) {
      if (arrangementPickerId !== null) selectArrangementPickerId(null);
      return;
    }
    const hasCurrentPicker =
      arrangementPickerId &&
      sortedSavedArrangements.some((entry) => entry.id === arrangementPickerId);
    if (hasCurrentPicker) return;
    const nextId =
      (loadedArrangementId &&
        sortedSavedArrangements.find((entry) => entry.id === loadedArrangementId)?.id) ||
      sortedSavedArrangements[0]?.id ||
      null;
    if (nextId !== arrangementPickerId) {
      selectArrangementPickerId(nextId);
    }
  }, [arrangementPickerId, loadedArrangementId, selectArrangementPickerId, sortedSavedArrangements]);
  const arrangementHasPendingUpdate = React.useMemo(() => {
    if (!selectedSavedArrangementEntry) return false;
    const currentItems = normalizeArrangementItems(arrangementItems);
    const savedItems = normalizeArrangementItems(selectedSavedArrangementEntry.items || []);
    return (
      JSON.stringify(currentItems) !== JSON.stringify(savedItems) ||
      String(arrangementTitleLine1Draft || "") !== String(selectedSavedArrangementEntry.titleLine1 || "") ||
      String(arrangementTitleLine2Draft || "") !== String(selectedSavedArrangementEntry.titleLine2 || "") ||
      String(arrangementComposerDraft || "") !== String(selectedSavedArrangementEntry.composer || "")
    );
  }, [arrangementItems, selectedSavedArrangementEntry, arrangementTitleLine1Draft, arrangementTitleLine2Draft, arrangementComposerDraft]);
  useEffect(() => {
    if (!selectedSavedArrangementEntry || !arrangementHasPendingUpdate) return undefined;
    const timer = window.setTimeout(() => {
      saveArrangementSnapshot({ mode: "update" });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [selectedSavedArrangementEntry, arrangementHasPendingUpdate, saveArrangementSnapshot]);
  const arrangementSourceBeats =
    arrangementSourceTab === "public" ? filteredPublicBeats : filteredLocalBeats;
  const openArrangementWindow = React.useCallback(() => {
    setIsArrangementOpen((v) => !v);
  }, []);
  useEffect(() => {
    if (!savedArrangements.length) {
      if (loadedArrangementId !== null) setLoadedArrangementId(null);
      return;
    }
    const activeEntry =
      (loadedArrangementId &&
        savedArrangements.find((entry) => entry.id === loadedArrangementId)) ||
      null;
    if (!activeEntry) {
      const fallbackEntry = sortedSavedArrangements[0] || null;
      if (fallbackEntry) {
        setLoadedArrangementId(fallbackEntry.id);
        setArrangementNameDraft(
          getArrangementNameFromTitles(
            fallbackEntry.titleLine1,
            fallbackEntry.titleLine2,
            String(fallbackEntry.name || "")
          )
        );
      }
      return;
    }
    setArrangementNameDraft(
      getArrangementNameFromTitles(
        activeEntry.titleLine1,
        activeEntry.titleLine2,
      String(activeEntry.name || "")
      )
    );
  }, [loadedArrangementId, savedArrangements, sortedSavedArrangements]);
  useEffect(() => {
    if (!arrangementSelection) return;
    if (!arrangementRows.length) {
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
      return;
    }
    const maxRow = arrangementRows.length - 1;
    if (arrangementSelection.start > maxRow || arrangementSelection.end > maxRow) {
      setArrangementSelection(null);
      setArrangementSelectionAnchor(null);
    }
  }, [arrangementRows.length, arrangementSelection]);
  useEffect(() => {
    if (!arrangementBarSelection) return;
    if (arrangementTotals.totalBars < 1) {
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
      return;
    }
    const maxBar = arrangementTotals.totalBars - 1;
    if (arrangementBarSelection.start > maxBar || arrangementBarSelection.end > maxBar) {
      setArrangementBarSelection(null);
      setArrangementBarSelectionAnchor(null);
    }
  }, [arrangementBarSelection, arrangementTotals.totalBars]);
  const canUndoTop = unifiedPast.length > 0;
  const canRedoTop = unifiedFuture.length > 0;
  const handleTopUndo = React.useCallback(() => {
    if (unifiedPastRef.current.length === 0) return;
    const prev = unifiedPastRef.current[unifiedPastRef.current.length - 1];
    unifiedPastRef.current = unifiedPastRef.current.slice(0, -1);
    const inverseKind =
      prev?.editor && prev?.library ? "both" : prev?.editor ? "editor" : prev?.library ? "library" : "both";
    unifiedFutureRef.current = [
      snapshotUnifiedHistoryEntry(inverseKind),
      ...unifiedFutureRef.current,
    ];
    applyCombinedHistoryState(prev);
    syncUnifiedHistoryState();
  }, [applyCombinedHistoryState, snapshotUnifiedHistoryEntry, syncUnifiedHistoryState]);
  const handleTopRedo = React.useCallback(() => {
    if (unifiedFutureRef.current.length === 0) return;
    const next = unifiedFutureRef.current[0];
    unifiedFutureRef.current = unifiedFutureRef.current.slice(1);
    const inverseKind =
      next?.editor && next?.library ? "both" : next?.editor ? "editor" : next?.library ? "library" : "both";
    unifiedPastRef.current = [
      ...unifiedPastRef.current,
      snapshotUnifiedHistoryEntry(inverseKind),
    ];
    applyCombinedHistoryState(next);
    syncUnifiedHistoryState();
  }, [applyCombinedHistoryState, snapshotUnifiedHistoryEntry, syncUnifiedHistoryState]);
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      const isModKey = e.metaKey || e.ctrlKey;
      const key = String(e.key || "").toLowerCase();
      const isDirectUndo = isModKey && !e.altKey && key === "z" && !e.shiftKey;
      const isDirectRedo = isModKey && !e.altKey && key === "z" && e.shiftKey;
      if (isDirectRedo || matchesShortcut(e, "redo")) {
        e.preventDefault();
        e.stopPropagation();
        handleTopRedo();
        return;
      }
      if (isDirectUndo || matchesShortcut(e, "undo")) {
        e.preventDefault();
        e.stopPropagation();
        handleTopUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleTopUndo, handleTopRedo, matchesShortcut]);

  const arrangementOrderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );
  const detectArrangementOrderDropCollision = React.useCallback((args) => {
    const pointer = args?.pointerCoordinates;
    const trashEl = arrangementTrashTargetRef.current;
    let trashHover = false;
    if (pointer && trashEl) {
      const rect = trashEl.getBoundingClientRect();
      trashHover =
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom;
    }
    arrangementSortDragOverTrashRef.current = trashHover;
    if (arrangementOrderTrashHoverRef.current !== trashHover) {
      arrangementOrderTrashHoverRef.current = trashHover;
      setArrangementOrderTrashHover(trashHover);
    }
    const sortableContainers = (args?.droppableContainers || []).filter(
      (entry) => String(entry?.id || "") !== "__trash__"
    );
    const nextArgs = { ...args, droppableContainers: sortableContainers };
    if (trashHover && arrangementSortLastOverIdRef.current) {
      const lastContainer = sortableContainers.find(
        (entry) => String(entry?.id || "") === String(arrangementSortLastOverIdRef.current || "")
      );
      if (lastContainer) {
        return [{
          id: String(arrangementSortLastOverIdRef.current || ""),
          data: { droppableContainer: lastContainer, value: Number.MAX_SAFE_INTEGER },
        }];
      }
    }
    const pointerHits = pointerWithin(nextArgs);
    const nextHit = pointerHits[0] || closestCenter(nextArgs)[0] || null;
    if (nextHit?.id) {
      arrangementSortLastOverIdRef.current = String(nextHit.id || "");
      return [nextHit];
    }
    return [];
  }, []);
  const onArrangementOrderDragEnd = React.useCallback((event) => {
    const { active, over } = event;
    if (arrangementSortDragOverTrashRef.current) {
      const draggedRowIds = Array.isArray(arrangementSortDraggedRowIdsRef.current)
        ? arrangementSortDraggedRowIdsRef.current
        : [];
      if (draggedRowIds.length > 1) {
        const draggedRowIdSet = new Set(draggedRowIds.map((id) => String(id || "")));
        setArrangementItemsWithUndo((prev) =>
          prev.filter((row) => !draggedRowIdSet.has(String(row?.id || "")))
        );
        setArrangementSelection(null);
        setArrangementSelectionAnchor(null);
        setArrangementBarSelection(null);
        setArrangementBarSelectionAnchor(null);
      } else {
        arrangementRemoveRow(String(active?.id || ""));
      }
      arrangementSortLastOverIdRef.current = "";
      arrangementSortDragOverTrashRef.current = false;
      arrangementSortDraggedRowIdsRef.current = [];
      setActiveArrangementSortRowId(null);
      setArrangementOrderDropTargetId(null);
      setArrangementOrderTrashHover(false);
      return;
    }
    const overId = over ? String(over.id || "") : "";
    if (!over || active.id === over.id) {
      arrangementSortLastOverIdRef.current = "";
      arrangementSortDragOverTrashRef.current = false;
      arrangementSortDraggedRowIdsRef.current = [];
      setActiveArrangementSortRowId(null);
      setArrangementOrderDropTargetId(null);
      setArrangementOrderTrashHover(false);
      return;
    }
    setArrangementItemsWithUndo((prev) => {
      const oldIndex = prev.findIndex((row) => row.id === String(active.id));
      const newIndex = prev.findIndex((row) => row.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    arrangementSortLastOverIdRef.current = "";
    arrangementSortDragOverTrashRef.current = false;
    arrangementSortDraggedRowIdsRef.current = [];
    setActiveArrangementSortRowId(null);
    setArrangementOrderDropTargetId(null);
    setArrangementOrderTrashHover(false);
  }, [arrangementRemoveRow, setArrangementBarSelection, setArrangementBarSelectionAnchor, setArrangementItemsWithUndo, setArrangementSelection, setArrangementSelectionAnchor]);
  const restrictArrangementDragToList = React.useCallback(({ transform, activeNodeRect }) => {
    const listEl = arrangementListRef.current;
    if (!listEl || !transform || !activeNodeRect) {
      return transform ? { ...transform, x: 0 } : transform;
    }
    const listRect = listEl.getBoundingClientRect();
    const minY = listRect.top - activeNodeRect.top;
    const maxY = listRect.bottom - activeNodeRect.bottom;
    return {
      ...transform,
      x: 0,
      y: Math.max(minY, Math.min(maxY, transform.y)),
    };
  }, []);
  const restrictBeatLibraryDragToList = React.useCallback(({ transform, activeNodeRect }) => {
    const listEl = arrangementSourceListRef.current;
    if (!listEl || !transform || !activeNodeRect) {
      return transform ? { ...transform, x: 0 } : transform;
    }
    const listRect = listEl.getBoundingClientRect();
    const minY = listRect.top - activeNodeRect.top;
    const maxY = listRect.bottom - activeNodeRect.bottom;
    return {
      ...transform,
      x: 0,
      y: Math.max(minY, Math.min(maxY, transform.y)),
    };
  }, []);


  const applyLoopWrites = React.useCallback((gridState, rule, repeats = "all", overlapMode = "all-to-all", respectPlayability = false) => {
    const next = {};
    ALL_INSTRUMENTS.forEach((inst) => (next[inst.id] = [...(gridState[inst.id] || [])]));
    if (!rule || rule.length < 1) return next;

    const { rowStart, rowEnd, start, length } = rule;
    const srcByRow = {};
    for (let r = rowStart; r <= rowEnd; r++) {
      const instId = instruments[r]?.id;
      if (!instId) continue;
      srcByRow[instId] = next[instId].slice(start, start + length);
    }

    const maxRepeats =
      repeats === "off"
        ? 0
        : repeats === "all"
          ? Infinity
          : Math.max(1, Math.min(8, Number(repeats) || 1));
    const endExclusive =
      maxRepeats === 0
        ? Math.min(columns, start + length)
        : maxRepeats === Infinity
          ? columns
          : Math.min(columns, start + length * (1 + maxRepeats));

    const wouldStayPlayable = (instId, idx, nextVal) => {
      if (!respectPlayability || FOOT_INSTRUMENTS.has(instId) || nextVal === CELL.OFF) return true;
      let handHits = 0;
      for (const inst of instruments) {
        const checkId = inst?.id;
        if (!checkId || FOOT_INSTRUMENTS.has(checkId)) continue;
        const val = checkId === instId ? nextVal : (next[checkId]?.[idx] ?? CELL.OFF);
        if (val !== CELL.OFF) handHits += 1;
        if (handHits > 2) return false;
      }
      return true;
    };

    for (let idx = start + length; idx < endExclusive; idx++) {
      const i = (idx - start) % length;
      for (let r = rowStart; r <= rowEnd; r++) {
        const instId = instruments[r]?.id;
        if (!instId) continue;
        const movedVal = srcByRow[instId]?.[i] ?? CELL.OFF;
        const targetVal = next[instId]?.[idx] ?? CELL.OFF;
        if (overlapMode === "all-to-all") {
          if (!wouldStayPlayable(instId, idx, movedVal)) continue;
          next[instId][idx] = movedVal;
          continue;
        }
        if (overlapMode === "active-to-all") {
          if (movedVal !== CELL.OFF && wouldStayPlayable(instId, idx, movedVal)) next[instId][idx] = movedVal;
          continue;
        }
        if (overlapMode === "active-to-empty") {
          if (movedVal !== CELL.OFF && targetVal === CELL.OFF && wouldStayPlayable(instId, idx, movedVal)) {
            next[instId][idx] = movedVal;
          }
          continue;
        }
      }
    }
    return next;
  }, [columns, instruments]);

  const bakeLoopInto = React.useCallback(
    (prevGrid, rule, repeats = "all", overlapMode = "all-to-all", respectPlayability = false) =>
      applyLoopWrites(prevGrid, rule, repeats, overlapMode, respectPlayability),
    [applyLoopWrites]
  );

  useEffect(() => {
    if (!loopRule) return;
    const onKey = (e) => {
      if (e.key !== "Enter") return;
      if (pendingPresetChange || isKitEditorOpen || isArrangementOpen || isPublicSubmitDialogOpen || isShareActionsDialogOpen || isPrintDialogOpen || isArrangementPrintDialogOpen || isMidiDialogOpen) return;
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      setBaseGridWithUndo((prev) => bakeLoopInto(prev, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability));
      setLoopRule(null);
      setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    loopRule,
    loopRepeats,
    loopOverlapMode,
    loopRespectPlayability,
    pendingPresetChange,
    isKitEditorOpen,
    isArrangementOpen,
    isPublicSubmitDialogOpen,
    isShareActionsDialogOpen,
    isPrintDialogOpen,
    isArrangementPrintDialogOpen,
    isMidiDialogOpen,
  ]);

  const computedGrid = React.useMemo(() => {
    if (!loopRule || loopRule.length < 2) {
      const g = {};
      instruments.forEach((inst) => (g[inst.id] = [...(baseGrid[inst.id] || [])]));
      return g;
    }
    return applyLoopWrites(baseGrid, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability);
  }, [baseGrid, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability, applyLoopWrites, instruments]);
  function buildAllNotationStickingSelection() {
    return buildNotationStickingSelectionFromGridRows(computedGrid, instruments, columns);
  }
  const allNotationStickingSelection = React.useMemo(
    () => buildAllNotationStickingSelection(),
    [computedGrid, instruments]
  );
  const lastCustomNotationStickingSelectionRef = React.useRef({});
  const notationStickingSelectionStats = React.useMemo(() => {
    const selected = Object.fromEntries(
      Object.entries(notationStickingSelection || {}).filter(([, value]) => value === true)
    );
    const selectedKeys = Object.keys(selected).sort();
    const allKeys = Object.keys(allNotationStickingSelection).sort();
    const isAll =
      allKeys.length > 0 &&
      selectedKeys.length === allKeys.length &&
      allKeys.every((key, idx) => key === selectedKeys[idx]);
    return {
      selected,
      selectedCount: selectedKeys.length,
      allCount: allKeys.length,
      isAll,
      mode:
        !showNotationSticking
          ? "off"
          : notationStickingSelectionModeEnabled
            ? "custom"
          : notationStickingModePreference === "all"
            ? "all"
            : notationStickingModePreference === "custom"
              ? "custom"
              : isAll
                ? "all"
                : "custom",
    };
  }, [
    notationStickingSelection,
    allNotationStickingSelection,
    showNotationSticking,
    notationStickingSelectionModeEnabled,
    notationStickingModePreference,
  ]);
  React.useEffect(() => {
    if (notationStickingSelectionStats.mode !== "custom") return;
    if (notationStickingSelectionStats.selectedCount < 1) return;
    lastCustomNotationStickingSelectionRef.current = {
      ...notationStickingSelectionStats.selected,
    };
  }, [
    notationStickingSelectionStats.mode,
    notationStickingSelectionStats.selectedCount,
    notationStickingSelectionStats.selected,
  ]);
  React.useEffect(() => {
    if (!showNotationSticking) return;
    if (notationStickingSelectionModeEnabled) return;
    if (notationStickingModePreference !== "all") return;
    setNotationStickingSelection((prev) => {
      const prevSelected = Object.fromEntries(
        Object.entries(prev || {}).filter(([, value]) => value === true)
      );
      const prevKeys = Object.keys(prevSelected).sort();
      const nextKeys = Object.keys(allNotationStickingSelection).sort();
      const matches =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key, idx) => key === prevKeys[idx]);
      return matches ? prev : allNotationStickingSelection;
    });
  }, [
    allNotationStickingSelection,
    showNotationSticking,
    notationStickingSelectionModeEnabled,
    notationStickingModePreference,
  ]);
  const setNotationStickingPrintMode = React.useCallback((mode) => {
    const normalizedMode =
      mode === "all" ? "all" : mode === "custom" ? "custom" : "off";
    if (
      notationStickingSelectionStats.mode === "custom" &&
      notationStickingSelectionStats.selectedCount > 0
    ) {
      lastCustomNotationStickingSelectionRef.current = {
        ...notationStickingSelectionStats.selected,
      };
    }
    if (normalizedMode === "off") {
      setNotationStickingModePreference("off");
      setShowNotationSticking(false);
      setNotationStickingSelectionModeEnabled(false);
      return;
    }
    if (normalizedMode === "all") {
      setNotationStickingModePreference("all");
      setNotationStickingSelection(allNotationStickingSelection);
      setShowNotationSticking(true);
      setNotationStickingSelectionModeEnabled(false);
      return;
    }
    setNotationStickingModePreference("custom");
    const rememberedCustomSelection =
      lastCustomNotationStickingSelectionRef.current &&
      typeof lastCustomNotationStickingSelectionRef.current === "object"
        ? Object.fromEntries(
            Object.entries(lastCustomNotationStickingSelectionRef.current).filter(([, value]) => value === true)
          )
        : {};
    if (Object.keys(rememberedCustomSelection).length > 0) {
      setNotationStickingSelection(rememberedCustomSelection);
    } else if (!notationStickingSelectionStats.selectedCount && notationStickingSelectionStats.allCount > 0) {
      setNotationStickingSelection(allNotationStickingSelection);
    }
    setShowNotationSticking(true);
    setNotationStickingSelectionModeEnabled(false);
  }, [
    allNotationStickingSelection,
    notationStickingSelectionStats.selectedCount,
    notationStickingSelectionStats.allCount,
    notationStickingSelectionStats.mode,
    notationStickingSelectionStats.selected,
  ]);
  const handleCustomNotationStickingModeToggle = React.useCallback(() => {
    if (notationStickingSelectionStats.mode !== "custom") {
      setNotationStickingPrintMode("custom");
      return;
    }
    setStickingGuideEnabled(true);
    setNotationStickingSelectionModeEnabled((v) => {
      const next = !v;
      if (next) setStickingEditModeEnabled(false);
      return next;
    });
  }, [
    notationStickingSelectionStats.mode,
    setNotationStickingPrintMode,
  ]);
  const cycleNotationStickingPrintMode = React.useCallback((delta) => {
    const modes = ["off", "all", "custom"];
    const currentMode =
      notationStickingSelectionStats.mode === "all"
        ? "all"
        : notationStickingSelectionStats.mode === "custom"
          ? "custom"
          : "off";
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + delta + modes.length) % modes.length;
    setNotationStickingPrintMode(modes[nextIndex]);
  }, [
    notationStickingSelectionStats.mode,
    setNotationStickingPrintMode,
  ]);
  useEffect(() => {
    if (importedBeatLoadInProgressRef.current) return;
    setNotationStickingSelection((prev) => {
      if (!prev || typeof prev !== "object") return {};
      let changed = false;
      const next = {};
      Object.entries(prev).forEach(([key, enabled]) => {
        if (!enabled) {
          changed = true;
          return;
        }
        const [instId, rawIdx] = String(key).split(":");
        const idx = Number(rawIdx);
        if (!instId || !Number.isFinite(idx) || FOOT_INSTRUMENTS.has(instId)) {
          changed = true;
          return;
        }
        if ((computedGrid[instId]?.[idx] ?? CELL.OFF) === CELL.OFF) {
          changed = true;
          return;
        }
        next[key] = true;
      });
      return changed ? next : prev;
    });
  }, [computedGrid]);
  useEffect(() => {
    if (importedBeatLoadInProgressRef.current) return;
    if (!autoPrintNewBeatStickingEnabled) return;
    if (loadedLocalBeatId) return;
    const next = buildAllNotationStickingSelection();
    setNotationStickingSelection((prev) => {
      const prevJson = JSON.stringify(
        Object.fromEntries(Object.entries(prev || {}).filter(([, value]) => value === true))
      );
      const nextJson = JSON.stringify(next);
      return prevJson === nextJson ? prev : next;
    });
    if (Object.keys(next).length > 0) {
      setShowNotationSticking(true);
    }
  }, [
    autoPrintNewBeatStickingEnabled,
    computedGrid,
    instruments,
    loadedLocalBeatId,
  ]);
  useEffect(() => {
    if (!notationStickingSelectionModeEnabled) return;
    if (!selection) return;
    if (selectionFinalized <= 0) return;
    if (selectionFinalized === lastHandledNotationStickingSelectionFinalizedRef.current) return;

    const keys = [];
    for (let c = selection.start; c < selection.endExclusive; c++) {
      for (let r = selection.rowStart; r <= selection.rowEnd; r++) {
        const instId = instruments[r]?.id;
        if (!instId || FOOT_INSTRUMENTS.has(instId)) continue;
        if ((computedGrid[instId]?.[c] ?? CELL.OFF) === CELL.OFF) continue;
        keys.push(`${instId}:${c}`);
      }
    }
    if (!keys.length) {
      lastHandledNotationStickingSelectionFinalizedRef.current = selectionFinalized;
      return;
    }
    setAutoPrintNewBeatStickingEnabled(false);
    setNotationStickingModePreference("custom");
    setNotationStickingSelection((prev) => {
      const next = { ...(prev || {}) };
      const allSelected = keys.every((key) => next[key] === true);
      keys.forEach((key) => {
        if (allSelected) delete next[key];
        else next[key] = true;
      });
      return next;
    });
    setShowNotationSticking(true);
    setSelection(null);
    lastHandledNotationStickingSelectionFinalizedRef.current = selectionFinalized;
  }, [
    notationStickingSelectionModeEnabled,
    selection,
    selectionFinalized,
    instruments,
    computedGrid,
  ]);
  const quarterDownbeatStepSet = React.useMemo(() => {
    const out = new Set();
    const byBar = Array.isArray(quarterSubdivisionsByBar) ? quarterSubdivisionsByBar : [];
    for (let b = 0; b < byBar.length; b++) {
      const barOffset = barStepOffsets?.[b] ?? 0;
      const row = Array.isArray(byBar[b]) ? byBar[b] : [];
      let acc = 0;
      for (let q = 0; q < row.length; q++) {
        out.add(barOffset + acc);
        acc += Math.max(1, Number(row[q]) || 1);
      }
    }
    return out;
  }, [quarterSubdivisionsByBar, barStepOffsets]);
  const stepStartQuarterTimes = React.useMemo(() => {
    const out = Array(columns).fill(0);
    const byBar = Array.isArray(quarterSubdivisionsByBar) ? quarterSubdivisionsByBar : [];
    const beatUnitQuarterLength = 4 / Math.max(1, Number(timeSig?.d) || 4);
    for (let b = 0; b < byBar.length; b++) {
      const barOffset = barStepOffsets?.[b] ?? 0;
      const row = Array.isArray(byBar[b]) ? byBar[b] : [];
      let localStep = 0;
      let t = 0;
      for (let q = 0; q < row.length; q++) {
        const subdiv = Math.max(1, Number(row[q]) || 1);
        const dur = beatUnitQuarterLength / subdiv;
        for (let s = 0; s < subdiv; s++) {
          const idx = barOffset + localStep;
          if (idx >= 0 && idx < columns) out[idx] = t;
          localStep += 1;
          t += dur;
        }
      }
    }
    return out;
  }, [quarterSubdivisionsByBar, barStepOffsets, columns, timeSig]);
  const autoStickingAssignmentsByStep = React.useMemo(() => {
    const handIds = instruments.map((inst) => inst.id).filter((id) => !FOOT_INSTRUMENTS.has(id));
    const lead = stickingLeadHand === "left" ? "L" : "R";
    const favoredHand = stickingHandedness === "left" ? "L" : "R";
    const rightFavorIds = new Set(["ride", "rideBell"]);
    const alternationIds = new Set([
      "hihat",
      "hihatOpen",
      "snare",
      "tom1",
      "tom2",
      "floorTom",
      "crash1",
      "crash2",
    ]);
    const isCrashLike = (id) => id === "crash1" || id === "crash2";
    const historyKeyFor = (id) => (isCrashLike(id) ? "__crash_pair__" : id);
    const handPos = {
      L: stickingHandedness === "left" ? 2.6 : 1.4,
      R: stickingHandedness === "left" ? 1.4 : 2.6,
    };
    const canAlternateAtSpacing = (spacingQuarter) => {
      if (!Number.isFinite(spacingQuarter)) return false;
      return stickingKeepQuarterLeadHand ? spacingQuarter < 1 : spacingQuarter <= 1;
    };
    const instLast = {}; // instId -> { hand, step, wasSingle }
    const handLast = { L: null, R: null }; // hand -> { instId, step }
    let lastSingle = null; // { hand, step, instId }
    const out = Array.from({ length: columns }, () => ({}));
    const getForcedHand = (instId, step) => {
      if (instId === "ride") return "R";
      const v = stickingOverrides?.[`${instId}:${step}`];
      return v === "L" || v === "R" ? v : null;
    };

    const scoreSingle = (hand, hit, step) => {
      let score = Math.abs(hit.pos - handPos[hand]) * 1.35; // jump minimization
      if (rightFavorIds.has(hit.id)) {
        score += hand === favoredHand ? -0.85 : 0.85; // favor hats/ride on favored hand
      }
      const prev = instLast[historyKeyFor(hit.id)];
      if (prev && prev.wasSingle) {
        const prevTime = stepStartQuarterTimes[prev.step] ?? prev.step;
        const currTime = stepStartQuarterTimes[step] ?? step;
        const spacingQuarter = currTime - prevTime;
        const allowAlternation =
          alternationIds.has(hit.id) &&
          canAlternateAtSpacing(spacingQuarter);
        // alternate repeated single-surface stream
        if (allowAlternation) score += prev.hand === hand ? 1.4 : -0.45;
        // On downbeats, lean toward the configured lead hand.
        if (quarterDownbeatStepSet.has(step)) {
          score += hand === lead ? -0.7 : 0.7;
        }
      } else if (!prev) {
        // Start new single-surface streams on the configured lead hand.
        score += hand === lead ? -0.6 : 0.6;
      }
      return score;
    };

    for (let step = 0; step < columns; step++) {
      const hits = handIds
        .filter((id) => (computedGrid[id]?.[step] ?? CELL.OFF) !== CELL.OFF)
        .map((id) => ({ id, pos: getHandPositionForInstrument(id, stickingHandedness) }))
        .sort((a, b) => a.pos - b.pos);
      if (!hits.length) continue;

      if (hits.length === 1) {
        const hit = hits[0];
        const historyKey = historyKeyFor(hit.id);
        const forced = getForcedHand(hit.id, step);
        const prev = instLast[historyKey];
        const prevInst = instLast[hit.id];
        const prevTime = prev ? (stepStartQuarterTimes[prev.step] ?? prev.step) : null;
        const currTime = stepStartQuarterTimes[step] ?? step;
        const spacingQuarter = prev ? (currTime - prevTime) : null;
        const allowAlternation =
          !!prev &&
          prev.wasSingle &&
          alternationIds.has(hit.id) &&
          canAlternateAtSpacing(spacingQuarter);
        const lastSingleTime = lastSingle ? (stepStartQuarterTimes[lastSingle.step] ?? lastSingle.step) : null;
        const lastSingleSpacingQuarter =
          lastSingle ? ((stepStartQuarterTimes[step] ?? step) - lastSingleTime) : null;
        const shouldAlternateFromLastSingleAcrossInstruments =
          !!lastSingle &&
          lastSingle.instId !== hit.id &&
          canAlternateAtSpacing(lastSingleSpacingQuarter);
        let hand;
        if (forced) {
          hand = forced;
        } else if (
          prevInst &&
          !prevInst.wasSingle &&
          prevInst.step === step - 1
        ) {
          // If a two-hand hit is followed immediately by a single on one of the same instruments,
          // keep that instrument on the same hand for continuity.
          hand = prevInst.hand;
        } else if (stickingKeepQuarterLeadHand && quarterDownbeatStepSet.has(step)) {
          // Global quarter rule: single hits on quarter downbeats use the configured lead hand.
          hand = lead;
        } else if (isCrashLike(hit.id)) {
          if (!prev || !prev.wasSingle) {
            // Crash pair starts by surface: crash1 -> L, crash2 -> R.
            hand = hit.id === "crash1" ? "L" : "R";
          } else if (prev.instId === hit.id) {
            // Repeating the same crash keeps the same hand (e.g. 2 1 1 2 -> R L L R).
            hand = prev.hand;
          } else {
            // Switching crash surface alternates hand.
            hand = prev.hand === "L" ? "R" : "L";
          }
        } else if (shouldAlternateFromLastSingleAcrossInstruments) {
          // Highest-priority ergonomic rule for single hits:
          // avoid same-hand jumps between different instruments when alternation is possible.
          hand = lastSingle.hand === "L" ? "R" : "L";
        } else if ((hit.id === "hihat" || hit.id === "hihatOpen") && (!prev || !prev.wasSingle)) {
          // Explicit hi-hat stream start (only when no better cross-instrument flow applies).
          hand = "R";
        } else if (allowAlternation) {
          // Hard alternation for selected instruments.
          hand = prev.hand === "L" ? "R" : "L";
        } else if (!prev && lastSingle) {
          // For new single-surface streams, keep short-range hand flow by alternating
          // from the previous single hit (even across instruments).
          const prevTime = stepStartQuarterTimes[lastSingle.step] ?? lastSingle.step;
          const currTime = stepStartQuarterTimes[step] ?? step;
          const spacingQuarter = currTime - prevTime;
          if (canAlternateAtSpacing(spacingQuarter)) {
            hand = lastSingle.hand === "L" ? "R" : "L";
          } else {
            const sL = scoreSingle("L", hit, step);
            const sR = scoreSingle("R", hit, step);
            hand = Math.abs(sL - sR) <= 0.02 ? lead : sL < sR ? "L" : "R";
          }
        } else {
          const sL = scoreSingle("L", hit, step);
          const sR = scoreSingle("R", hit, step);
          hand = Math.abs(sL - sR) <= 0.02 ? lead : sL < sR ? "L" : "R";
        }
        out[step][hit.id] = hand;
        handPos[hand] = hit.pos;
        instLast[hit.id] = { hand, step, wasSingle: true };
        instLast[historyKey] = { hand, step, wasSingle: true, instId: hit.id };
        handLast[hand] = { instId: hit.id, step };
        lastSingle = { hand, step, instId: hit.id };
        continue;
      }

      // Try opposite-hand pairings first (avoid same hand on simultaneous hits).
      const low = hits[0];
      const high = hits[1];
      const manualForcedLow = getForcedHand(low.id, step);
      const manualForcedHigh = getForcedHand(high.id, step);
      const isCrashPair =
        (low.id === "crash1" && high.id === "crash2") ||
        (low.id === "crash2" && high.id === "crash1");
      const autoForcedLow = isCrashPair ? (low.id === "crash1" ? "L" : "R") : null;
      const autoForcedHigh = isCrashPair ? (high.id === "crash1" ? "L" : "R") : null;
      const forcedLow = manualForcedLow || autoForcedLow;
      const forcedHigh = manualForcedHigh || autoForcedHigh;
      const pairings = [
        { low: "L", high: "R" },
        { low: "R", high: "L" },
      ];
      let best = pairings[0];
      let bestScore = Infinity;
      for (const p of pairings) {
        if (forcedLow && p.low !== forcedLow) continue;
        if (forcedHigh && p.high !== forcedHigh) continue;
        if (low.id === "ride" && p.low !== "R") continue;
        if (high.id === "ride" && p.high !== "R") continue;
        let score = 0;
        score += Math.abs(low.pos - handPos[p.low]) * 1.35;
        score += Math.abs(high.pos - handPos[p.high]) * 1.35;
        if (rightFavorIds.has(low.id)) score += p.low === favoredHand ? -0.7 : 0.7;
        if (rightFavorIds.has(high.id)) score += p.high === favoredHand ? -0.7 : 0.7;
        // Prefer hand continuity on the same instrument over crossing to a different one.
        // This avoids awkward patterns like L moving from hihat to tom while the hihat switches hands.
        const applyHandContinuityPreference = (hand, instId, stepIdx) => {
          const prev = handLast[hand];
          if (!prev) return;
          const prevTime = stepStartQuarterTimes[prev.step] ?? prev.step;
          const currTime = stepStartQuarterTimes[stepIdx] ?? stepIdx;
          const spacingQuarter = currTime - prevTime;
          // Stronger at short spacing where ergonomic flow matters most.
          const weight = spacingQuarter <= 1 ? 1.2 : 0.7;
          score += prev.instId === instId ? -weight : weight;
        };
        applyHandContinuityPreference(p.low, low.id, step);
        applyHandContinuityPreference(p.high, high.id, step);
        if (score < bestScore) {
          bestScore = score;
          best = p;
        }
      }

      out[step][low.id] = best.low;
      out[step][high.id] = best.high;
      handPos[best.low] = low.pos;
      handPos[best.high] = high.pos;
      instLast[low.id] = { hand: best.low, step, wasSingle: false };
      instLast[high.id] = { hand: best.high, step, wasSingle: false };
      handLast[best.low] = { instId: low.id, step };
      handLast[best.high] = { instId: high.id, step };
      if (isCrashPair) instLast.__crash_pair__ = { hand: best.high, step, wasSingle: false, instId: high.id };
      lastSingle = null;

      // For >2 simultaneous hits, place extras by nearest hand (unavoidable overlap case).
      for (let i = 2; i < hits.length; i++) {
        const hit = hits[i];
        const historyKey = historyKeyFor(hit.id);
        const forced = getForcedHand(hit.id, step);
        const hand =
          forced || (Math.abs(hit.pos - handPos.L) <= Math.abs(hit.pos - handPos.R) ? "L" : "R");
        out[step][hit.id] = hand;
        handPos[hand] = hit.pos;
        instLast[hit.id] = { hand, step, wasSingle: false };
        instLast[historyKey] = { hand, step, wasSingle: false, instId: hit.id };
        handLast[hand] = { instId: hit.id, step };
      }
      lastSingle = null;
    }
    return out;
  }, [computedGrid, instruments, columns, stickingLeadHand, stickingHandedness, quarterDownbeatStepSet, stickingOverrides, stepStartQuarterTimes, stickingKeepQuarterLeadHand]);
  const stickingAssignmentsByStep = React.useMemo(() => {
    const out = autoStickingAssignmentsByStep.map((step) => ({ ...step }));
    Object.entries(stickingOverrides || {}).forEach(([key, hand]) => {
      const [instId, idxRaw] = key.split(":");
      const idx = Number(idxRaw);
      if (!Number.isInteger(idx) || idx < 0 || idx >= out.length) return;
      if (hand !== "L" && hand !== "R") return;
      if ((computedGrid[instId]?.[idx] ?? CELL.OFF) === CELL.OFF) return;
      out[idx][instId] = hand;
    });
    return out;
  }, [autoStickingAssignmentsByStep, stickingOverrides, computedGrid]);
  const playabilityWarningSteps = React.useMemo(() => {
    const handIds = instruments.map((inst) => inst.id).filter((id) => !FOOT_INSTRUMENTS.has(id));
    const warned = [];
    for (let step = 0; step < columns; step++) {
      let handHits = 0;
      for (const id of handIds) {
        const v = computedGrid[id]?.[step] ?? CELL.OFF;
        if (v !== CELL.OFF) handHits += 1;
        if (handHits > 2) break;
      }
      if (handHits > 2) warned.push(step);
    }
    return warned;
  }, [computedGrid, instruments, columns]);
  const playabilityWarningStepSet = React.useMemo(
    () => new Set(playabilityWarningSteps),
    [playabilityWarningSteps]
  );
  const stickingConflictSteps = React.useMemo(() => {
    const handIds = instruments.map((inst) => inst.id).filter((id) => !FOOT_INSTRUMENTS.has(id));
    const warned = [];
    for (let step = 0; step < columns; step++) {
      const counts = { L: 0, R: 0 };
      for (const id of handIds) {
        const v = computedGrid[id]?.[step] ?? CELL.OFF;
        if (v === CELL.OFF) continue;
        const hand = stickingAssignmentsByStep?.[step]?.[id];
        if (hand === "L" || hand === "R") counts[hand] += 1;
      }
      if (counts.L > 1 || counts.R > 1) warned.push(step);
    }
    return warned;
  }, [computedGrid, stickingAssignmentsByStep, instruments, columns]);
  const stickingConflictStepSet = React.useMemo(
    () => new Set(stickingConflictSteps),
    [stickingConflictSteps]
  );

  const stepQuarterDurations = React.useMemo(() => {
    const out = [];
    const beatUnitQuarterLength = 4 / Math.max(1, Number(timeSig?.d) || 4);
    quarterSubdivisionsByBar.forEach((row) => {
      row.forEach((subdiv) => {
        const s = Math.max(1, Number(subdiv) || 1);
        for (let i = 0; i < s; i++) out.push(beatUnitQuarterLength / s);
      });
    });
    return out;
  }, [quarterSubdivisionsByBar, timeSig]);
  const effectivePlaybackBpm = React.useMemo(
    () => clampBpm(Math.round(bpm * playbackRate * 100) / 100),
    [bpm, playbackRate]
  );
  const playbackRateLabel = React.useMemo(() => `x${playbackRate.toFixed(2)}`, [playbackRate]);


  const playback = usePlayback({
    instruments,
    grid: computedGrid,
    columns,
    bpm: effectivePlaybackBpm,
    resolution,
    stepQuarterDurations,
    timeSig,
    metronomeEnabled,
    metronomeVolume,
    drumVolume,
  });
  useEffect(() => {
    playheadRef.current = playback.playhead;
  }, [playback.playhead]);
  useEffect(() => {
    let cancelled = false;
    const detectBrave = async () => {
      try {
        const maybeBrave = navigator?.brave;
        if (!maybeBrave || typeof maybeBrave.isBrave !== "function") return;
        const result = await maybeBrave.isBrave();
        if (!cancelled) setIsBraveBrowser(!!result);
      } catch (_) {}
    };
    detectBrave();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unified transport toggle: matches Spacebar + Play button behavior exactly.
  const togglePlaybackFromBeginning = React.useCallback(() => {
    if (playback.isPlaying) {
      playback.stop();
    } else {
      const countInBeatDurSec = (60 / effectivePlaybackBpm) * (4 / Math.max(1, Number(timeSig?.d) || 4));
      const countInBeats = metronomeCountInEnabled ? Math.max(1, Number(timeSig?.n) || 4) : 0;
      playback.setPlayhead(0);
      playback.play({ startStep: 0, countInBeats, countInBeatDurSec });
    }
  }, [playback.isPlaying, playback.play, playback.stop, playback.setPlayhead, effectivePlaybackBpm, timeSig, metronomeCountInEnabled]);
  const activeArrangementPlaybackEntry = React.useMemo(() => {
    if (!arrangementPlaybackEnabled) return null;
    return arrangementPlayableEntries[arrangementPlaybackIndex] || null;
  }, [arrangementPlaybackEnabled, arrangementPlayableEntries, arrangementPlaybackIndex]);
  useEffect(() => {
    if (!arrangementPlaybackEnabled) {
      arrangementPlaybackEditorBeatKeyRef.current = "";
      if (!normalizedArrangementSelection) setCurrentArrangementEditorBeatKey("");
      return;
    }
    const entry = activeArrangementPlaybackEntry;
    const beat = entry?.row?.beat;
    if (!beat?.payload) return;
    const beatKey = `${String(entry?.row?.source || "")}:${String(beat.id || "")}`;
    if (!beatKey || beatKey === arrangementPlaybackEditorBeatKeyRef.current) return;
    arrangementPlaybackEditorBeatKeyRef.current = beatKey;
    setCurrentArrangementEditorBeatKey(beatKey);
    loadBeatIntoEditor(entry?.row?.source, beat);
  }, [arrangementPlaybackEnabled, activeArrangementPlaybackEntry, loadBeatIntoEditor, normalizedArrangementSelection]);
  useEffect(() => {
    const rowIndex = normalizedArrangementSelection?.start;
    if (!Number.isFinite(rowIndex) || rowIndex < 0) {
      arrangementSelectionEditorBeatKeyRef.current = "";
      if (!arrangementPlaybackEnabled) setCurrentArrangementEditorBeatKey("");
      return;
    }
    const row = arrangementRows[rowIndex];
    const beat = row?.beat;
    if (!beat?.payload) return;
    const beatKey = `${String(row?.source || "")}:${String(beat.id || "")}`;
    if (!beatKey || beatKey === arrangementSelectionEditorBeatKeyRef.current) return;
    arrangementSelectionEditorBeatKeyRef.current = beatKey;
    setCurrentArrangementEditorBeatKey(beatKey);
    loadBeatIntoEditor(row?.source, beat);
  }, [normalizedArrangementSelection, arrangementRows, loadBeatIntoEditor, arrangementPlaybackEnabled]);
  useEffect(() => {
    if (!arrangementPlaybackEnabled) {
      setActiveArrangementGlobalBarIndex(-1);
      return;
    }
    const nextBar = Number(playback.stepMeta?.globalBarIndex);
    if (!Number.isFinite(nextBar) || nextBar < 0) return;
    setActiveArrangementGlobalBarIndex((prev) => (prev === nextBar ? prev : nextBar));
  }, [arrangementPlaybackEnabled, playback.stepMeta]);
  const arrangementNotationPages = React.useMemo(() => {
    const firstPageRowBudget = 6;
    const laterPageRowBudget = 7;
    const rowItems = [];
    arrangementNotationBlocks.forEach((block, blockIdx) => {
      const rowCounts = Array.isArray(block?.barsPerRow) && block.barsPerRow.length
        ? block.barsPerRow
        : [Math.max(1, Number(block?.bars) || 1)];
      let rowBarStart = 0;
      rowCounts.forEach((rowCount, rowIdx) => {
        const count = Math.max(1, Number(rowCount) || 1);
        rowItems.push({
          blockIdx,
          rowIdx,
          startBar: rowBarStart,
          barCount: count,
        });
        rowBarStart += count;
      });
    });
    const pages = [];
    let cursor = 0;
    let pageIndex = 0;
    while (cursor < rowItems.length) {
      const rowBudgetPerPage = pageIndex === 0 ? firstPageRowBudget : laterPageRowBudget;
      const pageRows = rowItems.slice(cursor, cursor + rowBudgetPerPage);
      cursor += pageRows.length;
      const pageSegments = pageRows
        .map((segment, segmentIdx) => {
          const block = arrangementNotationBlocks[segment.blockIdx];
          if (!block) return null;
          const notation = sliceNotationStateByBars(block, segment.startBar, segment.barCount);
          if (!notation) return null;
          return {
            id: `arr-page-${pages.length}-${segmentIdx}`,
            notation,
            stickingAssignments: sliceStickingAssignmentsByBars(
              block.stickingAssignments,
              block.barStepOffsets,
              segment.startBar,
              segment.barCount
            ),
            barsPerRow: [segment.barCount],
            barsPerLine: segment.barCount,
            sectionMarkers: sliceMarkerListByBars(block.sectionMarkers, segment.startBar, segment.barCount),
            tempoMarkers: sliceMarkerListByBars(block.tempoMarkers, segment.startBar, segment.barCount),
            dynamicSpacingByBar: sliceBooleanListByBars(
              block.dynamicSpacingByBar,
              segment.startBar,
              segment.barCount,
              false
            ),
            spacingPresetByBar: sliceStringListByBars(
              block.spacingPresetByBar,
              segment.startBar,
              segment.barCount,
              "normal"
            ),
            mergeRestsByBar: sliceBooleanListByBars(
              block.mergeRestsByBar,
              segment.startBar,
              segment.barCount,
              mergeRests
            ),
            mergeNotesByBar: sliceBooleanListByBars(
              block.mergeNotesByBar,
              segment.startBar,
              segment.barCount,
              mergeNotes
            ),
            dottedNotesByBar: sliceBooleanListByBars(
              block.dottedNotesByBar,
              segment.startBar,
              segment.barCount,
              dottedNotes
            ),
            showNotationStickingByBar: sliceBooleanListByBars(
              block.showNotationStickingByBar,
              segment.startBar,
              segment.barCount,
              showNotationSticking
            ),
            startBarOffset: (block.startBarOffset || 0) + segment.startBar,
          };
        })
        .filter(Boolean);
      if (pageSegments.length) {
        pages.push({
          id: `arr-page-${pages.length}`,
          segments: pageSegments,
        });
      }
      pageIndex += 1;
    }
    return pages;
  }, [arrangementNotationBlocks, mergeRests, mergeNotes, dottedNotes]);
  const arrangementSheetPages = React.useMemo(
    () =>
      arrangementNotationPages.length
        ? arrangementNotationPages
        : [{ id: "arr-blank-page", segments: [] }],
    [arrangementNotationPages]
  );
  const activeArrangementNotationPageIndex = React.useMemo(() => {
    if (!Number.isFinite(activeArrangementGlobalBarIndex) || activeArrangementGlobalBarIndex < 0) {
      return -1;
    }
    return arrangementSheetPages.findIndex((page) =>
      (Array.isArray(page?.segments) ? page.segments : []).some((segment) => {
        const startBar = Number(segment?.startBarOffset) || 0;
        const barCount = Math.max(1, Number(segment?.notation?.bars) || 0);
        return activeArrangementGlobalBarIndex >= startBar && activeArrangementGlobalBarIndex < startBar + barCount;
      })
    );
  }, [activeArrangementGlobalBarIndex, arrangementSheetPages]);
  const [arrangementVisiblePageIndices, setArrangementVisiblePageIndices] = useState([0, 1]);
  const arrangementVisiblePageStateRef = useRef(new Map());
  const arrangementVisiblePageSet = React.useMemo(
    () => new Set(arrangementVisiblePageIndices),
    [arrangementVisiblePageIndices]
  );
  useEffect(() => {
    arrangementNotationPageRefs.current = [];
  }, [arrangementSheetPages.length]);
  useEffect(() => {
    arrangementVisiblePageStateRef.current = new Map();
  }, [arrangementSheetPages.length, arrangementNotationVirtualize]);
  useEffect(() => {
    if (!isArrangementNotationOpen) return;
    if (arrangementNotationViewMode !== "sheet" || arrangementNotationPageMode !== "pages") return;
    if (!arrangementNotationVirtualize) {
      setArrangementVisiblePageIndices(
        Array.from({ length: arrangementSheetPages.length }, (_, idx) => idx)
      );
      return;
    }
    setArrangementVisiblePageIndices((prev) => {
      const maxIndex = Math.max(0, arrangementSheetPages.length - 1);
      const next = [0, Math.min(1, maxIndex)].filter((v, idx, arr) => arr.indexOf(v) === idx);
      if (prev.length === next.length && prev.every((v, idx) => v === next[idx])) return prev;
      return next;
    });
    const root = arrangementNotationPanelRef.current;
    if (!(root instanceof HTMLElement) || arrangementSheetPages.length < 1) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute("data-arr-page-idx"));
          if (!Number.isFinite(idx) || idx < 0) return;
          arrangementVisiblePageStateRef.current.set(idx, entry.isIntersecting || entry.intersectionRatio > 0);
        });
        const visible = new Set();
        arrangementVisiblePageStateRef.current.forEach((isVisible, idx) => {
          if (!isVisible) return;
          visible.add(idx);
          if (idx > 0) visible.add(idx - 1);
          if (idx + 1 < arrangementSheetPages.length) visible.add(idx + 1);
        });
        if (!visible.size) return;
        const next = [...visible].sort((a, b) => a - b);
        setArrangementVisiblePageIndices((prev) =>
          prev.length === next.length && prev.every((v, idx) => v === next[idx]) ? prev : next
        );
      },
      {
        root,
        rootMargin: "600px 0px 600px 0px",
        threshold: 0,
      }
    );
    arrangementNotationPageRefs.current.forEach((node) => {
      if (node instanceof HTMLElement) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [
    isArrangementNotationOpen,
    arrangementNotationViewMode,
    arrangementNotationPageMode,
    arrangementNotationVirtualize,
    arrangementSheetPages.length,
  ]);
  useEffect(() => {
    if (!isArrangementNotationOpen) return;
    if (arrangementNotationViewMode !== "sheet" || arrangementNotationPageMode !== "pages") return;
    if (!arrangementNotationVirtualize) return;
    if (!arrangementPlaybackEnabled || !playback.isPlaying) return;
    if (activeArrangementNotationPageIndex < 0) return;
    const maxIndex = Math.max(0, arrangementSheetPages.length - 1);
    const wanted = [activeArrangementNotationPageIndex - 1, activeArrangementNotationPageIndex, activeArrangementNotationPageIndex + 1]
      .filter((idx) => idx >= 0 && idx <= maxIndex);
    setArrangementVisiblePageIndices((prev) => {
      const next = Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...wanted]))
        .filter((idx) => idx >= 0 && idx <= maxIndex)
        .sort((a, b) => a - b);
      return prev.length === next.length && prev.every((idx, i) => idx === next[i])
        ? prev
        : next;
    });
  }, [
    isArrangementNotationOpen,
    arrangementNotationViewMode,
    arrangementNotationPageMode,
    arrangementNotationVirtualize,
    arrangementPlaybackEnabled,
    playback.isPlaying,
    activeArrangementNotationPageIndex,
    arrangementSheetPages.length,
  ]);
  useEffect(() => {
    if (!isArrangementOpen || arrangementDetailsCollapsed) return;
    if (!arrangementPlaybackEnabled || !playback.isPlaying) return;
    if (activeArrangementPlayingRowIndex < 0) return;
    const listEl = arrangementListRef.current;
    if (!(listEl instanceof HTMLElement)) return;
    const rowEl = listEl.querySelector(
      `[data-arrangement-row-index="${activeArrangementPlayingRowIndex}"]`
    );
    if (!(rowEl instanceof HTMLElement)) return;
    window.requestAnimationFrame(() => {
      const rowTop = rowEl.offsetTop;
      const rowHeight = rowEl.offsetHeight;
      const targetTop = Math.max(
        0,
        rowTop - (listEl.clientHeight - rowHeight) * (2 / 3)
      );
      listEl.scrollTo({ top: targetTop, behavior: "smooth" });
    });
  }, [
    isArrangementOpen,
    arrangementDetailsCollapsed,
    arrangementPlaybackEnabled,
    playback.isPlaying,
    activeArrangementPlayingRowIndex,
  ]);
  useEffect(() => {
    if (!isArrangementOpen || arrangementDetailsCollapsed) return;
    if (!normalizedArrangementSelection) return;
    const listEl = arrangementListRef.current;
    if (!(listEl instanceof HTMLElement)) return;
    const rowEl = listEl.querySelector(
      `[data-arrangement-row-index="${normalizedArrangementSelection.start}"]`
    );
    if (!(rowEl instanceof HTMLElement)) return;
    window.requestAnimationFrame(() => {
      const rowTop = rowEl.offsetTop;
      const rowHeight = rowEl.offsetHeight;
      const targetTop = Math.max(
        0,
        rowTop - (listEl.clientHeight - rowHeight) * (2 / 3)
      );
      listEl.scrollTo({ top: targetTop, behavior: "smooth" });
    });
  }, [
    isArrangementOpen,
    arrangementDetailsCollapsed,
    normalizedArrangementSelection,
  ]);
  useEffect(() => {
    if (!loadedLocalBeatId) return;
    if (!isArrangementOpen || arrangementSourcesCollapsed) return;
    if (arrangementSourceTab !== "local") return;
    const wantedId = `local:${String(loadedLocalBeatId)}`;
    window.requestAnimationFrame(() => {
      const shouldAlignToFolderBottom =
        pendingBeatLibraryScrollTargetIdRef.current === wantedId;
      const candidateLists = [
        arrangementSourceListRef.current,
        dockedBeatLibrarySidebarRef.current?.querySelector?.(".dg-scroll-follow-list"),
        arrangementPanelRef.current?.querySelector?.(".dg-scroll-follow-list"),
      ].filter((node, index, arr) => node instanceof HTMLElement && arr.indexOf(node) === index);
      let scrolledAny = false;
      candidateLists.forEach((listNode) => {
        if (!(listNode instanceof HTMLElement)) return;
        const target = listNode.querySelector(
          `[data-beat-row-id="${wantedId}"]`
        );
        if (!(target instanceof HTMLElement)) return;
        scrolledAny = true;
        const rowTop = target.offsetTop;
        const rowHeight = target.offsetHeight;
        const targetTop = shouldAlignToFolderBottom
          ? Math.max(0, rowTop - (listNode.clientHeight - rowHeight))
          : Math.max(
              0,
              rowTop - (listNode.clientHeight - rowHeight) * (2 / 3)
            );
        listNode.scrollTo({ top: targetTop, behavior: "smooth" });
      });
      if (scrolledAny && shouldAlignToFolderBottom) {
        pendingBeatLibraryScrollTargetIdRef.current = "";
      }
    });
  }, [
    loadedLocalBeatId,
    localBeats,
    isArrangementOpen,
    arrangementSourcesCollapsed,
    arrangementSourceTab,
  ]);
  useEffect(() => {
    if (!selectedArrangementSourceBeatKey) return;
    const [wantedSource] = selectedArrangementSourceBeatKey.split(":");
    if (isArrangementOpen && !arrangementSourcesCollapsed) {
      setArrangementSourceTab((prev) => (prev === wantedSource ? prev : wantedSource));
    }
  }, [
    selectedArrangementSourceBeatKey,
    isArrangementOpen,
    arrangementSourcesCollapsed,
  ]);
  const handleArrangementExternalRowDragOver = React.useCallback((rowId, rowIndex, e) => {
    if (!arrangementDragBeatRef.current?.beatId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position =
      e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setArrangementDropActive(true);
    setArrangementDropTarget({ rowId, position, index: rowIndex });
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);
  const handleArrangementExternalRowDrop = React.useCallback((rowId, rowIndex, e) => {
    if (!arrangementDragBeatRef.current?.beatId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position =
      e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    dropDraggedBeatIntoArrangement(rowIndex + (position === "after" ? 1 : 0));
  }, [dropDraggedBeatIntoArrangement]);
  useEffect(() => {
    if (!isArrangementOpen || arrangementSourcesCollapsed || !selectedArrangementSourceBeatKey) return;
    window.requestAnimationFrame(() => {
      const candidateLists = [
        arrangementSourceListRef.current,
        dockedBeatLibrarySidebarRef.current?.querySelector?.(".dg-scroll-follow-list"),
        arrangementPanelRef.current?.querySelector?.(".dg-scroll-follow-list"),
      ].filter((node, index, arr) => node instanceof HTMLElement && arr.indexOf(node) === index);
      candidateLists.forEach((listNode) => {
        if (!(listNode instanceof HTMLElement)) return;
        const target = listNode.querySelector(
          `[data-beat-row-id="${selectedArrangementSourceBeatKey}"]`
        );
        if (!(target instanceof HTMLElement)) return;
        const rowTop = target.offsetTop;
        const rowHeight = target.offsetHeight;
        const targetTop = Math.max(
          0,
          rowTop - (listNode.clientHeight - rowHeight) * (2 / 3)
        );
        listNode.scrollTo({ top: targetTop, behavior: "smooth" });
      });
    });
  }, [
    selectedArrangementSourceBeatKey,
    isArrangementOpen,
    arrangementSourcesCollapsed,
    arrangementSourceTab,
  ]);
  useEffect(() => {
    if (!isArrangementNotationOpen) return;
    if (!arrangementPlaybackEnabled || !playback.isPlaying) return;
    if (activeArrangementGlobalBarIndex < 0) return;
    const panel = arrangementNotationPanelRef.current;
    if (!(panel instanceof HTMLElement)) return;
    const targets = Array.from(
      panel.querySelectorAll("[data-arr-notation-row-target='1']")
    );
    const targetIndex = targets.findIndex((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const startBar = Number(node.getAttribute("data-arr-notation-start"));
      const endBar = Number(node.getAttribute("data-arr-notation-end"));
      return Number.isFinite(startBar) && Number.isFinite(endBar) &&
        activeArrangementGlobalBarIndex >= startBar &&
        activeArrangementGlobalBarIndex < endBar;
    });
    if (targetIndex < 0) return;
    const nextBucket = Math.floor(targetIndex / Math.max(1, arrangementNotationScrollRows));
    if (nextBucket === arrangementNotationScrollBucketRef.current) return;
    arrangementNotationScrollBucketRef.current = nextBucket;
    const target = targets[targetIndex];
    if (!(target instanceof HTMLElement)) return;
    window.requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetCenter =
        (targetRect.top - panelRect.top) + panel.scrollTop + targetRect.height / 2;
      const targetTop = Math.max(
        0,
        targetCenter - panel.clientHeight / 2
      );
      panel.scrollTo({ top: targetTop, behavior: "smooth" });
    });
  }, [
    isArrangementNotationOpen,
    arrangementPlaybackEnabled,
    playback.isPlaying,
    activeArrangementGlobalBarIndex,
    arrangementNotationViewMode,
    arrangementNotationPageMode,
    arrangementNotationScrollRows,
    arrangementVisiblePageIndices,
  ]);
  useEffect(() => {
    if (!isArrangementNotationOpen) return;
    if (!normalizedArrangementBarSelection) return;
    const panel = arrangementNotationPanelRef.current;
    if (!(panel instanceof HTMLElement)) return;
    const target = Array.from(
      panel.querySelectorAll("[data-arr-notation-row-target='1']")
    ).find((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const startBar = Number(node.getAttribute("data-arr-notation-start"));
      const endBar = Number(node.getAttribute("data-arr-notation-end"));
      return Number.isFinite(startBar) && Number.isFinite(endBar) &&
        normalizedArrangementBarSelection.start >= startBar &&
        normalizedArrangementBarSelection.start < endBar;
    });
    if (!(target instanceof HTMLElement)) return;
    window.requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetCenter =
        (targetRect.top - panelRect.top) + panel.scrollTop + targetRect.height / 2;
      const targetTop = Math.max(
        0,
        targetCenter - panel.clientHeight / 2
      );
      panel.scrollTo({ top: targetTop, behavior: "smooth" });
    });
  }, [
    isArrangementNotationOpen,
    normalizedArrangementBarSelection,
    arrangementNotationViewMode,
    arrangementNotationPageMode,
  ]);
  useEffect(() => {
    if (arrangementPlaybackEnabled) return;
    arrangementNotationScrollBucketRef.current = -1;
  }, [arrangementPlaybackEnabled, arrangementNotationViewMode, arrangementNotationPageMode]);
  const computeArrangementLoopRange = React.useCallback((queue, selection) => {
    if (!selection || !Array.isArray(queue) || queue.length < 1) return null;
    const selStart = selection.start;
    const selEnd = selection.end;
    const firstInRange = queue.findIndex(
      (entry) => entry.rowIndex >= selStart && entry.rowIndex <= selEnd
    );
    let lastInRange = -1;
    for (let i = queue.length - 1; i >= 0; i--) {
      const rowIndex = queue[i]?.rowIndex;
      if (rowIndex >= selStart && rowIndex <= selEnd) {
        lastInRange = i;
        break;
      }
    }
    if (firstInRange >= 0 && lastInRange >= firstInRange) {
      return { start: firstInRange, end: lastInRange };
    }
    return null;
  }, []);
  const arrangementPlaybackLoopRange = React.useMemo(
    () => computeArrangementLoopRange(arrangementPlayableEntries, normalizedArrangementLoopSelection),
    [arrangementPlayableEntries, normalizedArrangementLoopSelection, computeArrangementLoopRange]
  );
  const stepArrangementNotationPreviewScale = React.useCallback((delta) => {
    setArrangementNotationPreviewScale((prev) => {
      const steps = ["auto", 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1];
      if (prev === "auto") {
        const nextIdx = Math.max(0, Math.min(steps.length - 1, delta > 0 ? 1 : 0));
        return steps[nextIdx];
      }
      const currentIdx = steps.reduce(
        (bestIdx, step, idx) =>
          typeof step === "number" &&
          typeof steps[bestIdx] === "number" &&
          Math.abs(step - prev) < Math.abs(steps[bestIdx] - prev)
            ? idx
            : bestIdx,
        1
      );
      const nextIdx = Math.max(0, Math.min(steps.length - 1, currentIdx + delta));
      return steps[nextIdx];
    });
  }, []);
  const arrangementCompiledPlayback = React.useMemo(() => {
    const sourceEntries = (Array.isArray(arrangementPlayableEntries) ? arrangementPlayableEntries : []).map((entry, idx) => ({
      ...entry,
      __queueIndex: idx,
    }));
    const events = [];
    const boundaries = [];
    const barStartTimes = new Map();
    let timeSec = 0;
    sourceEntries.forEach((entry) => {
      const payload = buildEffectiveNotationPayloadFromBeat(entry?.row?.beat, {
        showNotationSticking: entry?.row?.notationPrintStickingEffective === true,
      });
      const notationState = buildNotationStateFromPayload(payload);
      if (!notationState) return;
      const stepQuarterDurations = buildStepQuarterDurationsFromNotationState(notationState);
      const entryTimeSig = payload?.timeSig || { n: 4, d: 4 };
      const beatQuarterLength = 4 / Math.max(1, Number(entryTimeSig?.d) || 4);
      const beatsPerBar = Math.max(1, Math.round(Number(entryTimeSig?.n) || 4));
      const beatBars = Math.max(1, Number(entry?.row?.beatBars) || 1);
      const repeatOffsetBars = Math.max(0, Number(entry?.repeatIndex) || 0) * beatBars;
      const globalBarBase =
        Math.max(1, Number(entry?.row?.startBarNumber) || 1) - 1 + repeatOffsetBars;
      const entryStartSec = timeSec;
      const entryBpm = clampBpm(
        Math.round(
          (Math.max(20, Math.min(400, Number(entry?.row?.beatBpm || payload?.bpm || bpm) || bpm)) * playbackRate) * 100
        ) / 100
      );
      let quarterPos = 0;
      for (let step = 0; step < stepQuarterDurations.length; step++) {
        const beatPos = quarterPos / Math.max(1e-6, beatQuarterLength);
        const nearestBeat = Math.round(beatPos);
        if (metronomeEnabled && Math.abs(beatPos - nearestBeat) < 1e-6) {
          const beatIndex = ((nearestBeat % beatsPerBar) + beatsPerBar) % beatsPerBar;
          const globalBarIndex = globalBarBase + getBarIndexForStepFromPayload(payload, step);
          events.push({
            timeSec,
            hits: [{
              instId: beatIndex === 0 ? "metronomeHi" : "metronomeLo",
              state: "on",
              gain: beatIndex === 0 ? 0.95 * metronomeVolume : 0.82 * metronomeVolume,
            }],
            meta: {
              mode: "arrangement-compiled",
              queueIndex: Number(entry?.__queueIndex ?? -1),
              rowIndex: Number(entry?.rowIndex ?? -1),
              repeatIndex: Number(entry?.repeatIndex ?? 0),
              globalBarIndex,
              localStep: step,
            },
          });
        }
        const hits = [];
        (notationState.instruments || []).forEach((inst) => {
          const state = notationState.grid?.[inst.id]?.[step] ?? CELL.OFF;
          if (state === CELL.OFF) return;
          hits.push({
            instId: inst.id,
            state: state === CELL.ACCENT ? "accent" : state === CELL.GHOST ? "ghost" : "on",
          });
        });
        const globalBarIndex = globalBarBase + getBarIndexForStepFromPayload(payload, step);
        events.push({
          timeSec,
          stepIndex: step,
          hits,
          meta: {
            mode: "arrangement-compiled",
            queueIndex: Number(entry?.__queueIndex ?? -1),
            rowIndex: Number(entry?.rowIndex ?? -1),
            repeatIndex: Number(entry?.repeatIndex ?? 0),
            globalBarIndex,
            localStep: step,
          },
        });
        if (!barStartTimes.has(globalBarIndex)) {
          barStartTimes.set(globalBarIndex, timeSec);
        }
        timeSec += (60 / entryBpm) * stepQuarterDurations[step];
        quarterPos += stepQuarterDurations[step];
      }
      boundaries.push({
        queueIndex: Number(entry?.__queueIndex ?? -1),
        rowIndex: Number(entry?.rowIndex ?? -1),
        repeatIndex: Number(entry?.repeatIndex ?? 0),
        startSec: entryStartSec,
        endSec: timeSec,
      });
    });
    let playbackEvents = events;
    let playbackBoundaries = boundaries;
    let totalDurationSec = timeSec;
    let loop = false;
    let playbackBarStartTimes = barStartTimes;
    if (normalizedArrangementBarLoopSelection) {
      const startBar = normalizedArrangementBarLoopSelection.start;
      const endBar = normalizedArrangementBarLoopSelection.end;
      const startTime = barStartTimes.get(startBar) ?? 0;
      const endTime =
        barStartTimes.get(endBar + 1) ??
        timeSec;
      playbackEvents = events
        .filter((event) => event.meta?.globalBarIndex >= startBar && event.meta?.globalBarIndex <= endBar)
        .map((event) => ({ ...event, timeSec: Math.max(0, event.timeSec - startTime) }));
      const queueIndices = new Set(playbackEvents.map((event) => Number(event?.meta?.queueIndex)));
      playbackBoundaries = boundaries
        .filter((entry) => queueIndices.has(Number(entry?.queueIndex)))
        .map((entry) => ({
          ...entry,
          startSec: Math.max(0, Number(entry?.startSec) - startTime),
          endSec: Math.max(0, Number(entry?.endSec) - startTime),
        }));
      playbackBarStartTimes = new Map();
      for (let bar = startBar; bar <= endBar; bar++) {
        const barTime = barStartTimes.get(bar);
        if (!Number.isFinite(barTime)) continue;
        playbackBarStartTimes.set(bar, Math.max(0, barTime - startTime));
      }
      const nextBarTime = barStartTimes.get(endBar + 1);
      if (Number.isFinite(nextBarTime)) {
        playbackBarStartTimes.set(endBar + 1, Math.max(0, nextBarTime - startTime));
      }
      totalDurationSec = Math.max(0, endTime - startTime);
      loop = true;
    } else if (arrangementPlaybackLoopRange) {
      playbackEvents = events.filter((event) => {
        const queueIndex = Number(event?.meta?.queueIndex);
        return queueIndex >= arrangementPlaybackLoopRange.start && queueIndex <= arrangementPlaybackLoopRange.end;
      });
      const startTime = playbackEvents[0]?.timeSec ?? 0;
      playbackEvents = playbackEvents.map((event) => ({ ...event, timeSec: Math.max(0, event.timeSec - startTime) }));
      playbackBoundaries = boundaries
        .slice(arrangementPlaybackLoopRange.start, arrangementPlaybackLoopRange.end + 1)
        .map((entry) => ({
          ...entry,
          startSec: Math.max(0, Number(entry?.startSec) - startTime),
          endSec: Math.max(0, Number(entry?.endSec) - startTime),
        }));
      const queueIndexSet = new Set(
        playbackEvents
          .map((event) => Number(event?.meta?.queueIndex))
          .filter((value) => Number.isFinite(value))
      );
      playbackBarStartTimes = new Map();
      playbackEvents.forEach((event) => {
        const globalBarIndex = Number(event?.meta?.globalBarIndex);
        const barTime = Number(event?.timeSec);
        if (!Number.isFinite(globalBarIndex) || !Number.isFinite(barTime)) return;
        if (!playbackBarStartTimes.has(globalBarIndex)) {
          playbackBarStartTimes.set(globalBarIndex, barTime);
        }
      });
      const lastBoundary = boundaries[arrangementPlaybackLoopRange.end];
      const nextBarIndex = Number(lastBoundary?.globalBarIndex) + 1;
      const nextBarTime = Number(lastBoundary?.endSec);
      if (Number.isFinite(nextBarIndex) && Number.isFinite(nextBarTime)) {
        playbackBarStartTimes.set(nextBarIndex, Math.max(0, nextBarTime - startTime));
      }
      totalDurationSec = Math.max(
        0,
        (boundaries[arrangementPlaybackLoopRange.end]?.endSec ?? timeSec) -
          (boundaries[arrangementPlaybackLoopRange.start]?.startSec ?? 0)
      );
      loop = true;
    } else if (arrangementPlaybackLoopEnabled) {
      loop = true;
    }
    return {
      events: playbackEvents,
      boundaries: playbackBoundaries,
      totalDurationSec,
      loop,
      barStartTimes: playbackBarStartTimes,
    };
  }, [arrangementPlayableEntries, arrangementPlaybackLoopRange, normalizedArrangementBarLoopSelection, arrangementPlaybackLoopEnabled, bpm, playbackRate, metronomeEnabled, metronomeVolume, buildEffectiveNotationPayloadFromBeat]);
  useEffect(() => {
    arrangementPlaybackIndexRef.current = arrangementPlaybackIndex;
  }, [arrangementPlaybackIndex]);
  const startArrangementPlayback = React.useCallback((startSpec = null) => {
    const plan = arrangementCompiledPlayback;
    if (!plan?.events?.length || !plan?.boundaries?.length) return;
    if (playback.isPlaying) playback.hardStop();
    arrangementStartedRef.current = false;
    playback.setStopAtTime(null);
    let startBoundary = plan.boundaries[0];
    let startAtSec = Math.max(0, Number(startBoundary?.startSec) || 0);
    if (startSpec && typeof startSpec === "object" && Number.isFinite(startSpec.barIndex)) {
      const wantedBar = Math.max(0, Math.floor(Number(startSpec.barIndex)));
      const candidate = plan.barStartTimes?.get(wantedBar);
      if (Number.isFinite(candidate)) startAtSec = Math.max(0, candidate);
    } else if (Number.isFinite(startSpec)) {
      const wantedRow = Math.max(0, Math.floor(Number(startSpec)));
      startBoundary =
        plan.boundaries.find((entry) => entry?.rowIndex === wantedRow) ||
        startBoundary;
      startAtSec = Math.max(0, Number(startBoundary?.startSec) || 0);
    } else if (normalizedArrangementBarSelection) {
      const candidate = plan.barStartTimes?.get(normalizedArrangementBarSelection.start);
      if (Number.isFinite(candidate)) startAtSec = Math.max(0, candidate);
    } else if (normalizedArrangementSelection) {
      const wantedRow = normalizedArrangementSelection.start;
      startBoundary =
        plan.boundaries.find((entry) => entry?.rowIndex === wantedRow) ||
        startBoundary;
      startAtSec = Math.max(0, Number(startBoundary?.startSec) || 0);
    }
    const firstEventAtStart =
      plan.events.find((event) => Number(event?.timeSec) >= startAtSec - 1e-6) || null;
    const startIndex = Math.max(
      0,
      Number(firstEventAtStart?.meta?.queueIndex ?? startBoundary?.queueIndex) || 0
    );
    const startEntry = arrangementPlayableEntries[startIndex] || startBoundary;
    const startPayload = buildEffectiveNotationPayloadFromBeat(startEntry?.row?.beat, {
      showNotationSticking: startEntry?.row?.notationPrintStickingEffective === true,
    });
    const startTimeSig = startPayload?.timeSig || { n: 4, d: 4 };
    const startBpm = clampBpm(
      Math.round(
        (Math.max(20, Math.min(400, Number(startEntry?.row?.beatBpm || startPayload?.bpm || bpm) || bpm)) * playbackRate) * 100
      ) / 100
    );
    const countInBeatDurSec = (60 / startBpm) * (4 / Math.max(1, Number(startTimeSig?.d) || 4));
    const countInBeats = metronomeCountInEnabled ? Math.max(1, Number(startTimeSig?.n) || 4) : 0;
    setArrangementPlaybackIndex(startIndex);
    setArrangementPlaybackEnabled(true);
    setArrangementPlaybackUiActive(true);
    setArrangementNotationVirtualize(true);
    window.requestAnimationFrame(() => {
      playback.playCompiled({
        events: plan.events,
        startAtSec,
        totalDurationSec: Math.max(0, Number(plan.totalDurationSec) || 0),
        loop: plan.loop === true,
        countInBeats,
        countInBeatDurSec,
      }).then(() => {
        arrangementStartedRef.current = true;
      }).catch(() => {
        playback.hardStop();
        setArrangementPlaybackEnabled(false);
        setArrangementPlaybackUiActive(false);
        setArrangementPlaybackIndex(0);
        setArrangementNotationVirtualize(false);
      });
    });
  }, [
    arrangementCompiledPlayback,
    arrangementPlayableEntries,
    buildEffectiveNotationPayloadFromBeat,
    clampBpm,
    bpm,
    playbackRate,
    playback.playCompiled,
    playback.hardStop,
    playback.isPlaying,
    playback.setStopAtTime,
    normalizedArrangementBarSelection,
    normalizedArrangementSelection,
    metronomeCountInEnabled,
  ]);
  const stopArrangementPlayback = React.useCallback(() => {
    playback.hardStop();
    arrangementStartedRef.current = false;
    playback.setStopAtTime(null);
    setArrangementPlaybackEnabled(false);
    setArrangementPlaybackUiActive(false);
    setArrangementPlaybackIndex(0);
    setArrangementNotationVirtualize(false);
  }, [playback.hardStop, playback.setStopAtTime]);
  const finishArrangementPlaybackNaturally = React.useCallback(() => {
    arrangementStartedRef.current = false;
    playback.setStopAtTime(null);
    setArrangementPlaybackEnabled(false);
    setArrangementPlaybackUiActive(false);
    setArrangementPlaybackIndex(0);
    setArrangementNotationVirtualize(false);
  }, [playback.setStopAtTime]);
  useEffect(() => {
    if (!arrangementPlaybackEnabled) return;
    if (!arrangementCompiledPlayback?.boundaries?.length) {
      stopArrangementPlayback();
      return;
    }
    const maxIndex = Math.max(
      0,
      ...arrangementCompiledPlayback.boundaries.map((entry) => Number(entry?.queueIndex) || 0)
    );
    if (arrangementPlaybackIndex > maxIndex) {
      setArrangementPlaybackIndex(maxIndex);
    }
  }, [
    arrangementPlaybackEnabled,
    arrangementCompiledPlayback,
    arrangementPlaybackIndex,
    stopArrangementPlayback,
  ]);
  useEffect(() => {
    if (!arrangementPlaybackEnabled) return;
    const meta = playback.stepMeta;
    if (!meta || meta.mode !== "arrangement-compiled") return;
    const queueIndex = Number(meta.queueIndex);
    if (Number.isFinite(queueIndex) && queueIndex >= 0 && queueIndex !== arrangementPlaybackIndexRef.current) {
      setArrangementPlaybackIndex(queueIndex);
    }
  }, [arrangementPlaybackEnabled, playback.stepMeta]);
  useEffect(() => {
    if (!arrangementPlaybackEnabled) return;
    if (playback.isPlaying) return;
    if (!arrangementStartedRef.current) return;
    if (playback.endedNaturallyAt) {
      finishArrangementPlaybackNaturally();
      return;
    }
    stopArrangementPlayback();
  }, [
    arrangementPlaybackEnabled,
    playback.isPlaying,
    playback.endedNaturallyAt,
    finishArrangementPlaybackNaturally,
    stopArrangementPlayback,
  ]);
  useEffect(() => {
    if (isArrangementOpen || isArrangementNotationOpen) return;
    if (normalizedArrangementSelection || normalizedArrangementBarSelection) return;
    if (!arrangementPlaybackEnabled) return;
    playback.hardStop();
    setArrangementPlaybackEnabled(false);
    setArrangementPlaybackUiActive(false);
    arrangementStartedRef.current = false;
    playback.setStopAtTime(null);
  }, [
    isArrangementOpen,
    isArrangementNotationOpen,
    normalizedArrangementSelection,
    normalizedArrangementBarSelection,
    arrangementPlaybackEnabled,
    playback.hardStop,
  ]);
  const toggleArrangementNotationPlayback = React.useCallback(() => {
    if (arrangementPlaybackUiActive) {
      flushSync(() => {
        setArrangementPlaybackUiActive(false);
      });
      stopArrangementPlayback();
      return;
    }
    flushSync(() => {
      setArrangementPlaybackUiActive(true);
    });
    startArrangementPlayback();
  }, [arrangementPlaybackUiActive, startArrangementPlayback, stopArrangementPlayback]);
  const arrangementHeaderUsesArrangementPlayback = Boolean(
    arrangementPlaybackUiActive ||
    normalizedArrangementBarSelection ||
    normalizedArrangementSelection
  );
  const arrangementHeaderPlaybackActive = arrangementHeaderUsesArrangementPlayback
    ? arrangementPlaybackUiActive
    : playback.isPlaying;
  const selectedArrangementHeaderRowIndex = Number.isFinite(normalizedArrangementSelection?.start)
    ? normalizedArrangementSelection.start
    : -1;
  const canStepArrangementSelectionBackward = selectedArrangementHeaderRowIndex > 0;
  const canStepArrangementSelectionForward =
    selectedArrangementHeaderRowIndex >= 0 &&
    selectedArrangementHeaderRowIndex < arrangementRows.length - 1;
  const stepArrangementSelection = React.useCallback((delta) => {
    const currentRowIndex = Number.isFinite(normalizedArrangementSelection?.start)
      ? normalizedArrangementSelection.start
      : -1;
    if (currentRowIndex < 0) return;
    const nextRowIndex = Math.max(0, Math.min(arrangementRows.length - 1, currentRowIndex + delta));
    if (nextRowIndex === currentRowIndex) return;
    handleArrangementRowSelect(nextRowIndex, false);
  }, [arrangementRows.length, handleArrangementRowSelect, normalizedArrangementSelection]);

  
  const notationExportRef = useRef(null);
  const fixedFooterRef = useRef(null);
  const [shouldInlineFooterForViewport, setShouldInlineFooterForViewport] = useState(false);
  const [measuredFixedFooterHeight, setMeasuredFixedFooterHeight] = useState(112);
  const effectiveUseFixedDesktopFooter = useFixedDesktopFooter && !shouldInlineFooterForViewport;
  const fixedFooterContentPadding = effectiveUseFixedDesktopFooter
    ? Math.max(96, Math.ceil(measuredFixedFooterHeight + 24))
    : 0;

  const setNotationExportEl = React.useCallback((el) => {
    if (el) notationExportRef.current = el;
  }, []);

  useEffect(() => {
    if (isEmbedMode || !useFixedDesktopFooter) {
      setShouldInlineFooterForViewport(false);
      return;
    }
    if (typeof window === "undefined") return undefined;
    let frameId = 0;
    const measureFooterMode = () => {
      const notationEl = notationExportRef.current;
      if (!(notationEl instanceof HTMLElement)) {
        setShouldInlineFooterForViewport(false);
        return;
      }
      const notationRect = notationEl.getBoundingClientRect();
      const notationSvg =
        notationEl.querySelector?.("svg") instanceof SVGElement ? notationEl.querySelector("svg") : null;
      const notationSvgRect = notationSvg ? notationSvg.getBoundingClientRect() : null;
      const visualNotationBottom = Math.max(
        notationRect.bottom,
        notationSvgRect ? notationSvgRect.bottom : Number.NEGATIVE_INFINITY
      );
      const measuredFooterRect =
        fixedFooterRef.current instanceof HTMLElement
          ? fixedFooterRef.current.getBoundingClientRect()
          : null;
      const fixedFooterHeight =
        measuredFooterRect && measuredFooterRect.height > 0
          ? measuredFooterRect.height
          : measuredFixedFooterHeight;
      if (measuredFooterRect && measuredFooterRect.height > 0) {
        setMeasuredFixedFooterHeight((prev) =>
          Math.abs(prev - measuredFooterRect.height) < 1 ? prev : Math.ceil(measuredFooterRect.height)
        );
      }
      const desiredGap = 24;
      const estimatedFixedFooterTop = window.innerHeight - fixedFooterHeight;
      const shouldInline = visualNotationBottom + desiredGap > estimatedFixedFooterTop;
      setShouldInlineFooterForViewport((prev) => (prev === shouldInline ? prev : shouldInline));
    };
    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measureFooterMode);
    };
    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    if (notationExportRef.current instanceof HTMLElement) observer.observe(notationExportRef.current);
    const notationSvg =
      notationExportRef.current?.querySelector?.("svg") instanceof SVGElement
        ? notationExportRef.current.querySelector("svg")
        : null;
    if (notationSvg instanceof SVGElement) observer.observe(notationSvg);
    if (fixedFooterRef.current instanceof HTMLElement) observer.observe(fixedFooterRef.current);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [isEmbedMode, measuredFixedFooterHeight, useFixedDesktopFooter]);

  const handlePrintSubmit = React.useCallback(async () => {
    try {
      await beatPdfExportRef.current?.();
      setIsPrintDialogOpen(false);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to export PDF");
    }
  }, []);
  const handleBeatPngExport = React.useCallback(async () => {
    try {
      await exportNotationPng(notationExportRef.current, {
        filename: (beatNameDraft || printTitle || "Drum Notation").trim() || "Drum Notation",
        color: notationPngColor,
      });
      setIsNotationPngDialogOpen(false);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to export PNG");
    }
  }, [beatNameDraft, printTitle, notationPngColor]);
  const bakeLoopPreview = React.useCallback(() => {
    if (!loopRule) return;
    setBaseGridWithUndo((prev) => bakeLoopInto(prev, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability));
    setLoopRule(null);
    setSelection(null);
  }, [loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability]);
  const buildCurrentBeatPayload = React.useCallback(() => {
    const grid = {};
    ALL_INSTRUMENTS.forEach((inst) => {
      const row = baseGrid[inst.id] || [];
      const events = [];
      for (let idx = 0; idx < Math.min(columns, row.length); idx++) {
        const cell = row[idx];
        if (cell === CELL.ACCENT) events.push([idx, 3]);
        else if (cell === CELL.ON) events.push([idx, 1]);
        else if (cell === CELL.GHOST) events.push([idx, 2]);
      }
      if (events.length) grid[inst.id] = events;
    });
    const compactNotationStickingSelection = Object.fromEntries(
      Object.entries(notationStickingSelection || {}).filter(([, value]) => value === true)
    );
    const compactStickingOverrides = Object.fromEntries(
      Object.entries(stickingOverrides || {}).filter(
        ([key, value]) =>
          typeof key === "string" &&
          key.includes(":") &&
          (value === "L" || value === "R")
      )
    );
    return {
      v: 1,
      name: String(beatNameDraft || "").trim(),
      composer: String(printComposer || "").trim(),
      category: beatCategoryDraft === "all" ? "Groove" : String(beatCategoryDraft || "").trim(),
      style: beatStyleDraft === "all" ? "" : String(beatStyleDraft || "").trim(),
      kitInstrumentIds,
      bars,
      resolution,
      timeSig,
      bpm,
      layout,
      tupletsByBar: normalizedTupletOverridesByBar,
      grid,
      mergeRests: mergeRests !== false,
      mergeNotes: mergeNotes !== false,
      dottedNotes: dottedNotes !== false,
      stickingHandedness: stickingHandedness === "left" ? "left" : "right",
      stickingLeadHand: stickingLeadHand === "left" ? "left" : "right",
      stickingKeepQuarterLeadHand: stickingKeepQuarterLeadHand !== false,
      showNotationSticking: showNotationSticking !== false,
      notationStickingView: notationStickingView === "split-rows" ? "split-rows" : "above",
      ...(Object.keys(compactStickingOverrides).length > 0
        ? { stickingOverrides: compactStickingOverrides }
        : {}),
      ...(Object.keys(compactNotationStickingSelection).length > 0
        ? { notationStickingSelection: compactNotationStickingSelection }
        : {}),
    };
  }, [
    baseGrid,
    columns,
    beatNameDraft,
    printComposer,
    beatCategoryDraft,
    beatStyleDraft,
    kitInstrumentIds,
    bars,
    resolution,
    timeSig,
    bpm,
    layout,
    normalizedTupletOverridesByBar,
    mergeRests,
    mergeNotes,
    dottedNotes,
    stickingHandedness,
    stickingLeadHand,
    stickingKeepQuarterLeadHand,
    showNotationSticking,
    notationStickingView,
    stickingOverrides,
    notationStickingSelection,
  ]);
  const loadedLocalBeat = React.useMemo(
    () => localBeats.find((b) => String(b?.id || "") === String(loadedLocalBeatId || "")) || null,
    [localBeats, loadedLocalBeatId]
  );
  const loadedLocalBeatNotationSelectionSyncKeyRef = React.useRef("");
  useEffect(() => {
    if (!loadedLocalBeatId || !loadedLocalBeat) {
      loadedLocalBeatNotationSelectionSyncKeyRef.current = "";
      return;
    }
    if (importedBeatLoadInProgressRef.current) return;
    const syncKey = `${loadedLocalBeatId}:${loadedLocalBeat.updatedAt || loadedLocalBeat.createdAt || ""}`;
    if (loadedLocalBeatNotationSelectionSyncKeyRef.current === syncKey) return;
    const savedSelection =
      loadedLocalBeat?.notationStickingSelection &&
      typeof loadedLocalBeat.notationStickingSelection === "object"
        ? Object.fromEntries(
            Object.entries(loadedLocalBeat.notationStickingSelection).filter(([, value]) => value === true)
          )
        : loadedLocalBeat?.payload?.notationStickingSelection &&
            typeof loadedLocalBeat.payload.notationStickingSelection === "object"
          ? Object.fromEntries(
              Object.entries(loadedLocalBeat.payload.notationStickingSelection).filter(([, value]) => value === true)
            )
          : {};
    const savedShowNotationSticking = loadedLocalBeat?.payload?.showNotationSticking !== false;
    const nextSelection =
      savedShowNotationSticking && Object.keys(savedSelection).length === 0
        ? buildNotationStickingSelectionFromGridRows(computedGrid, instruments, columns)
        : savedSelection;
    loadedLocalBeatNotationSelectionSyncKeyRef.current = syncKey;
    setNotationStickingModePreference(
      !savedShowNotationSticking ? "off" : Object.keys(savedSelection).length > 0 ? "custom" : "all"
    );
    setShowNotationSticking(savedShowNotationSticking);
    setNotationStickingSelectionModeEnabled(false);
    setNotationStickingSelection(nextSelection);
  }, [loadedLocalBeatId, loadedLocalBeat, computedGrid, instruments, columns]);
  const currentBeatPayload = React.useMemo(() => buildCurrentBeatPayload(), [buildCurrentBeatPayload]);
  const normalizedCurrentPayloadJson = React.useMemo(
    () => JSON.stringify(getComparableBeatPayload(currentBeatPayload)),
    [currentBeatPayload]
  );
  const loadedLocalPayloadJson = React.useMemo(
    () => JSON.stringify(getComparableBeatPayloadForLibraryBeat(loadedLocalBeat)),
    [loadedLocalBeat]
  );
  const normalizedCurrentPayloadJsonWithoutNotationSticking = React.useMemo(
    () => JSON.stringify(getComparableBeatPayloadWithoutNotationSticking(currentBeatPayload)),
    [currentBeatPayload]
  );
  const loadedLocalPayloadJsonWithoutNotationSticking = React.useMemo(
    () =>
      JSON.stringify(
        getComparableBeatPayloadForLibraryBeatWithoutNotationSticking(loadedLocalBeat)
      ),
    [loadedLocalBeat]
  );
  const currentNotationStickingSelectionJson = React.useMemo(
    () =>
      JSON.stringify(
        ((currentBeatPayload?.notationStickingSelection &&
          typeof currentBeatPayload.notationStickingSelection === "object")
          ? currentBeatPayload.notationStickingSelection
          : {})
      ),
    [currentBeatPayload]
  );
  const loadedNotationStickingSelectionJson = React.useMemo(
    () =>
      JSON.stringify(
        loadedLocalBeat?.payload?.notationStickingSelection &&
          typeof loadedLocalBeat.payload.notationStickingSelection === "object"
          ? loadedLocalBeat.payload.notationStickingSelection
          : {}
      ),
    [loadedLocalBeat]
  );
  const normalizedDraftName = React.useMemo(() => beatNameDraft.trim(), [beatNameDraft]);
  const normalizedDraftCategory = React.useMemo(
    () => (beatCategoryDraft === "all" ? "Groove" : beatCategoryDraft),
    [beatCategoryDraft]
  );
  const normalizedDraftStyle = React.useMemo(
    () => (beatStyleDraft === "all" ? undefined : beatStyleDraft.trim() || undefined),
    [beatStyleDraft]
  );
  const isLoadedLocalBeatDirty = React.useMemo(() => {
    if (!loadedLocalBeat) return false;
    const savedName = String(loadedLocalBeat.name || "").trim();
    const savedCategory = String(loadedLocalBeat.category || "Groove");
    const savedStyle = loadedLocalBeat.style ? String(loadedLocalBeat.style).trim() : undefined;
    const nameChanged = normalizedDraftName !== savedName;
    const categoryChanged = normalizedDraftCategory !== savedCategory;
    const styleChanged = (normalizedDraftStyle || undefined) !== (savedStyle || undefined);
    const payloadChanged = normalizedCurrentPayloadJson !== loadedLocalPayloadJson;
    return nameChanged || categoryChanged || styleChanged || payloadChanged;
  }, [
    loadedLocalBeat,
    normalizedDraftName,
    normalizedDraftCategory,
    normalizedDraftStyle,
    normalizedCurrentPayloadJson,
    loadedLocalPayloadJson,
  ]);
  const isLoadedLocalBeatNameChanged = React.useMemo(() => {
    if (!loadedLocalBeat) return false;
    const savedName = String(loadedLocalBeat.name || "").trim();
    return normalizedDraftName !== savedName;
  }, [loadedLocalBeat, normalizedDraftName]);
  const isLoadedLocalBeatNotationSelectionDirty = React.useMemo(() => {
    if (!loadedLocalBeat) return false;
    return currentNotationStickingSelectionJson !== loadedNotationStickingSelectionJson;
  }, [
    loadedLocalBeat,
    currentNotationStickingSelectionJson,
    loadedNotationStickingSelectionJson,
  ]);
  useEffect(() => {
    isLoadedLocalBeatNotationSelectionDirtyRef.current = isLoadedLocalBeatNotationSelectionDirty;
  }, [isLoadedLocalBeatNotationSelectionDirty]);
  const isLoadedLocalBeatCoreDirty = React.useMemo(() => {
    if (!loadedLocalBeat) return false;
    const savedCategory = String(loadedLocalBeat.category || "Groove");
    const savedStyle = loadedLocalBeat.style ? String(loadedLocalBeat.style).trim() : undefined;
    const categoryChanged = normalizedDraftCategory !== savedCategory;
    const styleChanged = (normalizedDraftStyle || undefined) !== (savedStyle || undefined);
    const payloadChanged =
      normalizedCurrentPayloadJsonWithoutNotationSticking !==
      loadedLocalPayloadJsonWithoutNotationSticking;
    return categoryChanged || styleChanged || payloadChanged;
  }, [
    loadedLocalBeat,
    normalizedDraftCategory,
    normalizedDraftStyle,
    normalizedCurrentPayloadJsonWithoutNotationSticking,
    loadedLocalPayloadJsonWithoutNotationSticking,
  ]);
  const canUpdateLoadedLocalBeat =
    arrangementSourceTab === "local" &&
    Boolean(loadedLocalBeat) &&
    isLoadedLocalBeatDirty &&
    !isLoadedLocalBeatNameChanged &&
    isLoadedLocalBeatCoreDirty;
  const getUniqueBeatName = React.useCallback(
    (rawName, options = {}) => {
      const fallbackName = `Beat ${localBeats.length + 1}`;
      const requestedName = String(rawName || "").trim() || fallbackName;
      const excludeId = String(options.excludeId || "").trim();
      const existingNames = new Set(
        localBeats
          .filter((beat) => !excludeId || String(beat?.id || "") !== excludeId)
          .map((beat) => String(beat?.name || "").trim().toLowerCase())
          .filter(Boolean)
      );
      if (!existingNames.has(requestedName.toLowerCase())) {
        return requestedName;
      }

      const seriesRoot =
        requestedName
          .replace(/\s*-\d{2,}$/u, "")
          .replace(/\s+\d+$/u, "")
          .trim() || fallbackName;
      let suffix = 1;
      let nextName = `${seriesRoot}-${String(suffix).padStart(2, "0")}`;
      while (existingNames.has(nextName.toLowerCase())) {
        suffix += 1;
        nextName = `${seriesRoot}-${String(suffix).padStart(2, "0")}`;
      }
      return nextName;
    },
    [localBeats]
  );

  const applyImportedBeatPayload = React.useCallback(
    (payload, sourceKey) => {
      const shareSourceKey = sourceKey || `import:${Date.now()}`;
      if (!payload || typeof payload !== "object") return;
      if (appliedSharedKeyRef.current === shareSourceKey) return;
      const nextBars = Math.max(1, Math.min(8, Number(payload.bars) || 1));
      const resOrder = [4, 8, 16, 32];
      const rawRes = Number(payload.resolution);
      const nextResolution = resOrder.includes(rawRes) ? rawRes : 8;
      const rawTs = payload.timeSig || {};
      const nextTimeSig = {
        n: Math.max(1, Number(rawTs.n) || 4),
        d: Math.max(1, Number(rawTs.d) || 4),
      };
      const quarterCount = getQuarterBeatsPerBar(nextTimeSig);
      const tupletsByBar = Array.from({ length: nextBars }, (_, barIdx) =>
        Array.from({ length: quarterCount }, (_, qIdx) => {
          const raw = payload.tupletsByBar?.[barIdx]?.[qIdx];
          return clampTupletValue(raw) ?? null;
        })
      );
      const nextBaseSubdivPerQuarter = getBaseSubdivPerQuarter(nextResolution, nextTimeSig);
      const nextQuarterSubdivisionsByBar = tupletsByBar.map((row) =>
        resolveQuarterSubdivisions(row, nextBaseSubdivPerQuarter)
      );
      const nextStepsPerBarByBar = nextQuarterSubdivisionsByBar.map((row) =>
        Math.max(1, row.reduce((sum, n) => sum + Math.max(1, Number(n) || 1), 0))
      );
      const nextBarStepOffsets = [0];
      for (let i = 0; i < nextStepsPerBarByBar.length; i += 1) {
        nextBarStepOffsets.push(nextBarStepOffsets[i] + nextStepsPerBarByBar[i]);
      }
      const nextColumns = nextBarStepOffsets[nextBarStepOffsets.length - 1] ?? 0;
      const nextKitIds = Array.isArray(payload.kitInstrumentIds)
        ? [...new Set(payload.kitInstrumentIds.filter((id) => INSTRUMENT_BY_ID[id]))]
        : [];
      if (!nextKitIds.length) nextKitIds.push(...DRUMKIT_PRESETS.standard);
      const nextInstrumentDefs = nextKitIds
        .map((id) => INSTRUMENT_BY_ID[id])
        .filter(Boolean);
      const nextStickingOverrides =
        payload?.stickingOverrides && typeof payload.stickingOverrides === "object"
          ? Object.fromEntries(
              Object.entries(payload.stickingOverrides).filter(
                ([key, value]) =>
                  typeof key === "string" &&
                  key.includes(":") &&
                  (value === "L" || value === "R")
              )
            )
          : {};

      const nextGrid = {};
      ALL_INSTRUMENTS.forEach((inst) => {
        nextGrid[inst.id] = Array(nextColumns).fill(CELL.OFF);
      });
      Object.entries(payload.grid && typeof payload.grid === "object" ? payload.grid : {}).forEach(
        ([instId, events]) => {
          if (!INSTRUMENT_BY_ID[instId] || !Array.isArray(events)) return;
          events.forEach((event) => {
            if (!Array.isArray(event) || event.length < 2) return;
            const idx = Number(event[0]);
            const code = Number(event[1]);
            if (!Number.isFinite(idx) || idx < 0 || idx >= nextColumns) return;
            const nextVal =
              code === 3 ? CELL.ACCENT : code === 2 ? CELL.GHOST : code === 1 ? CELL.ON : CELL.OFF;
            if (nextVal !== CELL.OFF) nextGrid[instId][Math.floor(idx)] = nextVal;
          });
        }
      );
      const compactImportedNotationStickingSelection =
        payload.notationStickingSelection && typeof payload.notationStickingSelection === "object"
          ? Object.fromEntries(
              Object.entries(payload.notationStickingSelection).filter(([, value]) => value === true)
            )
          : {};
      const importedShowNotationSticking = payload.showNotationSticking !== false;
      const importedNotationStickingMode =
        !importedShowNotationSticking
          ? "off"
          : Object.keys(compactImportedNotationStickingSelection).length > 0
            ? "custom"
            : "all";
      const importedEffectiveNotationStickingSelection =
        importedNotationStickingMode === "all"
          ? buildNotationStickingSelectionFromGridRows(nextGrid, nextInstrumentDefs, nextColumns)
          : compactImportedNotationStickingSelection;
      importedBeatLoadInProgressRef.current = true;
      skipNextBaseGridResizeRef.current = true;
      appliedSharedKeyRef.current = shareSourceKey;
      gridPastRef.current = [];
      gridFutureRef.current = [];
      unifiedPastRef.current = [];
      unifiedFutureRef.current = [];
      flushSync(() => {
        setNotationStickingSelection(
          importedEffectiveNotationStickingSelection
        );
        setNotationStickingModePreference(importedNotationStickingMode);
        setStickingOverrides(nextStickingOverrides);
        if (payload.stickingHandedness === "left" || payload.stickingHandedness === "right") {
          setStickingHandedness(payload.stickingHandedness);
        }
        if (payload.stickingLeadHand === "left" || payload.stickingLeadHand === "right") {
          setStickingLeadHand(payload.stickingLeadHand);
        }
        if (typeof payload.stickingKeepQuarterLeadHand === "boolean") {
          setStickingKeepQuarterLeadHand(payload.stickingKeepQuarterLeadHand);
        }
        setShowNotationSticking(importedShowNotationSticking);
        if (payload.notationStickingView === "split-rows" || payload.notationStickingView === "above") {
          setNotationStickingView(payload.notationStickingView);
        }
        if (typeof payload.mergeRests === "boolean") {
          setMergeRests(payload.mergeRests);
        }
        if (typeof payload.mergeNotes === "boolean") {
          setMergeNotes(payload.mergeNotes);
        }
        if (typeof payload.dottedNotes === "boolean") {
          setDottedNotes(payload.dottedNotes);
        }

        const nextLayout = payload.layout;
        const layoutOptions = ["grid-top", "notation-top", "grid-right", "notation-right"];
        if (layoutOptions.includes(nextLayout)) setLayout(nextLayout);
        setBeatNameDraft(String(payload?.name || ""));
        if (typeof payload?.composer === "string") {
          setPrintComposer(payload.composer);
        }
        if (typeof payload?.category === "string") {
          setBeatCategoryDraft(payload.category);
        }
        if (typeof payload?.style === "string") {
          setBeatStyleDraft(payload.style);
        }
        const nextBpm = Number(payload.bpm);
        if (Number.isFinite(nextBpm)) {
          const clampedBpm = Math.max(20, Math.min(400, Math.round(nextBpm)));
          setBpm(clampedBpm);
          setBpmDraft(String(clampedBpm));
        }
        setModifiedPresetBase(null);
        setPendingPresetChange(null);
        setPendingRemoval(null);
        setSelection(null);
        setLoopRule(null);
        setActiveTab("none");
        setLoopRepeats("off");
        setNotationStickingSelectionModeEnabled(false);
        setLoadedLocalBeatId(null);
        setKitInstrumentIds(nextKitIds);
        setBars(nextBars);
        setResolution(nextResolution);
        setTimeSig(nextTimeSig);
        setTupletOverridesByBar(tupletsByBar);
        setBaseGrid(nextGrid);
      });
      syncHistoryState();
      syncUnifiedHistoryState();
      pendingSharedLoadRef.current = null;
      importedBeatLoadInProgressRef.current = false;
    },
    []
  );
  useEffect(() => {
    applyImportedBeatPayloadRef.current = applyImportedBeatPayload;
  }, [applyImportedBeatPayload]);
  useEffect(() => {
    const mappingPending = pendingMidiImportMapping;
    const tempoPending = pendingMidiTempoPrompt;
    const previewSource = tempoPending?.arrayBuffer
      ? {
          arrayBuffer: tempoPending.arrayBuffer,
          noteAssignments: tempoPending.noteAssignments || {},
          noteVelocityModes: tempoPending.noteVelocityModes || {},
          timingShiftSixteenths: tempoPending.timingShiftSixteenths || 0,
          tempoMultiplier: Math.max(0.25, Math.min(4, Number(tempoPending.tempoMultiplier) || 1)),
          bpmOverride: getImportedMidiBpmOverride(
            tempoPending.imported,
            tempoPending.bpm,
            bpm,
            tempoPending.tempoMultiplier
          ),
        }
      : mappingPending?.arrayBuffer
        ? {
            arrayBuffer: mappingPending.arrayBuffer,
            noteAssignments: mappingPending.noteAssignments || {},
            noteVelocityModes: mappingPending.noteVelocityModes || {},
            timingShiftSixteenths: mappingPending.timingShiftSixteenths || 0,
            bpmOverride: null,
          }
        : null;
    const requestedPreviewBarNumber = Math.max(
      1,
      Math.round(Number(tempoPending?.previewBarNumber || mappingPending?.previewBarNumber) || 1)
    );
    if (!previewSource?.arrayBuffer) return;
    if (!midiImportPreviewSnapshotRef.current) {
      midiImportPreviewSnapshotRef.current = {
        payload: buildCurrentBeatPayload(),
        beatNameDraft,
        beatCategoryDraft,
        beatStyleDraft,
        loadedLocalBeatId,
        printTitle,
        printComposer,
      };
    }
    const hasIncompleteMapping =
      mappingPending &&
      (mappingPending.mappingEntries || []).some(
        (entry) =>
          !String(
            mappingPending.noteAssignments?.[String(entry.sourceKey || entry.note)] ||
              mappingPending.noteAssignments?.[String(entry.note)] ||
              ""
          ).trim()
      );
    if (hasIncompleteMapping) {
      restoreMidiImportPreviewSnapshot();
      return;
    }
    let imported;
    try {
      imported = importDrumMidi({
        arrayBuffer: previewSource.arrayBuffer,
        instruments: ALL_INSTRUMENTS,
        arrangementSplitBars: midiImportSplitBars,
        noteAssignments: previewSource.noteAssignments,
        noteVelocityModes: previewSource.noteVelocityModes,
        timingShiftSixteenths: previewSource.timingShiftSixteenths || 0,
        velocityThresholds: midiImportVelocityThresholds,
      });
    } catch (_) {
      restoreMidiImportPreviewSnapshot();
      return;
    }
    if (imported.kind === "needs-mapping") {
      restoreMidiImportPreviewSnapshot();
      return;
    }
    const preparedImported = buildPreparedImportedMidiResult(
      imported,
      previewSource.bpmOverride,
      previewSource.tempoMultiplier || 1
    );
    let previewPayload =
      preparedImported.kind === "arrangement"
        ? preparedImported.sections?.[0]?.payload
        : preparedImported.payload;
    if (preparedImported.kind === "arrangement" && Array.isArray(preparedImported.sections) && preparedImported.sections.length) {
      const fullNotation = mergeNotationStates(
        preparedImported.sections
          .map((section) => buildNotationStateFromPayload(section?.payload))
          .filter(Boolean)
      );
      const totalBars = preparedImported.sections.reduce(
        (sum, section) => sum + Math.max(1, Number(section?.payload?.bars) || 1),
        0
      );
      const previewBarNumber = Math.max(1, Math.min(totalBars, requestedPreviewBarNumber));
      const slicedNotation = fullNotation
        ? sliceNotationStateByBars(fullNotation, previewBarNumber - 1, 1)
        : null;
      const slicedPayload = slicedNotation
        ? buildPayloadFromNotationState(
            slicedNotation,
            Number(preparedImported.sections?.[0]?.payload?.bpm) || Number(previewSource.bpmOverride) || 120
          )
        : null;
      if (slicedPayload) previewPayload = slicedPayload;
    }
    if (!previewPayload) {
      restoreMidiImportPreviewSnapshot();
      return;
    }
    const previewEditorBpm =
      Number(midiImportPreviewSnapshotRef.current?.payload?.bpm) ||
      Number(buildCurrentBeatPayload().bpm) ||
      120;
    const previewPayloadForEditor = {
      ...previewPayload,
      bpm: previewEditorBpm,
    };
    const previewKey = JSON.stringify({
      kind: preparedImported.kind,
      bpmOverride: previewSource.bpmOverride == null ? "" : String(previewSource.bpmOverride),
      noteAssignments: previewSource.noteAssignments,
      thresholds: midiImportVelocityThresholds,
      splitBars: midiImportSplitBars,
      previewBarNumber: requestedPreviewBarNumber,
      title: preparedImported.title || "",
      payload: previewPayloadForEditor,
    });
    if (midiImportPreviewKeyRef.current === previewKey) return;
    midiImportPreviewKeyRef.current = previewKey;
    applyImportedBeatPayloadRef.current?.(previewPayloadForEditor, `midi-preview:${previewKey}`);
  }, [
    beatCategoryDraft,
    beatNameDraft,
    beatStyleDraft,
    buildCurrentBeatPayload,
    buildPreparedImportedMidiResult,
    getImportedMidiBpmOverride,
    loadedLocalBeatId,
    midiImportSplitBars,
    midiImportVelocityThresholds,
    pendingMidiImportMapping,
    pendingMidiTempoPrompt,
    printComposer,
    printTitle,
    restoreMidiImportPreviewSnapshot,
  ]);
  const applyImportedArrangementPayload = React.useCallback((payload) => {
    const viewportWidth =
      typeof window !== "undefined"
        ? (window.innerWidth || document.documentElement.clientWidth || 0)
        : 0;
    const isMobileViewport = viewportWidth > 0 && viewportWidth < 768;
    const sharedBeats = Array.isArray(payload?.beats)
      ? payload.beats
          .map((beat, idx) => {
            const nextPayload = beat?.payload && typeof beat.payload === "object" ? beat.payload : null;
            if (!nextPayload) return null;
            const nextBpm = Number.isFinite(Number(beat?.bpm))
              ? Math.round(Number(beat.bpm))
              : Number(nextPayload.bpm) || 120;
            return {
              id: String(beat?.id || `shared-${idx + 1}`),
              name: String(beat?.name || `Beat ${idx + 1}`),
              category: String(beat?.category || "Groove"),
              style: beat?.style ? String(beat.style) : undefined,
              timeSigCategory: String(
                beat?.timeSigCategory ||
                `${Number(nextPayload.timeSig?.n) || 4}/${Number(nextPayload.timeSig?.d) || 4}`
              ),
              bpm: nextBpm,
              payload: nextPayload,
              source: "shared",
            };
          })
          .filter(Boolean)
      : [];
    const nextItems = normalizeArrangementItems(payload?.items).map((item) => ({
      ...item,
      source: "shared",
    }));
    setSharedArrangementBeats(sharedBeats);
    setLoadedArrangementId(null);
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
    setArrangementItems(nextItems);
    setArrangementNameDraft(
      getArrangementNameFromTitles(
        payload?.titleLine1,
        payload?.titleLine2,
        String(payload?.name || "")
      )
    );
    setArrangementTitleLine1Draft(String(payload?.titleLine1 || ""));
    setArrangementTitleLine2Draft(String(payload?.titleLine2 || ""));
    setArrangementComposerDraft(String(payload?.composer || ""));
    setIsArrangementOpen(true);
    setArrangementSourcesCollapsed(isMobileViewport);
    setArrangementDetailsCollapsed(false);
    const firstBeat = sharedBeats[0] || null;
    if (firstBeat?.payload) {
      applyImportedBeatPayloadRef.current?.(firstBeat.payload, `shared-arrangement:${payload?.name || ""}:0`);
      setLoadedLocalBeatId(null);
    }
  }, []);
  useEffect(() => {
    const shareSourceKey = routeOptions.shareId
      ? `g:${routeOptions.shareId}`
      : routeOptions.shared
        ? `s:${routeOptions.shared}`
        : "";
    const effectiveSharedState = routeOptions.shareId ? resolvedSharedState : requestedSharedState;
    if (!effectiveSharedState || typeof effectiveSharedState !== "object") return;
    if (effectiveSharedState.kind === "arrangement") {
      applyImportedArrangementPayload(effectiveSharedState);
      return;
    }
    setSharedArrangementBeats([]);
    applyImportedBeatPayload(effectiveSharedState, shareSourceKey);
  }, [requestedSharedState, resolvedSharedState, routeOptions.shared, routeOptions.shareId, applyImportedBeatPayload, applyImportedArrangementPayload]);
  useEffect(() => {
    const shareSourceKey = routeOptions.shareId
      ? `g:${routeOptions.shareId}`
      : routeOptions.shared
        ? `s:${routeOptions.shared}`
        : "";
    if (!shareSourceKey) return;
    const effectiveSharedState = routeOptions.shareId ? resolvedSharedState : requestedSharedState;
    if (!effectiveSharedState || typeof effectiveSharedState !== "object") return;
    if (trackedSharedOpenKeysRef.current.has(shareSourceKey)) return;
    trackedSharedOpenKeysRef.current.add(shareSourceKey);
    void trackStatsEvent("share_open", {
      shareKind: effectiveSharedState.kind === "arrangement" ? "arrangement" : "beat",
    });
  }, [requestedSharedState, resolvedSharedState, routeOptions.shared, routeOptions.shareId, trackStatsEvent]);
  const saveCurrentBeatLocal = React.useCallback(async (options = {}) => {
    const shouldAutoRename = !(options && options.autoRename === false);
    const excludeId = String(options?.excludeId || "").trim();
    const name = getUniqueBeatName(beatNameDraft, excludeId ? { excludeId } : undefined);
    const now = new Date().toISOString();
    const selectedParentId = selectedBeatLibraryContainerId !== "all" ? selectedBeatLibraryContainerId : null;
    const nextManualOrder =
      localBeats.reduce((max, beat) => {
        const meta = getBeatLibraryMeta(beat);
        if ((meta.parentId || null) !== selectedParentId) return max;
        return Math.max(max, Number(meta.manualOrder) || 0);
      }, 0) + 1;
    const payload = {
      ...buildCurrentBeatPayload(),
      libraryMeta: {
        parentId: selectedParentId,
        manualOrder: nextManualOrder,
      },
    };
    const compactNotationStickingSelection =
      payload.notationStickingSelection && typeof payload.notationStickingSelection === "object"
        ? payload.notationStickingSelection
        : {};
    const item = {
      id: `local-${Math.random().toString(36).slice(2, 10)}`,
      name,
      category: beatCategoryDraft === "all" ? "Groove" : beatCategoryDraft,
      style: beatStyleDraft === "all" ? undefined : beatStyleDraft.trim() || undefined,
      timeSigCategory: `${timeSig.n}/${timeSig.d}`,
      bpm,
      createdAt: now,
      updatedAt: now,
      payload,
      notationStickingSelection: compactNotationStickingSelection,
      libraryMeta: payload.libraryMeta,
      source: "local",
    };
    if (authUser?.id && hasSupabaseEnabled && supabase) {
      try {
        await ensureCloudBeatQuotaAvailable();
      } catch (error) {
        alert(error?.message || "Personal cloud beat limit reached.");
        return null;
      }
      let data = null;
      try {
        data = await createCloudBeatRow({
          supabase,
          row: {
            user_id: authUser.id,
            name,
            payload,
            created_at: now,
            updated_at: now,
          },
        });
      } catch (error) {
        alert(error?.message || "Failed to save beat to cloud");
        return null;
      }
      const nextItem = normalizeCloudBeatRow(data);
      if (!nextItem) return null;
      setLocalBeatsWithUndo((prev) => [nextItem, ...prev].slice(0, 500));
      pendingBeatLibraryScrollTargetIdRef.current = `local:${String(nextItem.id)}`;
      setLoadedLocalBeatId(nextItem.id);
      setUnsavedBeatStripSnapshot(null);
      setBeatNameDraft(String(nextItem.name || ""));
      setIsCurrentBeatStripRenaming(false);
      setCurrentBeatStripRenameWidth(null);
      setPendingCurrentBeatStripAutoRename(shouldAutoRename);
      void refreshUsageLimits({ silent: true });
      return nextItem;
    }
    setLocalBeatsWithUndo((prev) => [item, ...prev].slice(0, 500));
    pendingBeatLibraryScrollTargetIdRef.current = `local:${String(item.id)}`;
    setLoadedLocalBeatId(item.id);
    setUnsavedBeatStripSnapshot(null);
    setBeatNameDraft(String(item.name || ""));
    setIsCurrentBeatStripRenaming(false);
    setCurrentBeatStripRenameWidth(null);
    setPendingCurrentBeatStripAutoRename(shouldAutoRename);
    return item;
  }, [
    authUser?.id,
    selectedBeatLibraryContainerId,
    beatNameDraft,
    beatCategoryDraft,
    beatStyleDraft,
    timeSig,
    bpm,
    buildCurrentBeatPayload,
    ensureCloudBeatQuotaAvailable,
    refreshUsageLimits,
    localBeats,
    getUniqueBeatName,
    setLocalBeatsWithUndo,
  ]);
  const saveCurrentBeatAsNewAndAddToSheet = React.useCallback(async () => {
    const savedBeat = await saveCurrentBeatLocal({ autoRename: false });
    if (!savedBeat?.id) return;
    arrangementAddBeat("local", savedBeat.id, savedBeat);
    setIsArrangementNotationOpen(true);
    setArrangementNotationRowMenuState(null);
  }, [arrangementAddBeat, saveCurrentBeatLocal]);
  const canAddCurrentBeatToSheetDirectly = React.useMemo(
    () =>
      Boolean(loadedLocalBeatId) &&
      !isLoadedLocalBeatNameChanged &&
      !isLoadedLocalBeatCoreDirty &&
      !isLoadedLocalBeatNotationSelectionDirty,
    [
      loadedLocalBeatId,
      isLoadedLocalBeatNameChanged,
      isLoadedLocalBeatCoreDirty,
      isLoadedLocalBeatNotationSelectionDirty,
    ]
  );
  const currentBeatAddToSheetUsesExistingBeat = React.useMemo(
    () => Boolean(loadedLocalBeatId) && (canAddCurrentBeatToSheetDirectly || isCurrentBeatStripRenaming),
    [loadedLocalBeatId, canAddCurrentBeatToSheetDirectly, isCurrentBeatStripRenaming]
  );
  const addCurrentBeatToSheet = React.useCallback(() => {
    if (!loadedLocalBeatId) return;
    const currentBeat =
      localBeatsRef.current.find((beat) => String(beat?.id || "") === String(loadedLocalBeatId)) ||
      loadedLocalBeat ||
      null;
    arrangementAddBeat("local", loadedLocalBeatId, currentBeat);
    setIsArrangementNotationOpen(true);
    setArrangementNotationRowMenuState(null);
  }, [arrangementAddBeat, loadedLocalBeatId, loadedLocalBeat]);
  const finalizeCurrentBeatStripRename = React.useCallback(() => {
    setCurrentBeatStripRenameHoverAction(null);
    setPendingCurrentBeatStripAutoRename(false);
    setCurrentBeatStripRenameWidth(null);
    setIsCurrentBeatStripRenaming(false);
  }, []);
  const updateCurrentLoadedBeatLocal = React.useCallback(async () => {
    if (!loadedLocalBeatId) return null;
    const name = beatNameDraft.trim() || String(loadedLocalBeat?.name || "Untitled Beat");
    const existingLibraryMeta = getBeatLibraryMeta(loadedLocalBeat);
    const payload = {
      ...buildCurrentBeatPayload(),
      libraryMeta: {
        parentId: existingLibraryMeta.parentId,
        manualOrder: existingLibraryMeta.manualOrder,
      },
    };
    const compactNotationStickingSelection =
      payload.notationStickingSelection && typeof payload.notationStickingSelection === "object"
        ? payload.notationStickingSelection
        : {};
    const category = beatCategoryDraft === "all" ? "Groove" : beatCategoryDraft;
    const style = beatStyleDraft === "all" ? undefined : beatStyleDraft.trim() || undefined;
    if (authUser?.id && hasSupabaseEnabled && supabase && isUuidLike(String(loadedLocalBeatId))) {
      const now = new Date().toISOString();
      let data = null;
      try {
        data = await updateCloudBeatRow({
          supabase,
          userId: authUser.id,
          beatId: String(loadedLocalBeatId),
          select: true,
          patch: {
            name,
            payload,
            updated_at: now,
          },
        });
      } catch (error) {
        alert(error?.message || "Failed to update beat");
        return null;
      }
      const nextItem = normalizeCloudBeatRow(data);
      if (!nextItem) return null;
      setLocalBeatsWithUndo((prev) =>
        prev.map((beat) => (String(beat?.id || "") === String(loadedLocalBeatId) ? nextItem : beat))
      );
      return nextItem;
    }
    const nextBeat = {
      ...(loadedLocalBeat || {}),
      id: String(loadedLocalBeatId),
      name,
      category,
      style,
      timeSigCategory: `${timeSig.n}/${timeSig.d}`,
      bpm,
      payload,
      notationStickingSelection: compactNotationStickingSelection,
      libraryMeta: payload.libraryMeta,
      source: loadedLocalBeat?.source || "local",
    };
    setLocalBeatsWithUndo((prev) =>
      prev.map((beat) =>
        String(beat?.id || "") === String(loadedLocalBeatId)
          ? nextBeat
          : beat
      )
    );
    return nextBeat;
  }, [
    authUser?.id,
    loadedLocalBeatId,
    loadedLocalBeat,
    beatNameDraft,
    buildCurrentBeatPayload,
    beatCategoryDraft,
    beatStyleDraft,
    setLocalBeatsWithUndo,
    timeSig.n,
    timeSig.d,
    bpm,
  ]);
  const handleCurrentBeatAddToSheet = React.useCallback(async () => {
    if (loadedLocalBeatId && isCurrentBeatStripRenaming) {
      const updatedBeat = await updateCurrentLoadedBeatLocal();
      finalizeCurrentBeatStripRename();
      arrangementAddBeat("local", loadedLocalBeatId, updatedBeat || loadedLocalBeat || null);
      setIsArrangementNotationOpen(true);
      setArrangementNotationRowMenuState(null);
      return;
    }
    if (canAddCurrentBeatToSheetDirectly) {
      addCurrentBeatToSheet();
      return;
    }
    await saveCurrentBeatAsNewAndAddToSheet();
  }, [
    loadedLocalBeatId,
    isCurrentBeatStripRenaming,
    updateCurrentLoadedBeatLocal,
    finalizeCurrentBeatStripRename,
    arrangementAddBeat,
    loadedLocalBeat,
    canAddCurrentBeatToSheetDirectly,
    addCurrentBeatToSheet,
    saveCurrentBeatAsNewAndAddToSheet,
  ]);
  const currentBeatStripName = React.useMemo(() => {
    const draft = String(beatNameDraft || "").trim();
    if (draft) return draft;
    if (loadedLocalBeat?.name) return String(loadedLocalBeat.name);
    return "Untitled beat";
  }, [beatNameDraft, loadedLocalBeat]);
  const currentBeatStripSource = React.useMemo(() => {
    if (loadedLocalBeatId) return "local";
    const editorKey = String(currentEditorBeatKey || "");
    if (editorKey.startsWith("public:")) return "public";
    if (editorKey.startsWith("shared:")) return "shared";
    if (editorKey.startsWith("local:")) return "local";
    return "";
  }, [currentEditorBeatKey, loadedLocalBeatId]);
  const isUnsavedBeatStripDraftActive = React.useMemo(
    () =>
      !loadedLocalBeatId &&
      !String(currentEditorBeatKey || "").startsWith("public:") &&
      !String(currentEditorBeatKey || "").startsWith("shared:"),
    [currentEditorBeatKey, loadedLocalBeatId]
  );
  const captureCurrentUnsavedBeatStripSnapshot = React.useCallback(() => {
    if (!isUnsavedBeatStripDraftActive) return null;
    const snapshot = {
      name: String(beatNameDraft || ""),
      category: String(beatCategoryDraft || "all"),
      style: String(beatStyleDraft || "all"),
      payload: buildCurrentBeatPayload(),
    };
    setUnsavedBeatStripSnapshot(snapshot);
    return snapshot;
  }, [
    beatCategoryDraft,
    beatNameDraft,
    beatStyleDraft,
    buildCurrentBeatPayload,
    isUnsavedBeatStripDraftActive,
  ]);
  const restoreUnsavedBeatStripSnapshot = React.useCallback(
    (snapshotArg = null) => {
      const snapshot = snapshotArg || unsavedBeatStripSnapshot;
      if (!snapshot?.payload) return false;
      setPendingCurrentBeatStripAutoRename(false);
      setCurrentBeatStripRenameWidth(null);
      setIsCurrentBeatStripRenaming(false);
      applyImportedBeatPayloadRef.current?.(snapshot.payload, "beat-strip-unsaved");
      setLoadedLocalBeatId(null);
      setCurrentEditorBeatKey("__unsaved__");
      setBeatNameDraft(String(snapshot.name || ""));
      setBeatCategoryDraft(String(snapshot.category || "all"));
      setBeatStyleDraft(String(snapshot.style || "all"));
      setSelectedBeatLibraryBeatIds([]);
      setBeatLibraryBeatSelectionAnchorId(null);
      return true;
    },
    [unsavedBeatStripSnapshot]
  );
  const effectiveCurrentBeatStripBeatId = React.useMemo(() => {
    if (isUnsavedBeatStripDraftActive) {
      return "__unsaved__";
    }
    if (String(currentEditorBeatKey || "").startsWith("public:")) {
      const id = String(currentEditorBeatKey || "").slice("public:".length);
      if (id) return id;
    }
    if (String(currentEditorBeatKey || "").startsWith("shared:")) {
      const id = String(currentEditorBeatKey || "").slice("shared:".length);
      if (id) return id;
    }
    if (loadedLocalBeatId) return String(loadedLocalBeatId);
    if (String(currentEditorBeatKey || "").startsWith("local:")) {
      const id = String(currentEditorBeatKey || "").slice("local:".length);
      if (id) return id;
    }
    if (selectedBeatLibraryBeatIds.length === 1) {
      const id = String(selectedBeatLibraryBeatIds[0] || "");
      if (id) return id;
    }
    if (beatLibraryBeatSelectionAnchorId) {
      const id = String(beatLibraryBeatSelectionAnchorId || "");
      if (id) return id;
    }
    return "";
  }, [
    beatLibraryBeatSelectionAnchorId,
    currentEditorBeatKey,
    isUnsavedBeatStripDraftActive,
    loadedLocalBeatId,
    selectedBeatLibraryBeatIds,
  ]);
  const effectiveCurrentBeatStripBeat = React.useMemo(() => {
    if (!effectiveCurrentBeatStripBeatId || effectiveCurrentBeatStripBeatId === "__unsaved__") return null;
    const sourceList =
      currentBeatStripSource === "public"
        ? publicBeats
        : currentBeatStripSource === "shared"
          ? sharedArrangementBeats
          : localBeats;
    return (
      sourceList.find((entry) => String(entry?.id || "") === effectiveCurrentBeatStripBeatId) || null
    );
  }, [currentBeatStripSource, effectiveCurrentBeatStripBeatId, localBeats, publicBeats, sharedArrangementBeats]);
  const currentBeatStripResolvedName = React.useMemo(() => {
    const draft = String(beatNameDraft || "").trim();
    if (draft) return draft;
    if (effectiveCurrentBeatStripBeat?.name) return String(effectiveCurrentBeatStripBeat.name);
    if (loadedLocalBeat?.name) return String(loadedLocalBeat.name);
    return "Untitled beat";
  }, [beatNameDraft, effectiveCurrentBeatStripBeat, loadedLocalBeat]);
  const currentBeatStripNavigationIds = React.useMemo(() => {
    const ids =
      currentBeatStripSource === "public"
        ? publicBeats.map((entry) => String(entry?.id || "")).filter(Boolean)
        : currentBeatStripSource === "shared"
          ? sharedArrangementBeats.map((entry) => String(entry?.id || "")).filter(Boolean)
          : [...allLocalBeatIdsInLibraryOrder];
    if (isUnsavedBeatStripDraftActive || unsavedBeatStripSnapshot) {
      return [...ids, "__unsaved__"];
    }
    return ids;
  }, [allLocalBeatIdsInLibraryOrder, currentBeatStripSource, isUnsavedBeatStripDraftActive, publicBeats, sharedArrangementBeats, unsavedBeatStripSnapshot]);
  const currentBeatStripParentContainer = React.useMemo(() => {
    if (currentBeatStripSource !== "local") return null;
    const parentId = String(getBeatLibraryMeta(effectiveCurrentBeatStripBeat).parentId || "");
    if (!parentId) return null;
    return beatLibraryContainers.find((entry) => String(entry?.id || "") === parentId) || null;
  }, [beatLibraryContainers, currentBeatStripSource, effectiveCurrentBeatStripBeat]);
  const currentBeatStripScopeLabel = React.useMemo(() => {
    if (currentBeatStripSource === "public") return "Public beats";
    if (currentBeatStripSource === "shared") return "Arrangement beats";
    if (!currentBeatStripParentContainer) {
      return "All beats";
    }
    return String(currentBeatStripParentContainer.name || "Current folder");
  }, [currentBeatStripParentContainer, currentBeatStripSource]);
  const currentBeatStripPosition = React.useMemo(() => {
    if (!effectiveCurrentBeatStripBeatId) {
      return { index: -1, total: currentBeatStripNavigationIds.length };
    }
    return {
      index: currentBeatStripNavigationIds.findIndex(
        (id) => String(id || "") === String(effectiveCurrentBeatStripBeatId || "")
      ),
      total: currentBeatStripNavigationIds.length,
    };
  }, [currentBeatStripNavigationIds, effectiveCurrentBeatStripBeatId]);
  const canNavigateCurrentBeatBackward =
    currentBeatStripPosition.index > 0;
  const canNavigateCurrentBeatForward =
    currentBeatStripPosition.index >= 0 &&
    currentBeatStripPosition.index < currentBeatStripPosition.total - 1;
  const beatLibraryDockedInSidebar =
    showDesktopSettingsSidebar &&
    !isMobileFloatingPanels &&
    isArrangementOpen &&
    ((!arrangementSourcesCollapsed && arrangementDetailsCollapsed) || keepBeatLibrarySidebarOpen);
  const hideFloatingArrangementWindow =
    beatLibraryDockedInSidebar &&
    !arrangementSourcesCollapsed &&
    arrangementDetailsCollapsed;
  const hasDesktopSidebarColumn =
    showDesktopSettingsSidebar &&
    (beatLibraryDockedInSidebar || !settingsSidebarCollapsed);
  const currentBeatEditorStripOffset = React.useMemo(
    () => `calc((${currentGridLabelGutterWidth}) * 0.6667)`,
    [currentGridLabelGutterWidth]
  );
  const currentBeatEditorStripPaddingLeft = React.useMemo(() => {
    if (hasDesktopSidebarColumn) {
      return `calc(15.5rem + 1.5rem + (${currentBeatEditorStripOffset}))`;
    }
    return currentBeatEditorStripOffset;
  }, [currentBeatEditorStripOffset, hasDesktopSidebarColumn]);
  const currentBeatEditorStripMainPaddingLeft = React.useMemo(
    () => `calc((${currentBeatEditorStripPaddingLeft}) - 4rem)`,
    [currentBeatEditorStripPaddingLeft]
  );
  const isBeatLibraryPanelActive =
    isArrangementOpen && !arrangementSourcesCollapsed && arrangementDetailsCollapsed;
  const canRenameCurrentBeat = Boolean(loadedLocalBeatId);
  const canSaveCurrentBeatFromStrip = React.useMemo(
    () => isUnsavedBeatStripDraftActive || !loadedLocalBeatId,
    [isUnsavedBeatStripDraftActive, loadedLocalBeatId]
  );
  const beginCurrentBeatStripRename = React.useCallback(() => {
    if (!canRenameCurrentBeat) return;
    const width =
      currentBeatStripNameButtonRef.current instanceof HTMLElement
        ? Math.ceil(currentBeatStripNameButtonRef.current.getBoundingClientRect().width)
        : null;
    setCurrentBeatStripRenameHoverAction(null);
    setCurrentBeatStripRenameWidth(width && width > 0 ? width : null);
    setIsCurrentBeatStripRenaming(true);
  }, [canRenameCurrentBeat]);
  const navigateCurrentBeatInLibrary = React.useCallback(
    async (direction) => {
      if (currentBeatStripNavigationIds.length === 0) return;
      const currentIndex = currentBeatStripNavigationIds.findIndex(
        (id) => String(id || "") === String(effectiveCurrentBeatStripBeatId || "")
      );
      if (currentIndex < 0) return;
      if (effectiveCurrentBeatStripBeatId === "__unsaved__") {
        captureCurrentUnsavedBeatStripSnapshot();
      }
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= currentBeatStripNavigationIds.length) return;
      const nextId = String(currentBeatStripNavigationIds[nextIndex] || "");
      if (nextId === "__unsaved__") {
        restoreUnsavedBeatStripSnapshot();
        return;
      }
      if (!nextId) return;
      const sourceList =
        currentBeatStripSource === "public"
          ? publicBeats
          : currentBeatStripSource === "shared"
            ? sharedArrangementBeats
            : localBeats;
      const nextBeat =
        sourceList.find((entry) => String(entry?.id || "") === nextId) || null;
      if (!nextBeat) return;
      if (currentBeatStripSource === "local") {
        const nextParentId = String(getBeatLibraryMeta(nextBeat).parentId || "");
        selectBeatLibraryContainer(nextParentId || "all");
        setSelectedBeatLibraryBeatIds([nextId]);
        setBeatLibraryBeatSelectionAnchorId(nextId);
      }
      setIsCurrentBeatStripRenaming(false);
      await loadBeatIntoEditorRef.current?.(currentBeatStripSource || "local", nextBeat);
    },
    [
      captureCurrentUnsavedBeatStripSnapshot,
      currentBeatStripSource,
      effectiveCurrentBeatStripBeatId,
      currentBeatStripNavigationIds,
      localBeats,
      publicBeats,
      restoreUnsavedBeatStripSnapshot,
      selectBeatLibraryContainer,
      sharedArrangementBeats,
    ]
  );
  const cancelCurrentBeatStripRename = React.useCallback(() => {
    if (loadedLocalBeat) {
      setBeatNameDraft(String(loadedLocalBeat.name || ""));
    }
    setCurrentBeatStripRenameHoverAction(null);
    setPendingCurrentBeatStripAutoRename(false);
    setCurrentBeatStripRenameWidth(null);
    setIsCurrentBeatStripRenaming(false);
  }, [loadedLocalBeat]);
  const commitCurrentBeatStripRename = React.useCallback(async () => {
    if (!loadedLocalBeatId) {
      finalizeCurrentBeatStripRename();
      return;
    }
    await updateCurrentLoadedBeatLocal();
    finalizeCurrentBeatStripRename();
  }, [loadedLocalBeatId, updateCurrentLoadedBeatLocal, finalizeCurrentBeatStripRename]);
  const toggleBeatLibraryPanel = React.useCallback(() => {
    setActiveTab("none");
    if (showDesktopSettingsSidebar) {
      setSettingsSidebarCollapsed(true);
    }
    if (!isArrangementOpen) {
      setKeepBeatLibrarySidebarOpen(true);
      setArrangementSourcesCollapsed(false);
      setArrangementDetailsCollapsed(true);
      setArrangementSourceTab("local");
      setIsArrangementOpen(true);
      return;
    }
    if (!arrangementSourcesCollapsed && arrangementDetailsCollapsed) {
      setKeepBeatLibrarySidebarOpen(false);
      setIsArrangementOpen(false);
      if (showDesktopSettingsSidebar) {
        setSettingsSidebarCollapsed(true);
      }
      return;
    }
    setKeepBeatLibrarySidebarOpen(true);
    setArrangementSourcesCollapsed(false);
    setArrangementDetailsCollapsed(true);
    setArrangementSourceTab("local");
    setIsArrangementOpen(true);
  }, [
    arrangementDetailsCollapsed,
    arrangementSourcesCollapsed,
    isArrangementOpen,
    showDesktopSettingsSidebar,
  ]);
  useEffect(() => {
    if (!isArrangementOpen) {
      setKeepBeatLibrarySidebarOpen(false);
    }
  }, [isArrangementOpen]);
  const closeFloatingArrangementWindow = React.useCallback(() => {
    setLibraryFiltersOpen(false);
    setArrangementLibraryMenuOpen(false);
    if (beatLibraryDockedInSidebar) {
      setKeepBeatLibrarySidebarOpen(true);
      setArrangementSourcesCollapsed(false);
      setArrangementDetailsCollapsed(true);
      setArrangementSourceTab("local");
      setIsArrangementOpen(true);
      return;
    }
    setIsArrangementOpen(false);
  }, [beatLibraryDockedInSidebar]);
  const handleHeaderLibraryButtonClick = React.useCallback((shiftKey = false) => {
    setActiveTab("none");
    if (beatLibraryDockedInSidebar) {
      if (!hideFloatingArrangementWindow) {
        closeFloatingArrangementWindow();
        return;
      }
      setKeepBeatLibrarySidebarOpen(true);
      setArrangementSourcesCollapsed(true);
      setArrangementDetailsCollapsed(false);
      setArrangementSourceTab("local");
      setIsArrangementOpen(true);
      return;
    }
    if (isMobileFloatingPanels) {
      if (!isArrangementOpen) {
        setArrangementSourcesCollapsed(false);
        setArrangementDetailsCollapsed(true);
        setArrangementSourceTab("local");
        setIsArrangementOpen(true);
        return;
      }
      if (!arrangementSourcesCollapsed && arrangementDetailsCollapsed) {
        setIsArrangementOpen(false);
        return;
      }
      setArrangementSourcesCollapsed(false);
      setArrangementDetailsCollapsed(true);
      setArrangementSourceTab("local");
      return;
    }
    if (shiftKey) {
      if (!isArrangementOpen) {
        setArrangementSourcesCollapsed(false);
        setArrangementDetailsCollapsed(true);
        setArrangementSourceTab("local");
        setIsArrangementOpen(true);
        return;
      }
      if (!arrangementSourcesCollapsed && arrangementDetailsCollapsed) {
        setIsArrangementOpen(false);
        return;
      }
      setArrangementSourcesCollapsed(false);
      setArrangementDetailsCollapsed(true);
      setArrangementSourceTab("local");
      return;
    }
    if (!isArrangementOpen) {
      setArrangementSourcesCollapsed(false);
      setArrangementDetailsCollapsed(false);
      setArrangementSourceTab("local");
      setIsArrangementOpen(true);
      return;
    }
    if (!arrangementSourcesCollapsed && !arrangementDetailsCollapsed) {
      setIsArrangementOpen(false);
      return;
    }
    setArrangementSourcesCollapsed(false);
    setArrangementDetailsCollapsed(false);
    setArrangementSourceTab("local");
  }, [
    beatLibraryDockedInSidebar,
    closeFloatingArrangementWindow,
    arrangementDetailsCollapsed,
    arrangementSourcesCollapsed,
    hideFloatingArrangementWindow,
    isMobileFloatingPanels,
    isArrangementOpen,
  ]);
  const renderStickingDisplayControl = () => (
    <div
      data-sidebar-chevron-control="sticking"
      onPointerDown={() => markSidebarChevronHint("sticking")}
      className="flex w-fit items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60"
    >
      <button
        type="button"
        onClick={() => setNotationStickingView("above")}
        className={`whitespace-nowrap px-3 py-1 text-sm ${
          notationStickingView === "above"
            ? "bg-neutral-800 text-white"
            : "bg-neutral-900 text-neutral-600"
        }`}
        title="Show sticking above notation"
      >
        Above
      </button>
      <button
        type="button"
        onClick={() => setNotationStickingView("split-rows")}
        className={`whitespace-nowrap border-l border-neutral-800 px-3 py-1 text-sm ${
          notationStickingView === "split-rows"
            ? "bg-neutral-800 text-white"
            : "bg-neutral-900 text-neutral-600"
        }`}
        title="Change sticking display"
      >
        Split rows
      </button>
    </div>
  );

  const renderSidebarSettingsMenu = (className) =>
    isSidebarSettingsMenuOpen ? (
      <div
        ref={sidebarSettingsMenuRef}
        className={className}
      >
        <div className="space-y-2">
          <span className="text-sm text-neutral-300">Notation view</span>
            <button
              type="button"
              onClick={() => setDottedNotes((v) => !v)}
              className={`w-full whitespace-nowrap touch-none select-none rounded border px-3 py-[5px] text-left text-sm ${
                dottedNotes
                  ? "bg-neutral-800 border-neutral-700 text-white"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
              }`}
              title="Convert note + following rest into a dotted note when possible"
              aria-pressed={dottedNotes}
            >
              Dotted notes
            </button>
            <button
              type="button"
              onClick={() => setMergeNotes((v) => !v)}
              className={`w-full whitespace-nowrap touch-none select-none rounded border px-3 py-[5px] text-left text-sm ${
                mergeNotes
                  ? "bg-neutral-800 border-neutral-700 text-white"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
              }`}
              title="Merge notes across adjacent rests"
              aria-pressed={mergeNotes}
            >
              Merge notes
            </button>
            <button
              type="button"
              onClick={() => setMergeRests((v) => !v)}
              className={`w-full whitespace-nowrap touch-none select-none rounded border px-3 py-[5px] text-left text-sm ${
                mergeRests
                  ? "bg-neutral-800 border-neutral-700 text-white"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
              }`}
              title="Merge consecutive rests"
              aria-pressed={mergeRests}
            >
              Merge rests
            </button>
            <button
              type="button"
              onClick={() => setFlatBeams((v) => !v)}
              className={`w-full whitespace-nowrap touch-none select-none rounded border px-3 py-[5px] text-left text-sm ${
                flatBeams
                  ? "bg-neutral-800 border-neutral-700 text-white"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
              }`}
              title="Render beams horizontally (no tilt)"
              aria-pressed={flatBeams}
            >
              Flat beams
            </button>
        </div>
      </div>
    ) : null;

  const renderSidebarChevron = (open, visible) => (
    <span
      aria-hidden="true"
      className={`inline-flex h-3 w-2 items-center justify-center text-neutral-500 transition ${
        visible ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      }`}
    >
      <svg
        viewBox="0 0 8 8"
        className={`h-2 w-2 transition-transform ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1.5 3 4 5.5 6.5 3" />
      </svg>
    </span>
  );

  const renderLoopOverlapStepper = () => (
    <div
      data-sidebar-chevron-control="loop"
		                        onPointerDownCapture={() => markSidebarChevronHint("loop")}
      className="flex w-fit max-w-full items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60"
    >
      <button
        type="button"
        onClick={() =>
          setLoopOverlapMode((prev) => {
            const idx = Math.max(0, MOVE_OVERLAP_MODES.findIndex((m) => m.id === prev));
            return MOVE_OVERLAP_MODES[(idx - 1 + MOVE_OVERLAP_MODES.length) % MOVE_OVERLAP_MODES.length].id;
          })
        }
        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
      >
        -
      </button>
      <button
        type="button"
        onClick={() =>
          setLoopOverlapMode((prev) => (prev === "all-to-all" ? "active-to-empty" : "all-to-all"))
        }
        className="min-w-[126px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-900/60 border-l border-r border-neutral-800 hover:bg-neutral-800/50"
        title={getOverlapModeDescription(loopOverlapMode)}
      >
        {MOVE_OVERLAP_MODES.find((m) => m.id === loopOverlapMode)?.label || "Fill in gaps"}
      </button>
      <button
        type="button"
        onClick={() =>
          setLoopOverlapMode((prev) => {
            const idx = Math.max(0, MOVE_OVERLAP_MODES.findIndex((m) => m.id === prev));
            return MOVE_OVERLAP_MODES[(idx + 1) % MOVE_OVERLAP_MODES.length].id;
          })
        }
        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
      >
        +
      </button>
    </div>
  );

  const settingsToolbarButton = (
          <div className="relative flex items-center gap-2">
            <button
              ref={gridMenuButtonRef}
              type="button"
              onClick={(e) => {
                if (e.shiftKey) {
                  setShowAppVersion((v) => !v);
                  return;
                }
	                if (showDesktopSettingsSidebar) {
	                  if (beatLibraryDockedInSidebar) {
	                    setKeepBeatLibrarySidebarOpen(false);
	                    setIsArrangementOpen(false);
	                    setSettingsSidebarCollapsed(false);
	                    return;
	                  }
	                  setSettingsSidebarCollapsed((v) => !v);
	                  return;
	                }
	                if (isBeatLibraryPanelActive) {
	                  setKeepBeatLibrarySidebarOpen(false);
	                  setIsArrangementOpen(false);
	                  setActiveTab("timing");
	                  return;
	                }
	                setActiveTab((t) => (t === "timing" ? "none" : "timing"));
	              }}
              className={`touch-none select-none inline-flex h-7 w-7 items-center justify-center rounded text-sm transition-colors outline-none focus:outline-none focus-visible:outline-none ${
                (!showDesktopSettingsSidebar && activeTab === "timing") ||
                (showDesktopSettingsSidebar && !settingsSidebarCollapsed && !beatLibraryDockedInSidebar)
                  ? "bg-neutral-900/70 text-neutral-200"
                  : "text-neutral-500 hover:bg-neutral-900/70 hover:text-neutral-200"
              }`}
              title={
                showDesktopSettingsSidebar
                  ? settingsSidebarCollapsed
                    ? "Show settings"
                    : "Hide settings"
                  : "Open settings"
              }
            >
              <SettingsIcon />
            </button>
            {showAppVersion ? (
              <span
                className="select-none whitespace-nowrap text-[11px] text-neutral-500"
                title={`Version ${APP_VERSION}`}
              >
                v{APP_VERSION}
              </span>
            ) : null}
            {!showDesktopSettingsSidebar && activeTab === "timing" && (
              <div
                ref={gridMenuPopupRef}
                data-sidebar-chevron-area="1"
                onPointerDown={handleSidebarChevronAreaPointerDown}
                className="absolute left-0 top-full z-20 mt-2 w-[min(15rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
              >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      data-sidebar-chevron-control="resolution"
                      onPointerDown={() => markSidebarChevronHint("resolution")}
                      onClick={() => setIsSidebarResolutionOpen((v) => !v)}
                      className="group -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                      aria-expanded={isSidebarResolutionOpen}
                      aria-controls="settings-popup-resolution-options"
                      title="Show resolution options"
                    >
                      <span className="whitespace-nowrap">Resolution</span>
                      {renderSidebarChevron(
                        isSidebarResolutionOpen,
                        isSidebarResolutionOpen || sidebarChevronHint === "resolution"
                      )}
                    </button>
                    <div
                      data-sidebar-chevron-control="resolution"
                      onPointerDown={() => markSidebarChevronHint("resolution")}
                      className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const order = [4, 8, 16, 32];
                          const idx = order.indexOf(resolution);
                          const next = order[(idx - 1 + order.length) % order.length];
                          handleResolutionChange(next);
                        }}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      >
                        −
                      </button>
                      <div className="min-w-[60px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-800 border-l border-r border-neutral-700">
                        {resolution === 4 ? "4th" : resolution === 8 ? "8th" : resolution === 16 ? "16th" : "32th"}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const order = [4, 8, 16, 32];
                          const idx = order.indexOf(resolution);
                          const next = order[(idx + 1) % order.length];
                          handleResolutionChange(next);
                        }}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                      >
                        +
                      </button>
	                    </div>
	                </div>
	                {isSidebarResolutionOpen ? (
	                  <div
	                    id="settings-popup-resolution-options"
	                    className="flex items-center justify-end gap-2"
	                  >
	                    <span className="text-sm text-neutral-500">Keep timing</span>
	                    <div className="flex w-fit items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
	                      <button
	                        type="button"
	                        onClick={() => setKeepTiming(false)}
	                        className={`whitespace-nowrap px-2.5 py-[2px] text-[13px] ${
	                          !keepTiming
	                            ? "bg-neutral-800 text-white"
	                            : "bg-neutral-900 text-neutral-600"
	                        }`}
	                        title="Allow timing to shift when changing resolution or tuplets"
	                        aria-pressed={!keepTiming}
	                      >
	                        Off
	                      </button>
	                      <button
	                        type="button"
	                        onClick={() => setKeepTiming(true)}
	                        className={`whitespace-nowrap border-l border-neutral-800 px-2.5 py-[2px] text-[13px] ${
	                          keepTiming
	                            ? "bg-neutral-800 text-white"
	                            : "bg-neutral-900 text-neutral-600"
	                        }`}
	                        title="Keep timing when changing resolution or tuplets (remap steps)"
	                        aria-pressed={keepTiming}
	                      >
	                        On
	                      </button>
	                    </div>
	                  </div>
	                ) : null}

	                <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
                    <span className="text-sm text-neutral-300">Bars</span>
                    <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => setBars((b) => Math.max(1, b - 1))}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                        aria-label="Decrease bars"
                      >
                        −
                      </button>
                      <div className="min-w-[44px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-800 border-l border-r border-neutral-700">
                        {bars}
                      </div>
                      <button
                        type="button"
                        onClick={() => setBars((b) => Math.min(8, b + 1))}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                        aria-label="Increase bars"
                      >
                        +
                      </button>
                    </div>
                </div>

	                <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
                    <span className="text-sm text-neutral-300 whitespace-nowrap">Time</span>
                    <div className="grid h-10 grid-cols-[1.5rem_3.5rem_1.5rem] grid-rows-2 overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                      <div className="row-span-2 grid grid-rows-2 border-r border-neutral-700">
                        <button
                          type="button"
                          onClick={() => stepTimeSigNumerator(1)}
                          className="flex items-center justify-center text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                          aria-label="Increase time signature numerator"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => stepTimeSigNumerator(-1)}
                          className="flex items-center justify-center border-t border-neutral-700 text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                          aria-label="Decrease time signature numerator"
                        >
                          −
                        </button>
                      </div>
                      <div className="row-span-2 flex items-center justify-center px-2 text-sm text-white tabular-nums">
                        {Math.max(2, Math.min(15, Number(timeSig.n) || 4))}
                        <span className="mx-1 text-neutral-400">/</span>
                        {timeSig.d === 8 ? 8 : 4}
                      </div>
                      <div className="row-span-2 grid grid-rows-2 border-l border-neutral-700">
                        <button
                          type="button"
                          onClick={() => stepTimeSigDenominator(1)}
                          className="flex items-center justify-center text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                          aria-label="Next time signature denominator"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => stepTimeSigDenominator(-1)}
                          className="flex items-center justify-center border-t border-neutral-700 text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                          aria-label="Previous time signature denominator"
                        >
                          −
                        </button>
                      </div>
                    </div>
                </div>

	                <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
                    <span className="text-sm text-neutral-300 whitespace-nowrap">Subdivision</span>
                    <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => stepGlobalTupletValue(-1)}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                        aria-label="Previous global tuplet value"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={toggleGlobalTupletOffLast}
                        className="min-w-[64px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-800 border-l border-r border-neutral-700 hover:bg-neutral-700/50"
                        title="Toggle off / last tuplet"
                      >
                        {globalTupletValue === "mixed"
                          ? "Mixed"
                          : globalTupletValue == null
                            ? "Off"
                            : String(globalTupletValue)}
                      </button>
                      <button
                        type="button"
                        onClick={() => stepGlobalTupletValue(1)}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                        aria-label="Next global tuplet value"
                      >
                        +
                      </button>
                    </div>
                </div>

	                <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
                    <span className="text-sm text-neutral-300">Drumkit</span>
                    <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                      <button
                        type="button"
                        onClick={() => stepPreset(-1)}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                        aria-label="Previous preset"
                      >
                        −
                      </button>
                      <div
                        onClick={() => setIsKitEditorOpen(true)}
                        className="min-w-[88px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-800 border-l border-r border-neutral-700 cursor-pointer hover:bg-neutral-700/60"
                        title="Open drumkit editor"
                      >
                        {selectedPresetLabel}
                      </div>
                      <button
                        type="button"
                        onClick={() => stepPreset(1)}
                        className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                        aria-label="Next preset"
                      >
                        +
                      </button>
                    </div>
                </div>

                <div className="border-t border-neutral-800 pt-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative shrink-0">
                        <button
                          type="button"
	                          data-sidebar-chevron-control="loop"
		                onPointerDownCapture={() => markSidebarChevronHint("loop")}
	                          onClick={() => setIsLoopAdvancedMenuOpen((v) => !v)}
                          className="group -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                          title="Loop overlap options"
                          aria-label="Loop overlap options"
                          aria-expanded={isLoopAdvancedMenuOpen}
                        >
                          <span>Selection loop</span>
                          {renderSidebarChevron(
                            isLoopAdvancedMenuOpen,
                            isLoopAdvancedMenuOpen || sidebarChevronHint === "loop"
                          )}
                        </button>
                      </div>
	                      <div
	                        data-sidebar-chevron-control="loop"
		                        onPointerDownCapture={() => markSidebarChevronHint("loop")}
	                        className={`ml-auto flex items-stretch overflow-hidden rounded-md border ${
                          loopRepeats === "off"
                            ? "border-neutral-800 bg-neutral-900/60"
                            : "border-neutral-800 bg-neutral-900/60"
                        }`}
                      >
	                        <button
	                          type="button"
	                          onPointerDown={() => markSidebarChevronHint("loop")}
	                          onMouseDown={(e) => {
	                            markSidebarChevronHint("loop");
	                            e.preventDefault();
                            const order = ["all", "off", "1", "2", "3", "4", "5", "6", "7", "8"];
                            const stepOnce = () => {
                              setLoopRepeats((prev) => {
                                const i = Math.max(0, order.indexOf(String(prev)));
                                return order[(i - 1 + order.length) % order.length];
                              });
                            };
                            stepOnce();
                            let interval = null;
                            let timeout = window.setTimeout(() => {
                              interval = window.setInterval(stepOnce, 160);
                            }, 130);
                            const stop = () => {
                              if (timeout) window.clearTimeout(timeout);
                              timeout = null;
                              if (interval) window.clearInterval(interval);
                              interval = null;
                              window.removeEventListener("mouseup", stop);
                              window.removeEventListener("touchend", stop);
                              window.removeEventListener("touchcancel", stop);
                            };
                            window.addEventListener("mouseup", stop);
                            window.addEventListener("touchend", stop, { passive: true });
                            window.addEventListener("touchcancel", stop, { passive: true });
                          }}
                          className={`px-2 text-base leading-none ${
                            loopRepeats === "off"
                              ? "text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                              : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                          }`}
                          title="Decrease loop repeats"
                        >
                          –
                        </button>
	                        <button
	                          type="button"
	                          onPointerDown={() => markSidebarChevronHint("loop")}
	                          onClick={() => {
	                            markSidebarChevronHint("loop");
	                            setLoopRepeats((prev) => (prev === "all" ? "off" : "all"));
	                          }}
                          className={`min-w-[44px] px-3 py-1 flex items-center justify-center text-sm border-l border-r capitalize ${
                            loopRepeats === "off"
                              ? "text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/50 border-neutral-800"
                              : "text-white bg-neutral-900/60 hover:bg-neutral-800/50 border-neutral-800"
                          }`}
                          title="How many times the selection repeats"
                        >
                          {loopRepeats}
                        </button>
	                        <button
	                          type="button"
	                          onPointerDown={() => markSidebarChevronHint("loop")}
	                          onMouseDown={(e) => {
	                            markSidebarChevronHint("loop");
	                            e.preventDefault();
                            const order = ["all", "off", "1", "2", "3", "4", "5", "6", "7", "8"];
                            const stepOnce = () => {
                              setLoopRepeats((prev) => {
                                const i = Math.max(0, order.indexOf(String(prev)));
                                return order[(i + 1) % order.length];
                              });
                            };
                            stepOnce();
                            let interval = null;
                            let timeout = window.setTimeout(() => {
                              interval = window.setInterval(stepOnce, 160);
                            }, 130);
                            const stop = () => {
                              if (timeout) window.clearTimeout(timeout);
                              timeout = null;
                              if (interval) window.clearInterval(interval);
                              interval = null;
                              window.removeEventListener("mouseup", stop);
                              window.removeEventListener("touchend", stop);
                              window.removeEventListener("touchcancel", stop);
                            };
                            window.addEventListener("mouseup", stop);
                            window.addEventListener("touchend", stop, { passive: true });
                            window.addEventListener("touchcancel", stop, { passive: true });
                          }}
                          className={`px-2 text-base leading-none ${
                            loopRepeats === "off"
                              ? "text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                              : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                          }`}
                          title="Increase loop repeats"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {isLoopAdvancedMenuOpen ? (
                      <div className="flex justify-end">
                        {renderLoopOverlapStepper()}
                      </div>
                    ) : null}

                    <div className="flex w-full flex-col gap-2">
                      <div className="flex w-full items-center justify-between gap-2">
                      <div className="relative shrink-0">
                        <button
                          type="button"
	                          data-sidebar-chevron-control="sticking"
	                          onPointerDown={() => markSidebarChevronHint("sticking")}
	                          onClick={() => setIsEditingAdvancedMenuOpen((v) => !v)}
                          className="group -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                          title="Sticking display options"
                          aria-label="Sticking display options"
                          aria-expanded={isEditingAdvancedMenuOpen}
                        >
                          <span>Sticking</span>
                          {renderSidebarChevron(
                            isEditingAdvancedMenuOpen,
                            isEditingAdvancedMenuOpen || sidebarChevronHint === "sticking"
                          )}
                        </button>
                      </div>
	                      <div className="ml-auto flex items-center gap-1.5">
	                        <div
	                          data-sidebar-chevron-control="sticking"
	                          onPointerDownCapture={() => markSidebarChevronHint("sticking")}
	                          className="flex items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60"
	                        >
	                          <button
	                            type="button"
	                            onPointerDown={() => markSidebarChevronHint("sticking")}
	                            onClick={() => {
	                              markSidebarChevronHint("sticking");
	                              cycleNotationStickingPrintMode(-1);
	                            }}
                            className="px-2 text-base leading-none text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                            title="Previous print sticking mode"
                            aria-label="Previous print sticking mode"
                          >
                            -
                          </button>
	                          <button
	                            type="button"
	                            onPointerDown={() => markSidebarChevronHint("sticking")}
	                            onClick={() => {
	                              markSidebarChevronHint("sticking");
	                              setNotationStickingPrintMode(notationStickingSelectionStats.mode === "all" ? "off" : "all");
	                            }}
                            className="min-w-[72px] px-3 py-1 flex items-center justify-center text-sm border-l border-r border-neutral-800 bg-neutral-900/60 text-neutral-500 hover:bg-neutral-800/50"
                            title={
                              notationStickingSelectionStats.mode === "custom"
                                ? "Show selected sticking only"
                                : notationStickingSelectionStats.mode === "all"
                                  ? "Print all sticking in notation"
                                  : "Do not print sticking in notation"
                            }
                          >
                            {notationStickingSelectionStats.mode === "all"
                              ? "All"
                              : notationStickingSelectionStats.mode === "custom"
                                ? "Some"
                                : "None"}
                          </button>
	                          <button
	                            type="button"
	                            onPointerDown={() => markSidebarChevronHint("sticking")}
	                            onClick={() => {
	                              markSidebarChevronHint("sticking");
	                              cycleNotationStickingPrintMode(1);
	                            }}
                            className="px-2 text-base leading-none text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                            title="Next print sticking mode"
                            aria-label="Next print sticking mode"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      </div>
                      {isEditingAdvancedMenuOpen ? (
                        <div className="flex justify-start">
                          {renderStickingDisplayControl()}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2">
	                      <button
	                        type="button"
	                        data-sidebar-chevron-control="sticking"
	                        onPointerDown={() => markSidebarChevronHint("sticking")}
	                        onClick={() =>
	                          setStickingEditModeEnabled((v) => {
                            const next = !v;
                            if (next) {
                              setStickingGuideEnabled(true);
                              setNotationStickingSelectionModeEnabled(false);
                            } else {
                              setNotationStickingSelectionModeEnabled(false);
                            }
                            return next;
                          })
                        }
                        className={`w-fit touch-none select-none px-3 py-[5px] rounded border text-sm ${
                          stickingEditModeEnabled
                            ? "bg-neutral-800 border-neutral-700 text-white"
                            : "bg-neutral-900 border-neutral-800 text-neutral-600"
                        }`}
                        title="When enabled, clicking active hand-hit cells edits R/L sticking instead of toggling notes"
                      >
                        Edit R/L
                      </button>
                      {notationStickingSelectionStats.mode === "custom" ? (
                        <button
                          type="button"
                          onClick={handleCustomNotationStickingModeToggle}
                          className={`w-fit touch-none select-none px-3 py-[5px] rounded border text-sm ${
                            notationStickingSelectionModeEnabled
                              ? "bg-neutral-800 border-neutral-700 text-white"
                              : "bg-neutral-900 border-neutral-800 text-neutral-600"
                          }`}
                          title="Choose which notes show sticking labels"
                          aria-pressed={notationStickingSelectionModeEnabled}
                        >
                          Select notes
                        </button>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleMainTrashClick}
                        className={`touch-none select-none inline-flex h-8 w-8 items-center justify-center rounded border ${
                          canClearSelection
                            ? "bg-neutral-800 border-neutral-700 text-white"
                            : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800/40"
                        }`}
                        title={canClearSelection ? "Clear selection (Cmd/Ctrl+click: reset defaults + delete library)" : "Clear all notes (Cmd/Ctrl+click: reset defaults + delete library)"}
                        aria-label={canClearSelection ? "Clear selection" : "Clear all notes"}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          className="-translate-y-px h-[0.95rem] w-[0.95rem]"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                        </svg>
                      </button>
                      <div className="relative shrink-0">
                        <button
                          ref={sidebarSettingsMenuButtonRef}
                          type="button"
                          data-sidebar-settings-menu-trigger="1"
                          onClick={() => setIsSidebarSettingsMenuOpen((v) => !v)}
                          className={`touch-none select-none inline-flex h-8 w-8 items-center justify-center rounded border ${
                            isSidebarSettingsMenuOpen
                              ? "bg-neutral-800 border-neutral-700 text-white"
                              : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800/40"
                          }`}
                          title="Notation view settings"
                          aria-label="Notation view settings"
                          aria-expanded={isSidebarSettingsMenuOpen}
                        >
                          <img
                            src="/musiknote.png"
                            alt=""
                            className="h-4 w-4 opacity-100 [filter:invert(39%)_sepia(6%)_saturate(520%)_hue-rotate(182deg)_brightness(92%)_contrast(86%)]"
                            aria-hidden="true"
                          />
                        </button>
                        {renderSidebarSettingsMenu("absolute bottom-full left-0 z-[140] mb-2 min-w-[12rem] rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl")}
                      </div>
                      {loadedLocalBeatId ? (
                        <button
                          type="button"
                          onClick={() => setBeatAutoUpdateEnabled((v) => !v)}
                          className={`w-fit touch-none select-none px-3 py-[5px] rounded border text-sm ${
                            beatAutoUpdateEnabled
                              ? "bg-neutral-800 border-neutral-700 text-white"
                              : "bg-neutral-900 border-neutral-800 text-neutral-600"
                          }`}
                          title={
                            beatAutoUpdateEnabled
                              ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                              : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                          }
                          aria-label={
                            beatAutoUpdateEnabled
                              ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                              : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                          }
                        >
                          Auto update
                        </button>
                      ) : null}
                    </div>

                  </div>
                </div>

              </div>
              </div>
            )}
          </div>
  );
  const currentBeatEditorStripLeadingControls = (
    <div className="inline-flex shrink-0 items-center gap-1.5 bg-transparent px-0 py-0.5 align-top">
      {settingsToolbarButton}
      <button
        type="button"
        onClick={toggleBeatLibraryPanel}
        className={`inline-flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
          isBeatLibraryPanelActive || beatLibraryDockedInSidebar
            ? "bg-neutral-900/70 text-neutral-200"
            : "text-neutral-500 hover:bg-neutral-900/70 hover:text-neutral-200"
        }`}
        title="Open beat library"
        aria-label="Open beat library"
      >
        <LibraryIcon />
      </button>
    </div>
  );
  const currentBeatEditorStripMainControls = (
    <div className="inline-flex max-w-full items-center gap-1.5 bg-transparent px-0 py-0.5 align-top">
      <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <button
          type="button"
          onClick={() => navigateCurrentBeatInLibrary(-1)}
          disabled={!canNavigateCurrentBeatBackward}
          className={`inline-flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
            canNavigateCurrentBeatBackward
              ? "text-neutral-500 hover:bg-neutral-900/70 hover:text-neutral-200"
              : "text-neutral-700 opacity-50 cursor-not-allowed"
          }`}
          title="Previous beat in current library view"
          aria-label="Previous beat"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => navigateCurrentBeatInLibrary(1)}
          disabled={!canNavigateCurrentBeatForward}
          className={`inline-flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
            canNavigateCurrentBeatForward
              ? "text-neutral-500 hover:bg-neutral-900/70 hover:text-neutral-200"
              : "text-neutral-700 opacity-50 cursor-not-allowed"
          }`}
          title="Next beat in current library view"
          aria-label="Next beat"
        >
          →
        </button>
      </div>
      <div className="min-w-0 flex items-center text-sm">
        {isCurrentBeatStripRenaming ? (
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="relative min-w-0 max-w-[16rem]"
              style={currentBeatStripRenameWidth ? { width: `${currentBeatStripRenameWidth}px` } : undefined}
            >
              <input
                ref={currentBeatStripNameInputRef}
                type="text"
                value={beatNameDraft}
                onChange={(e) => setBeatNameDraft(e.target.value)}
                onBlur={() => commitCurrentBeatStripRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitCurrentBeatStripRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelCurrentBeatStripRename();
                  }
                }}
                className="block w-full min-w-0 border-0 bg-transparent p-0 text-base font-medium leading-[1.2] text-white outline-none ring-0 focus:outline-none focus:ring-0"
                aria-label="Current beat name"
              />
              {loadedLocalBeatId ? (
                <div className="absolute left-1/2 top-full z-20 mt-2 inline-flex -translate-x-1/2 items-center overflow-hidden whitespace-nowrap rounded border border-neutral-700 bg-neutral-900 shadow-[0_12px_28px_rgba(0,0,0,0.38)]">
                  <button
                    type="button"
                    onMouseEnter={() => setCurrentBeatStripRenameHoverAction("rename")}
                    onMouseLeave={() => setCurrentBeatStripRenameHoverAction(null)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitCurrentBeatStripRename()}
                    className={`px-3 py-1.5 text-xs transition-colors ${
                      currentBeatStripRenameHoverAction === "save-as-new"
                        ? "text-neutral-300 hover:text-white"
                        : "bg-neutral-800 text-white hover:bg-neutral-700"
                    } active:bg-neutral-700`}
                    title="Rename current beat"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onMouseEnter={() => setCurrentBeatStripRenameHoverAction("save-as-new")}
                    onMouseLeave={() => setCurrentBeatStripRenameHoverAction(null)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      finalizeCurrentBeatStripRename();
                      saveCurrentBeatLocal({
                        autoRename: false,
                        excludeId: loadedLocalBeatId,
                      });
                    }}
                    className={`border-l border-neutral-700 px-3 py-1.5 text-xs transition-colors ${
                      currentBeatStripRenameHoverAction === "save-as-new"
                        ? "bg-neutral-800 text-white hover:bg-neutral-700"
                        : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    } active:bg-neutral-700`}
                    title="Save as new beat"
                  >
                    Save as new
                  </button>
                </div>
              ) : null}
            </div>
            {loadedLocalBeatId ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setBeatAutoUpdateEnabled((prev) => !prev)}
                className={`inline-flex h-7 w-7 translate-x-1 shrink-0 items-center justify-center rounded transition-colors ${
                  beatAutoUpdateEnabled
                    ? "text-[#00b3ba] hover:text-[#14c8d0]"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
                title={
                  beatAutoUpdateEnabled
                    ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                    : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                }
                aria-label={
                  beatAutoUpdateEnabled
                    ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                    : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                }
              >
                <SaveStateIcon />
              </button>
            ) : null}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCurrentBeatAddToSheet}
              className="inline-flex h-7 w-7 -translate-x-0.5 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-900/70 hover:text-neutral-200"
              title={
                currentBeatAddToSheetUsesExistingBeat
                  ? "Add current beat to sheet"
                  : "Save as new beat and add to sheet"
              }
              aria-label={
                currentBeatAddToSheetUsesExistingBeat
                  ? "Add current beat to sheet"
                  : "Save as new beat and add to sheet"
              }
            >
              <AddToSheetIcon showPlus={!currentBeatAddToSheetUsesExistingBeat} />
            </button>
            {playabilityWarningsEnabled && playabilityWarningSteps.length > 0 ? (
              <span className="shrink-0 text-[11px] text-red-400/80">
                {`${playabilityWarningSteps.length} playability warning${playabilityWarningSteps.length === 1 ? "" : "s"}`}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="min-w-0 max-w-[16rem]"
              style={currentBeatStripRenameWidth ? { width: `${currentBeatStripRenameWidth}px` } : undefined}
            >
              <button
                ref={currentBeatStripNameButtonRef}
                type="button"
                onClick={() => {
                  if (canRenameCurrentBeat) {
                    beginCurrentBeatStripRename();
                    return;
                  }
                  if (canSaveCurrentBeatFromStrip) {
                    saveCurrentBeatLocal();
                  }
                }}
                disabled={!canRenameCurrentBeat && !canSaveCurrentBeatFromStrip}
                className={`block w-full min-w-0 truncate bg-transparent p-0 text-left text-base font-medium leading-[1.2] transition-colors ${
                  canRenameCurrentBeat
                    ? "text-neutral-100 hover:text-white"
                    : canSaveCurrentBeatFromStrip
                      ? "text-neutral-500 hover:text-neutral-300"
                    : "text-neutral-400 cursor-default"
                }`}
                title={
                  canRenameCurrentBeat
                    ? "Rename current beat"
                    : canSaveCurrentBeatFromStrip
                      ? "Save as new beat"
                      : currentBeatStripResolvedName
                }
              >
                {currentBeatStripResolvedName}
              </button>
            </div>
            {loadedLocalBeatId ? (
              <button
                type="button"
                onClick={() => setBeatAutoUpdateEnabled((prev) => !prev)}
	                className={`inline-flex h-7 w-7 translate-x-1 shrink-0 items-center justify-center rounded transition-colors ${
                  beatAutoUpdateEnabled
                    ? "text-[#00b3ba] hover:text-[#14c8d0]"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
                title={
                  beatAutoUpdateEnabled
                    ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                    : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                }
                aria-label={
                  beatAutoUpdateEnabled
                    ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                    : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                }
              >
                <SaveStateIcon />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCurrentBeatAddToSheet}
	              className="inline-flex h-7 w-7 -translate-x-0.5 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-900/70 hover:text-neutral-200"
              title={
                currentBeatAddToSheetUsesExistingBeat
                  ? "Add current beat to sheet"
                  : "Save as new beat and add to sheet"
              }
              aria-label={
                currentBeatAddToSheetUsesExistingBeat
                  ? "Add current beat to sheet"
                  : "Save as new beat and add to sheet"
              }
            >
              <AddToSheetIcon showPlus={!currentBeatAddToSheetUsesExistingBeat} />
            </button>
            {playabilityWarningsEnabled && playabilityWarningSteps.length > 0 ? (
              <span className="shrink-0 text-[11px] text-red-400/80">
                {`${playabilityWarningSteps.length} playability warning${playabilityWarningSteps.length === 1 ? "" : "s"}`}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
  const updateCurrentLoadedBeatNotationSelectionOnly = React.useCallback(async () => {
    if (!loadedLocalBeatId || !loadedLocalBeat) return;
    const compactNotationStickingSelection = Object.fromEntries(
      Object.entries(notationStickingSelection || {}).filter(([, value]) => value === true)
    );
    const nextPayload = {
      ...(loadedLocalBeat.payload && typeof loadedLocalBeat.payload === "object"
        ? loadedLocalBeat.payload
        : {}),
    };
    if (Object.keys(compactNotationStickingSelection).length > 0) {
      nextPayload.notationStickingSelection = compactNotationStickingSelection;
    } else {
      delete nextPayload.notationStickingSelection;
    }

    if (authUser?.id && hasSupabaseEnabled && supabase && isUuidLike(String(loadedLocalBeatId))) {
      const now = new Date().toISOString();
      let data = null;
      try {
        data = await updateCloudBeatRow({
          supabase,
          userId: authUser.id,
          beatId: String(loadedLocalBeatId),
          select: true,
          patch: {
            payload: nextPayload,
            updated_at: now,
          },
        });
      } catch (error) {
        alert(error?.message || "Failed to update notation sticking");
        return;
      }
      const nextItem = normalizeCloudBeatRow(data);
      if (!nextItem) return;
      setLocalBeats((prev) =>
        prev.map((beat) => (String(beat?.id || "") === String(loadedLocalBeatId) ? nextItem : beat))
      );
      localBeatsRef.current = localBeatsRef.current.map((beat) =>
        String(beat?.id || "") === String(loadedLocalBeatId) ? nextItem : beat
      );
      return;
    }

    const nextUpdatedAt = new Date().toISOString();
    const next = localBeatsRef.current.map((beat) =>
      String(beat?.id || "") === String(loadedLocalBeatId)
        ? {
            ...beat,
            updatedAt: nextUpdatedAt,
            payload: nextPayload,
            notationStickingSelection: compactNotationStickingSelection,
          }
        : beat
    );
    localBeatsRef.current = next;
    setLocalBeats(next);
  }, [
    authUser?.id,
    loadedLocalBeatId,
    loadedLocalBeat,
    notationStickingSelection,
  ]);
  useEffect(() => {
    flushLoadedLocalBeatNotationSelectionRef.current = updateCurrentLoadedBeatNotationSelectionOnly;
  }, [updateCurrentLoadedBeatNotationSelectionOnly]);
  useEffect(() => {
    if (importedBeatLoadInProgressRef.current) return;
    if (!loadedLocalBeatId) return;
    const compactNotationStickingSelection = Object.fromEntries(
      Object.entries(notationStickingSelection || {}).filter(([, value]) => value === true)
    );
    const nextSelectionJson = JSON.stringify(compactNotationStickingSelection);
    const savedSelectionJson = JSON.stringify(
      loadedLocalBeat?.payload?.notationStickingSelection &&
        typeof loadedLocalBeat.payload.notationStickingSelection === "object"
        ? loadedLocalBeat.payload.notationStickingSelection
        : {}
    );
    if (nextSelectionJson === savedSelectionJson) return;
    const next = localBeatsRef.current.map((beat) => {
      if (String(beat?.id || "") !== String(loadedLocalBeatId)) return beat;
      const nextPayload = {
        ...(beat?.payload && typeof beat.payload === "object" ? beat.payload : {}),
      };
      if (Object.keys(compactNotationStickingSelection).length > 0) {
        nextPayload.notationStickingSelection = compactNotationStickingSelection;
      } else {
        delete nextPayload.notationStickingSelection;
      }
      return {
        ...beat,
        payload: nextPayload,
        notationStickingSelection: compactNotationStickingSelection,
      };
    });
    localBeatsRef.current = next;
    setLocalBeats(next);
  }, [notationStickingSelection, loadedLocalBeatId, loadedLocalBeat]);
  useEffect(() => {
    if (importedBeatLoadInProgressRef.current) return;
    if (!loadedLocalBeatId) return;
    if (isLoadedLocalBeatNameChanged) return;
    if (!isLoadedLocalBeatNotationSelectionDirty) return;
    updateCurrentLoadedBeatNotationSelectionOnly();
  }, [
    loadedLocalBeatId,
    isLoadedLocalBeatNameChanged,
    isLoadedLocalBeatNotationSelectionDirty,
    updateCurrentLoadedBeatNotationSelectionOnly,
  ]);
  useEffect(() => {
    if (importedBeatLoadInProgressRef.current) return;
    if (!beatAutoUpdateEnabled) return;
    if (!loadedLocalBeatId) return;
    if (isLoadedLocalBeatNameChanged) return;
    if (!isLoadedLocalBeatCoreDirty) return;
    const timeoutId = window.setTimeout(() => {
      updateCurrentLoadedBeatLocal();
    }, 150);
    return () => window.clearTimeout(timeoutId);
  }, [
    beatAutoUpdateEnabled,
    loadedLocalBeatId,
    isLoadedLocalBeatNameChanged,
    isLoadedLocalBeatCoreDirty,
    updateCurrentLoadedBeatLocal,
  ]);

  const submitCurrentBeatPublic = React.useCallback(async (opts = null) => {
    const titleInput = String(opts?.title ?? beatNameDraft).trim();
    const composerInput = String(opts?.composer ?? printComposer).trim();
    const categoryInput = String(opts?.category ?? beatCategoryDraft).trim() || "all";
    const styleInput = String(opts?.style ?? beatStyleDraft).trim() || "all";
    const name = titleInput;
    if (!name) return false;
    setPublicLibraryError("");
    if (!isAdminUser) {
      setPublicLibraryError("Admin login required.");
      return false;
    }
    try {
      if (hasSupabaseEnabled && supabase && authUser?.id) {
        const id = `pubbeat-${makeShortShareId()}`;
        const beatPayload = buildCurrentBeatPayload();
        const data = await publishPublicBeatRow({
          supabase,
          ownerUserId: authUser.id,
          id,
          name,
          composer: composerInput || "",
          category: categoryInput === "all" ? "Groove" : categoryInput,
          style: styleInput === "all" ? "" : styleInput || "",
          beatPayload,
        });
        const nextBeat = normalizePublishedBeatEntry(data);
        if (nextBeat) setPublicBeats((prev) => [nextBeat, ...prev]);
        return true;
      }
      const beat = await publishFallbackPublicBeat({
        name,
        composer: composerInput || undefined,
        category: categoryInput === "all" ? "Groove" : categoryInput,
        style: styleInput === "all" ? undefined : styleInput || undefined,
        timeSigCategory: `${timeSig.n}/${timeSig.d}`,
        bpm,
        payload: buildCurrentBeatPayload(),
      });
      setPublicBeats((prev) => [beat, ...prev].filter(Boolean));
      return true;
    } catch (error) {
      setPublicLibraryError(error?.message || "Failed to submit beat");
      return false;
    }
  }, [isAdminUser, authUser?.id, beatNameDraft, printComposer, beatCategoryDraft, beatStyleDraft, timeSig, bpm, buildCurrentBeatPayload]);
  const openPublicSubmitDialog = React.useCallback(() => {
    const nextTitle = (printTitle || beatNameDraft || "").trim();
    const nextComposer = (lockedPublicComposer || printComposer || "").trim();
    setPublicLibraryError("");
    setPublicSubmitTitle(nextTitle);
    setPublicSubmitComposer(nextComposer);
    setPublicSubmitCategory(beatCategoryDraft);
    setPublicSubmitStyle(beatStyleDraft);
    setIsPublicSubmitDialogOpen(true);
  }, [printTitle, beatNameDraft, printComposer, lockedPublicComposer, beatCategoryDraft, beatStyleDraft]);
  const confirmPublicSubmit = React.useCallback(async () => {
    const title = publicSubmitTitle.trim();
    if (!title) return;
    const composer = (lockedPublicComposer || publicSubmitComposer).trim();
    if (!composer) {
      setPublicLibraryError("Composer is required for public submission.");
      return;
    }
    if (publicSubmitCategory === "all" || publicSubmitStyle === "all") {
      setPublicLibraryError("Category and style are required for public submission.");
      return;
    }
    const ok = await submitCurrentBeatPublic({
      title,
      composer,
      category: publicSubmitCategory,
      style: publicSubmitStyle,
    });
    if (!ok) return;
    if (!lockedPublicComposer) setLockedPublicComposer(composer);
    // Keep title/composer in sync across print, midi, and public submit flows.
    setPrintTitle(title);
    setPrintComposer(composer);
    setBeatNameDraft(title);
    setIsPublicSubmitDialogOpen(false);
  }, [
    publicSubmitTitle,
    publicSubmitComposer,
    publicSubmitCategory,
    publicSubmitStyle,
    lockedPublicComposer,
    submitCurrentBeatPublic,
    setPrintTitle,
    setPrintComposer,
  ]);

  const refreshPublicLibrary = React.useCallback(async () => {
    setPublicLibraryLoading(true);
    setPublicLibraryError("");
    try {
      if (hasSupabaseEnabled && supabase) {
        const rows = await fetchPublicBeatRows({ supabase, limit: 500 });
        setPublicBeats(
          rows
            .filter(isPublicBeatShareLinkRow)
            .map(normalizePublishedBeatEntry)
            .filter(Boolean)
        );
        setPublicLibraryLoading(false);
        return;
      }
      const beats = await fetchFallbackPublicBeats({
        sort: librarySort,
        category: beatCategoryDraft,
        timeSig: libraryTimeSigFilter,
        style: beatStyleDraft,
      });
      setPublicBeats(beats);
    } catch (error) {
      setPublicLibraryError(error?.message || "Failed to load public library");
    } finally {
      setPublicLibraryLoading(false);
    }
  }, [librarySort, beatCategoryDraft, libraryTimeSigFilter, beatStyleDraft]);
  useEffect(() => {
    const libraryVisibleInCombinedWindow = isArrangementOpen && arrangementSourceTab === "public";
    if (!libraryVisibleInCombinedWindow) return;
    refreshPublicLibrary();
  }, [isArrangementOpen, arrangementSourceTab, refreshPublicLibrary]);
  useEffect(() => {
    const libraryVisibleInCombinedWindow = isArrangementOpen && arrangementSourceTab === "public";
    if (libraryVisibleInCombinedWindow) return;
    setPublicLibraryError("");
  }, [isArrangementOpen, arrangementSourceTab]);
  const selectedPublicArrangementEntry = React.useMemo(
    () => publicArrangements.find((entry) => entry.id === selectedPublicArrangementId) || null,
    [publicArrangements, selectedPublicArrangementId]
  );
  const publicArrangementRows = React.useMemo(() => {
    if (!selectedPublicArrangementEntry) return [];
    const beats = Array.isArray(selectedPublicArrangementEntry.beats)
      ? selectedPublicArrangementEntry.beats
      : [];
    const beatById = new Map(beats.map((beat) => [String(beat?.id || ""), beat]));
    const rows = normalizeArrangementItems(selectedPublicArrangementEntry.items).map((item) => {
      const beat = beatById.get(String(item?.beatId || "")) || null;
      const beatBars = Math.max(1, Number(beat?.payload?.bars) || 1);
      const beatTimeSig = beat?.timeSigCategory || "4/4";
      const beatBpm = getBeatBpm(beat);
      const [nRaw, dRaw] = String(beatTimeSig).split("/");
      const n = Math.max(1, Number(nRaw) || 4);
      const d = Math.max(1, Number(dRaw) || 4);
      const barSeconds = beatBpm ? (60 / beatBpm) * ((n * 4) / d) : 0;
      return {
        ...item,
        beat,
        beatBars,
        beatTimeSig,
        beatBpm,
        sectionBars: beatBars * item.repeats,
        sectionSeconds: barSeconds * beatBars * item.repeats,
      };
    });
    let runningBarNumber = 1;
    return rows.map((row) => {
      const nextRow = {
        ...row,
        startBarNumber: runningBarNumber,
      };
      runningBarNumber += Math.max(1, Number(row?.sectionBars) || 1);
      return nextRow;
    });
  }, [selectedPublicArrangementEntry, getBeatBpm]);
  const publicArrangementTotals = React.useMemo(() => {
    return publicArrangementRows.reduce(
      (acc, row) => ({
        totalBars: acc.totalBars + Math.max(1, Number(row?.sectionBars) || 1),
        totalSeconds: acc.totalSeconds + Math.max(0, Number(row?.sectionSeconds) || 0),
      }),
      { totalBars: 0, totalSeconds: 0 }
    );
  }, [publicArrangementRows]);
  const nudgeSelectedPublicArrangementRepeat = React.useCallback((rowId, delta) => {
    const normalizedRowId = String(rowId || "");
    if (!normalizedRowId || !selectedPublicArrangementId) return;
    const applyItemsUpdate = (items) =>
      normalizeArrangementItems(items).map((item) =>
        String(item?.id || "") === normalizedRowId
          ? {
              ...item,
              repeats: Math.max(1, Math.min(64, (Number(item?.repeats) || 1) + delta)),
            }
          : item
      );
    setPublicArrangements((prev) =>
      prev.map((entry) =>
        String(entry?.id || "") === String(selectedPublicArrangementId)
          ? { ...entry, items: applyItemsUpdate(entry?.items || []) }
          : entry
      )
    );
    setArrangementItems((prev) => {
      const hasTarget = prev.some((item) => String(item?.id || "") === normalizedRowId);
      return hasTarget ? applyItemsUpdate(prev) : prev;
    });
  }, [selectedPublicArrangementId]);
  const publishCurrentArrangementPublic = React.useCallback(async (options = {}) => {
    const { forceNew = false } = options || {};
    if (!isAdminUser || !authUser?.id || !hasSupabaseEnabled || !supabase) {
      setPublicLibraryError("Admin login required.");
      return;
    }
    const arrangementPayload = buildCurrentArrangementSharePayload();
    const normalizedItems = normalizeArrangementItems(arrangementPayload?.items);
    if (!normalizedItems.length) {
      setPublicLibraryError("Arrangement is empty.");
      return;
    }
    const now = new Date().toISOString();
    const nextPayload = {
      kind: "arrangement-default",
      publishedDefault: true,
      name: String(arrangementPayload?.name || arrangementDisplayName || "Arrangement"),
      titleLine1: String(arrangementPayload?.titleLine1 || arrangementTitleLine1Draft || ""),
      titleLine2: String(arrangementPayload?.titleLine2 || arrangementTitleLine2Draft || ""),
      composer: String(arrangementPayload?.composer || arrangementComposerDraft || ""),
      createdAt: now,
      beats: Array.isArray(arrangementPayload?.beats) ? arrangementPayload.beats : [],
      items: normalizedItems,
    };
    const targetEntry = !forceNew ? selectedPublicArrangementEntry : null;
    const targetId = targetEntry?.publishedShareId || `pubarr-${makeShortShareId()}`;
    let data = null;
    try {
      data = await publishPublicArrangementRow({
        supabase,
        ownerUserId: authUser.id,
        id: targetId,
        payload: nextPayload,
        updateExisting: Boolean(targetEntry),
      });
    } catch (error) {
      setPublicLibraryError(error?.message || "Failed to publish arrangement");
      return;
    }
    const nextEntry = normalizePublishedArrangementEntry(data);
    if (!nextEntry) return;
    setPublicArrangements((prev) => {
      const idx = prev.findIndex((entry) => entry.id === nextEntry.id);
      if (idx < 0) return [nextEntry, ...prev];
      const out = [...prev];
      out[idx] = nextEntry;
      return out;
    });
    setSelectedPublicArrangementId(nextEntry.id);
  }, [
    isAdminUser,
    authUser?.id,
    buildCurrentArrangementSharePayload,
    arrangementItems,
    arrangementDisplayName,
    arrangementTitleLine1Draft,
    arrangementTitleLine2Draft,
    arrangementComposerDraft,
    selectedPublicArrangementEntry,
  ]);
  const deletePublicArrangement = React.useCallback(async (entryId) => {
    if (!isAdminUser || !authUser?.id || !hasSupabaseEnabled || !supabase) {
      setPublicLibraryError("Admin login required.");
      return;
    }
    try {
      await deleteOwnedPublicShareRow({
        supabase,
        ownerUserId: authUser.id,
        id: entryId,
      });
    } catch (error) {
      setPublicLibraryError(error?.message || "Failed to delete public arrangement");
      return;
    }
    setPublicArrangements((prev) => prev.filter((entry) => entry.id !== entryId));
    setSelectedPublicArrangementId((prev) => (prev === entryId ? "" : prev));
  }, [isAdminUser, authUser?.id]);
  const loadPublishedArrangement = React.useCallback((entry) => {
    if (!entry || !Array.isArray(entry.items)) return;
    if (arrangementPlaybackEnabled) {
      setArrangementPlaybackEnabled(false);
      setArrangementPlaybackIndex(0);
    }
    pushLocalBeatHistory();
    setSharedArrangementBeats(Array.isArray(entry?.beats) ? entry.beats : []);
    setArrangementItems(
      normalizeArrangementItems(entry.items).map((item) => ({
        ...item,
        source: "shared",
      }))
    );
    setArrangementSelection(null);
    setArrangementSelectionAnchor(null);
    setArrangementBarSelection(null);
    setArrangementBarSelectionAnchor(null);
    setArrangementNameDraft(getArrangementNameFromTitles(entry.titleLine1, entry.titleLine2, entry.name));
    setArrangementTitleLine1Draft(String(entry.titleLine1 || ""));
    setArrangementTitleLine2Draft(String(entry.titleLine2 || ""));
    setArrangementComposerDraft(String(entry.composer || ""));
    setLoadedArrangementId(null);
    setSelectedPublicArrangementId(String(entry.id || ""));
    const firstBeat = Array.isArray(entry?.beats) ? entry.beats[0] || null : null;
    if (firstBeat?.payload) {
      applyImportedBeatPayloadRef.current?.(
        firstBeat.payload,
        `public-arrangement:${entry?.id || ""}:0`
      );
      setLoadedLocalBeatId(null);
    }
  }, [arrangementPlaybackEnabled, pushLocalBeatHistory]);
  const openArrangementSheetFromLibrary = React.useCallback(() => {
    if (arrangementLibraryTab === "public") {
      if (!selectedPublicArrangementEntry) return;
      loadPublishedArrangement(selectedPublicArrangementEntry);
    }
    positionArrangementNotationUnderHeaderButton(headerSheetButtonRef.current);
    setArrangementSourcesCollapsed(true);
    setArrangementDetailsCollapsed(false);
    setIsArrangementOpen(false);
    setIsArrangementNotationOpen(true);
  }, [arrangementLibraryTab, loadPublishedArrangement, positionArrangementNotationUnderHeaderButton, selectedPublicArrangementEntry]);
  useEffect(() => {
    if (!isArrangementOpen || arrangementDetailsCollapsed) return;
    refreshPublicArrangementLibrary();
  }, [isArrangementOpen, arrangementDetailsCollapsed, refreshPublicArrangementLibrary]);

  const createShareLink = React.useCallback(async (mode = "beat", options = {}) => {
    const { requireShort = false, forceLong = false } = options || {};
    const payload = mode === "arrangement" ? buildCurrentArrangementSharePayload() : buildCurrentBeatPayload();
    if (!payload || (mode === "arrangement" && (!Array.isArray(payload.items) || payload.items.length < 1))) {
      throw new Error("Failed to create share link");
    }
    let text = "";
    let usedShortLink = false;
    let createdNewShare = false;
    try {
      if (!forceLong && hasSupabaseEnabled && supabase && authUser?.id) {
        const storedShare = await createSupabaseShortShareLink({
          supabase,
          ownerUserId: authUser.id,
          mode,
          payload,
          origin: window.location.origin,
          ensureShortShareQuotaAvailable,
          buildSharePayloadFingerprint,
          getSharePayloadFingerprint,
          getShareLinkMeta,
          isTemporarySharePayload,
          isPublishedDefaultSharePayload,
          isPersonalLibraryStatePayload,
          withShareLinkMeta,
          makeShortShareId,
          buildTemporarySharePayload,
        });
        if (storedShare?.text) {
          text = storedShare.text;
          usedShortLink = true;
          createdNewShare = storedShare.createdNewShare === true;
        }
      }
      if (!forceLong && !text) {
        await ensureShortShareQuotaAvailable();
        const anonymousShare = await createAnonymousShortShareLink(payload, {
          origin: window.location.origin,
        });
        if (anonymousShare?.text) {
          text = anonymousShare.text;
          usedShortLink = true;
          createdNewShare = anonymousShare.createdNewShare === true;
        }
      }
    } catch (error) {
      if (requireShort) {
        throw error;
      }
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("limit reached")) {
        throw error;
      }
      // fall through to local URL state fallback
    }
    if (!text) {
      if (requireShort) {
        throw new Error("QR export requires a short share link. Check share storage.");
      }
      const encoded = encodeShareState(payload);
      if (!encoded) {
        throw new Error("Failed to create share link");
      }
      const url = new URL(window.location.origin + "/");
      url.searchParams.set("s", encoded);
      text = url.toString();
      createdNewShare = true;
    }
    if (createdNewShare) {
      void trackStatsEvent("share_create", {
        shareKind: mode === "arrangement" ? "arrangement" : "beat",
      });
      void refreshUsageLimits({ silent: true });
    }
    return {
      text,
      usedShortLink,
      mode,
      createdNewShare,
    };
  }, [
    authUser?.id,
    buildCurrentBeatPayload,
    buildCurrentArrangementSharePayload,
    ensureShortShareQuotaAvailable,
    hasSupabaseEnabled,
    refreshUsageLimits,
    supabase,
    trackStatsEvent,
  ]);
  const handleBeatPdfExport = React.useCallback(async () => {
    try {
      const qrText = printQrEnabled
        ? (await createShareLink("beat", { requireShort: true })).text
        : "";
      await exportNotationPdf(notationExportRef.current, {
        title: printTitle.trim() || "Drum Notation",
        scoreTitle: printTitle.trim(),
        composer: printComposer.trim(),
        watermark: printWatermarkEnabled,
        includeSticking: showNotationSticking,
        qrText,
      });
    } catch (error) {
      alert(error?.message || "Failed to export PDF");
    }
  }, [
    createShareLink,
    printQrEnabled,
    printTitle,
    printComposer,
    printWatermarkEnabled,
    showNotationSticking,
  ]);
  useEffect(() => {
    beatPdfExportRef.current = handleBeatPdfExport;
  }, [handleBeatPdfExport]);

  const handleShareLink = React.useCallback(async (mode = "beat") => {
    try {
      const selectedMode =
        mode === "arrangement" ? shareLinkMode.arrangement : shareLinkMode.beat;
      const { text, usedShortLink } = await createShareLink(mode, {
        forceLong: selectedMode === "long",
        requireShort: selectedMode === "short",
      });
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareLinkType(`${mode === "arrangement" ? "Arrangement" : "Beat"} ${usedShortLink ? "Short" : "Long"}`);
        setShareCopied(true);
        if (shareCopiedTimerRef.current) window.clearTimeout(shareCopiedTimerRef.current);
        shareCopiedTimerRef.current = window.setTimeout(() => {
          setShareCopied(false);
          shareCopiedTimerRef.current = null;
        }, 1400);
      } else {
        window.prompt("Copy share link", text);
      }
    } catch (error) {
      alert(error?.message || "Failed to create share link.");
    }
  }, [
    createShareLink,
    shareLinkMode,
  ]);
  const handleArrangementPdfExport = React.useCallback(async () => {
    try {
      const qrText = arrangementPdfQrEnabled
        ? (await createShareLink("arrangement", { requireShort: true })).text
        : "";
      const exportSource =
        arrangementNotationExportRef.current ||
        arrangementNotationVisiblePagesRef.current;
      const arrangementName = arrangementDisplayName || "Arrangement";
      await exportArrangementPdf(exportSource, {
        title: arrangementName || "arrangement-sheet",
        titleLine1: arrangementTitleLine1Draft.trim() || arrangementName || "Arrangement",
        titleLine2: arrangementTitleLine2Draft.trim(),
        composer: arrangementComposerDraft.trim(),
        qrText,
        watermark: arrangementPdfWatermarkEnabled,
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to export arrangement PDF");
    }
  }, [
    arrangementDisplayName,
    arrangementTitleLine1Draft,
    arrangementTitleLine2Draft,
    arrangementComposerDraft,
    arrangementPdfQrEnabled,
    arrangementPdfWatermarkEnabled,
    createShareLink,
  ]);
  const handleArrangementPrintSubmit = React.useCallback(async () => {
    await handleArrangementPdfExport();
    setIsArrangementPrintDialogOpen(false);
  }, [handleArrangementPdfExport]);
  const handleMidiExportSubmit = React.useCallback(() => {
    try {
      if (midiExportMode === "arrangement") {
        exportArrangementMidi({
          rows: arrangementRows,
          instruments: ALL_INSTRUMENTS,
          title: printTitle.trim(),
          composer: printComposer.trim(),
          filename: printTitle.trim() || arrangementDisplayName || "Drum Arrangement",
        });
      } else {
        exportDrumMidi({
          grid: computedGrid,
          instruments,
          columns,
          resolution,
          bpm,
          timeSig,
          stepQuarterDurations,
          payload: buildCurrentBeatPayload(),
          title: printTitle.trim(),
          composer: printComposer.trim(),
          filename: printTitle.trim() || "Drum Notation",
        });
      }
      setIsMidiDialogOpen(false);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to export MIDI");
    }
  }, [
    arrangementDisplayName,
    arrangementRows,
    bpm,
    buildCurrentBeatPayload,
    columns,
    computedGrid,
    instruments,
    midiExportMode,
    printComposer,
    printTitle,
    resolution,
    stepQuarterDurations,
    timeSig,
  ]);

  const renderArrangementNotationPage = (page, pageIdx, opts = {}) => {
    const {
      dark = true,
      exportMode = false,
      includePageNumber = true,
      pageRef = undefined,
      shouldRenderNotation = true,
    } = opts;
    return (
      <div
        key={exportMode ? `${page.id}-export` : page.id}
        ref={pageRef}
        data-arr-page-idx={pageIdx}
        data-arr-page="1"
        data-arr-export-page="1"
        {...(!exportMode ? { "data-arr-visible-export-page": "1" } : {})}
        className={
          exportMode
            ? "w-[794px] min-h-[1123px] px-3 pt-2 pb-4"
            : "relative mx-auto w-[794px] max-w-none min-h-[1123px] px-3 pt-2 pb-4"
        }
      >
        {!exportMode ? (
          <div
            className={`pointer-events-none absolute -top-3 -bottom-3 -left-14 -right-14 border ${
              dark ? "border-neutral-800 bg-neutral-950/40" : "border-neutral-300 bg-white"
            }`}
          />
        ) : null}
        <div
          className={`${exportMode ? "" : "relative z-[1]"} ${
            pageIdx > 0 ? "pt-3" : ""
          }`}
        >
          {pageIdx === 0 && (
            <div className="mb-6 flex justify-center">
              {exportMode ? (
                <ArrangementPageHeaderSvg
                  titleLine1={arrangementTitleLine1Draft.trim() || arrangementDisplayName || "Arrangement"}
                  titleLine2={arrangementTitleLine2Draft.trim()}
                  composer={arrangementComposerDraft.trim()}
                  dark={dark}
                />
              ) : (
                <div className="w-full max-w-[46rem]">
                  <div className="grid grid-cols-[12rem_minmax(0,1fr)_12rem] items-start gap-4">
                    <div />
                    <div
                      ref={isArrangementSheetTitleEditing ? arrangementSheetTitleEditorRef : undefined}
                      className="min-w-0 text-center"
                      style={{ fontFamily: '"Liberation Serif", serif' }}
                    >
                      {isArrangementSheetTitleEditing ? (
                        <div className="mx-auto max-w-[28rem]">
                          <input
                            type="text"
                            value={arrangementTitleLine1Draft}
                            onChange={(e) => setArrangementTitleLine1Draft(e.target.value)}
                            placeholder="Main title"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                e.preventDefault();
                                setIsArrangementSheetTitleEditing(false);
                              }
                            }}
                            className={`w-full bg-transparent p-0 text-center text-[2.85rem] font-normal leading-tight shadow-none outline-none ${
                              dark
                                ? "border-0 text-neutral-100"
                                : "border-0 text-neutral-900"
                            }`}
                          />
                          <div className="mt-1">
                            <input
                              type="text"
                              value={arrangementTitleLine2Draft}
                              onChange={(e) => setArrangementTitleLine2Draft(e.target.value)}
                              placeholder="Subtitle"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  e.preventDefault();
                                  setIsArrangementSheetTitleEditing(false);
                                }
                              }}
                            className={`block w-full bg-transparent p-0 text-center text-[2.85rem] font-normal leading-tight shadow-none outline-none ${
                              dark
                                ? "border-0 text-neutral-200"
                                : "border-0 text-neutral-900"
                            }`}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsArrangementSheetTitleEditing(true)}
                          className="w-full text-center"
                          title="Edit title"
                        >
                          <div className={`text-[2.85rem] font-normal leading-tight ${
                            dark ? "text-neutral-100" : "text-neutral-900"
                          }`}>
                            {arrangementTitleLine1Draft.trim() || arrangementDisplayName || "Arrangement"}
                          </div>
                          {arrangementTitleLine2Draft.trim() ? (
                            <div className={`mt-1 text-[2.85rem] font-normal leading-tight ${
                              dark ? "text-neutral-200" : "text-neutral-900"
                            }`}>
                              {arrangementTitleLine2Draft.trim()}
                            </div>
                          ) : null}
                        </button>
                      )}
                    </div>
                    <div
                      className={`pt-1 text-right text-sm ${
                        dark ? "text-neutral-300" : "text-neutral-700"
                      }`}
                      style={{ fontFamily: '"Liberation Serif", serif' }}
                    >
                      {arrangementComposerDraft.trim() || ""}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {page.segments.map((segment) => (
            <div
              key={exportMode ? `${segment.id}-export` : segment.id}
              className="mb-2 last:mb-0 flex justify-center"
              {...(!exportMode
                ? {
                    "data-arr-notation-row-target": "1",
                    "data-arr-notation-start": String(segment.startBarOffset || 0),
                    "data-arr-notation-end": String(
                      (segment.startBarOffset || 0) + Math.max(1, Number(segment.notation?.bars) || 0)
                    ),
                  }
                : {})}
            >
              {shouldRenderNotation ? (
                <MemoNotation
                  instruments={segment.notation.instruments}
                  grid={segment.notation.grid}
                  stickingAssignmentsByStep={segment.stickingAssignments || []}
                  showNotationSticking={showNotationSticking}
                  notationStickingSelection={segment.notation.notationStickingSelection || {}}
                  notationStickingView={notationStickingView}
                  resolution={segment.notation.resolution}
                  bars={segment.notation.bars}
                  barsPerLine={segment.barsPerLine || 4}
                  barsPerRow={segment.barsPerRow || null}
                  stepsPerBar={Math.max(
                    1,
                    Number((segment.notation.barStepOffsets?.[1] ?? 0) - (segment.notation.barStepOffsets?.[0] ?? 0)) ||
                      segment.notation.resolution
                  )}
                  timeSig={segment.notation.timeSig}
                  timeSigByBar={segment.notation.timeSigByBar}
                  quarterSubdivisionsByBar={segment.notation.quarterSubdivisionsByBar}
                  barStepOffsets={segment.notation.barStepOffsets}
                  mergeRests={mergeRests}
                  mergeNotes={mergeNotes}
                  dottedNotes={dottedNotes}
                  flatBeams={flatBeams}
                  justifySystems={true}
                  targetContentWidth={770}
                  sectionMarkers={segment.sectionMarkers || []}
                  tempoMarkers={segment.tempoMarkers || []}
                  dynamicSpacingByBar={segment.dynamicSpacingByBar || null}
                  spacingPresetByBar={segment.spacingPresetByBar || null}
                  mergeRestsByBar={segment.mergeRestsByBar || null}
                  mergeNotesByBar={segment.mergeNotesByBar || null}
                  dottedNotesByBar={segment.dottedNotesByBar || null}
                  showNotationStickingByBar={segment.showNotationStickingByBar || null}
                  showSystemBarNumbers={true}
                  barNumberOffset={segment.startBarOffset || 0}
                  enableMeasureRepeats={true}
                  theme={dark ? "dark" : "light"}
                  selectedBarIndices={
                    normalizedArrangementBarSelection
                      ? Array.from(
                          { length: Math.max(1, Number(segment.notation?.bars) || 0) },
                          (_, idx) => idx
                        ).filter((idx) => {
                          const globalBar = (segment.startBarOffset || 0) + idx;
                          return (
                            globalBar >= normalizedArrangementBarSelection.start &&
                            globalBar <= normalizedArrangementBarSelection.end
                          );
                        })
                      : []
                  }
                  editorBarIndices={
                    currentArrangementEditorBarRange
                      ? Array.from(
                          { length: Math.max(1, Number(segment.notation?.bars) || 0) },
                          (_, idx) => idx
                        ).filter((idx) => {
                          const globalBar = (segment.startBarOffset || 0) + idx;
                          return (
                            globalBar >= currentArrangementEditorBarRange.start &&
                            globalBar <= currentArrangementEditorBarRange.end
                          );
                        })
                      : []
                  }
                  onBarClick={
                    exportMode
                      ? null
                      : (localBarIndex, event) =>
                          (event?.pointerType && event.pointerType !== "mouse")
                            ? handleArrangementNotationBarTouchSelect(
                                (segment.startBarOffset || 0) + localBarIndex,
                                event.pointerId,
                                event.clientX,
                                event.clientY
                              )
                            : handleArrangementNotationBarSelect(
                                (segment.startBarOffset || 0) + localBarIndex,
                                !!event?.shiftKey
                              )
                  }
                  onBarMenuOpen={
                    exportMode
                      ? null
                      : (localBarIndex, event) =>
                          openArrangementNotationRowMenuAtBar(
                            (segment.startBarOffset || 0) + localBarIndex,
                            event.clientX,
                            event.clientY
                          )
                  }
                  activeBarIndices={
                    exportMode
                      ? []
                      : activeArrangementGlobalBarIndex >= (segment.startBarOffset || 0) &&
                          activeArrangementGlobalBarIndex <
                            (segment.startBarOffset || 0) + (segment.notation?.bars || 0)
                        ? [activeArrangementGlobalBarIndex - (segment.startBarOffset || 0)]
                        : []
                  }
                />
              ) : (
                <div style={{ width: 770, height: 160 * Math.max(1, segment.barsPerRow?.length || 1) }} />
              )}
            </div>
          ))}
          {includePageNumber ? (
            <div className="pt-6 text-center text-[11px] text-neutral-500">
              {pageIdx + 1}
            </div>
          ) : null}
        </div>
      </div>
    );
  };
// Spacebar toggles Play/Stop (avoid stealing space when typing)
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      if (!matchesShortcut(e, "play_toggle")) return;

      if (e.pointerType !== "mouse") e.preventDefault();
      if (
        arrangementPlaybackEnabled ||
        normalizedArrangementBarSelection ||
        normalizedArrangementSelection
      ) {
        if (arrangementPlaybackEnabled && playback.isPlaying) stopArrangementPlayback();
        else startArrangementPlayback();
        return;
      }
      togglePlaybackFromBeginning();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    arrangementPlaybackEnabled,
    normalizedArrangementBarSelection,
    normalizedArrangementSelection,
    playback.isPlaying,
    startArrangementPlayback,
    stopArrangementPlayback,
    togglePlaybackFromBeginning,
    matchesShortcut,
  ]);
  useEffect(() => {
    if (!isArrangementSheetTitleEditing) return undefined;
    const onPointerDown = (event) => {
      const root = arrangementSheetTitleEditorRef.current;
      if (!root) return;
      if (root.contains(event.target)) return;
      setIsArrangementSheetTitleEditing(false);
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("touchstart", onPointerDown, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("touchstart", onPointerDown, true);
    };
  }, [isArrangementSheetTitleEditing]);

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      if (stickingEditModeEnabled || notationStickingSelectionModeEnabled) return;

      if (matchesShortcut(e, "loop_all_toggle")) {
        e.preventDefault();
        setLoopRepeats((prev) => (prev === "all" ? "off" : "all"));
        return;
      }

      for (let number = 1; number <= 8; number++) {
        if (!matchesShortcut(e, `loop_${number}_toggle`)) continue;
        e.preventDefault();
        setLoopRepeats(String(number));
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matchesShortcut, notationStickingSelectionModeEnabled, stickingEditModeEnabled]);
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable;
      if (isTyping) return;
      if (!stickingEditModeEnabled) return;
      if (matchesShortcut(e, "assign_sticking_left")) {
        if (assignStickingOverrideHandToSelectionRef.current?.("L")) {
          e.preventDefault();
        }
        return;
      }
      if (matchesShortcut(e, "assign_sticking_right")) {
        if (assignStickingOverrideHandToSelectionRef.current?.("R")) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matchesShortcut, stickingEditModeEnabled]);

  useEffect(() => {
    playback.setPlayhead((prev) => Math.max(0, Math.min(columns - 1, prev)));
  }, [columns]);

  useEffect(() => {
    if (!isEmbedMode) return;
    if (window.parent === window) return;

    const sendEmbedHeight = () => {
      const doc = document.documentElement;
      const body = document.body;
      const height = Math.max(
        doc?.scrollHeight || 0,
        doc?.offsetHeight || 0,
        body?.scrollHeight || 0,
        body?.offsetHeight || 0
      );
      window.parent.postMessage(
        {
          type: "drumgrid-embed-height",
          exampleId: requestedExample?.id || null,
          height: Math.max(200, Math.ceil(height)),
        },
        "*"
      );
    };

    const raf = window.requestAnimationFrame(sendEmbedHeight);
    const timeout = window.setTimeout(sendEmbedHeight, 120);
    window.addEventListener("resize", sendEmbedHeight);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", sendEmbedHeight);
    };
  }, [isEmbedMode, requestedExample, bars, columns, layout, resolution, timeSig, instruments.length]);



  // Resize grid when resolution/bars change (preserve existing hits)
  useEffect(() => {
    if (skipNextBaseGridResizeRef.current) {
      skipNextBaseGridResizeRef.current = false;
      return;
    }
    setBaseGrid((prev) => {
      const needsResize = ALL_INSTRUMENTS.some(
        (i) => (prev[i.id]?.length ?? 0) !== columns
      );
      if (!needsResize) return prev;
      const next = {};
      ALL_INSTRUMENTS.forEach((i) => {
        next[i.id] = Array(columns)
          .fill(CELL.OFF)
          .map((_, idx) => prev[i.id]?.[idx] ?? CELL.OFF);
      });
      return next;
    });
  }, [columns]);

  
  
  
  const cycleVelocity = (inst, idx) => {
    if (loopRule) {
      const r = instruments.findIndex((x) => x.id === inst);
      const inLoopRows = r >= loopRule.rowStart && r <= loopRule.rowEnd;
      const inSourceCols = idx >= loopRule.start && idx < loopRule.start + loopRule.length;
      const inSource = inLoopRows && inSourceCols;

      const inGenerated = inLoopRows && idx >= loopRule.start + loopRule.length;

      // Rule:
      // - Click inside source: edit source live (no bake)
      // - Click anywhere else (including generated area): bake loop and exit loop mode (NO toggle on this click)
      if (!inSource || inGenerated) {
        setBaseGridWithUndo((prev) => bakeLoopInto(prev, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability));
        setLoopRule(null);
        setSelection(null);
        return;
      }
    }

    // Normal edit (or edit within loop source)
    setBaseGridWithUndo((prev) => {
      const next = { ...prev };
      const current = prev[inst][idx];
      // Articulated hits behave like "on" for regular click toggling.
      const normalized = current === CELL.GHOST || current === CELL.ACCENT ? CELL.ON : current;
      const nextVal = normalized === CELL.OFF ? CELL.ON : CELL.OFF;
      next[inst] = [...prev[inst]];
      next[inst][idx] = nextVal;
      return next;
    });
  };

  const cycleStickingOverride = React.useCallback((inst, idx) => {
    if (FOOT_INSTRUMENTS.has(inst)) return false;
    const val = computedGrid[inst]?.[idx] ?? CELL.OFF;
    if (val === CELL.OFF) return false;
    const clickedRow = instruments.findIndex((x) => x.id === inst);
    const currentHand = stickingAssignmentsByStep?.[idx]?.[inst] === "L" ? "L" : "R";
    const targetHand = currentHand === "L" ? "R" : "L";
    const oppositeHand = targetHand === "L" ? "R" : "L";
    const leadHand = stickingLeadHand === "left" ? "L" : "R";
    const nonLeadHand = leadHand === "L" ? "R" : "L";
    const clickedInSelection = Boolean(
      selection &&
      clickedRow >= selection.rowStart &&
      clickedRow <= selection.rowEnd &&
      idx >= selection.start &&
      idx < selection.endExclusive
    );
    if (clickedInSelection) {
      const selectionSignature = `${selection.rowStart}:${selection.rowEnd}:${selection.start}:${selection.endExclusive}`;
      const prevCycle = stickingSelectionCycleRef.current;
      const nextPhase =
        prevCycle.signature === selectionSignature
          ? (prevCycle.phase + 1) % 3
          : 0;
      stickingSelectionCycleRef.current = { signature: selectionSignature, phase: nextPhase };
      setStickingOverrides((prev) => {
        const next = { ...(prev || {}) };
        const selectedActiveCells = [];
        for (let c = selection.start; c < selection.endExclusive; c++) {
          for (let r = selection.rowStart; r <= selection.rowEnd; r++) {
            const instId = instruments[r]?.id;
            if (!instId || FOOT_INSTRUMENTS.has(instId)) continue;
            if ((computedGrid[instId]?.[c] ?? CELL.OFF) === CELL.OFF) continue;
            selectedActiveCells.push({ instId, col: c });
          }
        }
        let alternatingHand = leadHand;
        for (const cell of selectedActiveCells) {
          const { instId, col } = cell;
          const k = `${instId}:${col}`;
          let desired = leadHand;
          if (nextPhase === 1) {
            desired = nonLeadHand;
          } else if (nextPhase === 2) {
            desired = alternatingHand;
            alternatingHand = alternatingHand === "L" ? "R" : "L";
          }
          next[k] = desired;
        }
        return next;
      });
      return true;
    }
    const activeHandIds = instruments
      .map((i) => i.id)
      .filter((id) => !FOOT_INSTRUMENTS.has(id) && (computedGrid[id]?.[idx] ?? CELL.OFF) !== CELL.OFF);
    setStickingOverrides((prev) => {
      const next = { ...(prev || {}) };
      for (const id of activeHandIds) {
        const k = `${id}:${idx}`;
        const autoHand = autoStickingAssignmentsByStep?.[idx]?.[id] === "L" ? "L" : "R";
        const desired = id === inst ? targetHand : oppositeHand;
        if (desired === autoHand) delete next[k];
        else next[k] = desired;
      }
      return next;
    });
    return true;
  }, [computedGrid, autoStickingAssignmentsByStep, stickingAssignmentsByStep, instruments, selection, stickingLeadHand]);
  const assignStickingOverrideHandToSelection = React.useCallback((hand) => {
    const normalizedHand = hand === "L" ? "L" : hand === "R" ? "R" : null;
    if (!normalizedHand || !stickingEditModeEnabled) return false;
    const selectedCells = Array.isArray(wrappedSelectionCells) && wrappedSelectionCells.length > 0
      ? wrappedSelectionCells
      : selection
        ? Array.from({ length: Math.max(0, selection.endExclusive - selection.start) }, (_, colOffset) =>
            Array.from({ length: Math.max(0, selection.rowEnd - selection.rowStart + 1) }, (_, rowOffset) => ({
              row: selection.rowStart + rowOffset,
              col: selection.start + colOffset,
            }))
          ).flat()
        : [];
    const activeCells = selectedCells.filter((cell) => {
      const instId = instruments[cell?.row]?.id;
      if (!instId || FOOT_INSTRUMENTS.has(instId)) return false;
      return (computedGrid[instId]?.[cell?.col] ?? CELL.OFF) !== CELL.OFF;
    });
    if (!activeCells.length) return false;
    setStickingOverrides((prev) => {
      const next = { ...(prev || {}) };
      activeCells.forEach((cell) => {
        const instId = instruments[cell.row]?.id;
        if (!instId) return;
        next[`${instId}:${cell.col}`] = normalizedHand;
      });
      return next;
    });
    return true;
  }, [computedGrid, instruments, selection, stickingEditModeEnabled, wrappedSelectionCells]);
  React.useEffect(() => {
    assignStickingOverrideHandToSelectionRef.current = assignStickingOverrideHandToSelection;
  }, [assignStickingOverrideHandToSelection]);

  const clearNotationStickingSelection = React.useCallback(() => {
    setNotationStickingModePreference("off");
    setNotationStickingSelection({});
    setShowNotationSticking(false);
    setNotationStickingSelectionModeEnabled(false);
  }, []);

  const selectAllNotationSticking = React.useCallback(() => {
    const next = allNotationStickingSelection;
    setNotationStickingModePreference("all");
    setNotationStickingSelection(next);
    setShowNotationSticking(true);
    setNotationStickingSelectionModeEnabled(false);
  }, [allNotationStickingSelection]);

  const toggleNotationStickingSelectionAt = React.useCallback((inst, idx) => {
    if (FOOT_INSTRUMENTS.has(inst)) return false;
    if ((computedGrid[inst]?.[idx] ?? CELL.OFF) === CELL.OFF) return false;
    const key = `${inst}:${idx}`;
    setAutoPrintNewBeatStickingEnabled(false);
    setNotationStickingModePreference("custom");
    setNotationStickingSelection((prev) => {
      const next = { ...(prev || {}) };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
    setShowNotationSticking(true);
    return true;
  }, [computedGrid]);

  const cycleArticulation = (inst, idx, forceValue = null) => {
    if (!GHOST_ENABLED.has(inst)) return;

    if (loopRule) {
      const r = instruments.findIndex((x) => x.id === inst);
      const inLoopRows = r >= loopRule.rowStart && r <= loopRule.rowEnd;
      const inSourceCols = idx >= loopRule.start && idx < loopRule.start + loopRule.length;
      const inSource = inLoopRows && inSourceCols;
      const inGenerated = inLoopRows && idx >= loopRule.start + loopRule.length;

      // Match click behavior: long-pressing outside the source bakes & exits without toggling.
      if (!inSource || inGenerated) {
        setBaseGridWithUndo((prev) => bakeLoopInto(prev, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability));
        setLoopRule(null);
        setSelection(null);
        return;
      }
    }

    setBaseGridWithUndo((prev) => {
      const next = { ...prev };
      const current = prev[inst][idx];
      if (forceValue && (forceValue === CELL.ON || forceValue === CELL.GHOST || forceValue === CELL.ACCENT)) {
        next[inst] = [...prev[inst]];
        next[inst][idx] = forceValue;
        return next;
      }

      // Only toggle ghost on active cells.
      if (current === CELL.OFF) return prev;
      const nextVal =
        current === CELL.ON ? CELL.GHOST :
        current === CELL.GHOST ? CELL.ACCENT :
        CELL.ON;

      next[inst] = [...prev[inst]];
      next[inst][idx] = nextVal;
      return next;
    });
  };

  const getBeatLibraryParentId = React.useCallback((beat) => {
    const direct = beat?.libraryMeta && typeof beat.libraryMeta === "object" ? beat.libraryMeta : null;
    const payloadMeta =
      beat?.payload?.libraryMeta && typeof beat.payload.libraryMeta === "object"
        ? beat.payload.libraryMeta
        : null;
    const meta = direct || payloadMeta || null;
    return meta?.parentId ? String(meta.parentId) : null;
  }, []);

  const renderArrangementSourceTreeBeatRow = React.useCallback((beat, depth) => {
    const beatBpm = getBeatBpm(beat);
    const sourceLabel = "local";
    const beatRowKey = `${sourceLabel}:${String(beat.id)}`;
    const isLoadedTrackedBeat =
      String(loadedLocalBeatId || "") === String(beat.id) && !isLoadedLocalBeatNameChanged;
    const isSelectedArrangementSourceBeat =
      !loadedLocalBeatId && selectedArrangementSourceBeatKey === beatRowKey;
    const isActiveDraggedBeat = String(activeBeatLibraryDragBeatId || "") === String(beat.id);
    const hideSourceWhileDragging =
      isActiveDraggedBeat &&
      !!beatLibraryDropTargetId &&
      !String(beatLibraryDropTargetId).startsWith("beat:");
    return (
      <SortableArrangementSourceBeatRow
        key={`arr-tree-beat-${beat.id}`}
        beat={beat}
        depth={depth}
        beatRowKey={beatRowKey}
        beatBpm={beatBpm}
        isActiveDraggedBeat={isActiveDraggedBeat}
        beatLibraryDropTargetId={beatLibraryDropTargetId}
        isLoadedTrackedBeat={isLoadedTrackedBeat}
        isSelectedArrangementSourceBeat={isSelectedArrangementSourceBeat}
        isBeatLibraryBeatSelected={selectedBeatLibraryBeatIds.includes(String(beat.id))}
        editingBeatLibraryBeatId={editingBeatLibraryBeatId}
        editingBeatLibraryBeatName={editingBeatLibraryBeatName}
        setEditingBeatLibraryBeatName={setEditingBeatLibraryBeatName}
        commitEditingBeatLibraryBeat={commitEditingBeatLibraryBeat}
        cancelEditingBeatLibraryBeat={cancelEditingBeatLibraryBeat}
        startEditingBeatLibraryBeat={startEditingBeatLibraryBeat}
        pendingBeatRenameExitRef={beatLibraryPendingBeatRenameExitRef}
        showUpdateButton={
          String(loadedLocalBeatId || "") === String(beat.id) &&
          canUpdateLoadedLocalBeat
        }
        softActiveHighlight={Boolean(normalizedArrangementSelection)}
        updateCurrentLoadedBeatLocal={updateCurrentLoadedBeatLocal}
        onSelectBeat={handleBeatLibraryBeatSelect}
        arrangementAddBeat={arrangementAddBeat}
        handleDeleteLocalBeatClick={handleDeleteLocalBeatClick}
        hideSourceWhileDragging={hideSourceWhileDragging}
        disableTransition={
          !!activeBeatLibraryDragBeatId &&
          !!beatLibraryDropTargetId &&
          !String(beatLibraryDropTargetId).startsWith("beat:")
        }
      />
    );
  }, [
    activeBeatLibraryDragBeatId,
    arrangementAddBeat,
    commitEditingBeatLibraryBeat,
    cancelEditingBeatLibraryBeat,
    beatLibraryDropTargetId,
    canUpdateLoadedLocalBeat,
    editingBeatLibraryBeatId,
    editingBeatLibraryBeatName,
    getBeatBpm,
    handleDeleteLocalBeatClick,
    isLoadedLocalBeatNameChanged,
    loadedLocalBeatId,
    loadBeatIntoEditor,
    normalizedArrangementSelection,
    setEditingBeatLibraryBeatName,
    selectedArrangementSourceBeatKey,
    selectedBeatLibraryBeatIds,
    startEditingBeatLibraryBeat,
    updateCurrentLoadedBeatLocal,
    handleBeatLibraryBeatSelect,
  ]);

  const countBeatLibraryFolderBeats = React.useCallback((containerId) => {
    const targetId = String(containerId);
    const directCount = localBeats.filter(
      (beat) => String(getBeatLibraryParentId(beat) || "") === targetId
    ).length;
    const childFolders = beatLibraryContainers.filter(
      (entry) => String(entry.parentId || "") === targetId
    );
    return directCount + childFolders.reduce((sum, child) => sum + countBeatLibraryFolderBeats(child.id), 0);
  }, [beatLibraryContainers, getBeatLibraryParentId, localBeats]);
  const collectBeatLibraryFolderBeatsInOrder = React.useCallback((containerId) => {
    const targetId = String(containerId || "");
    if (!targetId) return [];
    const walk = (parentId) => {
      const beats = localBeats
        .filter((beat) => String(getBeatLibraryParentId(beat) || "") === String(parentId || ""))
        .sort(compareBeatLibraryOrder);
      const childFolders = beatLibraryContainers
        .filter((entry) => String(entry.parentId || "") === String(parentId || ""))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || a.name.localeCompare(b.name));
      return [
        ...beats,
        ...childFolders.flatMap((entry) => walk(entry.id)),
      ];
    };
    return walk(targetId);
  }, [beatLibraryContainers, getBeatLibraryParentId, localBeats]);
  const addBeatLibraryFolderToArrangement = React.useCallback((containerId) => {
    const beats = collectBeatLibraryFolderBeatsInOrder(containerId);
    if (!beats.length) return;
    arrangementAddBeatEntries(
      beats.map((beat) => ({
        source: "local",
        beatId: String(beat?.id || ""),
      }))
    );
  }, [arrangementAddBeatEntries, collectBeatLibraryFolderBeatsInOrder]);

  const renderArrangementSourceFolderRow = React.useCallback((entry, depth = 0, variant = "docked") => {
    const hasChildren = true;
    const folderBeatCount = countBeatLibraryFolderBeats(entry.id);
    const isSelected = String(selectedBeatLibraryContainerId) === String(entry.id);
    const suppressFolderSelectionHighlight =
      (Boolean(loadedLocalBeatId) && !isLoadedLocalBeatNameChanged) ||
      String(selectedArrangementSourceBeatKey || "").startsWith("local:");
    return (
      <BeatLibraryDropTarget
        key={`arr-src-container-${entry.id}`}
        id={String(entry.id)}
        className="relative"
        style={{ marginLeft: `${Math.max(0, depth) * 0.5}rem` }}
        draggable
        onDragStart={(e) => {
          beatLibraryJustDraggedContainerRef.current = { id: String(entry.id), at: Date.now() };
          beginBeatLibraryTreeDrag({ kind: "container", containerId: entry.id });
          try {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", `container:${String(entry.id)}`);
          } catch (_) {}
        }}
        onDragEnd={() => {
          beatLibraryJustDraggedContainerRef.current = { id: String(entry.id), at: Date.now() };
          clearBeatLibraryTreeDrag();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setBeatLibraryDropTargetId(String(entry.id));
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          scheduleBeatLibraryFolderExpand(
            entry.id,
            beatLibraryTreeDragRef.current?.kind === "beat" && hasChildren && entry.collapsed
          );
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setBeatLibraryDropTargetId(String(entry.id));
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          scheduleBeatLibraryFolderExpand(
            entry.id,
            beatLibraryTreeDragRef.current?.kind === "beat" && hasChildren && entry.collapsed
          );
        }}
        onDragLeave={() => {
          if (beatLibraryPendingExpandFolderIdRef.current === String(entry.id)) {
            clearBeatLibraryFolderExpandTimer();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleBeatLibraryTreeDrop(entry.id);
        }}
      >
        <div
          className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors ${
            beatLibraryDropTargetId === String(entry.id)
              ? "bg-cyan-950/20 text-cyan-50 ring-1 ring-inset ring-cyan-500/35"
              : isSelected && !suppressFolderSelectionHighlight
                ? "bg-sky-900/20 text-sky-100"
                : "text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-200"
          }`}
        >
          <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 overflow-hidden">
            <span
              className={`inline-flex h-6 min-w-6 items-center justify-center ${
                hasChildren ? "text-neutral-500" : "text-neutral-800"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (hasChildren) toggleBeatLibraryContainerCollapsed(entry.id);
              }}
              aria-hidden="true"
            >
              {hasChildren ? <TreeTriangle expanded={!entry.collapsed} /> : ""}
            </span>
            {String(editingBeatLibraryContainerId || "") === String(entry.id) ? (
              <input
                type="text"
                value={editingBeatLibraryContainerName}
                onChange={(e) => setEditingBeatLibraryContainerName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    commitEditingBeatLibraryContainer();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelEditingBeatLibraryContainer();
                  }
                }}
                onBlur={() => commitEditingBeatLibraryContainer()}
                autoFocus
                className="min-w-0 max-w-full bg-transparent px-1 py-0.5 text-xs text-white outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (
                    beatLibraryJustDraggedContainerRef.current.id === String(entry.id) &&
                    Date.now() - Number(beatLibraryJustDraggedContainerRef.current.at || 0) < 400
                  ) {
                    beatLibraryJustDraggedContainerRef.current = { id: "", at: 0 };
                    return;
                  }
                  clearBeatLibraryBeatSelection();
                  selectBeatLibraryContainer(entry.id);
                }}
                className="flex min-w-0 flex-1 basis-0 items-center rounded px-1 py-0.5 text-left hover:bg-neutral-800/40"
                title={String(entry.name || "Open folder")}
              >
                <MeasuredTailText
                  text={entry.name}
                  prefixLength={3}
                  minTailLength={3}
                  widthSafetyPx={
                    variant === "docked"
                      ? depth > 0
                        ? 6
                        : 10
                      : 12
                  }
                  className="block w-full min-w-0 overflow-hidden pr-1 text-clip whitespace-nowrap"
                />
              </button>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pr-1">
            <span className="min-w-[15px] text-right text-[10px] text-neutral-600">
              {folderBeatCount > 0 ? folderBeatCount : ""}
            </span>
            <button
              type="button"
              onPointerDown={(e) => {
                if (String(editingBeatLibraryContainerId || "") === String(entry.id)) {
                  e.preventDefault();
                  e.stopPropagation();
                  beatLibraryPendingRenameExitRef.current = String(entry.id);
                  return;
                }
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (beatLibraryPendingRenameExitRef.current === String(entry.id)) {
                  beatLibraryPendingRenameExitRef.current = "";
                  commitEditingBeatLibraryContainer();
                  return;
                }
                beatLibraryPendingRenameExitRef.current = "";
                startEditingBeatLibraryContainer(entry.id);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                if (String(editingBeatLibraryContainerId || "") === String(entry.id)) {
                  commitEditingBeatLibraryContainer();
                } else {
                  startEditingBeatLibraryContainer(entry.id);
                }
              }}
              className="inline-flex h-6 min-w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800/60 hover:text-white"
              title="Rename folder"
            >
            <PencilIcon />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                addBeatLibraryFolderToArrangement(entry.id);
              }}
              className="px-2 py-1 rounded text-xs text-neutral-400 bg-neutral-900/60 hover:bg-neutral-800/60"
              title="Add folder beats to arrangement"
              aria-label="Add folder beats to arrangement"
            >
              Add
            </button>
          </div>
        </div>
      </BeatLibraryDropTarget>
    );
  }, [
    beatLibraryContainers,
    beatLibraryDropTargetId,
    beginBeatLibraryTreeDrag,
    cancelEditingBeatLibraryContainer,
    clearBeatLibraryTreeDrag,
    clearBeatLibraryFolderExpandTimer,
    commitEditingBeatLibraryContainer,
    countBeatLibraryFolderBeats,
    editingBeatLibraryContainerId,
    editingBeatLibraryContainerName,
    getBeatLibraryParentId,
    handleBeatLibraryTreeDrop,
    isLoadedLocalBeatNameChanged,
    loadedLocalBeatId,
    localBeats,
    selectedArrangementSourceBeatKey,
    selectedBeatLibraryContainerId,
    scheduleBeatLibraryFolderExpand,
    clearBeatLibraryBeatSelection,
    addBeatLibraryFolderToArrangement,
    setEditingBeatLibraryContainerName,
    startEditingBeatLibraryContainer,
    toggleBeatLibraryContainerCollapsed,
  ]);

  const renderArrangementSourceFolderContents = React.useCallback((parentId, depth = 0, variant = "docked") => {
    const childBeats = filteredLocalBeats
      .filter((beat) => {
        const direct = beat?.libraryMeta && typeof beat.libraryMeta === "object" ? beat.libraryMeta : null;
        const payloadMeta =
          beat?.payload?.libraryMeta && typeof beat.payload.libraryMeta === "object"
            ? beat.payload.libraryMeta
            : null;
        const meta = direct || payloadMeta || null;
        return String(meta?.parentId || "") === String(parentId || "");
      })
      .sort(compareBeatLibraryOrder);
    const childFolders = beatLibraryContainers.filter(
      (entry) => String(entry.parentId || "") === String(parentId || "")
    );
    const nodes = [];
    if (childBeats.length > 0) {
      const shouldShowCrossFolderPlaceholder =
        !!activeBeatLibraryDragBeatId &&
        !!beatLibraryDropTargetId &&
        !String(beatLibraryDropTargetId).startsWith("beat:") &&
        childBeats.some((beat) => String(beat?.id || "") === String(activeBeatLibraryDragBeatId));
      const visibleBeats = shouldShowCrossFolderPlaceholder
        ? childBeats.filter((beat) => String(beat?.id || "") !== String(activeBeatLibraryDragBeatId))
        : childBeats;
      const originalIndex = childBeats.findIndex(
        (beat) => String(beat?.id || "") === String(activeBeatLibraryDragBeatId)
      );
      const lastOverBeatId = String(beatLibraryLastBeatOverIdRef.current || "");
      const targetIndex = childBeats.findIndex((beat) => String(beat?.id || "") === lastOverBeatId);
      const placeholderIndex = shouldShowCrossFolderPlaceholder
        ? Math.max(0, Math.min(visibleBeats.length, targetIndex >= 0 ? targetIndex : originalIndex))
        : -1;
      nodes.push(
        <SortableContext
          key={`arr-src-inline-sortable-${String(parentId || "root")}`}
          items={childBeats.map((beat) => `beat:${String(beat.id)}`)}
          strategy={verticalListSortingStrategy}
        >
          {visibleBeats.map((beat, index) => (
            <React.Fragment key={`arr-src-inline-node-${String(parentId || "root")}-${String(beat.id)}`}>
              {shouldShowCrossFolderPlaceholder && index === placeholderIndex ? <BeatLibraryReservedBeatRowSlot /> : null}
              {renderArrangementSourceTreeBeatRow(beat, depth)}
            </React.Fragment>
          ))}
          {shouldShowCrossFolderPlaceholder && placeholderIndex === visibleBeats.length ? (
            <BeatLibraryReservedBeatRowSlot />
          ) : null}
        </SortableContext>
      );
    }
    childFolders.forEach((entry) => {
      nodes.push(renderArrangementSourceFolderRow(entry, depth, variant));
      if (!entry.collapsed) nodes.push(...renderArrangementSourceFolderContents(entry.id, depth + 1, variant));
    });
    return nodes;
  }, [
    activeBeatLibraryDragBeatId,
    beatLibraryDropTargetId,
    beatLibraryContainers,
    filteredLocalBeats,
    renderArrangementSourceFolderRow,
    renderArrangementSourceTreeBeatRow,
  ]);
  const activeBeatLibraryDragBeat = React.useMemo(
    () => localBeats.find((beat) => String(beat?.id || "") === String(activeBeatLibraryDragBeatId || "")) || null,
    [activeBeatLibraryDragBeatId, localBeats]
  );
  const activeBeatLibraryDragBeatBpm = React.useMemo(
    () => (activeBeatLibraryDragBeat ? getBeatBpm(activeBeatLibraryDragBeat) : null),
    [activeBeatLibraryDragBeat, getBeatBpm]
  );
  const dockedBeatLibrarySidebar = beatLibraryDockedInSidebar ? (
    <aside
      ref={dockedBeatLibrarySidebarRef}
      className="sticky top-0 mt-6 z-20 self-start w-[15.5rem] shrink-0 overflow-visible rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-xl shadow-black/20"
      data-loopui="1"
    >
      <div className="flex h-full flex-col">
        <ArrangementSourceHeader
          sourceTab={arrangementSourceTab}
          moveUpTargetRef={beatLibraryMoveUpTargetRef}
          moveUpActive={beatLibraryDropTargetId === "__up__"}
          onMoveUpDragOver={(e) => {
            if (arrangementSourceTab !== "local") return;
            if (beatLibraryTreeDragRef.current?.kind !== "container") return;
            e.preventDefault();
            e.stopPropagation();
            setBeatLibraryDropTargetId("__up__");
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          }}
          onMoveUpDragLeave={(e) => {
            if (arrangementSourceTab !== "local") return;
            if (beatLibraryTreeDragRef.current?.kind !== "container") return;
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setBeatLibraryDropTargetId((prev) => (prev === "__up__" ? null : prev));
          }}
          onMoveUpDrop={(e) => {
            if (arrangementSourceTab !== "local") return;
            if (beatLibraryTreeDragRef.current?.kind !== "container") return;
            e.preventDefault();
            e.stopPropagation();
            handleBeatLibraryTreeDrop(null);
          }}
          renderBreadcrumb={() => renderBeatLibraryBreadcrumb("docked")}
          filtersButtonRef={dockedLibraryFiltersButtonRef}
          filtersOpen={libraryFiltersOpen}
          filtersMenuStyle={libraryFiltersMenuStyle}
          filtersMenuRef={libraryFiltersRef}
          filtersAnchor={libraryFiltersAnchor}
          onToggleFilters={() => {
            setLibraryFiltersAnchor("docked");
            setLibraryFiltersOpen((v) => !v);
          }}
          onSetSourceTab={(tab) => {
            setArrangementSourceTab(tab);
            setLibraryFiltersOpen(false);
          }}
          onShowBeats={() => {
            setArrangementSourcesCollapsed(false);
            setArrangementDetailsCollapsed(true);
            setArrangementSourceTab("local");
            setLibraryFiltersOpen(false);
          }}
          onShowArrangement={() => {
            setArrangementSourcesCollapsed(true);
            setArrangementDetailsCollapsed(false);
            setLibraryFiltersOpen(false);
          }}
          onShowBeatsAndArrangement={() => {
            setArrangementSourcesCollapsed(false);
            setArrangementDetailsCollapsed(false);
            setLibraryFiltersOpen(false);
          }}
          onShowSheet={() => {
            setArrangementSourcesCollapsed(true);
            setArrangementDetailsCollapsed(false);
            setIsArrangementOpen(true);
            setIsArrangementNotationOpen(true);
            setLibraryFiltersOpen(false);
          }}
          onShowPresets={() => {
            setArrangementSourcesCollapsed(false);
            setArrangementDetailsCollapsed(true);
            setArrangementSourceTab("presets");
            setLibraryFiltersOpen(false);
          }}
          canSyncPersonalLibrary={arrangementSourceTab === "local" && authUser?.id && hasSupabaseEnabled}
          personalLibraryRefreshing={personalLibraryRefreshing}
          onSyncPersonalLibrary={async () => {
            await refreshPersonalLibraryFromCloud({ alertOnError: true });
            setLibraryFiltersOpen(false);
          }}
          showBeatFilters={arrangementSourceTab !== "presets"}
          sortLabel={getLibrarySortLabel(librarySort)}
          onCycleSort={cycleLibrarySort}
          timeSigFilter={libraryTimeSigFilter}
          onTimeSigFilterChange={setLibraryTimeSigFilter}
          allTimeSigCategories={allTimeSigCategories}
          timeSigOptionKeyPrefix="arr-docked-ts"
          onStartBpmRepeat={startLibraryBpmRepeat}
          onStopBpmRepeat={stopLibraryBpmRepeat}
          onCycleBpmFilterMode={cycleLibraryBpmFilterMode}
          bpmFilterLabel={getBpmFilterLabel()}
          showRefreshPublic={arrangementSourceTab === "public"}
          onRefreshPublic={refreshPublicLibrary}
          showPublishPublic={arrangementSourceTab === "local" && isAdminUser}
          onPublishPublic={() => {
            setLibraryFiltersOpen(false);
            openPublicSubmitDialog();
          }}
          onClose={() => setIsArrangementOpen(false)}
          closeTitle="Close beat library"
          closeAriaLabel="Close beat library"
          error={publicLibraryError}
          onClearError={() => setPublicLibraryError("")}
        />
        {arrangementSourceTab === "local" ? (
          <LocalBeatSourceList
            listRef={arrangementSourceListRef}
            variant="docked"
            sensors={beatLibraryOrderSensors}
            collisionDetection={detectBeatLibraryDropCollision}
            modifiers={[restrictBeatLibraryDragToList]}
            onDragStart={handleBeatLibrarySortDragStart}
            onDragOver={handleBeatLibrarySortDragOver}
            onDragEnd={handleBeatLibrarySortDragEnd}
            onDragCancel={handleBeatLibrarySortDragCancel}
            DropTargetComponent={BeatLibraryDropTarget}
            DragOverlayCardComponent={BeatLibraryDragOverlayCard}
            activeDragBeat={activeBeatLibraryDragBeat}
            activeDragBeatBpm={activeBeatLibraryDragBeatBpm}
            selectedContainerId={selectedBeatLibraryContainerId}
            currentParentId={currentBeatLibraryParentId}
            currentFolders={currentBeatLibraryFolders}
            currentBeats={currentBeatLibraryBeats}
            renderFolderContents={renderArrangementSourceFolderContents}
            onCreateFolder={async () => {
              const nextContainer = createBeatLibraryContainer("folder");
              if (!nextContainer) return;
              setEditingBeatLibraryContainerId(String(nextContainer.id));
              setEditingBeatLibraryContainerName(String(nextContainer.name || ""));
              if (selectedBeatLibraryBeatIds.length > 0) {
                const orderedSelectedIds = visibleLocalBeatIdsInLibraryOrder.filter((id) =>
                  selectedBeatLibraryBeatIds.includes(id)
                );
                await moveBeatsToLibraryContainer(orderedSelectedIds, nextContainer.id);
                clearBeatLibraryBeatSelection();
              }
            }}
            onSaveAsNew={saveCurrentBeatLocal}
            trashTargetRef={beatLibraryTrashTargetRef}
            onTrashClick={handleBeatLibrarySidebarTrashClick}
            onTrashDragOver={(e) => {
              e.preventDefault();
              setBeatLibraryDropTargetId("__trash__");
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            }}
            onTrashDragLeave={() =>
              setBeatLibraryDropTargetId((prev) => (prev === "__trash__" ? null : prev))
            }
            onTrashDrop={async (e) => {
              e.preventDefault();
              await handleBeatLibraryTrashDrop();
            }}
            trashActive={beatLibraryDropTargetId === "__trash__"}
            trashEmphasis={selectedBeatLibraryContainerId !== "all"}
            trashTitle={
              selection
                ? "Clear current grid selection"
                : selectedLocalBeatForTrash?.id
                  ? "Delete selected beat or drop beats/folders here"
                  : selectedBeatLibraryContainerId !== "all"
                    ? "Delete selected folder or drop beats/folders here"
                    : "Drop beats/folders here to delete"
            }
            TrashIcon={TrashIcon}
          />
        ) : arrangementSourceTab === "presets" ? (
          <GridSettingsPresetSourceList
            listRef={arrangementSourceListRef}
            presets={gridSettingsPresets}
            activePreset={activeGridSettingsPreset}
            activeDragId={activeGridSettingsPresetDragId}
            dropTargetId={presetLibraryDropTargetId}
            lastOverPresetId={gridSettingsPresetLastOverIdRef.current}
            editingPresetId={editingGridSettingsPresetId}
            editingName={editingGridSettingsPresetName}
            onEditingNameChange={setEditingGridSettingsPresetName}
            onCommitEditing={commitEditingGridSettingsPreset}
            onCancelEditing={cancelEditingGridSettingsPreset}
            onStartEditing={startEditingGridSettingsPreset}
            pendingPresetRenameExitRef={gridSettingsPresetPendingRenameExitRef}
            sensors={beatLibraryOrderSensors}
            collisionDetection={detectGridSettingsPresetDropCollision}
            modifiers={[restrictBeatLibraryDragToList]}
            onDragStart={handleGridSettingsPresetDragStart}
            onDragOver={handleGridSettingsPresetDragOver}
            onDragEnd={handleGridSettingsPresetDragEnd}
            onDragCancel={handleGridSettingsPresetDragCancel}
            onApplyPreset={(preset) => {
              setSelectedGridSettingsPresetId(String(preset.id));
              applyGridSettingsPreset(preset);
            }}
            onSaveAsNew={saveCurrentGridSettingsPreset}
            onDeleteSelected={deleteSelectedGridSettingsPreset}
            trashTargetRef={beatLibraryTrashTargetRef}
            DropTargetComponent={BeatLibraryDropTarget}
            RowComponent={SortableGridSettingsPresetRow}
            ReservedRowSlotComponent={GridSettingsPresetReservedRowSlot}
            DragOverlayCardComponent={GridSettingsPresetDragOverlayCard}
            activeDragPreset={activeGridSettingsPresetDrag}
            TrashIcon={TrashIcon}
          />
        ) : (
          <PublicBeatSourceList
            beats={arrangementSourceBeats}
            getBeatBpm={getBeatBpm}
            selectedBeatKey={selectedArrangementSourceBeatKey}
            softActiveHighlight={Boolean(normalizedArrangementSelection)}
            loading={publicLibraryLoading}
            isAdmin={isAdminUser}
            keyPrefix="arr-docked-src"
            onBeginDrag={beginArrangementBeatDrag}
            onClearDrag={clearArrangementBeatDrag}
            onSelectBeat={handlePublicBeatSelect}
            onAddBeat={arrangementAddBeat}
            onDeleteBeat={handleDeletePublicBeatClick}
          />
        )}
      </div>
    </aside>
  ) : null;

  const desktopSettingsSidebar = showDesktopSettingsSidebar && !settingsSidebarCollapsed ? (
    <div className="self-start w-[15.5rem] shrink-0">
	    <aside
	      data-sidebar-chevron-area="1"
	      onPointerDown={handleSidebarChevronAreaPointerDown}
	      className="sticky top-0 mt-6 z-20 overflow-visible rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-xl shadow-black/20"
	      data-loopui="1"
	    >
      {isSidebarSettingsMenuOpen ? (
        <button
          type="button"
          aria-label="Close sidebar popup"
          onClick={() => {
            setIsSidebarSettingsMenuOpen(false);
          }}
          className="absolute inset-0 z-[60] rounded-xl bg-neutral-900/80"
        />
      ) : null}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-neutral-300">Settings</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsSidebarCollapsed(true)}
            className="inline-flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded border border-neutral-800 bg-neutral-900/60 text-xs leading-none text-neutral-400 hover:bg-neutral-800/60"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            ×
          </button>
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
	                data-sidebar-chevron-control="resolution"
	                onPointerDown={() => markSidebarChevronHint("resolution")}
	                onClick={() => setIsSidebarResolutionOpen((v) => !v)}
                className="group -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                aria-expanded={isSidebarResolutionOpen}
                aria-controls="settings-sidebar-resolution-options"
                title="Show resolution options"
              >
                <span className="whitespace-nowrap">Resolution</span>
                {renderSidebarChevron(
                  isSidebarResolutionOpen,
                  isSidebarResolutionOpen || sidebarChevronHint === "resolution"
                )}
              </button>
	              <div
	                data-sidebar-chevron-control="resolution"
	                onPointerDown={() => markSidebarChevronHint("resolution")}
	                className="flex items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60"
	              >
                <button
                  type="button"
                  onClick={() => {
                    const order = [4, 8, 16, 32];
                    const idx = order.indexOf(resolution);
                    const next = order[(idx - 1 + order.length) % order.length];
                    handleResolutionChange(next);
                  }}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                >
                  −
                </button>
                <div className="min-w-[60px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-900/60 border-l border-r border-neutral-800">
                  {resolution === 4 ? "4th" : resolution === 8 ? "8th" : resolution === 16 ? "16th" : "32th"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const order = [4, 8, 16, 32];
                    const idx = order.indexOf(resolution);
                    const next = order[(idx + 1) % order.length];
                    handleResolutionChange(next);
                  }}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                >
                  +
                </button>
              </div>
            </div>
            {isSidebarResolutionOpen ? (
              <div
                id="settings-sidebar-resolution-options"
                className="flex items-center justify-end gap-2"
              >
                <span className="text-sm text-neutral-500">Keep timing</span>
                <div className="flex w-fit items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
                  <button
                    type="button"
                    onClick={() => setKeepTiming(false)}
                    className={`whitespace-nowrap px-2.5 py-[2px] text-[13px] ${
                      !keepTiming
                        ? "bg-neutral-800 text-white"
                        : "bg-neutral-900 text-neutral-600"
                    }`}
                    title="Allow timing to shift when changing resolution or tuplets"
                    aria-pressed={!keepTiming}
                  >
                    Off
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeepTiming(true)}
                    className={`whitespace-nowrap border-l border-neutral-800 px-2.5 py-[2px] text-[13px] ${
                      keepTiming
                        ? "bg-neutral-800 text-white"
                        : "bg-neutral-900 text-neutral-600"
                    }`}
                    title="Keep timing when changing resolution or tuplets (remap steps)"
                    aria-pressed={keepTiming}
                  >
                    On
                  </button>
                </div>
              </div>
            ) : null}

	            <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
              <span className="text-sm text-neutral-300">Bars</span>
              <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
                <button
                  type="button"
                  onClick={() => setBars((b) => Math.max(1, b - 1))}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  aria-label="Decrease bars"
                >
                  −
                </button>
                <div className="min-w-[44px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-900/60 border-l border-r border-neutral-800">
                  {bars}
                </div>
                <button
                  type="button"
                  onClick={() => setBars((b) => Math.min(8, b + 1))}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  aria-label="Increase bars"
                >
                  +
                </button>
              </div>
            </div>

	            <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
              <span className="text-sm text-neutral-300 whitespace-nowrap">Time</span>
              <div className="grid h-10 grid-cols-[1.5rem_3.5rem_1.5rem] grid-rows-2 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
                <div className="row-span-2 grid grid-rows-2 border-r border-neutral-800">
                  <button
                    type="button"
                    onClick={() => stepTimeSigNumerator(1)}
                    className="flex items-center justify-center text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                    aria-label="Increase time signature numerator"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => stepTimeSigNumerator(-1)}
                    className="flex items-center justify-center border-t border-neutral-800 text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                    aria-label="Decrease time signature numerator"
                  >
                    −
                  </button>
                </div>
                <div className="row-span-2 flex items-center justify-center px-2 text-sm text-white tabular-nums">
                  {Math.max(2, Math.min(15, Number(timeSig.n) || 4))}
                  <span className="mx-1 text-neutral-500">/</span>
                  {timeSig.d === 8 ? 8 : 4}
                </div>
                <div className="row-span-2 grid grid-rows-2 border-l border-neutral-800">
                  <button
                    type="button"
                    onClick={() => stepTimeSigDenominator(1)}
                    className="flex items-center justify-center text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                    aria-label="Next time signature denominator"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => stepTimeSigDenominator(-1)}
                    className="flex items-center justify-center border-t border-neutral-800 text-xs leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                    aria-label="Previous time signature denominator"
                  >
                    −
                  </button>
                </div>
              </div>
            </div>

	            <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
              <span className="text-sm text-neutral-300 whitespace-nowrap">Subdivision</span>
              <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
                <button
                  type="button"
                  onClick={() => stepGlobalTupletValue(-1)}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={toggleGlobalTupletOffLast}
                  className="min-w-[64px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-900/60 border-l border-r border-neutral-800 hover:bg-neutral-800/50"
                  title="Toggle off / last tuplet"
                >
                  {globalTupletValue === "mixed"
                    ? "Mixed"
                    : globalTupletValue == null
                      ? "Off"
                      : String(globalTupletValue)}
                </button>
                <button
                  type="button"
                  onClick={() => stepGlobalTupletValue(1)}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                >
                  +
                </button>
              </div>
            </div>

	            <div className="flex items-center justify-between gap-2" onPointerDown={clearSidebarChevronHint}>
              <span className="text-sm text-neutral-300">Drumkit</span>
              <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60">
                <button
                  type="button"
                  onClick={() => stepPreset(-1)}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  aria-label="Previous preset"
                >
                  −
                </button>
                <div
                  onClick={() => setIsKitEditorOpen(true)}
                  className="min-w-[88px] px-3 py-1 flex items-center justify-center text-sm text-white bg-neutral-900/60 border-l border-r border-neutral-800 cursor-pointer hover:bg-neutral-800/60"
                  title="Open drumkit editor"
                >
                  {selectedPresetLabel}
                </div>
                <button
                  type="button"
                  onClick={() => stepPreset(1)}
                  className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  aria-label="Next preset"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

                <div className="border-t border-neutral-800 pt-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <button
                          type="button"
	                          data-sidebar-chevron-control="loop"
		                onPointerDownCapture={() => markSidebarChevronHint("loop")}
	                          onClick={() => setIsLoopAdvancedMenuOpen((v) => !v)}
                          className="group -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                          title="Loop overlap options"
                          aria-label="Loop overlap options"
                          aria-expanded={isLoopAdvancedMenuOpen}
                        >
                          <span>Selection loop</span>
                          {renderSidebarChevron(
                            isLoopAdvancedMenuOpen,
                            isLoopAdvancedMenuOpen || sidebarChevronHint === "loop"
                          )}
                        </button>
                      </div>
	              <div
	                data-sidebar-chevron-control="loop"
		                onPointerDownCapture={() => markSidebarChevronHint("loop")}
	                className={`ml-auto flex items-stretch overflow-hidden rounded-md border ${
                  loopRepeats === "off"
                    ? "border-neutral-800 bg-neutral-900/60"
                    : "border-neutral-800 bg-neutral-900/60"
                }`}
              >
	                <button
	                  type="button"
	                  onPointerDown={() => markSidebarChevronHint("loop")}
	                  onMouseDown={(e) => {
	                    markSidebarChevronHint("loop");
	                    e.preventDefault();
                    const order = ["all", "off", "1", "2", "3", "4", "5", "6", "7", "8"];
                    const stepOnce = () => {
                      setLoopRepeats((prev) => {
                        const i = Math.max(0, order.indexOf(String(prev)));
                        return order[(i - 1 + order.length) % order.length];
                      });
                    };
                    stepOnce();
                    let interval = null;
                    let timeout = window.setTimeout(() => {
                      interval = window.setInterval(stepOnce, 160);
                    }, 130);
                    const stop = () => {
                      if (timeout) window.clearTimeout(timeout);
                      timeout = null;
                      if (interval) window.clearInterval(interval);
                      interval = null;
                      window.removeEventListener("mouseup", stop);
                      window.removeEventListener("touchend", stop);
                      window.removeEventListener("touchcancel", stop);
                    };
                    window.addEventListener("mouseup", stop);
                    window.addEventListener("touchend", stop, { passive: true });
                    window.addEventListener("touchcancel", stop, { passive: true });
                  }}
                  className={`px-2 text-base leading-none ${
                    loopRepeats === "off"
                      ? "text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                      : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  }`}
                  title="Decrease loop repeats"
                >
                  –
                </button>
	                <button
	                  type="button"
	                  onPointerDown={() => markSidebarChevronHint("loop")}
	                  onClick={() => {
	                    markSidebarChevronHint("loop");
	                    setLoopRepeats((prev) => (prev === "all" ? "off" : "all"));
	                  }}
                  className={`min-w-[44px] px-3 py-1 flex items-center justify-center text-sm border-l border-r capitalize ${
                    loopRepeats === "off"
                      ? "text-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/50 border-neutral-800"
                      : "text-white bg-neutral-900/60 hover:bg-neutral-800/50 border-neutral-800"
                  }`}
                  title="How many times the selection repeats"
                >
                  {loopRepeats}
                </button>
	                <button
	                  type="button"
	                  onPointerDown={() => markSidebarChevronHint("loop")}
	                  onMouseDown={(e) => {
	                    markSidebarChevronHint("loop");
	                    e.preventDefault();
                    const order = ["all", "off", "1", "2", "3", "4", "5", "6", "7", "8"];
                    const stepOnce = () => {
                      setLoopRepeats((prev) => {
                        const i = Math.max(0, order.indexOf(String(prev)));
                        return order[(i + 1) % order.length];
                      });
                    };
                    stepOnce();
                    let interval = null;
                    let timeout = window.setTimeout(() => {
                      interval = window.setInterval(stepOnce, 160);
                    }, 130);
                    const stop = () => {
                      if (timeout) window.clearTimeout(timeout);
                      timeout = null;
                      if (interval) window.clearInterval(interval);
                      interval = null;
                      window.removeEventListener("mouseup", stop);
                      window.removeEventListener("touchend", stop);
                      window.removeEventListener("touchcancel", stop);
                    };
                    window.addEventListener("mouseup", stop);
                    window.addEventListener("touchend", stop, { passive: true });
                    window.addEventListener("touchcancel", stop, { passive: true });
                  }}
                  className={`px-2 text-base leading-none ${
                    loopRepeats === "off"
                      ? "text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                      : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  }`}
                  title="Increase loop repeats"
                >
                  +
                </button>
              </div>
            </div>
            {isLoopAdvancedMenuOpen ? (
              <div className="flex justify-end">
                {renderLoopOverlapStepper()}
              </div>
            ) : null}

            <div className="flex w-full flex-col gap-2">
              <div className="flex w-full items-center justify-between gap-2">
                <div className="relative shrink-0">
                  <button
                    type="button"
	                    data-sidebar-chevron-control="sticking"
	                    onPointerDown={() => markSidebarChevronHint("sticking")}
	                    onClick={() => setIsEditingAdvancedMenuOpen((v) => !v)}
                    className="group -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                    title="Sticking display options"
                    aria-label="Sticking display options"
                    aria-expanded={isEditingAdvancedMenuOpen}
                  >
                    <span>Sticking</span>
                    {renderSidebarChevron(
                      isEditingAdvancedMenuOpen,
                      isEditingAdvancedMenuOpen || sidebarChevronHint === "sticking"
                    )}
                  </button>
                </div>
	                <div className="ml-auto flex items-center gap-1.5">
	                <div
	                  data-sidebar-chevron-control="sticking"
	                  onPointerDownCapture={() => markSidebarChevronHint("sticking")}
	                  className="flex items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/60"
	                >
	                  <button
	                    type="button"
	                    onPointerDown={() => markSidebarChevronHint("sticking")}
	                    onClick={() => {
	                      markSidebarChevronHint("sticking");
	                      cycleNotationStickingPrintMode(-1);
	                    }}
                    className="px-2 text-base leading-none text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                    title="Previous print sticking mode"
                    aria-label="Previous print sticking mode"
                  >
                    -
                  </button>
	                  <button
	                    type="button"
	                    onPointerDown={() => markSidebarChevronHint("sticking")}
	                    onClick={() => {
	                      markSidebarChevronHint("sticking");
	                      setNotationStickingPrintMode(notationStickingSelectionStats.mode === "all" ? "off" : "all");
	                    }}
                    className="min-w-[72px] px-3 py-1 flex items-center justify-center text-sm border-l border-r border-neutral-800 bg-neutral-900/60 text-neutral-500 hover:bg-neutral-800/50"
                    title={
                      notationStickingSelectionStats.mode === "custom"
                        ? "Show selected sticking only"
                        : notationStickingSelectionStats.mode === "all"
                        ? "Print all sticking in notation"
                          : "Do not print sticking in notation"
                    }
                  >
                    {notationStickingSelectionStats.mode === "all"
                      ? "All"
                      : notationStickingSelectionStats.mode === "custom"
                        ? "Some"
                        : "None"}
                  </button>
	                  <button
	                    type="button"
	                    onPointerDown={() => markSidebarChevronHint("sticking")}
	                    onClick={() => {
	                      markSidebarChevronHint("sticking");
	                      cycleNotationStickingPrintMode(1);
	                    }}
                    className="px-2 text-base leading-none text-neutral-500 hover:bg-neutral-800/50 active:bg-neutral-800"
                    title="Next print sticking mode"
                    aria-label="Next print sticking mode"
                  >
                    +
                  </button>
                </div>
                </div>
              </div>
              {isEditingAdvancedMenuOpen ? (
                <div className="flex justify-start">
                  {renderStickingDisplayControl()}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
	              <button
	                type="button"
	                data-sidebar-chevron-control="sticking"
	                onPointerDown={() => markSidebarChevronHint("sticking")}
	                onClick={() =>
	                  setStickingEditModeEnabled((v) => {
                    const next = !v;
                    if (next) {
                      setStickingGuideEnabled(true);
                      setNotationStickingSelectionModeEnabled(false);
                    } else {
                      setNotationStickingSelectionModeEnabled(false);
                    }
                    return next;
                  })
                }
                className={`w-fit touch-none select-none px-3 py-[5px] rounded border text-sm ${
                  stickingEditModeEnabled
                    ? "bg-neutral-800 border-neutral-700 text-white"
                    : "bg-neutral-900 border-neutral-800 text-neutral-600"
                }`}
                title="When enabled, clicking active hand-hit cells edits R/L sticking instead of toggling notes"
              >
                Edit R/L
              </button>
              {notationStickingSelectionStats.mode === "custom" ? (
                <button
                  type="button"
                  onClick={handleCustomNotationStickingModeToggle}
                  className={`w-fit touch-none select-none px-3 py-[5px] rounded border text-sm ${
                    notationStickingSelectionModeEnabled
                      ? "bg-neutral-800 border-neutral-700 text-white"
                      : "bg-neutral-900 border-neutral-800 text-neutral-600"
                  }`}
                  title="Choose which notes show sticking labels"
                  aria-pressed={notationStickingSelectionModeEnabled}
                >
                  Select notes
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMainTrashClick}
                className={`touch-none select-none inline-flex h-8 w-8 items-center justify-center rounded border ${
                  canClearSelection
                    ? "bg-neutral-800 border-neutral-700 text-white"
                    : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800/40"
                }`}
                title={canClearSelection ? "Clear selection (Cmd/Ctrl+click: reset defaults + delete library)" : "Clear all notes (Cmd/Ctrl+click: reset defaults + delete library)"}
                aria-label={canClearSelection ? "Clear selection" : "Clear all notes"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  className="-translate-y-px h-[0.95rem] w-[0.95rem]"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                </svg>
              </button>
              <div className="relative shrink-0">
                <button
                  ref={sidebarSettingsMenuButtonRef}
                  type="button"
                  data-sidebar-settings-menu-trigger="1"
                  onClick={() => setIsSidebarSettingsMenuOpen((v) => !v)}
                  className={`touch-none select-none inline-flex h-8 w-8 items-center justify-center rounded border ${
                    isSidebarSettingsMenuOpen
                      ? "bg-neutral-800 border-neutral-700 text-white"
                      : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800/40"
                  }`}
                  title="Notation view settings"
                  aria-label="Notation view settings"
                  aria-expanded={isSidebarSettingsMenuOpen}
                >
                  <img
                    src="/musiknote.png"
                    alt=""
                    className="h-4 w-4 opacity-100 [filter:invert(39%)_sepia(6%)_saturate(520%)_hue-rotate(182deg)_brightness(92%)_contrast(86%)]"
                    aria-hidden="true"
                  />
                </button>
                {renderSidebarSettingsMenu("absolute bottom-full left-0 z-[140] mb-2 min-w-[12rem] rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl")}
              </div>
              {loadedLocalBeatId ? (
                <button
                  type="button"
                  onClick={() => setBeatAutoUpdateEnabled((v) => !v)}
                  className={`w-fit touch-none select-none px-3 py-[5px] rounded border text-sm ${
                    beatAutoUpdateEnabled
                      ? "bg-neutral-800 border-neutral-700 text-white"
                      : "bg-neutral-900 border-neutral-800 text-neutral-600"
                  }`}
                  title={
                    beatAutoUpdateEnabled
                      ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                      : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                  }
                  aria-label={
                    beatAutoUpdateEnabled
                      ? "Auto update is on. Beat changes, including sticking settings, save automatically."
                      : "Auto update is off. Beat changes, including sticking settings, do not save automatically."
                  }
                >
                Auto update
              </button>
              ) : null}
            </div>

          </div>
        </div>
      </div>
    </aside>
    <div
      aria-hidden="true"
      className="pointer-events-none h-12 w-full bg-transparent"
    />
    </div>
  ) : null;


  return (
    <div
      className={`${
        isEmbedMode
          ? "min-h-full bg-neutral-900 text-white p-3"
          : "flex min-h-screen flex-col overflow-x-hidden bg-neutral-900 px-6 pt-6 text-white"
      }`}
      style={!isEmbedMode && effectiveUseFixedDesktopFooter ? { paddingBottom: `${fixedFooterContentPadding}px` } : undefined}
      onMouseDown={(e) => {
        if (selection) {
          const el = e.target;
          if (el && el.closest && el.closest("[data-loopui='1']")) return;
          if (el && el.closest && el.closest("[data-gridsurface='1']")) {
            const cellEl = el?.closest?.("[data-gridcell='1']");
            if (cellEl) {
              const row = Number(cellEl.getAttribute("data-row"));
              const col = Number(cellEl.getAttribute("data-col"));
              const inSelection = Array.isArray(wrappedSelectionCells) && wrappedSelectionCells.length > 0
                ? wrappedSelectionCells.some((c) => c.row === row && c.col === col)
                : row >= selection.rowStart &&
                  row <= selection.rowEnd &&
                  col >= selection.start &&
                  col < selection.endExclusive;
              if (inSelection) return;
            }
            if (loopRule) {
              setBaseGridWithUndo((prev) => bakeLoopInto(prev, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability));
              setLoopRule(null);
              setSelection(null);
            } else {
              setLoopRule(null);
              setSelection(null);
            }
            return;
          }
        }
        if (!loopRule) return;
        const el = e.target;
        if (el && el.closest && el.closest("[data-loopui='1']")) return;
        // Cell clicks are handled in-cell (source edit or bake depending on role).
        if (el && el.closest && el.closest("[data-gridcell='1']")) return;
        // Clicking anywhere on the grid surface (including bar gaps and spaces between cells)
        // should bake the loop, same as clicking a non-source cell.
        if (el && el.closest && el.closest("[data-gridsurface='1']")) {
          setBaseGridWithUndo((prev) => bakeLoopInto(prev, loopRule, loopRepeats, loopOverlapMode, loopRespectPlayability));
          setLoopRule(null);
          setSelection(null);
          return;
        }
        // Non-grid click: dismiss looping without baking.
        setLoopRule(null);
        setSelection(null);
      }}
    >
      {isMidiWindowDragActive ? (
        <div className="pointer-events-none fixed inset-0 z-[170] flex items-center justify-center bg-black/35">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/90 px-5 py-4 text-center shadow-2xl">
            <div className="text-base font-medium text-white">Drop MIDI to import</div>
            <div className="mt-1 text-sm text-neutral-400">.mid or .midi</div>
          </div>
        </div>
      ) : null}
      
      <AppHeader
        isEmbedMode={isEmbedMode}
        requestedExample={requestedExample}
        showBraveAudioNotice={showBraveAudioNotice}
        isBraveBrowser={isBraveBrowser}
        slowStartDetected={playback.slowStartDetected}
        startupLagMs={playback.startupLagMs}
        onCloseBraveAudioNotice={() => setShowBraveAudioNotice(false)}
        playbackUsesArrangement={arrangementHeaderUsesArrangementPlayback}
        playbackActive={arrangementHeaderPlaybackActive}
        onTogglePlayback={() => {
          if (arrangementHeaderUsesArrangementPlayback) {
            if (arrangementPlaybackUiActive) stopArrangementPlayback();
            else startArrangementPlayback();
            return;
          }
          togglePlaybackFromBeginning();
        }}
        bpm={bpm}
        onBpmStepStart={startBpmRepeat}
        onBpmStepStop={stopBpmRepeat}
        onBpmScrubPointerDown={handleBpmScrubPointerDown}
        transportMenuButtonRef={transportMenuButtonRef}
        onToggleTransportMenu={() => {
          if (performance.now() < bpmButtonScrubSuppressUntilRef.current) return;
          setIsTransportMenuOpen((v) => !v);
        }}
        headerSheetButtonRef={headerSheetButtonRef}
        sheetOpen={isArrangementNotationOpen}
        onToggleSheet={() => {
          setArrangementNotationRowMenuState(null);
          setIsArrangementNotationOpen((prev) => {
            if (!prev) {
              positionArrangementNotationUnderHeaderButton(headerSheetButtonRef.current);
            }
            return !prev;
          });
        }}
        SheetIcon={SheetIcon}
        fileMenuButtonRef={fileMenuButtonRef}
        shareCopied={shareCopied}
        onToggleShareActions={() => setIsShareActionsDialogOpen((v) => !v)}
        canUndo={canUndoTop}
        canRedo={canRedoTop}
        onUndo={handleTopUndo}
        onRedo={handleTopRedo}
        hasSupabaseEnabled={hasSupabaseEnabled}
        authUser={authUser}
        authUserEmail={authUserEmail}
        isAdminUser={isAdminUser}
        isAuthButtonUnlocked={isAuthButtonUnlocked}
        authPending={authPending}
        authUserLabel={authUserLabel}
        onOpenAuthDialog={openAuthDialog}
        leadingControls={currentBeatEditorStripLeadingControls}
        mainControls={currentBeatEditorStripMainControls}
        hasDesktopSidebarColumn={hasDesktopSidebarColumn}
        mainControlsPaddingLeft={currentBeatEditorStripMainPaddingLeft}
      />


      
      
      <div className="-mx-6 w-[calc(100%+3rem)] overflow-x-auto overflow-y-visible px-6">
      <main
        className={`select-none ${
          isEmbedMode
            ? "mt-0"
            : hasDesktopSidebarColumn
              ? `mt-6 flex-1 grid min-w-max grid-cols-[15.5rem_minmax(0,1fr)] items-start gap-6 ${
                  effectiveUseFixedDesktopFooter ? "pb-0" : "pb-8"
                }`
              : `mt-6 flex-1 min-w-max ${
                layout === "grid-right"
                  ? `grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-6 ${effectiveUseFixedDesktopFooter ? "pb-0" : "pb-8"}`
                  : layout === "notation-right"
                    ? `grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-6 ${effectiveUseFixedDesktopFooter ? "pb-0" : "pb-8"}`
                    : `flex flex-col gap-6 items-start ${effectiveUseFixedDesktopFooter ? "pb-0" : "pb-8"}`
              }`
        }`}
      >
        {beatLibraryDockedInSidebar
          ? dockedBeatLibrarySidebar
          : showDesktopSettingsSidebar && !settingsSidebarCollapsed
            ? desktopSettingsSidebar
            : null}
        <div className={hasDesktopSidebarColumn ? "min-w-0" : undefined}>
        {isEmbedMode ? (
          <div className="w-full" ref={setNotationExportEl}>
            <MemoNotation
              instruments={instruments}
              grid={computedGrid}
              stickingAssignmentsByStep={stickingAssignmentsByStep}
              showNotationSticking={showNotationSticking}
              notationStickingSelection={notationStickingSelection}
              notationStickingView={notationStickingView}
              resolution={resolution}
              bars={bars}
              barsPerLine={barsPerLine}
              stepsPerBar={stepsPerBar}
              timeSig={timeSig}
              quarterSubdivisionsByBar={quarterSubdivisionsByBar}
              barStepOffsets={barStepOffsets}
              mergeRests={mergeRests}
              mergeNotes={mergeNotes}
              dottedNotes={dottedNotes}
              flatBeams={flatBeams}
            />
          </div>
        ) : layout === "notation-right" || layout === "notation-top" ? (
          <>
            <div className="w-full pl-14">
              <div className="w-full" ref={setNotationExportEl}>
                <MemoNotation
                  instruments={instruments}
                  grid={computedGrid}
                  stickingAssignmentsByStep={stickingAssignmentsByStep}
                  showNotationSticking={showNotationSticking}
                  notationStickingSelection={notationStickingSelection}
                  notationStickingView={notationStickingView}
                  resolution={resolution}
                  bars={bars}
                  barsPerLine={barsPerLine}
                  stepsPerBar={stepsPerBar}
                  timeSig={timeSig}
                  quarterSubdivisionsByBar={quarterSubdivisionsByBar}
                  barStepOffsets={barStepOffsets}
                  mergeRests={mergeRests}
                  mergeNotes={mergeNotes}
                  dottedNotes={dottedNotes}
                  flatBeams={flatBeams}
                />
              </div>
            </div>

	            <div
                className="w-full overflow-visible"
                style={
                  layout === "notation-top"
                    ? { marginTop: `${24 + notationGridGapOffset}px` }
                    : undefined
                }
              >
	              <div className="inline-block align-top pr-4 -ml-[0.9rem]">
                <Grid
                instruments={instruments}
                grid={computedGrid}
                columns={columns}
                bars={bars}
                stepsPerBar={stepsPerBar}
                resolution={resolution}
                timeSig={timeSig}
                quarterSubdivisionsByBar={quarterSubdivisionsByBar}
                normalizedTupletOverridesByBar={normalizedTupletOverridesByBar}
                barStepOffsets={barStepOffsets}
                setTupletAt={setTupletAt}
                resetTupletAt={resetTupletAt}
                selectedCountRowSubdivision={selectedCountRowSubdivision}
                onSelectedCountRowSubdivisionChange={(value) =>
                  setSelectedCountRowSubdivision(normalizeCountRowSelectedSubdivision(value))
                }
                gridBarsPerLine={gridBarsPerLine}
                cycleVelocity={cycleVelocity}
                toggleGhost={cycleArticulation}
                selection={selection}
                setSelection={setSelection}
                loopRule={loopRule}
                loopRepeats={loopRepeats}
                setLoopRule={setLoopRule}
                wrappedSelectionCells={wrappedSelectionCells}
                playhead={playback.playhead}
                moveSelectionByDelta={moveSelectionByDelta}
                playabilityWarningsEnabled={playabilityWarningsEnabled}
                playabilityWarningStepSet={playabilityWarningStepSet}
                stickingConflictStepSet={stickingConflictStepSet}
                stickingGuideEnabled={stickingGuideEnabled}
                showEditedSticking={showEditedSticking}
                notationStickingSelection={notationStickingSelection}
                stickingAssignmentsByStep={stickingAssignmentsByStep}
                stickingEditModeEnabled={stickingEditModeEnabled}
                notationStickingSelectionModeEnabled={notationStickingSelectionModeEnabled}
                stickingOverrides={stickingOverrides}
                onCycleStickingOverride={cycleStickingOverride}
                onToggleNotationStickingSelection={toggleNotationStickingSelectionAt}
                onDisableNotationStickingSelectionMode={() =>
                  setNotationStickingSelectionModeEnabled(false)
                }
                onDisableStickingEditMode={() => setStickingEditModeEnabled(false)}
                bakeLoopPreview={bakeLoopPreview}
                hoveredGridCellRef={hoveredGridCellRef}
                labelGutterWidth={currentGridLabelGutterWidth}
                tupletGridAppearanceByValue={tupletGridAppearanceByValue}
                darkenCountRowNonQuarters={darkenCountRowNonQuarters}
      />
            </div>
            </div>
          </>
        ) : (
          <>
	            <div className="w-full overflow-visible">
	              <div className="inline-block align-top pr-4 -ml-[0.9rem]">
                <Grid
                instruments={instruments}
                grid={computedGrid}
                columns={columns}
                bars={bars}
                stepsPerBar={stepsPerBar}
                resolution={resolution}
                timeSig={timeSig}
                quarterSubdivisionsByBar={quarterSubdivisionsByBar}
                normalizedTupletOverridesByBar={normalizedTupletOverridesByBar}
                barStepOffsets={barStepOffsets}
                setTupletAt={setTupletAt}
                resetTupletAt={resetTupletAt}
                selectedCountRowSubdivision={selectedCountRowSubdivision}
                onSelectedCountRowSubdivisionChange={(value) =>
                  setSelectedCountRowSubdivision(normalizeCountRowSelectedSubdivision(value))
                }
                gridBarsPerLine={gridBarsPerLine}
                cycleVelocity={cycleVelocity}
                toggleGhost={cycleArticulation}
                selection={selection}
                setSelection={setSelection}
                loopRule={loopRule}
                loopRepeats={loopRepeats}
                setLoopRule={setLoopRule}
                wrappedSelectionCells={wrappedSelectionCells}
                playhead={playback.playhead}
                moveSelectionByDelta={moveSelectionByDelta}
                playabilityWarningsEnabled={playabilityWarningsEnabled}
                playabilityWarningStepSet={playabilityWarningStepSet}
                stickingConflictStepSet={stickingConflictStepSet}
                stickingGuideEnabled={stickingGuideEnabled}
                showEditedSticking={showEditedSticking}
                notationStickingSelection={notationStickingSelection}
                stickingAssignmentsByStep={stickingAssignmentsByStep}
                stickingEditModeEnabled={stickingEditModeEnabled}
                notationStickingSelectionModeEnabled={notationStickingSelectionModeEnabled}
                stickingOverrides={stickingOverrides}
                onCycleStickingOverride={cycleStickingOverride}
                onToggleNotationStickingSelection={toggleNotationStickingSelectionAt}
                onDisableNotationStickingSelectionMode={() =>
                  setNotationStickingSelectionModeEnabled(false)
                }
                onDisableStickingEditMode={() => setStickingEditModeEnabled(false)}
                bakeLoopPreview={bakeLoopPreview}
                hoveredGridCellRef={hoveredGridCellRef}
                labelGutterWidth={currentGridLabelGutterWidth}
                tupletGridAppearanceByValue={tupletGridAppearanceByValue}
                darkenCountRowNonQuarters={darkenCountRowNonQuarters}
      />
            </div>
            </div>

            <div
              className="w-full pr-4 inline-block align-top pl-14"
              style={layout === "grid-top" ? { marginTop: `${gridNotationGap}px` } : undefined}
            >
              <div className="w-full" ref={setNotationExportEl}>
                <MemoNotation
                  instruments={instruments}
                  grid={computedGrid}
                  stickingAssignmentsByStep={stickingAssignmentsByStep}
                  showNotationSticking={showNotationSticking}
                  notationStickingSelection={notationStickingSelection}
                  notationStickingView={notationStickingView}
                  resolution={resolution}
                  bars={bars}
                  barsPerLine={barsPerLine}
                  stepsPerBar={stepsPerBar}
                  timeSig={timeSig}
                  quarterSubdivisionsByBar={quarterSubdivisionsByBar}
                  barStepOffsets={barStepOffsets}
                  mergeRests={mergeRests}
                  mergeNotes={mergeNotes}
                  dottedNotes={dottedNotes}
                  flatBeams={flatBeams}
                />
              </div>
            </div>
          </>
        )}
        </div>
      </main>
      </div>

      <footer
        className={`${isEmbedMode ? "hidden" : "mt-auto pt-1"}`}
        data-loopui='1'
      >
        <div className="flex justify-end" />
        {!isEmbedMode && !effectiveUseFixedDesktopFooter && (
          <>
          <div className="mt-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs text-neutral-500">
              <div />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreferencesDialogOpen(true)}
                  className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
                  title="Preferences"
                >
                  Preferences
                </button>
                <span className="text-neutral-700">·</span>
                <button
                  type="button"
                  onClick={handleLegalButtonClick}
                  className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
                  title="Legal information"
                >
                  Legal
                </button>
                <span className="text-neutral-700">·</span>
                <a
                  href="https://buymeacoffee.com/onlinedrumnotation"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-neutral-300 underline underline-offset-2"
                  title="Buy me a coffee"
                >
                  Buy me a coffee
                </a>
              </div>
              <div />
            </div>
          </div>
          <div className="relative left-1/2 mt-4 w-screen -translate-x-1/2 bg-black py-4">
            <div className="flex items-center justify-center px-4">
              <img
                src="/arnehertstein-logo-text-white.png"
                alt="Arne Hertstein"
                className="pointer-events-none h-12 w-auto opacity-20"
                loading="lazy"
              />
            </div>
          </div>
          </>
        )}
      </footer>
      {effectiveUseFixedDesktopFooter &&
        createPortal(
          <div ref={fixedFooterRef} className="fixed inset-x-0 bottom-0 z-[83] flex flex-col items-center">
            <div className="mb-4 w-full px-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs text-neutral-500">
                <div />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPreferencesDialogOpen(true)}
                    className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
                    title="Preferences"
                  >
                    Preferences
                  </button>
                  <span className="text-neutral-700">·</span>
                  <button
                    type="button"
                    onClick={handleLegalButtonClick}
                    className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
                    title="Legal information"
                  >
                    Legal
                  </button>
                  <span className="text-neutral-700">·</span>
                  <a
                    href="https://buymeacoffee.com/onlinedrumnotation"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-neutral-300 underline underline-offset-2"
                    title="Buy me a coffee"
                  >
                    Buy me a coffee
                  </a>
                </div>
                <div />
              </div>
            </div>
            <div className="flex w-full items-center justify-center bg-black px-6 py-3">
              <img
                src="/arnehertstein-logo-text-white.png"
                alt="Arne Hertstein"
                className="pointer-events-none h-12 w-auto opacity-20"
                loading="lazy"
              />
            </div>
          </div>,
          document.body
        )}
      {feedbackPortalTarget &&
        createPortal(
          <FeedbackPanel
            hasSupabaseEnabled={hasSupabaseEnabled}
            isAdminUser={isAdminUser}
            body={feedbackBody}
            onBodyChange={(nextBody) => {
              setFeedbackBody(nextBody);
              if (feedbackError) setFeedbackError("");
              if (feedbackSuccessMessage) setFeedbackSuccessMessage("");
            }}
            selectedTypes={feedbackTypes}
            onToggleType={toggleFeedbackType}
            submitting={feedbackSubmitting}
            onSubmit={submitFeedback}
            error={feedbackError}
            successMessage={feedbackSuccessMessage}
            sort={feedbackSort}
            onSortChange={setFeedbackSort}
            adminFilter={feedbackAdminFilter}
            onAdminFilterChange={setFeedbackAdminFilter}
            loading={feedbackLoading}
            items={feedbackItems}
            voteMap={feedbackVoteMap}
            onVote={voteOnFeedbackItem}
            adminReplyDrafts={feedbackAdminReplyDrafts}
            onAdminReplyDraftChange={(feedbackId, value) =>
              setFeedbackAdminReplyDrafts((prev) => ({
                ...(prev || {}),
                [feedbackId]: value,
              }))
            }
            onSetVisibility={setFeedbackItemVisibility}
            onUpdateAdminMeta={updateFeedbackAdminMeta}
            onDelete={deleteFeedbackItem}
          />,
          feedbackPortalTarget
        )}
      {isAdminUser && adminStatsPortalTarget &&
        createPortal(
          <AdminStatsPanel
            range={adminStatsRange}
            onRangeChange={setAdminStatsRange}
            stats={adminStats}
            loading={adminStatsLoading}
            error={adminStatsError}
            warnings={adminStatsWarnings}
          />,
          adminStatsPortalTarget
        )}
      <TransportMenu
        isEmbedMode={isEmbedMode}
        open={isTransportMenuOpen}
        menuRef={transportMenuRef}
        position={transportMenuPosition}
        onTapTempo={handleTapTempo}
        onBpmStepStart={startBpmRepeat}
        onBpmStepStop={stopBpmRepeat}
        bpmDraft={bpmDraft}
        bpm={bpm}
        onBpmDraftChange={(value) => {
          setBpmDraft(value);
          if (value === "") return;
          const n = Number(value);
          if (Number.isFinite(n)) {
            const rounded = Math.round(n);
            if (rounded >= 20 && rounded <= 400) setBpm(rounded);
          }
        }}
        onBpmInputBlur={() => {
          if (bpmDraft === "") {
            setBpmDraft(String(bpm));
            return;
          }
          const n = Number(bpmDraft);
          if (!Number.isFinite(n)) {
            setBpmDraft(String(bpm));
            return;
          }
          const clamped = clampBpm(Math.round(n));
          setBpm(clamped);
          setBpmDraft(String(clamped));
        }}
        onBpmScrubPointerDown={handleBpmScrubPointerDown}
        effectivePlaybackBpm={effectivePlaybackBpm}
        playbackRate={playbackRate}
        playbackRateLabel={playbackRateLabel}
        onPlaybackRateDecrease={() => setPlaybackRate((prev) => clampPlaybackRate(prev - 0.05))}
        onPlaybackRateReset={() => setPlaybackRate((prev) => (Math.abs(prev - 1) < 0.001 ? prev : 1))}
        onPlaybackRateIncrease={() => setPlaybackRate((prev) => clampPlaybackRate(prev + 0.05))}
        onPlaybackRateScrubPointerDown={handlePlaybackRateScrubPointerDown}
        metronomeEnabled={metronomeEnabled}
        onToggleMetronome={() => setMetronomeEnabled((v) => !v)}
        metronomeCountInEnabled={metronomeCountInEnabled}
        onToggleMetronomeCountIn={() => setMetronomeCountInEnabled((v) => !v)}
        drumVolume={drumVolume}
        onDrumVolumeChange={setDrumVolume}
        metronomeVolume={metronomeVolume}
        onMetronomeVolumeChange={setMetronomeVolume}
      />

      <ArrangementPanelShell
        isOpen={isArrangementOpen}
        hidden={hideFloatingArrangementWindow}
        panelRef={arrangementPanelRef}
        isMobile={isMobileFloatingPanels}
        mobileStyle={mobileArrangementPanelStyle}
        position={arrangementPos}
        sourcesCollapsed={arrangementSourcesCollapsed}
        detailsCollapsed={arrangementDetailsCollapsed}
        sharedWidthRem={sharedArrangementPanelWidthRem}
        sourceWidthRem={sharedArrangementSourcePanelWidthRem}
        detailsWidthRem={sharedArrangementDetailsPanelWidthRem}
        onMouseDown={(e) => {
          if (isMobileFloatingPanels) return;
          beginFloatingPanelDrag(e, arrangementPanelRef, arrangementDragRef);
        }}
      >
              {!arrangementSourcesCollapsed && (
              <div
                className={`${
                  !arrangementSourcesCollapsed && !arrangementDetailsCollapsed
                    ? "bg-transparent p-4 shadow-none border-0 rounded-none"
                    : arrangementDetailsCollapsed || !arrangementDetailsCollapsed
                    ? "rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
                    : "rounded border border-neutral-800 bg-neutral-950/40 p-3"
                } ${
                  arrangementDetailsCollapsed
                    ? arrangementSourcesCollapsed
                      ? "w-full max-w-[27rem] justify-self-start"
                      : "w-full max-w-[23rem] justify-self-start"
                    : ""
                } flex h-full flex-col`}
              >
                  <ArrangementSourceHeader
                    sourceTab={arrangementSourceTab}
                    moveUpTargetRef={beatLibraryMoveUpTargetRef}
                    moveUpActive={beatLibraryDropTargetId === "__up__"}
                    titleClassName="cursor-move"
                    onTitleMouseDown={(e) => {
                      if (isMobileFloatingPanels) return;
                      beginFloatingPanelDrag(e, arrangementPanelRef, arrangementDragRef);
                    }}
                    onTitlePointerDown={(e) => {
                      if (isMobileFloatingPanels) return;
                      beginFloatingPanelTouchHold(e, arrangementPanelRef, arrangementDragRef);
                    }}
                    onMoveUpDragOver={(e) => {
                      if (arrangementSourceTab !== "local") return;
                      if (beatLibraryTreeDragRef.current?.kind !== "container") return;
                      e.preventDefault();
                      e.stopPropagation();
                      setBeatLibraryDropTargetId("__up__");
                      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                    }}
                    onMoveUpDragLeave={(e) => {
                      if (arrangementSourceTab !== "local") return;
                      if (beatLibraryTreeDragRef.current?.kind !== "container") return;
                      if (e.currentTarget.contains(e.relatedTarget)) return;
                      setBeatLibraryDropTargetId((prev) => (prev === "__up__" ? null : prev));
                    }}
                    onMoveUpDrop={(e) => {
                      if (arrangementSourceTab !== "local") return;
                      if (beatLibraryTreeDragRef.current?.kind !== "container") return;
                      e.preventDefault();
                      e.stopPropagation();
                      handleBeatLibraryTreeDrop(null);
                    }}
                    renderBreadcrumb={() => renderBeatLibraryBreadcrumb("floating")}
                    actionSlot={
                      isMobileFloatingPanels ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setArrangementSourcesCollapsed(true);
                              setArrangementDetailsCollapsed(false);
                              setIsArrangementOpen(false);
                              setIsArrangementNotationOpen(true);
                              setLibraryFiltersOpen(false);
                            }}
                            className="inline-flex h-[1.625rem] items-center justify-center rounded border border-neutral-800 bg-neutral-900/60 px-2 text-xs leading-none text-neutral-400 hover:bg-neutral-800/60"
                            title="Open sheet"
                          >
                            Sheet
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setArrangementSourcesCollapsed(true);
                              setArrangementDetailsCollapsed(false);
                              setIsArrangementNotationOpen(false);
                              setIsArrangementOpen(true);
                              setLibraryFiltersOpen(false);
                            }}
                            className="inline-flex h-[1.625rem] items-center justify-center rounded border border-neutral-800 bg-neutral-900/60 px-2 text-xs leading-none text-neutral-400 hover:bg-neutral-800/60"
                            title="Open arrangement"
                          >
                            Arr.
                          </button>
                        </>
                      ) : null
                    }
                    filtersButtonRef={floatingLibraryFiltersButtonRef}
                    filtersOpen={libraryFiltersOpen}
                    filtersMenuStyle={libraryFiltersMenuStyle}
                    filtersMenuRef={libraryFiltersRef}
                    filtersAnchor={libraryFiltersAnchor}
                    onToggleFilters={() => {
                      setLibraryFiltersAnchor("floating");
                      setLibraryFiltersOpen((v) => !v);
                    }}
                    onSetSourceTab={(tab) => {
                      setArrangementSourceTab(tab);
                      setLibraryFiltersOpen(false);
                    }}
                    onShowBeats={() => {
                      setArrangementSourcesCollapsed(false);
                      setArrangementDetailsCollapsed(true);
                      setArrangementSourceTab("local");
                      setLibraryFiltersOpen(false);
                    }}
                    onShowArrangement={() => {
                      setArrangementSourcesCollapsed(true);
                      setArrangementDetailsCollapsed(false);
                      setLibraryFiltersOpen(false);
                    }}
                    onShowBeatsAndArrangement={() => {
                      setArrangementSourcesCollapsed(false);
                      setArrangementDetailsCollapsed(false);
                      setLibraryFiltersOpen(false);
                    }}
                    onShowSheet={() => {
                      setArrangementSourcesCollapsed(true);
                      setArrangementDetailsCollapsed(false);
                      setIsArrangementOpen(true);
                      setIsArrangementNotationOpen(true);
                      setLibraryFiltersOpen(false);
                    }}
                    onShowPresets={() => {
                      setArrangementSourcesCollapsed(false);
                      setArrangementDetailsCollapsed(true);
                      setArrangementSourceTab("presets");
                      setLibraryFiltersOpen(false);
                    }}
                    canSyncPersonalLibrary={arrangementSourceTab === "local" && authUser?.id && hasSupabaseEnabled}
                    personalLibraryRefreshing={personalLibraryRefreshing}
                    onSyncPersonalLibrary={async () => {
                      await refreshPersonalLibraryFromCloud({ alertOnError: true });
                      setLibraryFiltersOpen(false);
                    }}
                    showBeatFilters={arrangementSourceTab !== "presets"}
                    sortLabel={getLibrarySortLabel(librarySort)}
                    onCycleSort={cycleLibrarySort}
                    timeSigFilter={libraryTimeSigFilter}
                    onTimeSigFilterChange={setLibraryTimeSigFilter}
                    allTimeSigCategories={allTimeSigCategories}
                    timeSigOptionKeyPrefix="arr-ts"
                    onStartBpmRepeat={startLibraryBpmRepeat}
                    onStopBpmRepeat={stopLibraryBpmRepeat}
                    onCycleBpmFilterMode={cycleLibraryBpmFilterMode}
                    bpmFilterLabel={getBpmFilterLabel()}
                    showRefreshPublic={arrangementSourceTab === "public"}
                    onRefreshPublic={refreshPublicLibrary}
                    showPublishPublic={arrangementSourceTab === "local" && isAdminUser}
                    onPublishPublic={() => {
                      setLibraryFiltersOpen(false);
                      openPublicSubmitDialog();
                    }}
                    onClose={() => {
                      if (!arrangementDetailsCollapsed) {
                        if (beatLibraryDockedInSidebar) {
                          closeFloatingArrangementWindow();
                          return;
                        }
                        setArrangementSourcesCollapsed(true);
                        return;
                      }
                      closeFloatingArrangementWindow();
                    }}
                    closeTitle={!arrangementDetailsCollapsed ? "Close beats" : "Close library"}
                    closeAriaLabel={!arrangementDetailsCollapsed ? "Close beats" : "Close library"}
                    error={publicLibraryError}
                    onClearError={() => setPublicLibraryError("")}
                    menuClassName="min-w-[16rem]"
                  />
                {!arrangementSourcesCollapsed ? (
                  arrangementSourceTab === "local" ? (
                    <LocalBeatSourceList
                      listRef={arrangementSourceListRef}
                      variant="floating"
                      sensors={beatLibraryOrderSensors}
                      collisionDetection={detectBeatLibraryDropCollision}
                      modifiers={[restrictBeatLibraryDragToList]}
                      onDragStart={handleBeatLibrarySortDragStart}
                      onDragOver={handleBeatLibrarySortDragOver}
                      onDragEnd={handleBeatLibrarySortDragEnd}
                      onDragCancel={handleBeatLibrarySortDragCancel}
                      DropTargetComponent={BeatLibraryDropTarget}
                      DragOverlayCardComponent={BeatLibraryDragOverlayCard}
                      activeDragBeat={activeBeatLibraryDragBeat}
                      activeDragBeatBpm={activeBeatLibraryDragBeatBpm}
                      selectedContainerId={selectedBeatLibraryContainerId}
                      currentParentId={currentBeatLibraryParentId}
                      currentFolders={currentBeatLibraryFolders}
                      currentBeats={currentBeatLibraryBeats}
                      renderFolderContents={renderArrangementSourceFolderContents}
                      onCreateFolder={async () => {
                        const nextContainer = createBeatLibraryContainer("folder");
                        if (!nextContainer) return;
                        setEditingBeatLibraryContainerId(String(nextContainer.id));
                        setEditingBeatLibraryContainerName(String(nextContainer.name || ""));
                        if (selectedBeatLibraryBeatIds.length > 0) {
                          const orderedSelectedIds = visibleLocalBeatIdsInLibraryOrder.filter((id) =>
                            selectedBeatLibraryBeatIds.includes(id)
                          );
                          await moveBeatsToLibraryContainer(orderedSelectedIds, nextContainer.id);
                          clearBeatLibraryBeatSelection();
                        }
                      }}
                      onSaveAsNew={saveCurrentBeatLocal}
                      trashTargetRef={beatLibraryTrashTargetRef}
                      onTrashClick={handleBeatLibrarySidebarTrashClick}
                      onTrashDragOver={(e) => {
                        e.preventDefault();
                        setBeatLibraryDropTargetId("__trash__");
                        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                      }}
                      onTrashDragLeave={() =>
                        setBeatLibraryDropTargetId((prev) => (prev === "__trash__" ? null : prev))
                      }
                      onTrashDrop={async (e) => {
                        e.preventDefault();
                        await handleBeatLibraryTrashDrop();
                      }}
                      trashActive={beatLibraryDropTargetId === "__trash__"}
                      trashEmphasis={selectedBeatLibraryContainerId !== "all"}
                      trashTitle={
                        selection
                          ? "Clear current grid selection"
                          : selectedLocalBeatForTrash?.id
                            ? "Delete selected beat or drop beats/folders here"
                            : selectedBeatLibraryContainerId !== "all"
                              ? "Delete selected folder or drop beats/folders here"
                              : "Drop beats/folders here to delete"
                      }
                      TrashIcon={TrashIcon}
                    />
                  ) : arrangementSourceTab === "presets" ? (
                    <GridSettingsPresetSourceList
                      listRef={arrangementSourceListRef}
                      presets={gridSettingsPresets}
                      activePreset={activeGridSettingsPreset}
                      activeDragId={activeGridSettingsPresetDragId}
                      dropTargetId={presetLibraryDropTargetId}
                      lastOverPresetId={gridSettingsPresetLastOverIdRef.current}
                      editingPresetId={editingGridSettingsPresetId}
                      editingName={editingGridSettingsPresetName}
                      onEditingNameChange={setEditingGridSettingsPresetName}
                      onCommitEditing={commitEditingGridSettingsPreset}
                      onCancelEditing={cancelEditingGridSettingsPreset}
                      onStartEditing={startEditingGridSettingsPreset}
                      pendingPresetRenameExitRef={gridSettingsPresetPendingRenameExitRef}
                      sensors={beatLibraryOrderSensors}
                      collisionDetection={detectGridSettingsPresetDropCollision}
                      modifiers={[restrictBeatLibraryDragToList]}
                      onDragStart={handleGridSettingsPresetDragStart}
                      onDragOver={handleGridSettingsPresetDragOver}
                      onDragEnd={handleGridSettingsPresetDragEnd}
                      onDragCancel={handleGridSettingsPresetDragCancel}
                      onApplyPreset={(preset) => {
                        setSelectedGridSettingsPresetId(String(preset.id));
                        applyGridSettingsPreset(preset);
                      }}
                      onSaveAsNew={saveCurrentGridSettingsPreset}
                      onDeleteSelected={deleteSelectedGridSettingsPreset}
                      trashTargetRef={beatLibraryTrashTargetRef}
                      DropTargetComponent={BeatLibraryDropTarget}
                      RowComponent={SortableGridSettingsPresetRow}
                      ReservedRowSlotComponent={GridSettingsPresetReservedRowSlot}
                      DragOverlayCardComponent={GridSettingsPresetDragOverlayCard}
                      activeDragPreset={activeGridSettingsPresetDrag}
                      TrashIcon={TrashIcon}
                    />
                  ) : (
                    <PublicBeatSourceList
                      beats={arrangementSourceBeats}
                      getBeatBpm={getBeatBpm}
                      selectedBeatKey={selectedArrangementSourceBeatKey}
                      softActiveHighlight={Boolean(normalizedArrangementSelection)}
                      loading={publicLibraryLoading}
                      isAdmin={isAdminUser}
                      onBeginDrag={beginArrangementBeatDrag}
                      onClearDrag={clearArrangementBeatDrag}
                      onSelectBeat={handlePublicBeatSelect}
                      onAddBeat={arrangementAddBeat}
                      onDeleteBeat={handleDeletePublicBeatClick}
                    />
                  )
                ) : (
                  <div className="mt-2 text-xs text-neutral-500">Beat sources collapsed.</div>
                )}
              </div>
              )}

              <ArrangementDetailsPane
                isOpen={!arrangementDetailsCollapsed}
                sourcesCollapsed={arrangementSourcesCollapsed}
                dropActive={arrangementDropActive}
                onDragOver={(e) => {
                  if (!arrangementDragBeatRef.current?.beatId) return;
                  e.preventDefault();
                  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
                  if (!arrangementDropActive) setArrangementDropActive(true);
                  if (arrangementDropTarget) setArrangementDropTarget(null);
                }}
                onDragEnter={(e) => {
                  if (!arrangementDragBeatRef.current?.beatId) return;
                  e.preventDefault();
                  setArrangementDropActive(true);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget)) return;
                  setArrangementDropActive(false);
                  setArrangementDropTarget(null);
                }}
                onDrop={(e) => {
                  if (!arrangementDragBeatRef.current?.beatId) return;
                  e.preventDefault();
                  dropDraggedBeatIntoArrangement();
                }}
              >
                <ArrangementDetailsHeader
                  dragHandleProps={{
                    onMouseDown: (e) => {
                      if (isMobileFloatingPanels) return;
                      beginFloatingPanelDrag(e, arrangementPanelRef, arrangementDragRef);
                    },
                    onPointerDown: (e) => {
                      if (isMobileFloatingPanels) return;
                      beginFloatingPanelTouchHold(e, arrangementPanelRef, arrangementDragRef);
                    },
                  }}
                  playButtonRef={arrangementPlayButtonRef}
                  playbackUsesArrangement={arrangementHeaderUsesArrangementPlayback}
                  playbackActive={arrangementHeaderPlaybackActive}
                  onTogglePlayback={() => {
                    if (arrangementHeaderUsesArrangementPlayback) {
                      if (arrangementPlaybackUiActive) stopArrangementPlayback();
                      else startArrangementPlayback();
                      return;
                    }
                    togglePlaybackFromBeginning();
                  }}
                  isSheetOpen={isArrangementNotationOpen}
                  onOpenSheet={openArrangementSheetFromLibrary}
                  sheetDisabled={arrangementLibraryTab === "public" && !selectedPublicArrangementEntry}
                  sheetTitle={
                    arrangementLibraryTab === "public"
                      ? selectedPublicArrangementEntry
                        ? "Open selected public arrangement in sheet"
                        : "Select a public arrangement first"
                      : "Arrangement sheet"
                  }
                  menuButtonRef={arrangementLibraryMenuButtonRef}
                  menuRef={arrangementLibraryMenuRef}
                  menuOpen={arrangementLibraryMenuOpen}
                  menuStyle={arrangementLibraryMenuStyle}
                  onToggleMenu={() => setArrangementLibraryMenuOpen((v) => !v)}
                  activeLibraryTab={arrangementLibraryTab}
                  onSetLibraryTab={(tab) => {
                    setArrangementLibraryTab(tab);
                    setArrangementLibraryMenuOpen(false);
                  }}
                  canSyncPersonalLibrary={arrangementLibraryTab === "local" && !!authUser?.id && hasSupabaseEnabled}
                  personalLibraryRefreshing={personalLibraryRefreshing}
                  onSyncPersonalLibrary={async () => {
                    await refreshPersonalLibraryFromCloud({ alertOnError: true });
                    setArrangementLibraryMenuOpen(false);
                  }}
                  onShowBeats={() => {
                    setArrangementSourcesCollapsed(false);
                    setArrangementDetailsCollapsed(true);
                    setIsArrangementOpen(true);
                    setArrangementSourceTab("local");
                    setArrangementLibraryMenuOpen(false);
                  }}
                  onShowArrangement={() => {
                    setArrangementSourcesCollapsed(true);
                    setArrangementDetailsCollapsed(false);
                    setIsArrangementOpen(true);
                    setArrangementLibraryMenuOpen(false);
                  }}
                  onShowBeatsAndArrangement={() => {
                    setArrangementSourcesCollapsed(false);
                    setArrangementDetailsCollapsed(false);
                    setIsArrangementOpen(true);
                    setArrangementLibraryMenuOpen(false);
                  }}
                  onShowSheet={() => {
                    openArrangementSheetFromLibrary();
                    setArrangementLibraryMenuOpen(false);
                  }}
                  onClose={closeFloatingArrangementWindow}
                />
                {arrangementLibraryTab === "public" && (
                  <PublicArrangementPreview
                    selectedEntry={selectedPublicArrangementEntry}
                    rows={publicArrangementRows}
                    RowComponent={ReadonlyArrangementRow}
                    currentEditorBeatKey={currentArrangementEditorBeatKey}
                    normalizedSelection={normalizedArrangementSelection}
                    playbackEnabled={arrangementPlaybackEnabled}
                    activePlayingRowIndex={activeArrangementPlayingRowIndex}
                    loading={publicArrangementLibraryLoading}
                    publicArrangements={publicArrangements}
                    totals={publicArrangementTotals}
                    selectedPublicArrangementId={selectedPublicArrangementId}
                    isAdmin={isAdminUser}
                    onClearSelection={clearArrangementSelection}
                    onSelectRow={handleArrangementRowSelect}
                    onLoadBeatIntoEditor={(source, beat) =>
                      loadBeatIntoEditorRef.current?.(source, beat)
                    }
                    onRepeatChange={(rowId, delta) => nudgeSelectedPublicArrangementRepeat(rowId, delta)}
                    onSelectArrangementId={(nextId) => {
                      setSelectedPublicArrangementId(nextId);
                      const nextEntry =
                        publicArrangements.find((entry) => String(entry.id || "") === nextId) || null;
                      if (nextEntry) loadPublishedArrangement(nextEntry);
                    }}
                    onLoadArrangement={loadPublishedArrangement}
                    onRefresh={refreshPublicArrangementLibrary}
                    onPublish={publishCurrentArrangementPublic}
                    onDelete={deletePublicArrangement}
                  />
                )}
                {arrangementLibraryTab === "local" && (
                  <LocalArrangementRows
                    listRef={arrangementListRef}
                    rows={arrangementRows}
                    RowComponent={SortableArrangementRow}
                    DropTargetComponent={BeatLibraryDropTarget}
                    sensors={arrangementOrderSensors}
                    collisionDetection={detectArrangementOrderDropCollision}
                    modifiers={[restrictArrangementDragToList]}
                    normalizedSelection={normalizedArrangementSelection}
                    playbackEnabled={arrangementPlaybackEnabled}
                    activePlayingRowIndex={activeArrangementPlayingRowIndex}
                    currentEditorBeatKey={currentArrangementEditorBeatKey}
                    dropTarget={arrangementDropTarget}
                    activeSortRowId={activeArrangementSortRowId}
                    orderDropTargetId={arrangementOrderDropTargetId}
                    onClearSelection={clearArrangementSelection}
                    onDragStart={(event) => {
                      const activeRowId = String(event?.active?.id || "");
                      arrangementSortLastOverIdRef.current = activeRowId;
                      arrangementSortDragOverTrashRef.current = false;
                      const draggedRowIds =
                        activeRowId &&
                        normalizedArrangementSelection &&
                        arrangementRows
                          .slice(
                            normalizedArrangementSelection.start,
                            normalizedArrangementSelection.end + 1
                          )
                          .some((row) => String(row?.id || "") === activeRowId)
                          ? arrangementRows
                              .slice(
                                normalizedArrangementSelection.start,
                                normalizedArrangementSelection.end + 1
                              )
                              .map((row) => String(row?.id || ""))
                          : [activeRowId];
                      arrangementSortDraggedRowIdsRef.current = draggedRowIds.filter(Boolean);
                      setActiveArrangementSortRowId(activeRowId);
                      setArrangementOrderDropTargetId(null);
                      setArrangementOrderTrashHover(false);
                    }}
                    onDragOver={(event) => {
                      setArrangementOrderTrashHover(arrangementSortDragOverTrashRef.current);
                      setArrangementOrderDropTargetId(
                        arrangementSortDragOverTrashRef.current
                          ? "__trash__"
                          : event?.over
                            ? String(event.over.id || "")
                            : null
                      );
                    }}
                    onDragEnd={onArrangementOrderDragEnd}
                    onDragCancel={() => {
                      arrangementSortLastOverIdRef.current = "";
                      arrangementSortDragOverTrashRef.current = false;
                      arrangementSortDraggedRowIdsRef.current = [];
                      setActiveArrangementSortRowId(null);
                      setArrangementOrderDropTargetId(null);
                      setArrangementOrderTrashHover(false);
                    }}
                    onSelectRow={handleArrangementRowSelect}
                    onTouchSelectRow={handleArrangementRowTouchSelect}
                    onExternalDragOverRow={handleArrangementExternalRowDragOver}
                    onExternalDropRow={handleArrangementExternalRowDrop}
                    onRepeatChange={arrangementNudgeRepeats}
                  />
                )}
                {arrangementLibraryTab === "local" && (
                  <LocalArrangementFooter
                    barLoopSelection={normalizedArrangementBarLoopSelection}
                    rowLoopSelection={normalizedArrangementLoopSelection}
                    totals={arrangementTotals}
                    onClearSelection={clearArrangementSelection}
                    isRenaming={isArrangementPickerRenaming}
                    nameInputRef={arrangementPickerNameInputRef}
                    nameDraft={arrangementNameDraft}
                    onNameDraftChange={setArrangementNameDraft}
                    onCommitRename={commitArrangementPickerRename}
                    onCancelRename={cancelArrangementPickerRename}
                    renameWidth={arrangementPickerRenameWidth}
                    renameHoverAction={arrangementPickerRenameHoverAction}
                    onRenameHoverActionChange={setArrangementPickerRenameHoverAction}
                    onSaveAsNew={saveArrangementPickerAsNew}
                    nameButtonRef={arrangementPickerNameButtonRef}
                    canRename={canRenameCurrentArrangement}
                    displayName={arrangementDisplayName}
                    onBeginRename={beginArrangementPickerRename}
                    pickerMenuOpen={arrangementPickerMenuOpen}
                    pickerMenuRef={arrangementPickerMenuRef}
                    pickerMenuPosition={arrangementPickerMenuPosition}
                    savedArrangements={sortedSavedArrangements}
                    activeArrangementEntry={arrangementPickerEntry}
                    onLoadSavedArrangement={(entry) => {
                      setArrangementPickerMenuOpen(false);
                      selectArrangementPickerId(entry.id || null);
                      loadSavedArrangement(entry);
                    }}
                    pickerButtonRef={arrangementPickerButtonRef}
                    onPickerButtonMouseDown={(e) => {
                      if (isArrangementPickerRenaming) e.preventDefault();
                    }}
                    onPickerButtonClick={() => {
                      setArrangementSelection(null);
                      setArrangementSelectionAnchor(null);
                      setArrangementBarSelection(null);
                      setArrangementBarSelectionAnchor(null);
                      if (isArrangementPickerRenaming) {
                        finalizeArrangementPickerRename();
                      }
                      setArrangementPickerMenuOpen((v) => !v);
                    }}
                    titleMenuButtonRef={arrangementTitleMenuButtonRef}
                    titleMenuOpen={arrangementTitleMenuOpen}
                    onToggleTitleMenu={() => setArrangementTitleMenuOpen((v) => !v)}
                    titleMenuRef={arrangementTitleMenuRef}
                    titleMenuPosition={arrangementTitleMenuPosition}
                    titleLine1Draft={arrangementTitleLine1Draft}
                    onTitleLine1DraftChange={setArrangementTitleLine1Draft}
                    titleLine2Draft={arrangementTitleLine2Draft}
                    onTitleLine2DraftChange={setArrangementTitleLine2Draft}
                    composerDraft={arrangementComposerDraft}
                    onComposerDraftChange={setArrangementComposerDraft}
                    onCreateNew={createNewArrangement}
                    isAdmin={isAdminUser}
                    actionsMenuButtonRef={arrangementActionsMenuButtonRef}
                    actionsMenuOpen={isArrangementActionsMenuOpen}
                    actionsMenuStyle={arrangementActionsMenuStyle}
                    actionsMenuRef={arrangementActionsMenuRef}
                    onToggleActionsMenu={() => setIsArrangementActionsMenuOpen((v) => !v)}
                    onPublishPublic={() => {
                      setIsArrangementActionsMenuOpen(false);
                      publishCurrentArrangementPublic({ forceNew: true });
                    }}
                    DropTargetComponent={BeatLibraryDropTarget}
                    trashTargetRef={arrangementTrashTargetRef}
                    trashDisabled={!arrangementPickerEntry && !normalizedArrangementSelection}
                    trashActive={!!activeArrangementSortRowId && arrangementOrderTrashHover}
                    trashTitle={
                      activeArrangementSortRowId
                        ? "Drop sections here to delete"
                        : normalizedArrangementSelection
                          ? "Delete selected section"
                          : "Delete arrangement"
                    }
                    onTrashClick={() => {
                      if (normalizedArrangementSelection) {
                        arrangementRemoveSelectedRows();
                        return;
                      }
                      const selectedId =
                        arrangementPickerIdRef.current ||
                        loadedArrangementIdRef.current ||
                        arrangementPickerEntry?.id ||
                        "";
                      const targetEntry =
                        savedArrangements.find((entry) => String(entry.id) === String(selectedId)) || null;
                      if (!targetEntry) return;
                      requestDeleteSavedArrangement(targetEntry);
                    }}
                    PencilIcon={PencilIcon}
                    TrashIcon={TrashIcon}
                  />
                )}
              </ArrangementDetailsPane>
      </ArrangementPanelShell>

      {isArrangementNotationOpen && (
        <ArrangementSheetPanel
          panelRef={arrangementNotationPanelRef}
          isMobile={isMobileFloatingPanels}
          position={arrangementNotationPos}
          shellWidth={arrangementNotationShellWidth}
          onPanelMouseDown={(e) => {
            if (isMobileFloatingPanels) return;
            beginFloatingPanelDrag(e, arrangementNotationPanelRef, arrangementNotationDragRef);
          }}
          onHeaderMouseDown={(e) => {
            if (isMobileFloatingPanels) return;
            beginFloatingPanelDrag(e, arrangementNotationPanelRef, arrangementNotationDragRef);
          }}
          onHeaderPointerDown={(e) => {
            if (isMobileFloatingPanels) return;
            beginFloatingPanelTouchHold(e, arrangementNotationPanelRef, arrangementNotationDragRef);
          }}
          playbackActive={arrangementPlaybackUiActive}
          playbackDisabled={arrangementPlayableEntries.length < 1}
          hasLoopSelection={Boolean(normalizedArrangementBarLoopSelection || normalizedArrangementLoopSelection)}
          playbackLoopEnabled={arrangementPlaybackLoopEnabled}
          onTogglePlaybackLoop={() => setArrangementPlaybackLoopEnabled((prev) => !prev)}
          onTogglePlayback={toggleArrangementNotationPlayback}
          clearDisabled={arrangementItems.length < 1}
          clearTitle={
            normalizedArrangementSelection
              ? "Clear selected beats from sheet"
              : "Clear all beats from sheet"
          }
          onClear={clearSheetArrangementBeats}
          libraryActive={!arrangementSourcesCollapsed && !arrangementDetailsCollapsed && isArrangementOpen}
          onOpenLibrary={handleHeaderLibraryButtonClick}
          onClose={() => setIsArrangementNotationOpen(false)}
          LibraryIcon={LibraryIcon}
          TrashIcon={TrashIcon}
          settingsMenu={
            <ArrangementSheetSettingsMenu
              buttonRef={arrangementNotationMoreMenuButtonRef}
              menuRef={arrangementNotationMoreMenuRef}
              open={arrangementNotationMoreMenuOpen}
              position={arrangementNotationMoreMenuPosition}
              onToggleOpen={() => setArrangementNotationMoreMenuOpen((v) => !v)}
              scrollRows={arrangementNotationScrollRows}
              onPreviousScrollRows={() =>
                setArrangementNotationScrollRows((prev) => (prev <= 1 ? 3 : prev - 1))
              }
              onNextScrollRows={() =>
                setArrangementNotationScrollRows((prev) => (prev >= 3 ? 1 : prev + 1))
              }
              theme={arrangementNotationTheme}
              onToggleTheme={() =>
                setArrangementNotationTheme((prev) => (prev === "light" ? "dark" : "light"))
              }
              virtualize={arrangementNotationVirtualize}
              onToggleVirtualize={() => setArrangementNotationVirtualize((prev) => !prev)}
              barsPerRow={arrangementNotationBarsPerRow}
              onPreviousBarsPerRow={() => {
                const next =
                  arrangementNotationBarsPerRow === 4
                    ? 3
                    : arrangementNotationBarsPerRow === 3
                      ? 2
                      : arrangementNotationBarsPerRow === 2
                        ? 1
                        : 4;
                setArrangementNotationBarsPerRow(next);
              }}
              onNextBarsPerRow={() => {
                const next =
                  arrangementNotationBarsPerRow === 1
                    ? 2
                    : arrangementNotationBarsPerRow === 2
                      ? 3
                      : arrangementNotationBarsPerRow === 3
                        ? 4
                        : 1;
                setArrangementNotationBarsPerRow(next);
              }}
              dynamicSpacing={arrangementNotationDynamicSpacing}
              onToggleDynamicSpacing={() => setArrangementNotationDynamicSpacing((v) => !v)}
              globalMergeRests={arrangementNotationGlobalMergeRests}
              onToggleGlobalMergeRests={() => setArrangementNotationGlobalMergeRests((v) => !v)}
              globalMergeNotes={arrangementNotationGlobalMergeNotes}
              onToggleGlobalMergeNotes={() => setArrangementNotationGlobalMergeNotes((v) => !v)}
              globalDottedNotes={arrangementNotationGlobalDottedNotes}
              onToggleGlobalDottedNotes={() => setArrangementNotationGlobalDottedNotes((v) => !v)}
              printSticking={showNotationSticking}
              onTogglePrintSticking={() => setShowNotationSticking((v) => !v)}
              previewScale={arrangementNotationPreviewScale}
              onDecreasePreviewScale={() => stepArrangementNotationPreviewScale(-1)}
              onIncreasePreviewScale={() => stepArrangementNotationPreviewScale(1)}
              canExportPdf={arrangementSheetPages.length > 0}
              onOpenPdfExport={() => setIsArrangementPrintDialogOpen(true)}
            />
          }
        >
            <ArrangementSheetPreview
              topGap={arrangementNotationTopGap}
              isMobile={isMobileFloatingPanels}
              onClearSelection={clearArrangementNotationSelection}
              scale={arrangementNotationEffectivePreviewScale}
              scaledHeight={arrangementNotationPreviewScaledHeight}
              previewInnerRef={arrangementNotationPreviewInnerRef}
              visiblePagesRef={arrangementNotationVisiblePagesRef}
              pages={arrangementSheetPages}
              renderPage={renderArrangementNotationPage}
              dark={arrangementNotationTheme !== "light"}
              pageRefs={arrangementNotationPageRefs}
              virtualize={arrangementNotationVirtualize}
              visiblePageSet={arrangementVisiblePageSet}
            >
              <ArrangementSheetRowMenuPortal
                menuState={arrangementNotationRowMenuState}
                rows={arrangementRows}
                RowMenuComponent={ArrangementRowNotationMenu}
                globalNotationBarsPerRow={arrangementNotationBarsPerRow}
                globalNotationDynamicSpacing={arrangementNotationDynamicSpacing}
                globalMergeRests={arrangementNotationGlobalMergeRests}
                globalMergeNotes={arrangementNotationGlobalMergeNotes}
                globalDottedNotes={arrangementNotationGlobalDottedNotes}
                globalNotationPrintStickingMode={arrangementGlobalNotationStickingMode}
                getNotationPrintStickingModeFromPayload={getNotationPrintStickingModeFromPayload}
                onClose={() => setArrangementNotationRowMenuState(null)}
                onUpdateRowNotationOptions={arrangementUpdateRowNotationOptions}
              />
            </ArrangementSheetPreview>
        </ArrangementSheetPanel>
      )}

      <ArrangementSheetExportPreview
        exportRef={arrangementNotationExportRef}
        pages={arrangementSheetPages}
        renderPage={renderArrangementNotationPage}
      />

      <KitEditorDialog
        isOpen={isKitEditorOpen}
        saveAsOpen={isSaveAsDialogOpen}
        saveAsName={saveAsName}
        onSaveAsNameChange={setSaveAsName}
        onOpenSaveAs={() => {
          setSaveAsName("");
          setIsSaveAsDialogOpen(true);
        }}
        onCancelSaveAs={() => {
          setIsSaveAsDialogOpen(false);
          setSaveAsName("");
        }}
        onSaveAs={savePresetAsNew}
        presetNameInlineDraft={presetNameInlineDraft}
        onPresetNameInlineDraftChange={setPresetNameInlineDraft}
        selectedSavedPreset={selectedSavedPreset}
        onRenameSelectedPreset={renameSelectedPresetInline}
        onDeleteSelectedPreset={deleteSelectedPreset}
        onStepPreset={stepPreset}
        keepTracksWithNotesEnabled={keepTracksWithNotesEnabled}
        onToggleKeepTracksWithNotes={() => setKeepTracksWithNotesEnabled((v) => !v)}
        pendingRemoval={pendingRemoval}
        onPendingRemovalChange={setPendingRemoval}
        onConfirmRemoveMoveNotes={confirmRemoveMoveNotes}
        onConfirmRemoveDeleteNotes={confirmRemoveDeleteNotes}
        kitInstrumentIds={kitInstrumentIds}
        allInstruments={ALL_INSTRUMENTS}
        instrumentById={INSTRUMENT_BY_ID}
        kitOrderSensors={kitOrderSensors}
        kitOrderListRef={kitOrderListRef}
        restrictKitDragToList={restrictKitDragToList}
        onKitOrderDragEnd={onKitOrderDragEnd}
        availableInstrumentButtonWidthCh={availableInstrumentButtonWidthCh}
        onToggleInstrumentInKit={toggleInstrumentInKit}
        onRequestRemoveInstrument={requestRemoveInstrument}
        onClose={() => {
          setIsKitEditorOpen(false);
          setPendingRemoval(null);
        }}
        onBackdropMouseDown={() => {
          if (isSaveAsDialogOpen) {
            setIsSaveAsDialogOpen(false);
            setSaveAsName("");
            return;
          }
          setIsKitEditorOpen(false);
          setPendingRemoval(null);
        }}
      />

      <PresetChangeConfirmDialog
        pendingPresetChange={pendingPresetChange}
        presetLabels={PRESET_LABELS}
        instrumentById={INSTRUMENT_BY_ID}
        keepTracksWithNotesEnabled={keepTracksWithNotesEnabled}
        onKeepNotedTracks={confirmPresetKeepNotedTracks}
        onDeleteAnyway={confirmPresetDeleteAnyway}
        onCancel={() => setPendingPresetChange(null)}
      />

      <input
        ref={midiImportInputRef}
        type="file"
        accept=".mid,.midi,audio/midi"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            await handleMidiImportFile(file);
          } catch (err) {
            console.error(err);
            alert(err?.message || "Failed to import MIDI");
          }
        }}
      />
      <ShareActionsDialog
        isOpen={isShareActionsDialogOpen}
        menuRef={fileMenuRef}
        menuPosition={fileMenuPosition}
        shareCopied={shareCopied}
        shareLinkType={shareLinkType}
        shareLinkMode={shareLinkMode}
        onShareLinkModeChange={(scope, value) =>
          setShareLinkMode((prev) => ({ ...prev, [scope]: value }))
        }
        shareLinkRetention={shareLinkRetention}
        onShareLinkRetentionChange={(scope, value) =>
          setShareLinkRetention((prev) => ({ ...prev, [scope]: value }))
        }
        usageLimits={usageLimits}
        usageLimitsLoading={usageLimitsLoading}
        usageLimitsError={usageLimitsError}
        isSignedIn={!!authUser?.id}
        arrangementItemsCount={arrangementItems.length}
        arrangementSheetPagesCount={arrangementSheetPages.length}
        hasLastMidiImportSession={!!lastMidiImportSession?.arrayBuffer}
        onShareBeat={() => handleShareLink("beat")}
        onShareArrangement={() => handleShareLink("arrangement")}
        onBeatPdf={() => {
          setIsShareActionsDialogOpen(false);
          setIsPrintDialogOpen(true);
        }}
        onBeatPng={() => {
          setIsShareActionsDialogOpen(false);
          setIsNotationPngDialogOpen(true);
        }}
        onBeatMidi={() => {
          setIsShareActionsDialogOpen(false);
          setMidiExportMode("beat");
          setIsMidiDialogOpen(true);
        }}
        onArrangementPdf={() => {
          setIsShareActionsDialogOpen(false);
          setIsArrangementPrintDialogOpen(true);
        }}
        onArrangementMidi={() => {
          setIsShareActionsDialogOpen(false);
          setPrintTitle(arrangementDisplayName || "Arrangement");
          setPrintComposer(arrangementComposerDraft.trim());
          setMidiExportMode("arrangement");
          setIsMidiDialogOpen(true);
        }}
        onMidiImport={() => {
          setIsShareActionsDialogOpen(false);
          midiImportInputRef.current?.click();
        }}
        onEditMidiImport={reopenLastMidiImportSettings}
        onEditMidiMapping={reopenLastMidiImportMapping}
      />

      <BeatPrintDialog
        isOpen={isPrintDialogOpen}
        titleInputRef={printTitleInputRef}
        composerInputRef={printComposerInputRef}
        title={printTitle}
        onTitleChange={setPrintTitle}
        composer={printComposer}
        onComposerChange={setPrintComposer}
        watermarkEnabled={printWatermarkEnabled}
        onToggleWatermark={() => setPrintWatermarkEnabled((v) => !v)}
        qrEnabled={printQrEnabled}
        onToggleQr={() => setPrintQrEnabled((v) => !v)}
        onCancel={() => setIsPrintDialogOpen(false)}
        onPrint={handlePrintSubmit}
      />

      <NotationPngExportDialog
        isOpen={isNotationPngDialogOpen}
        color={notationPngColor}
        onColorChange={setNotationPngColor}
        onCancel={() => setIsNotationPngDialogOpen(false)}
        onExport={handleBeatPngExport}
      />

      <ArrangementPrintDialog
        isOpen={isArrangementPrintDialogOpen}
        title={arrangementTitleLine1Draft}
        onTitleChange={setArrangementTitleLine1Draft}
        subtitle={arrangementTitleLine2Draft}
        onSubtitleChange={setArrangementTitleLine2Draft}
        composer={arrangementComposerDraft}
        onComposerChange={setArrangementComposerDraft}
        watermarkEnabled={arrangementPdfWatermarkEnabled}
        onToggleWatermark={() => setArrangementPdfWatermarkEnabled((v) => !v)}
        qrEnabled={arrangementPdfQrEnabled}
        onToggleQr={() => setArrangementPdfQrEnabled((v) => !v)}
        onCancel={() => setIsArrangementPrintDialogOpen(false)}
        onPrint={handleArrangementPrintSubmit}
      />

      <MidiImportMappingDialog
        mapping={pendingMidiImportMapping}
        presets={MIDI_IMPORT_MAPPING_PRESETS}
        instruments={ALL_INSTRUMENTS}
        velocityRanges={pendingMidiImportVelocityRanges}
        snareGhostMax={midiImportSnareGhostMax}
        onSnareGhostMaxChange={setMidiImportSnareGhostMax}
        tomGhostMax={midiImportTomGhostMax}
        onTomGhostMaxChange={setMidiImportTomGhostMax}
        hihatGhostMax={midiImportHihatGhostMax}
        onHihatGhostMaxChange={setMidiImportHihatGhostMax}
        looksReady={pendingMidiImportMappingLooksReady}
        onCancel={cancelPendingMidiImport}
        onConfirm={confirmPendingMidiImportMapping}
        onPresetChange={applyMidiImportMappingPreset}
        onPreviewBarChange={(previewBarNumber) =>
          setPendingMidiImportMapping((prev) =>
            prev ? { ...prev, previewBarNumber } : prev
          )
        }
        onAssignmentChange={(sourceKey, nextValue) =>
          setPendingMidiImportMapping((prev) =>
            prev
              ? {
                  ...prev,
                  noteAssignments: {
                    ...(prev.noteAssignments || {}),
                    [sourceKey]: nextValue,
                  },
                }
              : prev
          )
        }
        onVelocityModeChange={(sourceKey, nextValue) =>
          setPendingMidiImportMapping((prev) =>
            prev
              ? {
                  ...prev,
                  noteVelocityModes: {
                    ...(prev.noteVelocityModes || {}),
                    [sourceKey]: nextValue,
                  },
                }
              : prev
          )
        }
      />

      <MidiImportSettingsDialog
        prompt={pendingMidiTempoPrompt}
        currentBpm={bpm}
        onCancel={cancelPendingMidiImport}
        onConfirm={confirmPendingMidiTempoPrompt}
        onPatch={(patch) =>
          setPendingMidiTempoPrompt((prev) => (prev ? { ...prev, ...patch } : prev))
        }
        onArrangementImportModeChange={(value) => {
          const nextValue = normalizeMidiArrangementImportMode(value);
          setMidiArrangementImportMode(nextValue);
          setPendingMidiTempoPrompt((prev) => (
            prev ? { ...prev, arrangementImportMode: nextValue } : prev
          ));
        }}
        normalizeArrangementImportMode={normalizeMidiArrangementImportMode}
        formatTimingShiftLabel={formatTimingShiftLabel}
        getSuggestedBpm={getSuggestedImportedMidiBpm}
        onTempoMultiplierStepStart={startMidiTempoMultiplierRepeat}
        onTempoMultiplierStepStop={stopMidiTempoMultiplierRepeat}
        onTempoMultiplierReset={resetPendingMidiTempoMultiplier}
      />

      <ArrangementDeleteDialog
        entry={pendingArrangementDeleteEntry}
        onCancel={() => setPendingArrangementDeleteEntry(null)}
        onDelete={(arrangementId) => {
          deleteSavedArrangement(arrangementId);
          setPendingArrangementDeleteEntry(null);
        }}
      />

      <PublicSubmitDialog
        isOpen={isPublicSubmitDialogOpen}
        titleInputRef={publicSubmitTitleInputRef}
        composerInputRef={publicSubmitComposerInputRef}
        title={publicSubmitTitle}
        onTitleChange={setPublicSubmitTitle}
        composer={publicSubmitComposer}
        onComposerChange={setPublicSubmitComposer}
        lockedComposer={lockedPublicComposer}
        category={publicSubmitCategory}
        onCategoryChange={setPublicSubmitCategory}
        style={publicSubmitStyle}
        onStyleChange={setPublicSubmitStyle}
        categoryOptions={BEAT_CATEGORY_OPTIONS}
        styleOptions={BEAT_STYLE_OPTIONS}
        onCancel={() => setIsPublicSubmitDialogOpen(false)}
        onSubmit={confirmPublicSubmit}
      />

      <MidiExportDialog
        isOpen={isMidiDialogOpen}
        mode={midiExportMode}
        title={printTitle}
        onTitleChange={setPrintTitle}
        composer={printComposer}
        onComposerChange={setPrintComposer}
        onCancel={() => setIsMidiDialogOpen(false)}
        onExport={handleMidiExportSubmit}
      />

      <LegalDialog
        isOpen={isLegalDialogOpen}
        legalTab={legalTab}
        onClose={() => setIsLegalDialogOpen(false)}
        onSetLegalTab={setLegalTab}
        onImpressumPress={handleLegalButtonClick}
        showLegalEmail={showLegalEmail}
        onRevealEmail={() => setShowLegalEmail(true)}
      />
      <AuthDialog
        isOpen={isAuthDialogOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        signedInEmail={authUserEmail}
        roleLabel={isAdminUser ? "Admin" : authUser ? "Signed in" : ""}
        emailInputRef={authEmailInputRef}
        email={authEmailInput}
        onEmailChange={setAuthEmailInput}
        password={authPasswordInput}
        onPasswordChange={setAuthPasswordInput}
        onCancel={() => {
          setIsAuthDialogOpen(false);
          setAuthError("");
        }}
        onSubmit={() => {
          if (authMode === "sign-up") return handlePasswordSignUp();
          if (authMode === "new-password") return handleSetNewPassword();
          if (authMode === "reset") return handlePasswordReset();
          if (authMode === "magic-link") return handleMagicLinkSignIn();
          return handlePasswordSignIn();
        }}
        onSignOut={authUser ? handleSignOut : null}
        pending={authPending}
        error={authError}
        message={authMessage}
        beatsCount={localBeats.length}
        arrangementsCount={savedArrangements.length}
        foldersCount={beatLibraryContainers.length}
        shareQrCount={profileShareQrCount}
        temporaryShareCount={profileTemporaryShareCount}
        cleanedShareCount={profileCleanedShareCount}
        shareLinks={profileShareLinks}
        onOpenShareLink={openProfileShareLinkInNewTab}
        onDeleteShareLink={deleteProfileShareLink}
        lastSyncAt={authProfileLastSyncLabel}
        statsPending={profileStatsLoading || personalLibraryRefreshing}
        shortLinksMonthUsed={Math.max(0, Number(usageLimits?.shortLinks?.counts?.month) || 0)}
        shortLinksMonthLimit={Math.max(0, Number(usageLimits?.shortLinks?.limits?.month) || 60)}
        cloudBeatLimit={Math.max(0, Number(usageLimits?.cloudLibrary?.limits?.beats) || 1000)}
        cloudArrangementLimit={Math.max(0, Number(usageLimits?.cloudLibrary?.limits?.arrangements) || 100)}
      />
      <PersonalCloudImportDialog
        snapshot={pendingPersonalCloudImport}
        pending={personalCloudImportPending}
        selectedBeatIds={selectedPersonalCloudImportBeatIds}
        selectedFolderIds={selectedPersonalCloudImportFolderIds}
        selectedArrangementIds={selectedPersonalCloudImportArrangementIds}
        expandedFolderIds={personalCloudImportExpandedFolderIds}
        selectedLibraryCount={pendingPersonalCloudImportSelectedLibraryCount}
        selectedArrangementCount={pendingPersonalCloudImportSelectedArrangementCount}
        visibleSelectedLibraryCount={pendingPersonalCloudImportVisibleSelectedLibraryCount}
        folderChildrenByParent={pendingPersonalCloudImportFolderChildrenByParent}
        beatChildrenByParent={pendingPersonalCloudImportBeatChildrenByParent}
        getDescendantFolderIds={getPendingPersonalCloudImportDescendantFolderIds}
        onToggleFolderExpanded={togglePersonalCloudImportFolderExpanded}
        onToggleFolderSelection={togglePersonalCloudImportFolderSelection}
        onToggleBeatSelection={togglePersonalCloudImportBeatSelection}
        onSelectAllLibrary={() => {
          if (!pendingPersonalCloudImport) return;
          setSelectedPersonalCloudImportBeatIds(
            pendingPersonalCloudImport.beats.map((entry) => String(entry?.id || "")).filter(Boolean)
          );
          setSelectedPersonalCloudImportFolderIds(
            pendingPersonalCloudImport.folders.map((entry) => String(entry?.id || "")).filter(Boolean)
          );
        }}
        onSelectNoLibrary={() => {
          setSelectedPersonalCloudImportBeatIds([]);
          setSelectedPersonalCloudImportFolderIds([]);
        }}
        onSelectAllArrangements={() => {
          if (!pendingPersonalCloudImport) return;
          setSelectedPersonalCloudImportArrangementIds(
            pendingPersonalCloudImport.arrangements.map((entry) => String(entry?.id || "")).filter(Boolean)
          );
        }}
        onSelectNoArrangements={() => setSelectedPersonalCloudImportArrangementIds([])}
        onToggleArrangement={(arrangementId, checked) =>
          setSelectedPersonalCloudImportArrangementIds((prev) =>
            checked ? [...prev, arrangementId] : prev.filter((value) => value !== arrangementId)
          )
        }
        onDismiss={dismissPendingPersonalCloudImport}
        onMerge={handleMergePendingPersonalCloudImport}
      />
      <PreferencesDialog
        isOpen={isPreferencesDialogOpen}
        category={preferencesCategory}
        onCategoryChange={setPreferencesCategory}
        onClose={() => setIsPreferencesDialogOpen(false)}
        defaultLoopRepeats={defaultLoopRepeats}
        loopRepeatsOrder={LOOP_REPEATS_ORDER}
        lastNonAllLoopRepeatsRef={lastNonAllLoopRepeats}
        onDefaultLoopRepeatsChange={setDefaultLoopRepeats}
        onLoopRepeatsChange={setLoopRepeats}
        defaultMetronomeVolume={defaultMetronomeVolume}
        onDefaultMetronomeVolumeChange={setDefaultMetronomeVolume}
        onMetronomeVolumeChange={setMetronomeVolume}
        settingsSidebarDefaultOpen={settingsSidebarDefaultOpen}
        onSettingsSidebarDefaultOpenChange={setSettingsSidebarDefaultOpen}
        onSettingsSidebarCollapsedChange={setSettingsSidebarCollapsed}
        customStartupGridSettings={customStartupGridSettings}
        onSaveCurrentStartupGridSettings={saveCurrentStartupGridSettings}
        onResetStartupGridSettings={resetStartupGridSettings}
        isShortcutsDialogOpen={isShortcutsDialogOpen}
        onShortcutsDialogOpenChange={setIsShortcutsDialogOpen}
        gridSelectionHoldDelayMs={gridSelectionHoldDelayMs}
        onGridSelectionHoldDelayMsChange={setGridSelectionHoldDelayMs}
        playabilityWarningsEnabled={playabilityWarningsEnabled}
        onPlayabilityWarningsEnabledChange={setPlayabilityWarningsEnabled}
        loopRespectPlayability={loopRespectPlayability}
        onLoopRespectPlayabilityChange={setLoopRespectPlayability}
        stickingHandedness={stickingHandedness}
        onStickingHandednessChange={setStickingHandedness}
        stickingLeadHand={stickingLeadHand}
        onStickingLeadHandChange={setStickingLeadHand}
        stickingKeepQuarterLeadHand={stickingKeepQuarterLeadHand}
        onStickingKeepQuarterLeadHandChange={setStickingKeepQuarterLeadHand}
        showEditedSticking={showEditedSticking}
        onShowEditedStickingChange={setShowEditedSticking}
        onClearStickingOverrides={() => setStickingOverrides({})}
        wrapSelectionMoveEnabled={wrapSelectionMoveEnabled}
        onWrapSelectionMoveEnabledChange={setWrapSelectionMoveEnabled}
        moveOverlapMode={moveOverlapMode}
        moveOverlapModes={MOVE_OVERLAP_MODES}
        onMoveOverlapModeChange={setMoveOverlapMode}
        getOverlapModeDescription={getOverlapModeDescription}
        moveOverrideBehavior={moveOverrideBehavior}
        onMoveOverrideBehaviorChange={setMoveOverrideBehavior}
        bars={bars}
        barsPerLine={barsPerLine}
        onBarsPerLineChange={setBarsPerLine}
        gridBarsPerLine={gridBarsPerLine}
        onGridBarsPerLineChange={setGridBarsPerLine}
        layout={layout}
        onLayoutChange={setLayout}
        gridNotationGap={gridNotationGap}
        onGridNotationGapChange={setGridNotationGap}
        notationGridGapOffset={notationGridGapOffset}
        onNotationGridGapOffsetChange={setNotationGridGapOffset}
        tupletGridAppearanceByValue={tupletGridAppearanceByValue}
        defaultTupletGridAppearanceByValue={DEFAULT_TUPLET_GRID_APPEARANCE_BY_VALUE}
        openTupletAppearanceEditor={openTupletAppearanceEditor}
        onOpenTupletAppearanceEditorChange={setOpenTupletAppearanceEditor}
        onTupletGridAppearanceByValueChange={setTupletGridAppearanceByValue}
        formatTupletHslColor={formatTupletHslColor}
        hslToHex={hslToHex}
        hexToHsl={hexToHsl}
        darkenCountRowNonQuarters={darkenCountRowNonQuarters}
        onDarkenCountRowNonQuartersChange={setDarkenCountRowNonQuarters}
        shortcuts={SHORTCUTS}
        editingShortcutActionId={editingShortcutActionId}
        onEditingShortcutActionIdChange={setEditingShortcutActionId}
        onShortcutBindingsChange={setShortcutBindings}
        getShortcutBinding={getShortcutBinding}
        displayShortcutBinding={displayShortcutBinding}
      />

    </div>
  );
}


const SortableArrangementRow = React.memo(function SortableArrangementRow({
  row,
  index,
  isPlaying,
  isEditorBeat,
  isSelected,
  onSelectRow,
  dropPosition,
  onExternalDragOverRow,
  onExternalDropRow,
  onRepeatChange,
  onTouchSelectRow,
  disableTransition = false,
}) {
  const rootRef = React.useRef(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const verticalTransform = transform ? { ...transform, x: 0 } : null;
  const style = {
    transform: CSS.Transform.toString(verticalTransform),
    transition: disableTransition ? undefined : transition,
  };
  const sortablePointerDown = listeners?.onPointerDown;
  const sortableKeyDown = listeners?.onKeyDown;
  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        setNodeRef(node);
      }}
      data-arrangement-row-index={index}
      style={style}
      {...attributes}
      onClick={(e) => onSelectRow?.(index, !!e?.shiftKey, e)}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") {
          sortablePointerDown?.(e);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onTouchSelectRow?.(index, e.pointerId);
      }}
      onKeyDown={(e) => {
        sortableKeyDown?.(e);
      }}
      onDragOver={(e) => onExternalDragOverRow?.(row.id, index, e)}
      onDrop={(e) => onExternalDropRow?.(row.id, index, e)}
      className={`select-none rounded border px-2.5 py-2 outline-none focus:outline-none focus-visible:outline-none ${
        isPlaying
          ? "border-sky-500/70 bg-sky-900/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
          : isEditorBeat
            ? "border-sky-500/70 bg-sky-900/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
          : isSelected
            ? "border-sky-500/30 bg-sky-950/10 shadow-[0_0_0_1px_rgba(14,165,233,0.12)]"
            : isDragging
              ? "border-cyan-700/70 bg-cyan-950/20"
              : "border-neutral-800 bg-neutral-900/40"
      } cursor-grab active:cursor-grabbing`}
    >
      {dropPosition === "before" ? (
        <div className="-mt-1.5 mb-1.5 h-0.5 rounded bg-cyan-400/90" />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-white truncate">
            {`${row.startBarNumber || 1}. ${row.beat?.name || "(missing beat)"}`}
          </div>
          <div className="text-xs text-neutral-400 truncate">
            {`${row.sectionBars} ${row.sectionBars === 1 ? "bar" : "bars"} (${row.repeats}x ${row.beatBars} ${row.beatBars === 1 ? "bar" : "bars"}) · ${row.beatTimeSig}` +
              (Number.isFinite(row.beatBpm) ? ` · ${row.beatBpm} BPM` : "")}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-stretch overflow-hidden rounded border border-neutral-800 bg-neutral-900/60">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRepeatChange?.(row.id, -1);
              }}
              className="px-2 text-xs text-neutral-400 hover:bg-neutral-800/60"
              aria-label="Decrease repeats"
            >
              −
            </button>
            <div className="min-w-[44px] border-l border-r border-neutral-800 bg-neutral-900/60 px-2 py-1 text-center text-xs text-neutral-400">
              x{row.repeats}
            </div>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRepeatChange?.(row.id, 1);
              }}
              className="px-2 text-xs text-neutral-400 hover:bg-neutral-800/60"
              aria-label="Increase repeats"
            >
              +
            </button>
          </div>
        </div>
      </div>
      {dropPosition === "after" ? (
        <div className="mt-1.5 -mb-1.5 h-0.5 rounded bg-cyan-400/90" />
      ) : null}
    </div>
  );
});

const ReadonlyArrangementRow = React.memo(function ReadonlyArrangementRow({
  row,
  index,
  isSelected,
  isPlaying,
  isEditorBeat,
  onSelectRow,
  onRepeatChange,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => onSelectRow?.(index, !!e?.shiftKey, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectRow?.(index, !!e?.shiftKey, e);
        }
      }}
      className={`select-none rounded border px-2.5 py-2 outline-none focus:outline-none focus-visible:outline-none ${
        isPlaying
          ? "border-sky-500/70 bg-sky-900/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
          : isEditorBeat
          ? "border-sky-500/70 bg-sky-900/20 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]"
          : isSelected
          ? "border-sky-500/30 bg-sky-950/10 shadow-[0_0_0_1px_rgba(14,165,233,0.12)]"
          : "border-neutral-800 bg-neutral-900/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-white truncate">
            {`${row.startBarNumber || index + 1}. ${row.beat?.name || "(missing beat)"}`}
          </div>
          <div className="text-xs text-neutral-400 truncate">
            {`${row.sectionBars} ${row.sectionBars === 1 ? "bar" : "bars"} (${row.repeats}x ${row.beatBars} ${row.beatBars === 1 ? "bar" : "bars"}) · ${row.beatTimeSig}` +
              (Number.isFinite(row.beatBpm) ? ` · ${row.beatBpm} BPM` : "")}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-stretch overflow-hidden rounded border border-neutral-800 bg-neutral-900/60">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRepeatChange?.(row.id, -1);
              }}
              className="px-2 text-xs text-neutral-400 hover:bg-neutral-800/60"
              aria-label="Decrease repeats"
            >
              −
            </button>
            <div className="min-w-[44px] border-l border-r border-neutral-800 bg-neutral-900/60 px-2 py-1 text-center text-xs text-neutral-400">
              x{row.repeats}
            </div>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRepeatChange?.(row.id, 1);
              }}
              className="px-2 text-xs text-neutral-400 hover:bg-neutral-800/60"
              aria-label="Increase repeats"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});


function areNumberArraysEqual(a = [], b = []) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const MemoNotation = React.memo(Notation, (prev, next) => {
  return (
    prev.instruments === next.instruments &&
    prev.grid === next.grid &&
    prev.stickingAssignmentsByStep === next.stickingAssignmentsByStep &&
    prev.showNotationSticking === next.showNotationSticking &&
    prev.notationStickingSelection === next.notationStickingSelection &&
    prev.notationStickingView === next.notationStickingView &&
    prev.resolution === next.resolution &&
    prev.bars === next.bars &&
    prev.barsPerLine === next.barsPerLine &&
    prev.barsPerRow === next.barsPerRow &&
    prev.stepsPerBar === next.stepsPerBar &&
    prev.timeSig === next.timeSig &&
    prev.timeSigByBar === next.timeSigByBar &&
    prev.quarterSubdivisionsByBar === next.quarterSubdivisionsByBar &&
    prev.barStepOffsets === next.barStepOffsets &&
    prev.mergeRests === next.mergeRests &&
    prev.mergeNotes === next.mergeNotes &&
    prev.dottedNotes === next.dottedNotes &&
    prev.flatBeams === next.flatBeams &&
    prev.justifySystems === next.justifySystems &&
    prev.targetContentWidth === next.targetContentWidth &&
    areNumberArraysEqual(prev.activeBarIndices, next.activeBarIndices) &&
    areNumberArraysEqual(prev.editorBarIndices, next.editorBarIndices) &&
    areNumberArraysEqual(prev.selectedBarIndices, next.selectedBarIndices) &&
    prev.sectionMarkers === next.sectionMarkers &&
    prev.tempoMarkers === next.tempoMarkers &&
    prev.dynamicSpacingByBar === next.dynamicSpacingByBar &&
    prev.spacingPresetByBar === next.spacingPresetByBar &&
    prev.mergeRestsByBar === next.mergeRestsByBar &&
    prev.mergeNotesByBar === next.mergeNotesByBar &&
    prev.dottedNotesByBar === next.dottedNotesByBar &&
    prev.showNotationStickingByBar === next.showNotationStickingByBar &&
    prev.showSystemBarNumbers === next.showSystemBarNumbers &&
    prev.barNumberOffset === next.barNumberOffset &&
    prev.enableMeasureRepeats === next.enableMeasureRepeats &&
    prev.theme === next.theme
  );
});
