const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Compile every inline script without executing browser code. This catches syntax errors
// but intentionally does not claim to replace browser interaction testing.
const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]))
  .map(match => match[2]);
assert.ok(inlineScripts.length >= 1, 'inline scripts are present');
inlineScripts.forEach((script, index) => {
  new vm.Script(script, { filename: `inline-script-${index + 1}.js` });
});

const requiredIds = [
  'date', 'datePickerBtn', 'dateCalendar', 'dateCalPrev',
  'dateCalNext', 'dateCalTitle', 'dateCalDays', 'dateCalClear', 'dateCalToday'
];
requiredIds.forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `missing calendar element #${id}`);
});
assert.match(html, /\.dateFieldWrap\{/);
assert.match(html, /\.dateCalendar\{[^}]*border:1px solid #a8cdb8/);
assert.match(html, /\.dateCalendar\{[^}]*border-radius:12px/);
assert.match(html, /\.dateCalendar\{[^}]*box-shadow:/);
assert.match(html, /placeholder="dd\/mm\/yyyy"/);

const start = html.indexOf('function getDateISO()');
const end = html.indexOf('const exts=', start);
assert.ok(start >= 0 && end > start, 'date processing block exists');
const dateBlock = html.slice(start, end);

assert.equal((dateBlock.match(/\$\('date'\)\.addEventListener\('input'/g) || []).length, 1,
  'one date input listener');
assert.equal((dateBlock.match(/\$\('date'\)\.addEventListener\('blur'/g) || []).length, 1,
  'one date validation listener');
assert.equal((dateBlock.match(/const dateCalendar=\$\('dateCalendar'\)/g) || []).length, 1,
  'one calendar controller');
assert.match(dateBlock, /function setDateDMY\(value\)/);
assert.match(dateBlock, /function setDateInput\(value\)\{setDateDMY\(value\|\|''\);\}/);
assert.match(dateBlock, /function getDateISO\(\)/);
assert.match(dateBlock, /function dateCalParse\(\)\{const iso=getDateISO\(\)/);
assert.match(dateBlock, /function dateCalSet\(iso\)\{setDateInput\(iso\);/);
assert.match(dateBlock, /dateCalPrev/);
assert.match(dateBlock, /dateCalNext/);
assert.match(dateBlock, /dateCalClear/);
assert.match(dateBlock, /dateCalToday/);
assert.match(dateBlock, /dispatchEvent\(new Event\('input'/);
assert.match(dateBlock, /dispatchEvent\(new Event\('change'/);
assert.match(dateBlock, /Ngày không hợp lệ\. Vui lòng kiểm tra lại\./);

console.log(`PASS: syntax-compiled ${inlineScripts.length} inline scripts and verified calendar/source contracts.`);
