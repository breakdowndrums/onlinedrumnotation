# Drum Grid App Context

## Product Summary

Drum Grid App is a React/Vite single-page web app for writing drum notation in the browser. It supports drum-grid editing, notation rendering, playback, MIDI import/export, PDF/PNG export, arrangements, local offline storage, optional Supabase-backed personal cloud sync, public publishing, feedback, and admin-only stats.

Primary entry points:

- [src/main.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/main.jsx:1)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:3790)

## Architecture Overview

### Frontend

- `src/App.jsx` contains most product logic and UI state.
- `src/main.jsx` preloads shared states on `/g/:id`, tracks `site_visit`, and mounts the app.
- `src/components/AuthDialog.jsx` handles auth/profile UI.
- `src/components/AdminStatsPanel.jsx` handles admin stats presentation.
- `src/components/ArrangementDeleteDialog.jsx` handles arrangement delete confirmation presentation.
- `src/components/ArrangementDetailsHeader.jsx` handles the floating arrangement details header and its options menu.
- `src/components/ArrangementDetailsPane.jsx` handles the floating arrangement details pane wrapper, drop-zone styling, and drop handlers.
- `src/components/ArrangementPanelShell.jsx` handles the floating arrangement window shell, sizing, positioning, and source/details grid layout.
- `src/components/ArrangementSourceHeader.jsx` handles the arrangement source header, source/filter menu, drag target title, and source error banner.
- `src/components/ArrangementRowNotationMenu.jsx` handles per-row arrangement sheet notation options.
- `src/components/ArrangementSheetExportPreview.jsx` handles the hidden arrangement sheet export render target.
- `src/components/ArrangementSheetPanel.jsx` handles the floating arrangement sheet shell and header controls.
- `src/components/ArrangementSheetPreview.jsx` handles the visible arrangement sheet preview scaling, page rendering wrapper, and mobile touch-clear area.
- `src/components/ArrangementSheetRowMenuPortal.jsx` handles the arrangement sheet row notation menu portal wiring.
- `src/components/ArrangementSheetSettingsMenu.jsx` handles the floating arrangement sheet options menu.
- `src/components/AppHeader.jsx` handles the embed header and main top toolbar, including playback/BPM controls, help, undo/redo, sheet/file/auth actions, and the current beat editor strip.
- `src/components/BeatLibraryPrimitives.jsx` handles shared beat-library DnD row primitives, source/preset drag overlays, and source-list icons.
- `src/components/FeedbackPanel.jsx` handles feedback form/list/admin controls presentation.
- `src/components/Grid.jsx` handles the interactive drum grid surface, selection gestures, count-row subdivision popup, tuplet grid styling, and sticking overlays.
- `src/components/GridSettingsPresetSourceList.jsx` handles the grid-settings preset source list in the arrangement source panel/sidebar.
- `src/components/KitEditorDialog.jsx` handles drumkit editor presentation.
- `src/components/KitPresetDialogs.jsx` handles kit preset save-as and preset-change confirmation presentation.
- `src/components/LegalDialog.jsx` handles legal/privacy UI.
- `src/components/MidiImportMappingDialog.jsx` handles MIDI note mapping presentation.
- `src/components/MidiImportSettingsDialog.jsx` handles MIDI tempo, timing shift, and arrangement import settings presentation.
- `src/components/LocalArrangementFooter.jsx` handles local arrangement totals, arrangement picker/rename, title/admin menus, and delete controls.
- `src/components/LocalArrangementRows.jsx` handles local arrangement sortable rows and row drop targets inside the arrangement details pane.
- `src/components/LocalBeatSourceList.jsx` handles the local beat source tree/list/footer in the arrangement source panel/sidebar.
- `src/components/Notation.jsx` handles VexFlow notation rendering, notation hit overlays, sticking print labels, arrangement section/tempo markers, and measure-repeat rendering.
- `src/components/PersonalCloudImportDialog.jsx` handles the local-to-cloud import dialog presentation.
- `src/components/PreferencesDialog.jsx` handles preferences and keyboard-shortcut dialog presentation.
- `src/components/PublicArrangementPreview.jsx` handles the public arrangement preview/list and public arrangement controls inside the arrangement details pane.
- `src/components/PublicBeatSourceList.jsx` handles the public beat source list in the arrangement source panel/sidebar.
- `src/components/PublicSubmitDialog.jsx` handles public beat submission presentation.
- `src/components/ShareActionsDialog.jsx` handles the File/share actions menu presentation.
- `src/components/TransportMenu.jsx` handles the playback transport dropdown for tap tempo, BPM, multiplier, metronome/count-in, and volume controls.
- `src/components/ExportDialogs.jsx` handles beat PDF, notation PNG, arrangement PDF, and MIDI export dialog presentation.
- `src/audio/*` contains sample playback and transport scheduling.
- `src/hooks/*` contains extracted UI/controller hooks such as kit-editor preset and instrument management.
- `src/utils/*` contains MIDI import/export, notation export, arrangement export, stats tracking, and visitor ID helpers.
- `src/services/*` contains extracted API/service wrappers for feedback, stats, usage limits, share-link storage, public library, and personal cloud library sync.

