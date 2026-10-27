(function(global){
  'use strict';

  function autoDraftIdForSession(sessionId){
    const id=String(sessionId||'').trim();
    if(!id)throw new Error('Thiếu mã phiên để tạo nháp tự động.');
    return 'AUTO-DRAFT:'+id;
  }

  function isInactiveAutoDraft(draft,currentSessionId,lastActiveAt,now,staleAfterMs){
    if(!draft||draft.auto!==true||draft.sessionId===currentSessionId)return false;
    const activeAt=Number(lastActiveAt)||0;
    return !activeAt||now-activeAt>staleAfterMs;
  }

  function migrateLegacyAutoDraft(db,legacyId,targetId,sessionId,keyRange,transactionDone){
    const tx=db.transaction(['drafts','draftImages'],'readwrite');
    const drafts=tx.objectStore('drafts'),images=tx.objectStore('draftImages');
    let legacyMeta=null,legacyImages=[],metaReady=false,imagesReady=false,migrated=null;
    const finishRead=()=>{
      if(!metaReady||!imagesReady||!legacyMeta||legacyMeta.sessionId!==sessionId)return;
      migrated=Object.assign({},legacyMeta,{id:targetId});
      drafts.put(migrated);
      drafts.delete(legacyId);
      legacyImages.forEach(image=>{
        const id=targetId+'|'+image.sectionIndex+'|'+image.itemIndex;
        images.put(Object.assign({},image,{id,draftId:targetId}));
        images.delete(image.id);
      });
    };
    const metaReq=drafts.get(legacyId);
    metaReq.onsuccess=()=>{legacyMeta=metaReq.result||null;metaReady=true;finishRead()};
    const imageReq=images.index('draftId').getAll(keyRange.only(legacyId));
    imageReq.onsuccess=()=>{legacyImages=imageReq.result||[];imagesReady=true;finishRead()};
    return transactionDone(tx).then(()=>migrated);
  }

  function replaceLocalDraft(db,id,meta,imageRecords,keyRange,transactionDone,onImagesReady){
    const tx=db.transaction(['drafts','draftImages'],'readwrite');
    const drafts=tx.objectStore('drafts'),images=tx.objectStore('draftImages');
    drafts.put(meta);
    const cursorReq=images.index('draftId').openCursor(keyRange.only(id));
    cursorReq.onsuccess=()=>{
      const cursor=cursorReq.result;
      if(cursor){cursor.delete();cursor.continue();return}
      if(onImagesReady)onImagesReady();
      imageRecords.forEach(image=>images.put(image));
    };
    return transactionDone(tx);
  }

  global.PTISharedCore=Object.assign(global.PTISharedCore||{}, {
    autoDraftIdForSession,
    isInactiveAutoDraft,
    migrateLegacyAutoDraft,
    replaceLocalDraft
  });
})(window);
