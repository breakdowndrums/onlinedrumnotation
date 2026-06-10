import React from "react";
import { createPortal } from "react-dom";

export default function TransportMenu({
  isEmbedMode,
  open,
  menuRef,
  position,
  onTapTempo,
  onBpmStepStart,
  onBpmStepStop,
  bpmDraft,
  bpm,
  onBpmDraftChange,
  onBpmInputBlur,
  onBpmScrubPointerDown,
  effectivePlaybackBpm,
  playbackRate,
  playbackRateLabel,
  onPlaybackRateDecrease,
  onPlaybackRateReset,
  onPlaybackRateIncrease,
  onPlaybackRateScrubPointerDown,
  metronomeEnabled,
  onToggleMetronome,
  metronomeCountInEnabled,
  onToggleMetronomeCountIn,
  drumVolume,
  onDrumVolumeChange,
  metronomeVolume,
  onMetronomeVolumeChange,
}) {
  if (isEmbedMode) return null;

  return createPortal(
    open && position ? (
      <div
        ref={menuRef}
        style={position}
        className="fixed z-[140] rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-300">Tap</span>
            <button
              type="button"
              onClick={onTapTempo}
              className="touch-none select-none rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700/60"
              title="Tap tempo (starts after 3 taps)"
            >
              Tap
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-300">BPM</span>
            <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
              <button
                type="button"
                onPointerDown={() => onBpmStepStart(-1)}
                onPointerUp={onBpmStepStop}
                onPointerCancel={onBpmStepStop}
                onPointerLeave={onBpmStepStop}
                className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                aria-label="Decrease BPM"
              >
                &minus;
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={20}
                max={400}
                value={bpmDraft}
                onPointerDown={onBpmScrubPointerDown}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.target.select()}
                onChange={(e) => onBpmDraftChange(e.target.value)}
                onBlur={onBpmInputBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-[70px] border-l border-r border-neutral-700 bg-neutral-800 px-3 py-1 text-center text-sm text-white outline-none appearance-none no-spinner touch-none cursor-ns-resize"
                aria-label="BPM"
              />
              <button
                type="button"
                onPointerDown={() => onBpmStepStart(1)}
                onPointerUp={onBpmStepStop}
                onPointerCancel={onBpmStepStop}
                onPointerLeave={onBpmStepStop}
                className="px-2 text-base leading-none text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                aria-label="Increase BPM"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-300">Multiplier</span>
            <div className="text-right">
              <div className="mb-1 text-[11px] text-neutral-500 tabular-nums">
                {`${Math.round(effectivePlaybackBpm)} BPM`}
              </div>
              <div
                className={`flex items-stretch overflow-hidden rounded-md border ${
                  Math.abs(playbackRate - 1) < 0.001
                    ? "border-neutral-800 bg-neutral-900/60"
                    : "border-neutral-700 bg-neutral-800"
                }`}
              >
                <button
                  type="button"
                  onClick={onPlaybackRateDecrease}
                  className={`px-1.5 text-sm leading-none ${
                    Math.abs(playbackRate - 1) < 0.001
                      ? "text-neutral-500 hover:bg-neutral-800/40"
                      : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  }`}
                  aria-label="Decrease playback speed"
                >
                  &minus;
                </button>
                <button
                  type="button"
                  onClick={onPlaybackRateReset}
                  onPointerDown={onPlaybackRateScrubPointerDown}
                  className={`min-w-[56px] border-l border-r px-2 py-1 text-center text-xs tabular-nums ${
                    Math.abs(playbackRate - 1) < 0.001
                      ? "text-neutral-500 border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/40"
                      : "text-white border-neutral-700 bg-neutral-800 hover:bg-neutral-700/40"
                  } touch-none cursor-ns-resize select-none`}
                >
                  {playbackRateLabel}
                </button>
                <button
                  type="button"
                  onClick={onPlaybackRateIncrease}
                  className={`px-1.5 text-sm leading-none ${
                    Math.abs(playbackRate - 1) < 0.001
                      ? "text-neutral-500 hover:bg-neutral-800/40"
                      : "text-neutral-200 hover:bg-neutral-700/60 active:bg-neutral-700"
                  }`}
                  aria-label="Increase playback speed"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-300">Metronome</span>
            <button
              type="button"
              onClick={onToggleMetronome}
              className={`rounded border px-2.5 py-1 text-xs ${
                metronomeEnabled
                  ? "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700/60"
                  : "border-neutral-800 bg-neutral-900/60 text-neutral-500 hover:bg-neutral-800/40"
              }`}
            >
              {metronomeEnabled ? "On" : "Off"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-300">Count-in</span>
            <button
              type="button"
              onClick={onToggleMetronomeCountIn}
              className={`rounded border px-2.5 py-1 text-xs ${
                metronomeCountInEnabled
                  ? "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700/60"
                  : "border-neutral-800 bg-neutral-900/60 text-neutral-500 hover:bg-neutral-800/40"
              }`}
            >
              {metronomeCountInEnabled ? "On" : "Off"}
            </button>
          </div>

          <label className="block">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-300">Drum volume</span>
              <span className="text-[11px] text-neutral-500 tabular-nums">
                {`${Math.round(drumVolume * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(drumVolume * 100)}
              onChange={(e) => onDrumVolumeChange(Math.max(0, Math.min(1, (Number(e.target.value) || 0) / 100)))}
              className="w-full accent-neutral-300"
            />
          </label>

          <label className="block">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-300">Metronome volume</span>
              <span className="text-[11px] text-neutral-500 tabular-nums">
                {`${Math.round(metronomeVolume * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(metronomeVolume * 100)}
              onChange={(e) => onMetronomeVolumeChange(Math.max(0, Math.min(1, (Number(e.target.value) || 0) / 100)))}
              className="w-full accent-neutral-300"
            />
          </label>
        </div>
      </div>
    ) : null,
    document.body
  );
}
