import React from "react";

export default function ArrangementSheetPreview({
  topGap,
  isMobile,
  onClearSelection,
  scale,
  scaledHeight,
  previewInnerRef,
  visiblePagesRef,
  pages,
  renderPage,
  dark,
  pageRefs,
  virtualize,
  visiblePageSet,
  children,
}) {
  return (
    <div
      className="w-full overflow-visible"
      style={{
        marginTop: `${topGap}px`,
      }}
      onPointerDown={(e) => {
        if (!isMobile) return;
        if (e.pointerType === "mouse") return;
        if (e.target !== e.currentTarget) return;
        onClearSelection?.();
      }}
    >
      <div
        className="mx-auto overflow-visible"
        style={{
          width: `${794 * scale}px`,
          height: scaledHeight > 0 ? `${scaledHeight}px` : undefined,
        }}
      >
        <div
          ref={previewInnerRef}
          className="max-w-none overflow-visible p-0"
          style={{
            width: "794px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div ref={visiblePagesRef} className="space-y-6">
            {pages.map((page, pageIdx) =>
              renderPage(page, pageIdx, {
                dark,
                exportMode: false,
                includePageNumber: false,
                pageRef: (node) => {
                  pageRefs.current[pageIdx] = node;
                },
                shouldRenderNotation: !virtualize || visiblePageSet.has(pageIdx),
              })
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
