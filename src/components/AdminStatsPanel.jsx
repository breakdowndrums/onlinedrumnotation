import React from "react";

const ADMIN_STATS_RANGE_OPTIONS = [
  { id: "day", label: "This day" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
];

const ADMIN_STATS_ITEMS = [
  ["Users", "users"],
  ["Signed up users", "signedUpUsers"],
  ["Site visits", "siteVisits"],
  ["Beat share links created", "beatShareCreates"],
  ["Arrangement share links created", "arrangementShareCreates"],
  ["Beat opens via link / QR", "beatShareOpens"],
  ["Arrangement opens via link / QR", "arrangementShareOpens"],
];

export default function AdminStatsPanel({
  range,
  onRangeChange,
  stats,
  loading = false,
  error = "",
  warnings = [],
}) {
  const safeStats = stats && typeof stats === "object" ? stats : {};
  const safeWarnings = Array.isArray(warnings) ? warnings : [];

  return (
    <details>
      <summary>
        <span className="seo-summary">
          <span className="seo-caret">▸</span>
          <span>Stats</span>
        </span>
      </summary>
      <div className="seo-body">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ADMIN_STATS_RANGE_OPTIONS.map((rangeOption) => (
              <button
                key={`admin-stats-range-${rangeOption.id}`}
                type="button"
                onClick={() => onRangeChange?.(rangeOption.id)}
                className={`rounded px-2 py-1 ${
                  range === rangeOption.id
                    ? "bg-neutral-900/70 text-neutral-300"
                    : "bg-neutral-950/30 text-neutral-600 hover:bg-neutral-900/50 hover:text-neutral-400"
                }`}
              >
                {rangeOption.label}
              </button>
            ))}
          </div>
          {error ? <div className="text-xs text-amber-300">{error}</div> : null}
          {!error && safeWarnings.length > 0 ? (
            <div className="space-y-1">
              {safeWarnings.map((warning, warningIdx) => (
                <div
                  key={`admin-stats-warning-${warningIdx}`}
                  className="text-xs text-amber-300"
                >
                  {warning}
                </div>
              ))}
            </div>
          ) : null}
          {loading ? (
            <div className="text-xs text-neutral-500">Loading stats...</div>
          ) : (
            <div className="grid gap-2 text-xs text-neutral-400 sm:grid-cols-2">
              {ADMIN_STATS_ITEMS.map(([label, key]) => (
                <div
                  key={`admin-stat-${label}`}
                  className="flex items-center justify-between gap-3 bg-black px-3 py-2"
                >
                  <span className="text-neutral-500">{label}</span>
                  <span className="text-neutral-200 tabular-nums">{safeStats[key]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
