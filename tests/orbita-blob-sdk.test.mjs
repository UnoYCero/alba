import test from 'node:test';
import assert from 'node:assert/strict';
import {getStore} from '@netlify/blobs';
import {checkedStorageFetch} from '../orbita-server/netlify-runtime.mjs';
const options={name:'fixture',siteID:'fixture-site',token:'fixture-token',edgeURL:'https://storage.test',uncachedEdgeURL:'https://storage.test',consistency:'strong'};
test('pinned Netlify SDK sends conditional headers and reports conflicts without a write',async()=>{
  let mode='success',headers;
  const store=getStore({...options,fetch:checkedStorageFetch(async(_url,input)=>{headers=new Headers(input.headers);
    return new Response('',{status:mode==='success'?200:412,headers:{etag:'"fixture-revision"'}});})});
  assert.deepEqual(await store.set('key','value',{onlyIfNew:true}),{modified:true,etag:'"fixture-revision"'});
  assert.equal(headers.get('if-none-match'),'*');
  mode='conflict';assert.deepEqual(await store.set('key','value',{onlyIfMatch:'"previous"'}),{modified:false});
  assert.equal(headers.get('if-match'),'"previous"');
});
test('pinned SDK cannot disguise a forbidden storage write as modified',async()=>{
  const store=getStore({...options,fetch:checkedStorageFetch(async()=>new Response('Forbidden',{status:403}))});
  await assert.rejects(store.set('key','value',{onlyIfNew:true}),/STORAGE_REQUEST_FAILED/);
});
