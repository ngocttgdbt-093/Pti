const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const modulePath = path.join(__dirname, 'DriveStorage093.frontend.js');
const source = fs.readFileSync(modulePath, 'utf8');
const helperStart = source.indexOf('async function commitDriveUploadBatch(recordId,results)');
const exportStart = source.indexOf('root.PTI093DriveStorage093=', helperStart);
assert.notEqual(helperStart, -1, 'grouped commit helper exists');
assert.notEqual(exportStart, -1, 'module API export exists');
const uploadCode = `${source.slice(helperStart, exportStart)}\nglobalThis.runDriveUpload = pti093UploadAll;`;

function createHarness({ count = 10, commitItems, statusResult } = {}) {
  let now = 0;
  let activeUploads = 0;
  let maxActiveUploads = 0;
  let commitCalls = 0;
  let uploadCalls = 0;
  let statusCalls = 0;
  let progressAtCommit = null;
  const nodes = new Map();
  const progress = { classList: { remove() {} }, style: {}, textContent: '' };
  const state = {
    driveRecordId: 'record-1', driveUploadFailures: [], groups: [],
    current: { title: 'Current', items: [] }, localDraftId: ''
  };
  for (let i = 0; i < count; i++) state.current.items.push({ key: `image-${i}`, file: { name: `image-${i}.jpg` } });
  const context = {
    state,
    window: {},
    sessionStorage: { getItem: () => 'record-1' },
    localStorage: { getItem: () => '[]', setItem() {} },
    performance: { now: () => ++now },
    setTimeout, clearTimeout, Blob,
    requirePTI093DriveApi_() {},
    getAllGroups: () => [],
    driveImageKey: item => item.key,
    getDriveUploadedKeys: () => new Set(),
    getDrivePendingUploadKey: () => '',
    saveDrivePendingUploadKey() {}, saveDriveUploadedKeys() {},
    scheduleAutoDraftSave() {}, renderDriveUploadFailures() {},
    prepareDriveItem: async item => ({ key: item.key, uploadKey: `sha256:${item.key}`, payload: `upload:${item.key}` }),
    waitForUploadStatus: async () => {
      statusCalls++;
      if (statusResult) return statusResult;
      throw new Error('not found');
    },
    sha256HexBlob: async () => 'batch-hash',
    sendDrivePayload: async payload => {
      if (payload.includes('"action":"commitUploadIndex"')) {
        commitCalls++;
        progressAtCommit = nodes.get('driveProgressText')?.textContent || '';
        const body = JSON.parse(payload);
        return { success: true, items: commitItems || body.items.map(item => ({ ...item, success: true, fileName: item.fileId + '.jpg' })) };
      }
      uploadCalls++;
      activeUploads++;
      maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
      await new Promise(resolve => setTimeout(resolve, 2));
      activeUploads--;
      return { success: true, pendingIndex: true, fileId: `file-${payload}` };
    },
    setDriveState() {}, msg() {},
    $: id => {
      if (id === 'driveProgress') return progress;
      if (!nodes.has(id)) nodes.set(id, { style: {}, textContent: '', classList: { remove() {} } });
      return nodes.get(id);
    }
  };
  vm.createContext(context);
  vm.runInContext(uploadCode, context);
  return {
    context,
    run: () => context.runDriveUpload(),
    stats: () => ({ maxActiveUploads, commitCalls, uploadCalls, statusCalls, progressAtCommit })
  };
}

test('the packaged module parses and exposes the expected API without a production URL fallback', async () => {
  new vm.Script(source);
  assert.match(source, /root\.PTI093DriveStorage093=Object\.freeze/);
  assert.match(source, /root\.PTI093_DRIVE_CONFIG/);
  assert.doesNotMatch(source, /AKfycbwmydXC/);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  await assert.rejects(context.window.PTI093DriveStorage093.createRecord(), /Chưa cấu hình API Drive riêng/);
});

test('holds the success counter until one grouped commit confirms all uploaded images', async () => {
  const harness = createHarness({ count: 10 });
  const result = await harness.run();
  const stats = harness.stats();
  assert.equal(stats.maxActiveUploads, 5);
  assert.equal(stats.uploadCalls, 10);
  assert.equal(stats.commitCalls, 1);
  assert.equal(stats.progressAtCommit, 'Đã xác nhận 0/10 ảnh');
  assert.equal(result.sent, 10);
  assert.equal(result.failures.length, 0);
});

test('leaves all new images unconfirmed when grouped commit omits an item', async () => {
  const harness = createHarness({ count: 2, commitItems: [{ uploadKey: 'sha256:image-0', success: true, fileId: 'file-0' }] });
  const result = await harness.run();
  assert.equal(result.sent, 0);
  assert.equal(result.failures.length, 2);
});

test('reconciles an image already committed on the server before counting it', async () => {
  const harness = createHarness({ count: 1, statusResult: { success: true, found: true, pendingIndex: false, fileId: 'file-existing', fileName: 'existing.jpg' } });
  harness.context.state.current.items[0].driveUploadKey = 'sha256:old-key';
  const result = await harness.run();
  const stats = harness.stats();
  assert.equal(stats.statusCalls, 1);
  assert.equal(stats.uploadCalls, 0);
  assert.equal(stats.commitCalls, 0);
  assert.equal(result.sent, 1);
});

test('recommits a recovered pending image before incrementing the counter', async () => {
  const harness = createHarness({ count: 1, statusResult: { success: true, found: true, pendingIndex: true, fileId: 'file-pending', fileName: 'pending.jpg' } });
  harness.context.state.current.items[0].drivePendingUploadKey = 'sha256:image-0';
  const result = await harness.run();
  const stats = harness.stats();
  assert.equal(stats.uploadCalls, 0);
  assert.equal(stats.commitCalls, 1);
  assert.equal(stats.progressAtCommit, 'Đã xác nhận 0/1 ảnh');
  assert.equal(result.sent, 1);
});

test('carries server-reconciliation state through the five-item worker queue', () => {
  assert.match(source, /needsValidation:x\.needsValidation/);
  assert.match(source, /const DRIVE_CONCURRENCY=5/);
  assert.match(source, /deferIndex:true/);
  assert.match(source, /action:'commitUploadIndex'/);
});
