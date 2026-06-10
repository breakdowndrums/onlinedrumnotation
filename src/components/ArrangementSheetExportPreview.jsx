import React from "react";

export default function ArrangementSheetExportPreview({
  exportRef,
  pages,
  renderPage,
}) {
  return (
    <div
      ref={exportRef}
      className="pointer-events-none fixed left-0 top-0 z-[-1] w-[794px] overflow-hidden opacity-0"
      aria-hidden="true"
    >
      {pages.map((page, pageIdx) =>
        renderPage(page, pageIdx, {
          dark: false,
          exportMode: true,
          includePageNumber: false,
        })
      )}
    </div>
  );
}
