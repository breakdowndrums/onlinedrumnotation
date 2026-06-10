import React from "react";
import { createPortal } from "react-dom";

function LinkModeToggle({ value, onChange, shortTitle, longTitle }) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5">
      <button
        type="button"
        onClick={() => onChange?.("short")}
        className={`rounded-md px-2 py-1 text-xs ${
          value === "short" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/40"
        }`}
        title={shortTitle}
      >
        Short
      </button>
      <button
        type="button"
        onClick={() => onChange?.("long")}
        className={`rounded-md px-2 py-1 text-xs ${
          value === "long" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/40"
        }`}
        title={longTitle}
      >
        Long
      </button>
    </div>
  );
}

function RetentionToggle({ value, onChange }) {
  return (
    <div className="inline-flex w-fit rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5">
      <button
        type="button"
        onClick={() => onChange?.("temporary")}
        className={`rounded-md px-2 py-1 text-xs ${
          value === "temporary" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/40"
        }`}
        title="Temporary short link"
      >
        Temporary
      </button>
      <button
        type="button"
        disabled
        className="rounded-md px-2 py-1 text-xs text-neutral-600 cursor-not-allowed"
        title="Permanent short links are reserved for future paid storage."
      >
        Permanent
      </button>
    </div>
  );
}

function MenuActionButton({ disabled = false, onClick, className = "", title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-left text-sm ${className}`}
      title={title}
    >
      {children}
    </button>
  );
}

export default function ShareActionsDialog({
  isOpen,
  menuRef,
  menuPosition,
  shareCopied,
  shareLinkType,
  shareLinkMode,
  onShareLinkModeChange,
  shareLinkRetention,
  onShareLinkRetentionChange,
  usageLimits,
  usageLimitsLoading,
  usageLimitsError,
  isSignedIn,
  arrangementItemsCount,
  arrangementSheetPagesCount,
  hasLastMidiImportSession,
  onShareBeat,
  onShareArrangement,
  onBeatPdf,
  onBeatPng,
  onBeatMidi,
  onArrangementPdf,
  onArrangementMidi,
  onMidiImport,
  onEditMidiImport,
  onEditMidiMapping,
}) {
  if (!isOpen) return null;

  const beatCopied = shareCopied && shareLinkType?.startsWith("Beat");
  const arrangementCopied = shareCopied && shareLinkType?.startsWith("Arrangement");
  const beatShortTitle = usageLimitsLoading
    ? "Short share link. Loading short-link limits…"
    : usageLimitsError
      ? `Short share link. ${usageLimitsError}`
      : usageLimits?.shortLinks
        ? usageLimits.isSignedIn
          ? `Short share link. Short links this month: ${usageLimits.shortLinks.counts?.month || 0} / ${usageLimits.shortLinks.limits?.month || 60}`
          : `Short share link. Short links today: ${usageLimits.shortLinks.counts?.day || 0} / ${usageLimits.shortLinks.limits?.day || 15} · month: ${usageLimits.shortLinks.counts?.month || 0} / ${usageLimits.shortLinks.limits?.month || 50}`
        : "Short share link";

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[140] w-72 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-2xl"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-500">
        <div className="mt-1">
          Short links need database storage. Long links always work without share storage, but they are much longer.
        </div>
        <div className="mt-1">Temporary short links may be cleaned later if unused.</div>
      </div>

      <div className="px-1 pb-2 text-sm text-neutral-300">Beat</div>
      <div className="grid grid-cols-1 gap-1.5">
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <MenuActionButton
            onClick={onShareBeat}
            className={
              beatCopied
                ? "border-neutral-600 bg-neutral-800 text-white"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
            }
            title="Copy shareable beat link"
          >
            {beatCopied
              ? shareLinkType === "Beat Short"
                ? "Short link created and copied"
                : `Link copied (${shareLinkType})`
              : "Link"}
          </MenuActionButton>
          <LinkModeToggle
            value={shareLinkMode.beat}
            onChange={(value) => onShareLinkModeChange?.("beat", value)}
            shortTitle={beatShortTitle}
            longTitle="Long share link: stores the full beat in the URL, so it works without share storage, but the link is much longer."
          />
        </div>
        {isSignedIn ? (
          <RetentionToggle
            value={shareLinkRetention.beat}
            onChange={(value) => onShareLinkRetentionChange?.("beat", value)}
          />
        ) : null}
        <MenuActionButton
          onClick={onBeatPdf}
          className="border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
          title="Export beat notation as PDF"
        >
          PDF
        </MenuActionButton>
        <MenuActionButton
          onClick={onBeatPng}
          className="border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
          title="Export beat notation as transparent PNG"
        >
          PNG
        </MenuActionButton>
        <MenuActionButton
          onClick={onBeatMidi}
          className="border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
          title="Export current pattern as MIDI file"
        >
          Export MIDI
        </MenuActionButton>
      </div>

      <div className="my-3 border-t border-neutral-800" />
      <div className="px-1 pb-2 text-sm text-neutral-300">Arrangement</div>
      <div className="grid grid-cols-1 gap-1.5">
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <MenuActionButton
            onClick={onShareArrangement}
            disabled={arrangementItemsCount < 1}
            className={
              arrangementCopied
                ? "border-neutral-600 bg-neutral-800 text-white"
                : arrangementItemsCount > 0
                  ? "border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
                  : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
            }
            title="Copy shareable arrangement link"
          >
            {arrangementCopied
              ? shareLinkType === "Arrangement Short"
                ? "Short link created and copied"
                : `Link copied (${shareLinkType})`
              : "Link"}
          </MenuActionButton>
          <LinkModeToggle
            value={shareLinkMode.arrangement}
            onChange={(value) => onShareLinkModeChange?.("arrangement", value)}
            shortTitle="Short share link"
            longTitle="Long share link: stores the full arrangement in the URL, so it works without share storage, but the link is much longer."
          />
        </div>
        {isSignedIn ? (
          <RetentionToggle
            value={shareLinkRetention.arrangement}
            onChange={(value) => onShareLinkRetentionChange?.("arrangement", value)}
          />
        ) : null}
        <MenuActionButton
          onClick={onArrangementPdf}
          disabled={arrangementSheetPagesCount < 1}
          className={
            arrangementSheetPagesCount > 0
              ? "border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
              : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
          }
          title="Export sheet as PDF"
        >
          PDF
        </MenuActionButton>
        <MenuActionButton
          onClick={onArrangementMidi}
          disabled={arrangementItemsCount < 1}
          className={
            arrangementItemsCount > 0
              ? "border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
              : "border-neutral-800 text-neutral-500 bg-neutral-900/60 cursor-not-allowed"
          }
          title="Export arrangement as MIDI file"
        >
          Export MIDI
        </MenuActionButton>
      </div>

      <div className="my-3 border-t border-neutral-800" />
      <div className="px-1 pb-2 text-sm text-neutral-300">Import</div>
      <div className="grid grid-cols-1 gap-1.5">
        <MenuActionButton
          onClick={onMidiImport}
          className="border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
          title="Import MIDI"
        >
          MIDI
        </MenuActionButton>
        {hasLastMidiImportSession ? (
          <>
            <MenuActionButton
              onClick={onEditMidiImport}
              className="border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
              title="Reopen MIDI import settings"
            >
              Edit MIDI Import
            </MenuActionButton>
            <MenuActionButton
              onClick={onEditMidiMapping}
              className="border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800/60"
              title="Reopen mapping for the last imported MIDI file"
            >
              Edit MIDI Mapping
            </MenuActionButton>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
