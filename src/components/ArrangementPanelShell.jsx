import React from "react";

export default function ArrangementPanelShell({
  isOpen,
  hidden = false,
  panelRef,
  isMobile,
  mobileStyle,
  position,
  sourcesCollapsed,
  detailsCollapsed,
  sharedWidthRem,
  sourceWidthRem,
  detailsWidthRem,
  onMouseDown,
  children,
}) {
  if (!isOpen || hidden) return null;

  const isCombined = !sourcesCollapsed && !detailsCollapsed;

  return (
    <div className="fixed inset-0 z-[88] pointer-events-none">
      <div
        ref={panelRef}
        className={`${
          isMobile
            ? "w-[calc(100vw-16px)] max-w-none"
            : detailsCollapsed && !sourcesCollapsed
              ? "w-full max-w-[23rem]"
              : sourcesCollapsed || detailsCollapsed
                ? "w-full max-w-[27rem]"
                : "max-w-none"
        } max-h-[94vh] overflow-auto pointer-events-auto ${
          isCombined
            ? "rounded-xl border border-neutral-700 bg-neutral-900 p-0 shadow-2xl overflow-hidden"
            : "bg-transparent p-0 shadow-none"
        }`}
        style={{
          position: "absolute",
          left: isMobile ? (mobileStyle?.left ?? 8) : position.x,
          top: isMobile ? (mobileStyle?.top ?? 8) : position.y,
          maxHeight: isMobile ? (mobileStyle?.maxHeight ?? "calc(100vh - 16px)") : undefined,
          width: !isMobile && isCombined ? `${sharedWidthRem}rem` : undefined,
          minWidth: !isMobile && isCombined ? `${sharedWidthRem}rem` : undefined,
        }}
        onMouseDown={onMouseDown}
      >
        <div
          className={`grid ${isCombined ? "grid-cols-2" : "grid-cols-1"} gap-0`}
          style={
            isCombined
              ? {
                  gridTemplateColumns: `${sourceWidthRem}rem ${detailsWidthRem}rem`,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
