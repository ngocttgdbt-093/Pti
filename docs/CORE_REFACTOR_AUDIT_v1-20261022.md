# PTI Core Refactor Audit — v1-20261022.4

## Status
This is a source-boundary audit on `refactor/core-modules-test-20261022`, not a claim of functional acceptance. Production `main` remains untouched.

## User-confirmed requirements
- PTI must use the standardized shared Core sourced from GHÉP ẢNH 093.
- PTI must not provide or invoke Drive case storage/search/open/upload. The only Drive integration to retain is the separate GĐV administrator/login/permissions/user-directory module.
- The visible case-save controls are already hidden in the current source via CSS, but hiding UI is not sufficient: handlers and callable Drive case functions remain in `index.html`.
- Preserve PTI local save and autosave/recovery, as well as `admin-gdv/admin-gdv.js` and its dedicated API.
- Keep all work on this test branch until functional checks pass.

## Source findings from `main` on 2026-10-22
- `index.html` contains `driveCreate`, `driveSaveProject`, `driveSaveDraft` and a Drive search row. CSS hides most of the Drive case UI while explicitly making `.driveSearchRow` and search results visible. The two case-save buttons are present in HTML but hidden; this matches the user's distinction between visible UI and dormant source code.
- Case-Drive code is not merely dead markup. The source assigns `$('driveCreate').onclick=createDriveRecord`, assigns `$('driveSaveProject').onclick=...`, exposes `window.pti093UploadAll`, defines `createDriveRecord` and `saveProjectToDrive`, and has search/open/upload API calls through a `PTI093_API` endpoint. Therefore the next change must disable/remove all PTI case-Drive entry points, not just hide buttons.
- `driveSaveDraft` invokes `saveDraftWithoutPhotos`, which is a local-device save with user confirmation; preserve this local-save function and its progress UI.
- `admin-gdv/admin-gdv.js` is a separate script using its own `PTI_GDV_ADMIN_API_URL` and is included at the end of `index.html`. Preserve it and do not redirect it to the 093 case API.
- PTI local draft DB is `pti_local_drafts_v1`, draft ID `AUTO-DRAFT`, session key `pti_work_session_id`. It has an active-session heartbeat/stale-session cleanup in addition to autosave and restore. Do not replace it blindly with 093's implementation; compare behavior and extract shared contracts only after tests.

## Implementation guardrails
1. First add regression checks for PTI local draft restore and admin module presence.
2. Remove/disable case-Drive search/open/create/save/upload pathways on this branch, while retaining the local-only save action and admin module.
3. Extract shared Core incrementally; preserve app-specific adapters/configuration and the current 093 Drive saver unchanged.
4. Syntax tests are not functional tests. Do not merge or deploy until browser-level draft recovery and admin regression checks are recorded.

## Implementation record — v1-20261022.8

- On the PTI test branch, added a feature gate `PTI_CASE_DRIVE_ENABLED=false` and guards to case create/save/open/search/upload entry points. The Drive case-search row and results are hidden. The local-only `driveSaveDraft` / `saveDraftWithoutPhotos` action remains wired, and the separate `admin-gdv/admin-gdv.js` remains included with its dedicated API.
- Added `tests/source-contract.test.js` and a GitHub Actions step for the PTI boundary contract. Added a corresponding GitHub Actions source-contract check for the 093 draft-recovery identifiers. These checks are source-contract checks, not browser-level functional acceptance.
- Manual syntax parsing of current main 093 inline scripts succeeded (5/5); PTI test-branch inline script succeeded (1/1); PTI admin script syntax succeeded. Static checks confirmed the PTI guard, hidden search, local-save wiring, admin script inclusion, and dedicated admin API markers.
- GitHub combined status responses did not report any status checks at the time of inspection. Do not call CI green until a completed workflow run is visible.
- Still pending: verify the test branch's workflow run, browser-test PTI local save/autosave/reload recovery, verify admin login and user-directory operations, then begin extracting shared Core modules incrementally. No production branch was changed and no deployment was performed.

## Shared Core extraction milestone — v2-20261022

- PTI now imports the same `core/gdv-search.js` helper module as the 093 test branch and binds the app's existing `normalizeRecordSearch`, `gdvInitials`, and `gdvSearchMatches` names to the shared module. The app-specific GĐV name list and PTI admin module remain app-specific.
- Added shared-helper tests for normalization, initials, partial-name matching, empty queries, and no-match behavior, with a GitHub Actions step configured on the test branch.
- Source parsing after extraction: PTI inline script 1/1 parsed successfully; the shared helper module loaded and manual behavior checks passed. These are syntax/pure-helper checks, not full browser acceptance.
- The PTI case-Drive feature gate remains disabled; local-only save and the separate GĐV admin module are preserved by source-contract checks. Browser verification of autosave/reload and admin workflows remains pending.
