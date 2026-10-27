const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

global.window = {};
require('../core/local-draft-storage.js');
const {autoDraftIdForSession,isInactiveAutoDraft,migrateLegacyAutoDraft,replaceLocalDraft} = global.window.PTISharedCore;

function makeDb(existingImages=[]){
  const deleted=[];
  const written={drafts:[],images:[]};
  let cursorRequest;
  const tx={
    stores:{
      drafts:{put:value=>written.drafts.push(value)},
      draftImages:{
        put:value=>written.images.push(value),
        index:name=>{
          assert.equal(name,'draftId');
          return {openCursor:range=>{
            assert.deepEqual(range,{only:'LOCAL-1'});
            cursorRequest={onsuccess:null,result:null};
            return cursorRequest;
          }};
        }
      }
    },
    objectStore(name){return this.stores[name]}
  };
  return {db:{transaction(names,mode){
    assert.deepEqual(names,['drafts','draftImages']);
    assert.equal(mode,'readwrite');
    return tx;
  }},tx,deleted,written,get cursorRequest(){return cursorRequest},existingImages};
}

function finishCursorScan(fake){
  const rows=fake.existingImages.filter(image=>image.draftId==='LOCAL-1');
  const visit=index=>{
    const row=rows[index];
    fake.cursorRequest.result=row?{
      delete(){fake.deleted.push(row.id)},
      continue(){visit(index+1)}
    }:null;
    fake.cursorRequest.onsuccess();
  };
  visit(0);
}

const keyRange={only:value=>({only:value})};
function waitForTransaction(tx){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(new Error('transaction error'));
    tx.onabort=()=>reject(new Error('transaction aborted'));
  });
}

test('replaces metadata and all image rows in one transaction after removing old rows',async()=>{
  const fake=makeDb([{id:'LOCAL-1|old|0',draftId:'LOCAL-1'},{id:'OTHER|0|0',draftId:'OTHER'}]);
  const meta={id:'LOCAL-1',storageType:'local'};
  const images=[{id:'LOCAL-1|0|0',draftId:'LOCAL-1',file:{name:'a.jpg'}},{id:'LOCAL-1|0|1',draftId:'LOCAL-1',file:{name:'b.jpg'}}];
  let wroteImages=false;
  const done=replaceLocalDraft(fake.db,'LOCAL-1',meta,images,keyRange,waitForTransaction,()=>{wroteImages=true});
  finishCursorScan(fake);
  fake.tx.oncomplete();
  await done;
  assert.deepEqual(fake.deleted,['LOCAL-1|old|0']);
  assert.deepEqual(fake.written.drafts,[meta]);
  assert.deepEqual(fake.written.images,images);
  assert.equal(wroteImages,true);
});

test('propagates a grouped transaction failure',async()=>{
  const fake=makeDb();
  const done=replaceLocalDraft(fake.db,'LOCAL-1',{id:'LOCAL-1'},[],keyRange,waitForTransaction);
  finishCursorScan(fake);
  fake.tx.onabort();
  await assert.rejects(done,/transaction aborted/);
});

test('uses distinct autosave keys and preserves another active session',()=>{
  assert.equal(autoDraftIdForSession('tab-a'),'AUTO-DRAFT:tab-a');
  assert.notEqual(autoDraftIdForSession('tab-a'),autoDraftIdForSession('tab-b'));
  const other={id:'AUTO-DRAFT:tab-a',auto:true,sessionId:'tab-a'};
  assert.equal(isInactiveAutoDraft(other,'tab-b',Date.now()-1000,Date.now(),30000),false);
  assert.equal(isInactiveAutoDraft(other,'tab-b',0,Date.now(),30000),true);
  assert.equal(isInactiveAutoDraft({...other,sessionId:'tab-b'},'tab-b',0,Date.now(),30000),false);
});

