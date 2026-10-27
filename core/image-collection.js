(function(global){
  'use strict';

  const imageExtension=/\.(?:jpe?g|png|webp|gif|heic|heif)$/i;

  function imageFileKey(file){
    return [String(file&&file.name||''),Number(file&&file.size)||0,Number(file&&file.lastModified)||0].join('|');
  }

  function fileBaseName(name){return String(name||'').replace(/\.[^.]+$/,'')}

  function collectUniqueImageFiles(files,existingItems,options){
    const opts=options||{},seen=new Set((existingItems||[]).map(item=>item.key||imageFileKey(item.file||item)));
    const items=[];let addSeq=Number(opts.addSeq)||0;
    for(const file of Array.from(files||[])){
      if(!file)continue;
      const type=String(file.type||'');
      if(!type.startsWith('image/')&&!imageExtension.test(String(file.name||'')))continue;
      const key=imageFileKey(file);
      if(seen.has(key))continue;
      seen.add(key);addSeq++;
      items.push({file,key,caption:opts.filenameCaption?fileBaseName(file.name):'',addSeq,rotate:0});
    }
    return {items,addSeq};
  }

  function orderItemsByKeys(items,orderedKeys,keyForItem){
    const source=Array.from(items||[]),keys=Array.from(orderedKeys||[],key=>String(key));
    if(typeof keyForItem!=='function'||keys.length!==source.length)return null;
    const byKey=new Map();
    for(const item of source){
      const key=String(keyForItem(item)||'');
      if(!key||byKey.has(key))return null;
      byKey.set(key,item);
    }
    if(new Set(keys).size!==keys.length||keys.some(key=>!byKey.has(key)))return null;
    return keys.map(key=>byKey.get(key));
  }

  global.PTISharedCore=Object.assign(global.PTISharedCore||{}, {collectUniqueImageFiles,orderItemsByKeys});
})(window);
