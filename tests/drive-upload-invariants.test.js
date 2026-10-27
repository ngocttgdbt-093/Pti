const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('async function commitDriveUploadBatch(recordId,results)');
const marker = 'window.pti093UploadAll = pti093UploadAll;';
const end = html.indexOf(marker, start);
assert.notEqual(start, -1, 'Drive grouped commit helper is present');
assert.notEqual(end, -1, 'Drive upload function is present');
const driveCode = `${html.slice(start, end + marker.length)}\nglobalThis.runDriveUpload = pti093UploadAll;`;

function createHarness({ count = 10, commitItems, statusResult } = {}) {
  let now = 0;
  let activeUploads = 0;
  let maxActiveUploads = 0;
  let commitCalls = 0;
  let uploadCalls = 0;
  let statusCalls = 0;
  let progressAtCommit = null;
  const progress = {
    classList: { remove() {} },
    style: {},
    textContent: ''
  };
  const nodes = new Map();
  const state = {
    driveRecordId: 'record-1',
    driveUploadFailures: [],
    groups: [],
    current: { title: 'Current', items: [] },
    localDraftId: ''
  };
  for (let i = 0; i < count; i++) {
    state.current.items.push({ key: `image-${i}`, file: { name: `image-${i}.jpg` } });
  }
  const context = {
    state,
    window: {},
    sessionStorage: { getItem: () => 'record-1' },
    localStorage: { getItem: () => '[]', setItem() {} },
    performance: { now: () => ++now },
    setTimeout,
    clearTimeout,
    Blob,
    getAllGroups: () => [],
    driveImageKey: item => item.key,
    getDriveUploadedKeys: () => new Set(),
    getDrivePendingUploadKey: () => '',
    saveDrivePendingUploadKey() {},
    saveDriveUploadedKeys() {},
    scheduleAutoDraftSave() {},
    renderDriveUploadFailures() {},
    prepareDriveItem: async item => ({ key: item.key, uploadKey: `sha256:${item.key}`, payload: `upload:${item.key}` }),
    waitForUploadStatus: async () => {
      if (statusResult) return statusResult;
      throw new Error('not found');
    },
    sha256HexBlob: async () => 'batch-hash',
    sendDrivePayload: async (payload, recordId, uploadKey) => {
      if (payload.includes('"action":"commitUploadIndex"')) {
        commitCalls++;
        progressAtCommit = nodes.get('driveProgressText')?.textContent || '';
        progressAtCommit = progressAtCommit || progress.textContent;
        const body = JSON.parse(payload);
        return { success: true, items: commitItems || body.items.map(item => ({ ...item, success: true, fileName: item.fileId + '.jpg' })) };
      }
      uploadCalls++;
      activeUploads++;
      maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
      await new Promise(resolve => setTimeout(resolve, 2));
      activeUploads--;
      return { success: true, pendingIndex: true, fileId: `file-${uploadKey}` };
    },
    setDriveState() {},
    msg() {},
    $: id => {
      if (id === 'driveProgress') return progress;
      if (!nodes.has(id)) nodes.set(id, { style: {}, textContent: '', classList: { remove() {} } });
      return nodes.get(id);
    }
  };
  vm.createContext(context);
  vm.runInContext(driveCode, context);
  return {
    context,
    run: () => context.runDriveUpload(),
    stats: () => ({ activeUploads, maxActiveUploads, commitCalls, uploadCalls, progressAtCommit, statusCalls, progress: progress.textContent })
  };
}

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

test('does not count any image when grouped commit omits an item confirmation', async () => {
  const harness = createHarness({ count: 2, commitItems: [{ uploadKey: 'sha256:image-0', success: true, fileId: 'file-0' }] });
  const result = await harness.run();
  assert.equal(result.sent, 0);
  assert.equal(result.failures.length, 2);
});

test('reconciles a locally marked image with server status before counting it', async () => {
  const harness = createHarness({
    count: 1,
    statusResult: { success: true, found: true, pendingIndex: false, fileId: 'file-existing', fileName: 'existing.jpg' }
  });
  const item = harness.context.state.current.items[0];
  item.driveUploadKey = 'sha256:old-key';
  const result = await harness.run();
  const stats = harness.stats();
  assert.equal(stats.uploadCalls, 0, JSON.stringify(stats));
  assert.equal(stats.commitCalls, 0);
  assert.equal(result.sent, 1);
  assert.equal(result.failures.length, 0);
});
test('keeps the 5-request cap and deferred index contract in the integrated Core source', () => {
  assert.match(html, /const DRIVE_CONCURRENCY=5/);
  assert.match(html, /deferIndex:true/);
  assert.match(html, /action:'commitUploadIndex'/);
});

test('all inline JavaScript in the Core page parses', () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inlineScripts = scripts.filter(([, attrs]) => !/\bsrc\s*=/.test(attrs) && !/application\/json/i.test(attrs));
  assert.ok(inlineScripts.length > 0, 'at least one inline script exists');
  for (const [, , source] of inlineScripts) new vm.Script(source);
});
test('recommits a server-recovered pending image before incrementing its counter', async () => {
  const harness = createHarness({
    count: 1,
    statusResult: { success: true, found: true, pendingIndex: true, fileId: 'file-pending', fileName: 'pending.jpg' }
  });
  const item = harness.context.state.current.items[0];
  item.drivePendingUploadKey = 'sha256:image-0';
  const result = await harness.run();
  const stats = harness.stats();
  assert.equal(stats.uploadCalls, 0);
  assert.equal(stats.commitCalls, 1);
  assert.equal(stats.progressAtCommit, 'Đã xác nhận 0/1 ảnh');
  assert.equal(result.sent, 1);
  assert.equal(result.failures.length, 0);
});