test('migrates a legacy autosave only when it belongs to this browser session',async()=>{
  const meta={id:'AUTO-DRAFT',auto:true,sessionId:'tab-a'};
  const image={id:'AUTO-DRAFT|0|0',draftId:'AUTO-DRAFT',sectionIndex:0,itemIndex:0,file:{name:'a.jpg'}};
  const writes={drafts:[],images:[]},deletes={drafts:[],images:[]};
  const metaReq={onsuccess:null,result:meta},imageReq={onsuccess:null,result:[image]};
  const tx={stores:{
    drafts:{get(){return metaReq},put:value=>writes.drafts.push(value),delete:id=>deletes.drafts.push(id)},
    draftImages:{index(name){assert.equal(name,'draftId');return {getAll(range){assert.deepEqual(range,{only:'AUTO-DRAFT'});return imageReq}}},put:value=>writes.images.push(value),delete:id=>deletes.images.push(id)}
  },objectStore(name){return this.stores[name]}};
  const db={transaction(names,mode){assert.deepEqual(names,['drafts','draftImages']);assert.equal(mode,'readwrite');return tx}};
  const done=migrateLegacyAutoDraft(db,'AUTO-DRAFT','AUTO-DRAFT:tab-a','tab-a',keyRange,waitForTransaction);
  assert.equal(typeof metaReq.onsuccess,'function');
  assert.equal(typeof imageReq.onsuccess,'function');
  metaReq.onsuccess();imageReq.onsuccess();
  tx.oncomplete();
  assert.deepEqual(await done,{...meta,id:'AUTO-DRAFT:tab-a'});
  assert.equal(writes.drafts.length,1);
  assert.equal(writes.drafts[0].id,'AUTO-DRAFT:tab-a');
  assert.deepEqual(writes.images[0],{...image,id:'AUTO-DRAFT:tab-a|0|0',draftId:'AUTO-DRAFT:tab-a'});
  assert.deepEqual(deletes.drafts,['AUTO-DRAFT']);
  assert.deepEqual(deletes.images,['AUTO-DRAFT|0|0']);
});

test('leaves a legacy autosave owned by another session untouched',async()=>{
  const metaReq={onsuccess:null,result:{id:'AUTO-DRAFT',auto:true,sessionId:'tab-a'}};
  const imageReq={onsuccess:null,result:[{id:'AUTO-DRAFT|0|0',draftId:'AUTO-DRAFT',sectionIndex:0,itemIndex:0}]};
  const writes=[],deletes=[];
  const tx={
    objectStore(name){return name==='drafts'?{
      get:()=>metaReq,put:value=>writes.push(value),delete:id=>deletes.push('draft:'+id)
    }:{
      index:()=>({getAll:()=>imageReq}),put:value=>writes.push(value),delete:id=>deletes.push('image:'+id)
    }}
  };
  const db={transaction:()=>tx};
  const done=migrateLegacyAutoDraft(db,'AUTO-DRAFT','AUTO-DRAFT:tab-b','tab-b',keyRange,waitForTransaction);
  metaReq.onsuccess();imageReq.onsuccess();tx.oncomplete();
  assert.equal(await done,null);
  assert.deepEqual(writes,[]);
  assert.deepEqual(deletes,[]);
});

test('does not clear the in-memory Drive association before local transaction success',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const start=html.indexOf('async function saveLocalDraft(){');
  const end=html.indexOf('\nasync function openLocalDraft(',start);
  assert.notEqual(start,-1);
  assert.notEqual(end,-1);
  const save=html.slice(start,end);
  const commit=save.indexOf('await window.PTISharedCore.replaceLocalDraft');
  const clear=save.indexOf("state.driveRecordId='';state.localDraftId=id;");
  assert.ok(commit>=0&&clear>commit,'Drive association is cleared only after the local transaction resolves');
  assert.ok(save.slice(0,commit).includes('state.localDraftId||\'\'')&& !save.slice(0,commit).includes("it.driveFileId='';"));
});
