const assert = require('node:assert/strict');
const test = require('node:test');

global.window = {};
require('../core/image-collection.js');
const {collectUniqueImageFiles,orderItemsByKeys} = global.window.PTISharedCore;

function file(name,size=10,lastModified=1,type='image/jpeg'){
  return {name,size,lastModified,type};
}

test('filters unsupported files and removes duplicates from both existing items and the incoming batch',()=>{
  const existing=[{file:file('already.jpg'),key:'already.jpg|10|1'}];
  const batch=[file('already.jpg'),file('first.png'),file('first.png'),file('notes.txt',10,1,'text/plain'),file('legacy.HEIC',20,2,'')];
  const result=collectUniqueImageFiles(batch,existing,{addSeq:4});
  assert.deepEqual(result.items.map(item=>item.file.name),['first.png','legacy.HEIC']);
  assert.deepEqual(result.items.map(item=>item.addSeq),[5,6]);
  assert.equal(result.addSeq,6);
});

test('preserves selection order and filename captions when requested',()=>{
  const batch=[file('damage-front.jpg'),file('damage-side.jpeg'),file('damage-rear.png')];
  const result=collectUniqueImageFiles(batch,[],{addSeq:10,filenameCaption:true});
  assert.deepEqual(result.items.map(item=>item.caption),['damage-front','damage-side','damage-rear']);
  assert.deepEqual(result.items.map(item=>item.addSeq),[11,12,13]);
  assert.deepEqual(result.items.map(item=>item.rotate),[0,0,0]);
});

test('supports image MIME types without an extension and file extensions without a MIME type',()=>{
  const result=collectUniqueImageFiles([file('camera-export',2,3,'image/heic'),file('phone-photo.heif',4,5,'')],[],{});
  assert.deepEqual(result.items.map(item=>item.file.name),['camera-export','phone-photo.heif']);
});

test('reorders items from a complete one-to-one DOM key list',()=>{
  const items=[{dragId:'a',name:'first'},{dragId:'b',name:'second'},{dragId:'c',name:'third'}];
  assert.deepEqual(orderItemsByKeys(items,['c','a','b'],item=>item.dragId),[items[2],items[0],items[1]]);
  assert.equal(orderItemsByKeys(items,['a','b','c'],item=>item.dragId).every((item,index)=>item===items[index]),true);
});

test('rejects incomplete, duplicated, unknown, or ambiguous DOM keys without losing items',()=>{
  const items=[{dragId:'a'},{dragId:'b'},{dragId:'c'}];
  assert.equal(orderItemsByKeys(items,['a','b'],item=>item.dragId),null);
  assert.equal(orderItemsByKeys(items,['a','a','c'],item=>item.dragId),null);
  assert.equal(orderItemsByKeys(items,['a','b','unknown'],item=>item.dragId),null);
  assert.equal(orderItemsByKeys([{dragId:'a'},{dragId:'a'}],['a','a'],item=>item.dragId),null);
});
