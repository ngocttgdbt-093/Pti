(function(global){
  'use strict';

  const IMAGE_COUNTS=[1,2,3,4,6,8];

  function normalizeImageLayout(settings,defaults){
    const input=settings||{},fallback=defaults||{};
    const fallbackCount=IMAGE_COUNTS.includes(Number(fallback.imagesPerPage))?Number(fallback.imagesPerPage):6;
    const fallbackOrientation=fallback.orientation==='landscape'?'landscape':'portrait';
    const count=Number(input.imagesPerPage);
    return {
      imagesPerPage:IMAGE_COUNTS.includes(count)?count:fallbackCount,
      orientation:input.orientation==='landscape'||input.orientation==='portrait'?input.orientation:fallbackOrientation
    };
  }

  function imageGridDimensions(imagesPerPage,orientation){
    const layout=normalizeImageLayout({imagesPerPage,orientation});
    const n=layout.imagesPerPage;
    if(n===1)return {cols:1,rows:1};
    if(n===2)return {cols:2,rows:1};
    if(n===3)return {cols:3,rows:1};
    if(n===4)return {cols:2,rows:2};
    if(n===6)return layout.orientation==='portrait'?{cols:2,rows:3}:{cols:3,rows:2};
    return layout.orientation==='portrait'?{cols:2,rows:4}:{cols:4,rows:2};
  }

  global.PTISharedCore=Object.assign(global.PTISharedCore||{}, {
    normalizeImageLayout,
    imageGridDimensions
  });
})(window);
