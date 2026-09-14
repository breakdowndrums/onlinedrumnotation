import React from "react";

function formatChangelogDate(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(date);
  } catch (_) {
    return date.toLocaleDateString();
  }
}

export default function ChangelogPanel({
  hasSupabaseEnabled,
  isAdminUser,
  title,
  body,
  onBodyChange,
  submitting = false,
  onSubmit,
  error = "",
  successMessage = "",
  loading = false,
  items = [],
  onDelete,
}) {
  if (!hasSupabaseEnabled) {
    return (
      <div className="px-3 py-2 text-xs text-neutral-500">
        Changelog is not configured yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isAdminUser ? (
        <div className="bg-black p-3">
          <div className="mb-2 rounded bg-neutral-900/80 px-3 py-2 text-sm text-neutral-400">
            {title}
          </div>
          <textarea
            value={body}
            onChange={(e) => onBodyChange?.(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Write the update..."
            className="w-full resize-y rounded bg-neutral-900/80 px-3 py-2 text-sm text-neutral-200 outline-none ring-0 placeholder:text-neutral-600 focus:outline-none focus:ring-0"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-[11px] text-neutral-600">
              {String(body || "").length >= 2000 ? "Character limit reached" : ""}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {successMessage ? <span className="text-xs text-sky-300">{successMessage}</span> : null}
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className={`rounded px-3 py-1.5 text-xs ${
                  submitting
                    ? "bg-neutral-950/60 text-neutral-600 cursor-not-allowed"
                    : "bg-neutral-900/70 text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-300"
                }`}
              >
                {submitting ? "Posting..." : "Post update"}
              </button>
            </div>
          </div>
          {error ? <div className="mt-2 text-xs text-amber-300">{error}</div> : null}
        </div>
      ) : error ? (
        <div className="px-3 py-2 text-xs text-amber-300">{error}</div>
      ) : null}

      <div className="space-y-2">
        {loading ? (
          <div className="px-3 py-2 text-xs text-neutral-500">Loading changelog...</div>
        ) : !items.length ? (
          <div className="px-3 py-2 text-xs text-neutral-600">No updates yet.</div>
        ) : (
          items.map((item) => (
            <article key={`changelog-item-${item.id}`} className="bg-black p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-neutral-300">{item.title}</h3>
                  <div className="mt-1 text-[11px] text-neutral-700">
                    {formatChangelogDate(item.publishedAt || item.createdAt)}
                  </div>
                </div>
                {isAdminUser ? (
                  <button
                    type="button"
                    onClick={() => onDelete?.(item.id)}
                    className="shrink-0 rounded bg-neutral-900/60 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800/60 hover:text-neutral-300"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="mt-3 whitespace-pre-wrap text-xs leading-5 text-neutral-500">{item.body}</div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