### Storage Modes

The app operates in two main modes:

- Anonymous/local mode:
  - Extensive `localStorage` usage for beats, arrangements, folders, settings, and editor preferences.
- Signed-in/cloud mode:
  - Supabase auth for login.
  - Supabase tables for beats, arrangements, feedback, votes, share links, and analytics events.

### Backend Split

Two backend storage systems are used:

- Supabase:
  - Auth
  - Personal cloud library
  - Share links for signed-in users
  - Feedback
  - Usage limits
  - Admin stats
- KV/Redis:
  - Anonymous/global share-link storage fallback
  - Public beat fallback storage when Supabase is not used

## Key Files

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:3790): Main application logic, UI state, sync, share flows, public library, admin tools.
- [src/main.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/main.jsx:1): App bootstrap, preloaded share loading, visit tracking.
- [src/components/AdminStatsPanel.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/AdminStatsPanel.jsx:1): Admin stats panel UI.
- [src/components/ArrangementDeleteDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementDeleteDialog.jsx:1): Arrangement delete confirmation dialog.
- [src/components/ArrangementDetailsHeader.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementDetailsHeader.jsx:1): Floating arrangement details header and options menu.
- [src/components/ArrangementDetailsPane.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementDetailsPane.jsx:1): Floating arrangement details pane wrapper and drop zone.
- [src/components/ArrangementPanelShell.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementPanelShell.jsx:1): Floating arrangement panel shell and layout wrapper.
- [src/components/ArrangementSourceHeader.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementSourceHeader.jsx:1): Arrangement source header, source/filter menu, drag target title, and source error banner.
- [src/components/ArrangementRowNotationMenu.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementRowNotationMenu.jsx:1): Per-row arrangement sheet notation options.
- [src/components/ArrangementSheetExportPreview.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementSheetExportPreview.jsx:1): Hidden arrangement sheet export render target.
- [src/components/ArrangementSheetPanel.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementSheetPanel.jsx:1): Floating arrangement sheet shell and header controls.
- [src/components/ArrangementSheetPreview.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementSheetPreview.jsx:1): Visible arrangement sheet preview scaling, page rendering wrapper, and mobile touch-clear area.
- [src/components/ArrangementSheetRowMenuPortal.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementSheetRowMenuPortal.jsx:1): Arrangement sheet row notation menu portal wiring.
- [src/components/ArrangementSheetSettingsMenu.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ArrangementSheetSettingsMenu.jsx:1): Floating arrangement sheet options menu.
- [src/components/AppHeader.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/AppHeader.jsx:1): Embed header and main top toolbar, including playback/BPM controls, help, undo/redo, sheet/file/auth actions, and current beat editor strip.
- [src/components/BeatLibraryPrimitives.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/BeatLibraryPrimitives.jsx:1): Beat-library DnD row primitives, source/preset drag overlays, and source-list icons.
- [src/components/FeedbackPanel.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/FeedbackPanel.jsx:1): Feedback form, list, voting, and admin moderation UI.
- [src/components/ExportDialogs.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ExportDialogs.jsx:1): Beat PDF, notation PNG, arrangement PDF, and MIDI export dialogs.
- [src/components/Grid.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/Grid.jsx:1): Interactive drum grid surface, selection gestures, count-row subdivision popup, tuplet styling, and sticking overlays.
- [src/components/GridSettingsPresetSourceList.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/GridSettingsPresetSourceList.jsx:1): Grid-settings preset source list in the arrangement source panel/sidebar.
- [src/components/KitEditorDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/KitEditorDialog.jsx:1): Drumkit editor dialog UI.
- [src/components/KitPresetDialogs.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/KitPresetDialogs.jsx:1): Kit preset save-as panel and preset-change confirmation dialog.
- [src/components/MidiImportMappingDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/MidiImportMappingDialog.jsx:1): MIDI note mapping dialog UI.
- [src/components/MidiImportSettingsDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/MidiImportSettingsDialog.jsx:1): MIDI import tempo/timing/settings dialog UI.
- [src/components/LocalArrangementFooter.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/LocalArrangementFooter.jsx:1): Local arrangement totals, picker/rename, title/admin menus, and delete controls.
- [src/components/LocalArrangementRows.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/LocalArrangementRows.jsx:1): Local arrangement sortable rows and row drop targets.
- [src/components/LocalBeatSourceList.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/LocalBeatSourceList.jsx:1): Local beat source tree/list/footer in the arrangement source panel/sidebar.
- [src/components/Notation.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/Notation.jsx:1): VexFlow notation rendering, notation hit overlays, sticking print labels, arrangement markers, and measure-repeat rendering.
- [src/components/PersonalCloudImportDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/PersonalCloudImportDialog.jsx:1): Local-to-personal-cloud import dialog UI.
- [src/components/PreferencesDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/PreferencesDialog.jsx:1): Preferences and keyboard-shortcuts dialog UI.
- [src/components/PublicArrangementPreview.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/PublicArrangementPreview.jsx:1): Public arrangement preview/list and controls in the arrangement details pane.
- [src/components/PublicBeatSourceList.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/PublicBeatSourceList.jsx:1): Public beat source list in the arrangement source panel/sidebar.
- [src/components/PublicSubmitDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/PublicSubmitDialog.jsx:1): Public beat submission dialog UI.
- [src/components/ShareActionsDialog.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/ShareActionsDialog.jsx:1): File/share actions menu UI for share, export, and MIDI import shortcuts.
- [src/components/TransportMenu.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/components/TransportMenu.jsx:1): Playback transport dropdown for tap tempo, BPM, multiplier, metronome/count-in, and volume controls.
- [src/lib/supabase.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/lib/supabase.js:1): Client Supabase setup.
- [src/services/feedback.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/services/feedback.js:1): Feedback API request wrapper.
- [src/services/stats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/services/stats.js:1): Admin stats API request wrapper.
- [src/services/usageLimits.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/services/usageLimits.js:1): Usage-limit API request wrapper with visitor/auth headers.
- [src/services/shareLinks.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/services/shareLinks.js:1): Supabase and anonymous short-link creation, route share-link lookup, profile share-link rows, deletion, access-touch, and cleanup helpers.
- [src/services/publicLibrary.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/services/publicLibrary.js:1): Public beat/arrangement load, publish, delete, and KV fallback helpers.
- [src/services/cloudLibrary.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/services/cloudLibrary.js:1): Personal cloud beat/arrangement fetch, beat/arrangement CRUD, quota counts, folder-state load/save, and merge insert helpers.
- [src/hooks/useKitEditorState.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/hooks/useKitEditorState.js:1): Kit preset lookup, kit switching, instrument add/remove, and kit-order drag controller hook.
- [api/_supabaseAdmin.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/_supabaseAdmin.js:1): Service-role Supabase client and admin user detection.
- [api/share.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/share.js:1): Anonymous/KV short-link creation with payload dedupe.
- [api/share/[id].js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/share/%5Bid%5D.js:1): Shared payload loading by short ID.
- [api/beats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/beats.js:1): Public beat fallback submission and listing.
- [api/track.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/track.js:1): Analytics event ingest.
- [api/admin-stats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/admin-stats.js:1): Admin-only stats endpoint.
- [api/usage-limits.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/usage-limits.js:1): Quota/usage endpoint.
- [api/feedback.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/feedback.js:1): Feedback submit/vote/moderate/delete.
- [api/_kv.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/_kv.js:1): Upstash REST / Redis abstraction.
- [supabase-admin-stats-schema.sql](/Users/arne/Coding/Codex/Drum%20Grid%20App/supabase-admin-stats-schema.sql:1): `app_events` schema.
- [supabase-feedback-schema.sql](/Users/arne/Coding/Codex/Drum%20Grid%20App/supabase-feedback-schema.sql:1): Feedback and vote schema.
- [index.html](/Users/arne/Coding/Codex/Drum%20Grid%20App/index.html:1): SEO content, portal roots for feedback and admin stats.

