import React from "react";

function formatChangelogDate(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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
  onUpdate,
}) {
  const [edit, setEdit] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const saveEdit = async () => {
    if (!edit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (await onUpdate?.(edit.id, { title: edit.title, body: edit.body })) setEdit(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
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
                  {isAdminUser && edit?.id === item.id ? (
                    <input aria-label="Edit update title" value={edit.title} maxLength={120} disabled={saving}
                      onChange={(event) => setEdit({ ...edit, title: event.target.value })}
                      className="w-full rounded bg-neutral-900/80 px-3 py-2 text-sm text-neutral-200" />
                  ) : <h3 className="text-sm font-medium text-neutral-300">{item.title}</h3>}
                </div>
                {isAdminUser ? (
                  <div className="flex shrink-0 gap-2">
                  {edit?.id !== item.id && <button type="button" disabled={Boolean(edit) || saving}
                    onClick={() => setEdit({ id: item.id, title: item.title, body: item.body })}
                    className="rounded px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-50">
                    Edit post
                  </button>}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onDelete?.(item.id)}
                    className="shrink-0 rounded bg-neutral-900/60 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800/60 hover:text-neutral-300"
                  >
                    Delete
                  </button>
                  </div>
                ) : null}
              </div>
              {isAdminUser && edit?.id === item.id ? (
                <div className="mt-3 space-y-2">
                  <textarea aria-label="Edit update text" autoFocus rows={5} maxLength={2000}
                    value={edit.body} disabled={saving}
                    onChange={(event) => setEdit({ ...edit, body: event.target.value })}
                    className="w-full resize-y rounded bg-neutral-900/80 px-3 py-2 text-xs leading-5 text-neutral-200" />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit}
                      disabled={saving || edit.title.trim().length < 2 || edit.body.trim().length < 3}
                      className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700/60 disabled:opacity-50">
                      {saving ? "Saving..." : "Save post"}
                    </button>
                    <button type="button" disabled={saving} onClick={() => setEdit(null)}
                      className="rounded px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300">Cancel</button>
                  </div>
                </div>
              ) : <div className="mt-3 whitespace-pre-wrap text-xs leading-5 text-neutral-500">{item.body}</div>}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
