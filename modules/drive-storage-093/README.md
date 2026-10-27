# Drive storage module for the 093 composition

This package is the optional case-storage layer for the standardized Project 5 Core. It is kept separate from the Core and from each app's skin. The PTI composition must not load this module; PTI uses the shared Core plus the separate GĐV administration module.

## Composition

- **093:** optimized shared Core + `drive-storage-093` + 093 skin.
- **PTI:** optimized shared Core + GĐV administration module + PTI skin.

The module is not included by the PTI page and this branch does not enable case Drive storage in PTI. A 093 skin can load `DriveStorage093.frontend.js` after the Core, set the Core adapter globals listed below, then wire its own controls to `window.PTI093DriveStorage093`.

## Source and provenance

The implementation comes from the Project 1 handoff, `drive-module-handoff-20261027`, based on the frozen 093 frontend commit `8e321068ea279acf7c2b6e762cb07a93d1ec0254`. The original handoff README is retained as `HANDOFF-README.md`; the Apps Script v25 action map is retained in `AppsScript-v25-MODULE-MAP.md`.

The endpoint shown in the source handoff map is historical evidence for Project 1. The packaged JavaScript has no production endpoint fallback. Supply a destination-specific endpoint through `window.PTI093_DRIVE_CONFIG.apiUrl` before loading the module. Configure the destination Apps Script `PTI093_FOLDER_ID` on that backend; never place a Drive root ID in frontend code.

## Module API

The package exposes `window.PTI093DriveStorage093`:

- `createRecord()` creates a Drive case and uploads the current Core image set.
- `uploadAll()` uploads or reconciles the Core image set.
- `saveProject(showMessage)` saves case metadata after uploads are confirmed.
- `searchRecords()` and `openRecord(recordId)` find and reopen cases.
- `buildProjectData()` creates the case metadata payload.

The 093 skin owns the visible controls and calls these methods. The module expects the control IDs in the handoff contract (`driveCreate`, `driveSaveProject`, `driveState`, `driveId`, `driveProgress*`, `driveUploadMissing`, `driveSearch`, and `driveSearchResults`). Keep local-only draft save in Core; do not route it through Drive.

## Core adapter contract

The loaded Core must provide:

- `state.driveRecordId`, `state.driveUploadFailures`, `state.groups`, `state.current`, `state.orientation`, `state.per`, `state.addSeq`, and `state.localDraftId`.
- `$()`, `getAllGroups()`, `selectedGdv()`, `getDateISO()`, `getLocalDrafts()`, and `finalizeCompletedSession()`.
- `msg()`, `render()`, `renderLayout()`, `scheduleAutoDraftSave()`, `getDriveUploadedKeys()` storage behavior, and open-load progress helpers.
- Each item keeps `file`, stable `key`, `caption`, `rotate`, and optional `driveFileId`, `driveFileName`, `driveUploadKey`, and `drivePendingUploadKey` fields.

Set the endpoint before loading the module, for example:

```html
<script>
  window.PTI093_DRIVE_CONFIG = { apiUrl: window.PTI093_APP_CONFIG.driveApiUrl };
</script>
<script src="./modules/drive-storage-093/DriveStorage093.frontend.js"></script>
```

Do not hardcode a production deployment URL in the module or in a test page.

## Data and upload invariants

- `project.pti` remains the server record of truth; metadata saves must preserve the server's existing `uploadIndex` and `uploadIndexVersion`.
- Image transport is capped at five concurrent requests.
- Upload images with `deferIndex: true`; after both upload groups finish, submit one `commitUploadIndex` for all pending items.
- Advance the confirmed-image counter only after server confirmation and a successful grouped index commit. A recovered image already in the index may count only after `uploadStatus` verifies that server state.
- Reconcile interrupted requests by `recordId + uploadKey`; do not delete files to recover.
- Backend SHA-256 verification, dedupe, index migration, and ScriptLock behavior must follow the action map. Keep backend deployment/root configuration separate from frontend skin configuration.

## Verification limits

The module tests are offline contract and behavior tests. They do not write to Drive. A real 10-image test requires a dedicated Project 5 Apps Script deployment and test Drive root; the historical Project 1 live-run result is documented in the retained handoff README.