## Major Product Capabilities

### Editing And Notation

- Drum kit editing and presets
- Grid-based drum editing
- Tuplets and quarter subdivision controls
- Notation/grid layout variants
- Sticking inference and manual sticking override system
- Arrangement building from beats

Relevant hotspots:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:805)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:28659)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:29961)

### Playback

- Web Audio sample playback
- Metronome and count-in
- Compiled arrangement playback
- iOS audio unlock handling
- Playback lag detection

Relevant files:

- [src/audio/usePlayback.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/audio/usePlayback.js:1)
- [src/audio/engine.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/audio/engine.js:1)

### Import/Export

- Beat MIDI export
- Arrangement MIDI export
- MIDI import with mapping UI and tempo/timing adjustment
- Notation PDF export
- Arrangement PDF export
- Transparent notation PNG export

Relevant files:

- [src/utils/exportMidi.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/utils/exportMidi.js:1)
- [src/utils/importMidi.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/utils/importMidi.js:1)
- [src/utils/exportNotationPdf.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/utils/exportNotationPdf.js:1)
- [src/utils/exportArrangementPdf.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/utils/exportArrangementPdf.js:1)

### Auth And Personal Cloud

- Email/password sign-in
- Sign-up
- Magic link sign-in
- Password reset and recovery
- Profile modal with quotas and share-link management
- Personal cloud beat/arrangement sync
- Offline local library merge into cloud on first sign-in

