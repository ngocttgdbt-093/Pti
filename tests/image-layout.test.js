const assert = require('node:assert/strict');
const test = require('node:test');

global.window = {};
require('../core/image-layout.js');
const {imageGridDimensions,normalizeImageLayout} = global.window.PTISharedCore;

test('returns the established portrait and landscape grid for every supported page size',()=>{
  const expected={
    1:{portrait:[1,1],landscape:[1,1]},
    2:{portrait:[2,1],landscape:[2,1]},
    3:{portrait:[3,1],landscape:[3,1]},
    4:{portrait:[2,2],landscape:[2,2]},
    6:{portrait:[2,3],landscape:[3,2]},
    8:{portrait:[2,4],landscape:[4,2]}
  };
  for(const [count,orientations] of Object.entries(expected)){
    for(const [orientation,[cols,rows]] of Object.entries(orientations)){
      assert.deepEqual(imageGridDimensions(Number(count),orientation),{cols,rows});
    }
  }
});

test('normalizes invalid draft settings to the current valid layout',()=>{
  assert.deepEqual(
    normalizeImageLayout({imagesPerPage:5,orientation:'diagonal'},{imagesPerPage:4,orientation:'landscape'}),
    {imagesPerPage:4,orientation:'landscape'}
  );
  assert.deepEqual(
    normalizeImageLayout({imagesPerPage:'6',orientation:'portrait'},{imagesPerPage:8,orientation:'landscape'}),
    {imagesPerPage:6,orientation:'portrait'}
  );
});

test('uses the safe default when both saved and current layout settings are invalid',()=>{
  assert.deepEqual(normalizeImageLayout({imagesPerPage:0,orientation:''},{imagesPerPage:-1,orientation:'sideways'}),{imagesPerPage:6,orientation:'portrait'});
  assert.deepEqual(imageGridDimensions(0,'sideways'),{cols:2,rows:3});
});
