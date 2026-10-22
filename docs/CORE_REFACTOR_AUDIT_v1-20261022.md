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