Relevant hotspots:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:5397)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:6020)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:6270)

### Sharing And Publishing

Three share paths exist:

- Signed-in short links via Supabase `share_links`
- Anonymous/global short links via `/api/share` and KV
- Long fallback links with full encoded state in the URL query

Relevant hotspot:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:19209)

Public content behavior:

- Public beats can be published by admin
- Public arrangements can be published by admin
- In Supabase mode, both are stored in `share_links`

Relevant hotspots:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:18835)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:19069)

### Feedback And Stats

- Public feedback panel rendered into a portal root in `index.html`
- Feedback supports anonymous and signed-in submission
- Public voting
- Admin moderation, admin reply, and resolution status
- Admin-only stats panel with range filters

Relevant files:

- [api/feedback.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/feedback.js:1)
- [api/admin-stats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/admin-stats.js:1)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:22711)

## Important Tables And Payloads

### Supabase Tables

- `beats`
  - Personal cloud beats for signed-in users
- `arrangements`
  - Personal cloud arrangements for signed-in users
- `share_links`
  - User share links
  - Published public beats
  - Published public arrangements
  - Personal library folder-state snapshot
  - New rows should set `purpose` to one of `temporary_share`, `public_beat`, `public_arrangement`, or `personal_library_state`
- `app_events`
  - Analytics events
- `feedback_items`
  - Feedback records
- `feedback_votes`
  - Feedback votes

### `share_links` Overloading

`share_links` is used for several different concerns:

- temporary user share links
- public default beats
- public default arrangements
- personal library state sync record

Rows now have an explicit `purpose` discriminator so code does not have to infer intent only from JSON payload shape. Legacy payload-shape checks still exist as fallback until all existing rows are backfilled.

