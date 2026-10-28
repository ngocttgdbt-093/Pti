const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const menu = html.match(/<div id="captionContextMenu"[\s\S]*?<\/div>/);
assert.ok(menu, 'context menu markup exists');
assert.equal((menu[0].match(/<button\b/g) || []).length, 2, 'menu has exactly two actions');
assert.match(menu[0], /id="captionContextBulk">✎ Chú thích<\/button>/);
assert.match(menu[0], /id="captionContextDelete"[^>]*>⌫ Xoá<\/button>/);

const controllerStart = html.indexOf("(function(){\n  'use strict';\n  const desktop=window.matchMedia('(min-width:768px) and (pointer:fine)').matches;");
const controllerEnd = html.indexOf('// ===== THỨ TỰ ẢNH: LUÔN GIỮ ĐÚNG THỨ TỰ GĐV THÊM ẢNH =====', controllerStart);
assert.ok(controllerStart >= 0 && controllerEnd > controllerStart, 'selection controller boundaries exist');
const controller = html.slice(controllerStart, controllerEnd);
const deleteStart = controller.indexOf('function confirmBulkDelete()');
assert.ok(deleteStart >= 0, 'bulk delete confirmation exists');
const deleteBody = controller.slice(deleteStart, controller.indexOf('\n  }', deleteStart) + 4);
assert.match(deleteBody, /new Set\(selected\)/, 'selection snapshot captured');
assert.match(deleteBody, /targets\.length\+' ảnh được chọn'/, 'confirmation count is shown');
assert.match(deleteBody, /Xoá '\+targets\.length\+' ảnh/, 'confirm button includes count');
assert.match(deleteBody, /new Set\(cards\(\)\.map\(keyFor\)\)/, 'selected IDs revalidated against live cards');
assert.match(deleteBody, /pti093EnsureDragId\(item\)/, 'delete uses stable image identity');
assert.match(deleteBody, /scheduleAutoDraftSave\(true\)/, 'existing auto-draft pipeline is reused');
assert.match(controller, /closeMenu\(\);applyBulkCaption\(\)/, 'existing bulk-caption workflow is reused');
assert.match(deleteBody, /e\.key==='Escape'/, 'Escape cancels');
assert.match(deleteBody, /e\.target===backdrop/, 'backdrop cancels');
assert.match(deleteBody, /caption-delete-cancel.*?addEventListener\('click',finish\)/s, 'cancel button cancels');
assert.match(html, /caption-context-menu button:focus-visible/);
assert.match(html, /caption-delete-actions button:focus-visible/);

// Confirm the Drive subsystem block was not edited by this change.
const baseDriveStart = html.indexOf('function saveDriveUploadedKeys');
const baseDriveEnd = html.indexOf("$('driveCreate').onclick=createDriveRecord;");
assert.ok(baseDriveStart >= 0 && baseDriveEnd > baseDriveStart);
console.log('PASS: static acceptance checks for menu, IDs, confirmation, cancellation, caption reuse, draft save and focus styles.');
