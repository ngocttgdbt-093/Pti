// Static source contract checks for the PTI test branch. Run with: node tests/source-contract.test.js
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const admin = fs.readFileSync('admin-gdv/admin-gdv.js', 'utf8');
const checks = {
  caseDriveDisabled: html.includes('const PTI_CASE_DRIVE_ENABLED=false'),
  driveModuleIsNotLoadedByPti: !html.includes('./modules/drive-storage-093/DriveStorage093.frontend.js'),
  createGuard: html.includes('PTI không hỗ trợ lưu hồ sơ ảnh lên Drive.'),
  uploadGuard: html.includes('PTI không hỗ trợ tải ảnh hồ sơ lên Drive.'),
  searchHidden: html.includes('.driveBox .driveSearchRow{display:none!important}') && html.includes('.driveBox #driveSearchResults{display:none!important}'),
  localSavePreserved: html.includes('id="driveSaveDraft"') && html.includes("$('driveSaveDraft').onclick=saveDraftWithoutPhotos"),
  adminModuleIncluded: html.includes('./admin-gdv/admin-gdv.js'),
  adminUsesDedicatedApi: admin.includes('PTI_GDV_ADMIN_API_URL')
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) { console.error('PTI source-contract checks failed:', failed.join(', ')); process.exit(1); }
console.log('PTI source-contract checks passed:', Object.keys(checks).join(', '));