Migration/reference SQL:

- [supabase-share-links-purpose.sql](/Users/arne/Coding/Codex/Drum%20Grid%20App/supabase-share-links-purpose.sql:1)

### Special Personal Library State

Folder/container state is not in its own table. It is stored as a special `share_links` row:

- `kind: "arrangement"`
- payload kind: `personal-library-state`

Relevant constants:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:926)

## Analytics And Admin Stats

Currently tracked event types:

- `site_visit`
- `share_open`
- `share_create`

Tracked in:

- [src/utils/trackStats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/utils/trackStats.js:1)
- [src/main.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/main.jsx:36)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:17171)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:19326)

Current admin stats shown:

- users
- signed up users
- site visits
- beat share links created
- arrangement share links created
- beat opens via link / QR
- arrangement opens via link / QR

Relevant files:

- [api/admin-stats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/admin-stats.js:1)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:22711)

Admin detection:

- client-side email comparison against `VITE_ADMIN_EMAIL`
- server-side bearer token lookup and email comparison

Relevant files:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:5109)
- [api/_supabaseAdmin.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/_supabaseAdmin.js:1)

## Quotas And Limits

Short-link limits from [api/usage-limits.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/usage-limits.js:1):

- anonymous:
  - 15/day
  - 50/month
- signed-in:
  - 60/month

Personal cloud limits:

- beats: 1000
- arrangements: 100

The frontend checks these before creating short links or cloud entries.

## Notable UX/Implementation Details

- `src/App.jsx` is very large and acts as the app’s central controller.
- There is a hidden-ish auth unlock behavior tied to repeated legal-button interaction when signed out.
- Shared payloads can be preloaded before React boot when the URL is `/g/:id`.
- Short links try to dedupe by payload fingerprint/canonicalization before creating new records.
- Temporary share links can be auto-cleaned when signed in.
- MIDI export embeds payload metadata with a `DG_PAYLOAD:` marker.

## Risks And Constraints

- `src/App.jsx` concentration increases regression risk when changing unrelated product areas.
- `share_links` is overloaded, so filtering by payload kind matters.
- Analytics are sparse right now, so stats work is limited by what is actually tracked.
- There is no existing `README.md`; code is the main documentation source.
- In this workspace snapshot, `git status` showed the project as effectively untracked, so local git history may not be reliable here.

## Environment Variables

Frontend/client:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_EMAIL`

Server/admin:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`
- `ADMIN_VISITOR_IDS`

KV/Redis:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `REDIS_URL`

## Recommended Reading Order

1. [package.json](/Users/arne/Coding/Codex/Drum%20Grid%20App/package.json:1)
2. [src/main.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/main.jsx:1)
3. [src/lib/supabase.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/lib/supabase.js:1)
4. [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:3790)
5. [api/_supabaseAdmin.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/_supabaseAdmin.js:1)
6. [api/share.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/share.js:1)
7. [api/usage-limits.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/usage-limits.js:1)
8. [api/feedback.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/feedback.js:1)
9. [api/admin-stats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/admin-stats.js:1)
10. [supabase-admin-stats-schema.sql](/Users/arne/Coding/Codex/Drum%20Grid%20App/supabase-admin-stats-schema.sql:1) and [supabase-feedback-schema.sql](/Users/arne/Coding/Codex/Drum%20Grid%20App/supabase-feedback-schema.sql:1)

## State Snapshot

- Current goal:
  - Continue development in this chat using codebase-derived context instead of the overfull old chat.
- Last completed context work:
  - Reconstructed architecture, storage model, backend endpoints, and product feature map directly from the codebase.
- High-value likely next tasks:
  - Improve admin stats, likely including excluding admin/self traffic.
  - Add richer tracked events if more meaningful stats are needed.
  - Reduce risk in `src/App.jsx` by isolating future work into smaller modules where practical.
- Known open question:
  - How much production data already exists in Supabase/KV, and whether any schema migrations/backfills are needed for stats changes.
- Testing status:
  - No tests were run during context reconstruction.
