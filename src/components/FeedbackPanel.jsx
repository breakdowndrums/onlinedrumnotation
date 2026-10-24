import React from "react";

const FEEDBACK_TYPE_OPTIONS = ["bug", "feature_idea"];
const FEEDBACK_SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "top", label: "Top" },
];
const FEEDBACK_ADMIN_FILTER_OPTIONS = ["pending", "public", "hidden", "all"];
const FEEDBACK_RESOLUTION_OPTIONS = ["reviewing", "planned", "done"];

function feedbackTypeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "bug") return "Bug";
  return "Feature idea";
}

function feedbackResolutionLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "planned") return "Planned";
  if (normalized === "done") return "Done";
  return "Reviewing";
}

function formatFeedbackDate(raw) {
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

function getVisibleFeedbackItems({ items, isAdmin, adminFilter }) {
  const list = Array.isArray(items) ? items : [];
  if (!isAdmin) return list.filter((item) => item.isPublic);
  return list.filter((item) =>
    adminFilter === "all"
      ? true
      : adminFilter === "public"
        ? item.isPublic
        : item.status === adminFilter
  );
}

export default function FeedbackPanel({
  hasSupabaseEnabled,
  isAdminUser,
  body,
  onBodyChange,
  name = "",
  onNameChange,
  email = "",
  onEmailChange,
  adminBusyIds = [],
  selectedTypes = [],
  onToggleType,
  submitting = false,
  onSubmit,
  error = "",
  successMessage = "",
  sort,
  onSortChange,
  adminFilter,
  onAdminFilterChange,
  loading = false,
  items = [],
  voteMap = {},
  onVote,
  adminReplyDrafts = {},
  onAdminReplyDraftChange,
  onSetVisibility,
  onUpdateAdminMeta,
  onDelete,
}) {
  const [contactDetailsOpen, setContactDetailsOpen] = React.useState(false);
  const contactDetailsId = React.useId();
  const visibleItems = getVisibleFeedbackItems({
    items,
    isAdmin: isAdminUser,
    adminFilter,
  });

  if (!hasSupabaseEnabled) {
    return (
      <div className="px-3 py-2 text-xs text-neutral-500">
        Feedback is not configured yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form
        className="bg-black p-3"
        onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }}
        onInvalid={() => setContactDetailsOpen(true)}
      >
        <textarea
          aria-label="Your feedback"
          disabled={submitting}
          value={body}
          onChange={(e) => onBodyChange?.(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Share ideas, bugs, and requests. Feedback is private by default and can be made public by admin."
          className="w-full resize-y rounded bg-neutral-900/80 px-3 py-2 text-sm text-neutral-200 outline-none ring-0 placeholder:text-neutral-600 focus:outline-none focus:ring-0"
        />
        <div className="mt-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {FEEDBACK_TYPE_OPTIONS.map((typeId) => (
              <button
                key={`feedback-type-${typeId}`}
                type="button"
                onClick={() => onToggleType?.(typeId)}
                className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                  selectedTypes.includes(typeId)
                    ? "border-sky-700/80 bg-sky-950/25 text-sky-200"
                    : "border-neutral-800 bg-transparent text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                }`}
              >
                {feedbackTypeLabel(typeId)}
              </button>
            ))}
            <span className="text-[11px] text-neutral-600">Optional. Pick none, one, or several.</span>
            <span className="text-[11px] text-neutral-500">
              {String(body || "").length >= 2000 ? "Character limit reached" : ""}
            </span>
          </div>
          <button
            type="button"
            aria-expanded={contactDetailsOpen}
            aria-controls={contactDetailsId}
            onClick={() => setContactDetailsOpen((open) => !open)}
            className="ml-auto text-[11px] text-neutral-600 hover:text-neutral-300"
          >
            Add name or get a reply by email
          </button>
        </div>
        <div id={contactDetailsId} hidden={!contactDetailsOpen} className="mt-3 text-xs text-neutral-500">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span>Name (optional)</span>
              <input value={name} onChange={(event) => onNameChange?.(event.target.value)}
                maxLength={80} autoComplete="name" disabled={submitting}
                className="block w-full rounded bg-neutral-900/80 px-3 py-2 text-sm text-neutral-200" />
            </label>
            <label className="space-y-1">
              <span>Email (optional)</span>
              <input type="email" value={email} onChange={(event) => onEmailChange?.(event.target.value)}
                maxLength={254} autoComplete="email" disabled={submitting}
                className="block w-full rounded bg-neutral-900/80 px-3 py-2 text-sm text-neutral-200" />
            </label>
          </div>
          <p className="mt-2">Get an email when I reply. Your address stays private; your name may appear on published feedback.</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-3">
            {successMessage ? <span className="text-xs text-sky-300">{successMessage}</span> : null}
          </div>
          <div className="ml-auto shrink-0">
            <button
              type="submit"
              disabled={submitting}
              className={`rounded px-3 py-1.5 text-xs ${
                submitting
                  ? "bg-neutral-950/60 text-neutral-600 cursor-not-allowed"
                  : "bg-neutral-900/70 text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-300"
              }`}
            >
              {submitting ? "Sending..." : "Send feedback"}
            </button>
          </div>
        </div>
        {error ? <div className="mt-2 text-xs text-amber-300">{error}</div> : null}
      </form>

      <div className="flex flex-wrap items-center gap-2 pl-3 text-xs">
        {FEEDBACK_SORT_OPTIONS.map((sortOption) => (
          <button
            key={`feedback-sort-${sortOption.id}`}
            type="button"
            onClick={() => onSortChange?.(sortOption.id)}
            className={`rounded px-2 py-1 ${
              sort === sortOption.id
                ? "bg-neutral-900/70 text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-300"
                : "bg-neutral-950/30 text-neutral-600 hover:bg-neutral-900/50 hover:text-neutral-400"
            }`}
          >
            {sortOption.label}
          </button>
        ))}
        {isAdminUser
          ? FEEDBACK_ADMIN_FILTER_OPTIONS.map((filterId) => (
              <button
                key={`feedback-filter-${filterId}`}
                type="button"
                onClick={() => onAdminFilterChange?.(filterId)}
                className={`rounded px-2 py-1 ${
                  adminFilter === filterId
                    ? "bg-neutral-900/70 text-neutral-300"
                    : "bg-neutral-950/30 text-neutral-600 hover:bg-neutral-900/50 hover:text-neutral-400"
                }`}
              >
                {filterId === "all" ? "All" : filterId.charAt(0).toUpperCase() + filterId.slice(1)}
              </button>
            ))
          : null}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="px-3 py-2 text-xs text-neutral-500">Loading feedback...</div>
        ) : visibleItems.length < 1 ? null : (
          visibleItems.map((item) => {
            const currentVote = Number(voteMap[item.id] || 0);
            return (
              <div key={`feedback-item-${item.id}`} className="bg-black p-3">
                <div className="flex items-start gap-3">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onVote?.(item.id, 1)}
                      disabled={!item.isPublic}
                      className={`h-6 w-6 rounded text-xs ${
                        !item.isPublic
                          ? "bg-neutral-950 text-neutral-700 cursor-not-allowed"
                          : currentVote === 1
                            ? "border border-sky-600 bg-sky-900/30 text-sky-100"
                            : "bg-neutral-900/70 text-neutral-400 hover:bg-neutral-800/60"
                      }`}
                      title={item.isPublic ? "Upvote" : "Voting is only available on public feedback"}
                    >
                      +
                    </button>
                    <div className="min-w-[2rem] text-center text-xs text-neutral-300">{item.voteScore}</div>
                    <button
                      type="button"
                      onClick={() => onVote?.(item.id, -1)}
                      disabled={!item.isPublic}
                      className={`h-6 w-6 rounded text-xs ${
                        !item.isPublic
                          ? "bg-neutral-950 text-neutral-700 cursor-not-allowed"
                          : currentVote === -1
                            ? "border border-sky-600 bg-sky-900/30 text-sky-100"
                            : "bg-neutral-900/70 text-neutral-400 hover:bg-neutral-800/60"
                      }`}
                      title={item.isPublic ? "Downvote" : "Voting is only available on public feedback"}
                    >
                      -
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {item.feedbackTypes.map((typeId) => (
                        <span
                          key={`feedback-type-badge-${item.id}-${typeId}`}
                          className="rounded border border-neutral-800 bg-transparent px-2.5 py-1 text-neutral-400"
                        >
                          {feedbackTypeLabel(typeId)}
                        </span>
                      ))}
                      {item.resolutionStatus ? (
                        <span className={`rounded-md px-2.5 py-1 font-medium ${
                          item.resolutionStatus === "done"
                            ? "bg-emerald-900/55 text-emerald-200"
                            : item.resolutionStatus === "planned"
                              ? "bg-amber-900/55 text-amber-200"
                              : "bg-neutral-900/60 text-neutral-500"
                        }`}>
                          {feedbackResolutionLabel(item.resolutionStatus)}
                        </span>
                      ) : null}
                    </div>
                    <div className="whitespace-pre-wrap text-xs text-neutral-500">{item.body}</div>
                    {item.adminReply ? (
                      <div className="mt-3 rounded bg-neutral-900/70 px-3 py-2 text-xs text-neutral-500">
                        <div className="mb-1 text-left text-xs uppercase text-neutral-500">Admin reply</div>
                        <div className="whitespace-pre-wrap">{item.adminReply}</div>
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-700">
                      <span>{item.authorLabel || (item.authorKind === "registered" ? "Signed-in user" : "Anonymous")}</span>
                      <span className="text-neutral-700">·</span>
                      <span>{formatFeedbackDate(item.createdAt)}</span>
                      <span className="text-neutral-700">·</span>
                      <span>{`${item.voteCount} vote${item.voteCount === 1 ? "" : "s"}`}</span>
                      {isAdminUser ? (
                        <>
                          <span className="text-neutral-700">·</span>
                          <span>{item.isPublic ? "Public" : item.status}</span>
                        </>
                      ) : null}
                    </div>
                    {isAdminUser ? (
                      <div className="mt-3 space-y-2">
                        {item.contactEmail ? (
                          <div className="break-all text-xs text-neutral-500">
                            {item.contactEmail} (private)
                            {item.replyEmailStatus ? (
                              <div className="mt-1" role="status">
                                {item.replyEmailStatus === "sent" ? "Last email sent" : item.replyEmailStatus === "failed" ? "Last email failed - retry below" : "Email pending"}
                                {item.replyEmailUpdatedAt ? ` · ${formatFeedbackDate(item.replyEmailUpdatedAt)}` : ""}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          {FEEDBACK_RESOLUTION_OPTIONS.map((statusId) => (
                            <button
                              key={`feedback-status-${item.id}-${statusId}`}
                              type="button"
                              disabled={adminBusyIds.includes(item.id)}
                              onClick={() => onUpdateAdminMeta?.(item.id, { resolutionStatus: statusId })}
                              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                                item.resolutionStatus === statusId
                                  ? statusId === "done"
                                    ? "bg-emerald-900/55 text-emerald-200"
                                    : statusId === "planned"
                                      ? "bg-amber-900/55 text-amber-200"
                                      : "bg-neutral-900/60 text-neutral-500"
                                  : "bg-neutral-950/40 text-neutral-500 hover:bg-neutral-900/60"
                              }`}
                            >
                              {feedbackResolutionLabel(statusId)}
                            </button>
                          ))}
                        </div>
                        <textarea
                          disabled={adminBusyIds.includes(item.id)}
                          value={adminReplyDrafts[item.id] ?? item.adminReply ?? ""}
                          onChange={(e) => onAdminReplyDraftChange?.(item.id, e.target.value)}
                          rows={3}
                          placeholder="Add admin reply..."
                          className="w-full resize-y rounded bg-neutral-900/80 px-3 py-2 text-xs text-neutral-200 outline-none ring-0 placeholder:text-neutral-600 focus:outline-none focus:ring-0"
                        />
                        <button
                          type="button"
                          onClick={() => onSetVisibility?.(item.id, true)}
                          disabled={item.isPublic || adminBusyIds.includes(item.id)}
                          className={`rounded px-2 py-1 text-xs ${
                            item.isPublic
                              ? "bg-neutral-950 text-neutral-700 cursor-not-allowed"
                              : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700/60"
                          }`}
                        >
                          Make public
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetVisibility?.(item.id, false)}
                          disabled={(!item.isPublic && item.status === "hidden") || adminBusyIds.includes(item.id)}
                          className={`rounded px-2 py-1 text-xs ${
                            !item.isPublic && item.status === "hidden"
                              ? "bg-neutral-950 text-neutral-700 cursor-not-allowed"
                              : "bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/60"
                          }`}
                        >
                          Hide
                        </button>
                        <button
                          type="button"
                          disabled={adminBusyIds.includes(item.id)}
                          onClick={() =>
                            onUpdateAdminMeta?.(item.id, {
                              adminReply: String(adminReplyDrafts[item.id] ?? item.adminReply ?? ""),
                              sendEmail: Boolean(item.contactEmail),
                            })
                          }
                          className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700/60"
                        >
                          {adminBusyIds.includes(item.id) ? "Saving..." : item.contactEmail ? "Save & email reply" : "Save reply"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete?.(item.id)}
                          disabled={adminBusyIds.includes(item.id)}
                          className="rounded bg-neutral-900/60 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800/60 hover:text-neutral-300"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
