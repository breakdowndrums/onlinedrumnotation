# Drum Grid App Roadmap

This roadmap is ordered for practical momentum: first protect the data and admin workflows, then reduce the app's long-term maintenance pressure, then broaden product analytics and test coverage.

## Phase 1: Admin Stats And Analytics Hygiene

Goal: make stats trustworthy before adding more of them.

1. Exclude admin/self usage from stats. Done in code; deploy requires applying the schema/backfill SQL.
   - Add `exclude_from_stats boolean not null default false` to `app_events`.
   - Set it during event ingest in `api/track.js` when the request user is admin.
   - Support an `ADMIN_VISITOR_IDS` env var for admin browser/device IDs when not signed in.
   - Filter excluded rows in `api/admin-stats.js`.
   - Add a one-time SQL backfill snippet for existing admin rows.

2. Add richer derived admin metrics from existing events.
   - Share open rate.
   - Beat vs arrangement share split.
   - Signed-in vs anonymous event counts.
   - Day/week/all range comparison.

3. Add new event types only where they answer real product questions.
   - `auth_sign_up`
   - `auth_sign_in`
   - `beat_save`
   - `arrangement_save`
   - `pdf_export`
   - `midi_export`
   - `midi_import`
   - `playback_start`

Primary files:

- [api/track.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/track.js:1)
- [api/admin-stats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/api/admin-stats.js:1)
- [supabase-admin-stats-schema.sql](/Users/arne/Coding/Codex/Drum%20Grid%20App/supabase-admin-stats-schema.sql:1)
- [src/utils/trackStats.js](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/utils/trackStats.js:1)

## Phase 2: Data Model Hardening

Goal: make storage intent explicit so future changes are less fragile.

1. Add a row-level discriminator to `share_links`. Done in code and SQL migration.
   - Suggested column: `purpose`.
   - Example values: `temporary_share`, `public_beat`, `public_arrangement`, `personal_library_state`.
   - Keep payload checks as a fallback during migration.

2. Move personal library folder state out of implicit payload detection. Started with `purpose = 'personal_library_state'`.
   - Short term: use `share_links.purpose = 'personal_library_state'`.
   - Longer term: consider a dedicated `library_state` table.

3. Add ordered migrations.
   - Create a `supabase/migrations` folder.
   - Keep the existing schema files as reference docs or convert them into first migrations.

Primary files:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:6046)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:18835)
- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:19069)

## Phase 3: Extract Backend Service Modules

Goal: shrink `src/App.jsx` without changing user-facing behavior.

Start with low-risk service wrappers around existing logic:

1. `src/services/stats.js` Done.
   - `fetchAdminStats`

2. `src/services/feedback.js` Done.
   - `listFeedback`
   - `submitFeedback`
   - `voteFeedback`
   - `moderateFeedback`
   - `deleteFeedback`

3. `src/services/usageLimits.js` Done.
   - usage-limit API request
   - visitor/auth headers
   - response parsing and error handling

4. `src/services/shareLinks.js` Done. Short-link creation, route lookup, and profile share-link storage operations are extracted.
   - short-link creation helpers
   - route share-link lookup
   - profile share-link management
   - share-link cleanup helpers

5. `src/services/cloudLibrary.js` Started. Personal cloud sync storage details are extracted.
   - fetch cloud beats
   - create/update/delete cloud beats
   - fetch cloud arrangements
   - create/update/delete cloud arrangements
   - count cloud library quota rows
   - save cloud folder state
   - insert offline-imported beats and arrangements

6. `src/services/publicLibrary.js` Done.
   - public beat load/publish/delete
   - public arrangement load/publish/delete
   - fallback public beat API calls

This phase should keep function signatures close to the current call sites. The first win is moving fetch/Supabase details out of the main component, not redesigning state management.

Primary file:

- [src/App.jsx](/Users/arne/Coding/Codex/Drum%20Grid%20App/src/App.jsx:3790)

## Phase 4: Split UI Components

Goal: make the main file easier to reason about during feature work.

Good extraction candidates:

1. Admin stats panel. Done.
2. Feedback panel. Done.
3. Public submit dialog. Done.
4. MIDI import mapping/settings dialogs. Done.
5. Beat and arrangement print/export dialogs. Done.
6. Personal cloud import dialog. Done.
7. Preferences dialog. Done.
8. Kit editor dialog and controller hook. Done.
9. Share/actions menu. Done.
10. Arrangement panel shell. Done.
11. Arrangement details pane wrapper/drop zone. Done.
12. Arrangement details header/options menu. Done.
13. Public arrangement preview/list section. Done.
14. Local arrangement sortable rows. Done.
15. Local arrangement footer controls. Done.
16. Arrangement sheet settings menu. Done.
17. Arrangement sheet row notation menu portal. Done.
18. Arrangement sheet visible preview wrapper. Done.
19. Arrangement sheet hidden export preview. Done.
20. Arrangement sheet panel shell/header. Done.
21. Arrangement row notation options menu. Done.
22. Public beat source list. Done.
23. Grid-settings preset source list. Done.
24. Local beat source tree/list/footer. Done.
25. Arrangement source header/filter menu. Done.
26. Beat-library DnD/source row primitives. Done.
27. Transport menu. Done.
28. Interactive drum grid surface. Done.
29. VexFlow notation renderer. Done.
30. Top app toolbar/header. Done.

Each extraction should move UI and local UI-only helpers first. Shared state can still be passed as props until the app is stable enough for deeper state refactors.

## Phase 5: Focused Tests

Goal: protect the behavior that is easiest to break silently.

Start with pure functions and API handlers:

1. Share payload canonicalization and fingerprinting.
2. Stats filtering and admin exclusion.
3. Arrangement item normalization.
4. Notation state slicing/merging.
5. MIDI payload metadata encode/decode.
6. Feedback type normalization.

Suggested first test setup:

- Add Vitest for pure utilities.
- Add a small API-handler test harness for `api/track.js` and `api/admin-stats.js`.

## Phase 6: Product Polish

Goal: improve clarity without disturbing core workflows.

1. Replace the hidden legal-click auth unlock with a clearer admin/profile entry.
2. Improve admin stats layout once the data is cleaner.
3. Add a short `README.md`.
4. Add focused docs:
   - `docs/data-model.md`
   - `docs/sharing.md`
   - `docs/admin-stats.md`

## Recommended Next Step

Start with Phase 1, item 1: exclude admin/self usage from stats.

It is small, directly useful, and creates the right foundation before adding more admin metrics.
