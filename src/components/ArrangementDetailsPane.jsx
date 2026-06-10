import React from "react";

export default function ArrangementDetailsPane({
  isOpen,
  sourcesCollapsed,
  dropActive,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  children,
}) {
  if (!isOpen) return null;

  const isCombined = !sourcesCollapsed;

  return (
    <div
      className={`${
        isCombined
          ? dropActive
            ? "rounded-none border-0 bg-cyan-950/10 p-4 shadow-none"
            : "rounded-none border-0 bg-transparent p-4 shadow-none"
          : dropActive
            ? "rounded-xl border border-cyan-500/80 bg-neutral-900 p-4 shadow-2xl shadow-[0_0_0_1px_rgba(6,182,212,0.35)]"
            : "rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
      } ${sourcesCollapsed ? "w-full max-w-[27rem] justify-self-start" : ""} ${
        !sourcesCollapsed ? "relative" : ""
      } flex h-full flex-col`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isCombined ? (
        <div className="pointer-events-none absolute left-0 top-4 bottom-4 w-px bg-neutral-800" />
      ) : null}
      {children}
    </div>
  );
}
