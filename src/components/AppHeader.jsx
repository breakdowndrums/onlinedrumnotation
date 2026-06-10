import React from "react";

function HelpHotspot({ tip, className = "", align = "center", widthClass = "w-52" }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef(null);
  const popupRef = React.useRef(null);
  const [popupStyle, setPopupStyle] = React.useState(null);

  const updatePopupPosition = React.useCallback(() => {
    const triggerEl = triggerRef.current;
    const popupEl = popupRef.current;
    if (!triggerEl || !popupEl || typeof window === "undefined") return;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const margin = 12;
    const triggerRect = triggerEl.getBoundingClientRect();
    const popupRect = popupEl.getBoundingClientRect();
    let left = 0;

    if (align === "left") {
      left = 0;
    } else if (align === "right") {
      left = triggerRect.width - popupRect.width;
    } else {
      left = (triggerRect.width - popupRect.width) / 2;
    }

    const absoluteLeft = triggerRect.left + left;
    const minLeft = margin;
    const maxLeft = Math.max(margin, viewportWidth - popupRect.width - margin);
    const clampedAbsoluteLeft = Math.min(Math.max(absoluteLeft, minLeft), maxLeft);
    const adjustedLeft = clampedAbsoluteLeft - triggerRect.left;

    setPopupStyle({
      left: `${Math.round(adjustedLeft)}px`,
      right: "auto",
      transform: "none",
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    });
  }, [align]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPopupStyle(null);
      return;
    }
    updatePopupPosition();
  }, [open, updatePopupPosition, tip, widthClass]);

  React.useEffect(() => {
    if (!open) return;
    const handle = () => updatePopupPosition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, updatePopupPosition]);

  return (
    <div
      className={`relative inline-flex items-center ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-950 bg-black text-[10px] leading-none text-neutral-600 hover:border-neutral-900 hover:text-neutral-300"
        aria-label="Show help tip"
      >
        ?
      </button>
      {open ? (
        <div
          ref={popupRef}
          style={popupStyle || undefined}
          className={`absolute top-full z-[160] mt-2 ${widthClass} whitespace-normal break-words rounded-md border border-neutral-800 bg-neutral-950/95 px-2.5 py-2 text-[11px] leading-4 text-neutral-400 shadow-xl`}
        >
          {tip}
        </div>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-[1.05rem] w-[1.05rem] -translate-x-[0.5px] translate-y-[0.5px] fill-current"
      aria-hidden="true"
    >
      <path d="M4.5 2.75a.75.75 0 0 1 1.14-.64l6.5 4a.75.75 0 0 1 0 1.28l-6.5 4A.75.75 0 0 1 4.5 10.75z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[1.05rem] w-[1.05rem] fill-current" aria-hidden="true">
      <rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1.25" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" aria-hidden="true">
      <circle cx="8" cy="5" r="2.5" strokeWidth="1.4" />
      <path d="M3 13c.7-2 2.5-3 5-3s4.3 1 5 3" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18 2A3 3 0 0 0 15 5A3 3 0 0 0 15.054688 5.560547L7.939453 9.710938A3 3 0 0 0 6 9A3 3 0 0 0 3 12A3 3 0 0 0 6 15A3 3 0 0 0 7.935547 14.287109L15.054688 18.439453A3 3 0 0 0 15 19A3 3 0 0 0 18 22A3 3 0 0 0 21 19A3 3 0 0 0 18 16A3 3 0 0 0 16.0625 16.712891L8.945312 12.560547A3 3 0 0 0 9 12A3 3 0 0 0 8.945312 11.439453L16.060547 7.289062A3 3 0 0 0 18 8A3 3 0 0 0 21 5A3 3 0 0 0 18 2Z" />
    </svg>
  );
}

export default function AppHeader({
  isEmbedMode,
  requestedExample,
  showBraveAudioNotice,
  isBraveBrowser,
  slowStartDetected,
  startupLagMs,
  onCloseBraveAudioNotice,
  playbackUsesArrangement,
  playbackActive,
  onTogglePlayback,
  bpm,
  onBpmStepStart,
  onBpmStepStop,
  onBpmScrubPointerDown,
  transportMenuButtonRef,
  onToggleTransportMenu,
  headerSheetButtonRef,
  sheetOpen,
  onToggleSheet,
  SheetIcon,
  fileMenuButtonRef,
  shareCopied,
  onToggleShareActions,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSupabaseEnabled,
  authUser,
  authUserEmail,
  isAdminUser,
  isAuthButtonUnlocked,
  authPending,
  authUserLabel,
  onOpenAuthDialog,
  leadingControls,
  mainControls,
  hasDesktopSidebarColumn,
  mainControlsPaddingLeft,
}) {
  const playbackButtonClass = (embed = false) =>
    `touch-none select-none inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded border text-sm capitalize outline-none focus:outline-none focus-visible:outline-none ${
      playbackUsesArrangement
        ? "border-sky-500/70 text-sky-100 bg-sky-900/30 shadow-[0_0_0_1px_rgba(14,165,233,0.35)] hover:bg-sky-900/40"
        : playbackActive
          ? embed
            ? "bg-neutral-800 border-neutral-600 text-white"
            : "bg-neutral-950 border-neutral-800 text-white"
          : embed
            ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
            : "bg-black border-neutral-900 text-neutral-400 hover:bg-neutral-950/80 hover:text-neutral-300"
    }`;

  return (
    <>
      {isEmbedMode && (
        <header className="mb-3 flex items-center justify-between gap-3" data-loopui="1">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {requestedExample?.title || "Drum Groove Example"}
            </div>
            <a
              href={requestedExample ? `/?example=${encodeURIComponent(requestedExample.id)}` : "/"}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Open in editor
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlayback}
              className={playbackButtonClass(true)}
              title={playbackActive ? "Stop playback" : "Start playback"}
              aria-label={playbackActive ? "Stop playback" : "Start playback"}
            >
              {playbackActive ? <StopIcon /> : <PlayIcon />}
            </button>
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
              <div className="min-w-[52px] px-2 py-1 text-center text-sm text-white bg-neutral-800 border-l border-r border-neutral-700">
                <div
                  onPointerDown={onBpmScrubPointerDown}
                  className="touch-none cursor-ns-resize select-none"
                  title="Drag up/down to change BPM"
                >
                  {bpm}
                </div>
              </div>
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
        </header>
      )}
      <header className={`${isEmbedMode ? "hidden" : "flex flex-col gap-3"}`} data-loopui="1">
        {showBraveAudioNotice && isBraveBrowser && slowStartDetected && (
          <div className="mb-2 flex flex-col gap-3 rounded-lg border border-amber-700/70 bg-black px-4 py-3 text-xs text-amber-100 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-medium">Low Volume?</div>
              <div className="mt-1 leading-relaxed text-amber-100/90 break-words">
                {`Detected delayed playback start (~${(Math.max(0, startupLagMs || 0) / 1000).toFixed(1)}s). `}
                Click the Brave lion icon in the address bar, then set
                <span className="mx-1 font-medium">Fingerprinting</span>
                to
                <span className="ml-1 font-medium">Allow</span>.
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseBraveAudioNotice}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Spacebar") e.preventDefault();
              }}
              className="self-start rounded border border-amber-700/70 px-2 py-0.5 text-amber-100 hover:bg-amber-950/60"
            >
              Close tip
            </button>
          </div>
        )}
        <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-2 bg-black px-6 py-3">
          <h1 className="mr-4 text-lg font-semibold text-neutral-300">Drum Grid → Notation</h1>
          <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
            <button
              onClick={onTogglePlayback}
              className={playbackButtonClass(false)}
              title={playbackActive ? "Stop playback" : "Start playback"}
              aria-label={playbackActive ? "Stop playback" : "Start playback"}
            >
              {playbackActive ? <StopIcon /> : <PlayIcon />}
            </button>
            <button
              ref={transportMenuButtonRef}
              type="button"
              onPointerDown={onBpmScrubPointerDown}
              onClick={onToggleTransportMenu}
              className="touch-none select-none whitespace-nowrap rounded border border-neutral-900 bg-black px-3 py-1.5 text-sm text-neutral-400 outline-none hover:bg-neutral-950/80 hover:text-neutral-300 focus:outline-none focus-visible:outline-none cursor-ns-resize"
              title="Open tempo controls or drag up/down to change BPM"
              aria-label={`Open tempo controls or drag to change BPM (${bpm} BPM)`}
            >
              {`${bpm} BPM`}
            </button>
          </div>
          <div className="min-w-4 flex-1" />
          <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
            <HelpHotspot
              tip={
                <>
                  <div>Grid: long press a cell to cycle note modes.</div>
                  <div className="mt-1">Selection: long press and drag to select.</div>
                  <div className="mt-1">Selection: use arrow keys to move it.</div>
                  <div className="mt-1">Looping: press &quot;L&quot; to toggle looping for the current selection.</div>
                  <div className="mt-1">Subdivision: click count numbers above the grid to toggle the selected subdivision. Long press a count number for subdivision options.</div>
                </>
              }
              align="right"
              widthClass="w-72"
            />
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`touch-none select-none inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded border text-sm bg-black border-neutral-900 text-neutral-400 hover:bg-neutral-950/80 hover:text-neutral-300 ${
                !canUndo ? "opacity-40 cursor-not-allowed" : ""
              }`}
              title="Undo"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`touch-none select-none inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded border text-sm bg-black border-neutral-900 text-neutral-400 hover:bg-neutral-950/80 hover:text-neutral-300 ${
                !canRedo ? "opacity-40 cursor-not-allowed" : ""
              }`}
              title="Redo"
            >
              →
            </button>
          </div>
          <button
            ref={headerSheetButtonRef}
            type="button"
            onClick={onToggleSheet}
            className={`touch-none select-none inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded border text-sm ${
              sheetOpen
                ? "bg-neutral-800 border-neutral-600 text-white"
                : "bg-black border-neutral-900 text-neutral-400 hover:bg-neutral-950/80 hover:text-neutral-300"
            }`}
            title={sheetOpen ? "Close sheet" : "Open sheet"}
            aria-label={sheetOpen ? "Close sheet" : "Open sheet"}
          >
            <SheetIcon />
          </button>
          <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
            <button
              ref={fileMenuButtonRef}
              type="button"
              onClick={onToggleShareActions}
              className={`touch-none select-none inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded border text-sm ${
                shareCopied
                  ? "bg-neutral-800 border-neutral-600 text-white"
                  : "bg-black border-neutral-900 text-neutral-400 hover:bg-neutral-950/80 hover:text-neutral-300"
              }`}
              title="File actions"
              aria-label="File actions"
            >
              <ShareIcon />
            </button>
            {authUser ? (
              <>
                <span
                  className={`hidden md:inline-block rounded border px-2 py-1 text-[11px] ${
                    isAdminUser
                      ? "border-amber-700/60 bg-amber-950/30 text-amber-200"
                      : "border-sky-700/50 bg-sky-950/20 text-sky-200"
                  }`}
                >
                  {isAdminUser ? "Admin" : "Signed in"}
                </span>
                {authUserEmail && isAdminUser ? (
                  <span
                    className="hidden md:inline-block max-w-[170px] truncate text-xs text-neutral-500"
                    title={authUserEmail}
                  >
                    {authUserEmail}
                  </span>
                ) : null}
              </>
            ) : null}
            {hasSupabaseEnabled && (authUser || isAuthButtonUnlocked) && (
              <button
                type="button"
                onClick={onOpenAuthDialog}
                disabled={authPending}
                className={`touch-none select-none inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded border ${
                  authPending
                    ? "bg-black border-neutral-900 text-neutral-500 cursor-not-allowed"
                    : "bg-black border-neutral-900 text-neutral-400 hover:bg-neutral-950/80 hover:text-neutral-300"
                }`}
                title={authPending ? "Authentication pending" : authUser ? `Open account for ${authUserLabel}` : "Sign in with email"}
                aria-label={authPending ? "Authentication pending" : authUser ? `Open account for ${authUserLabel}` : "Sign in with email"}
              >
                {authPending ? "…" : <UserIcon />}
              </button>
            )}
          </div>
        </div>

        <div className="ml-[0.15rem] flex max-w-full items-center gap-4">
          <div className="-ml-2 shrink-0">{leadingControls}</div>
          <div
            className={`min-w-0 max-w-full ${hasDesktopSidebarColumn ? "" : "-ml-[0.55rem]"}`}
            style={{ paddingLeft: mainControlsPaddingLeft }}
          >
            {mainControls}
          </div>
        </div>
      </header>
    </>
  );
}
