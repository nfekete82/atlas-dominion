import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';

// Safari and Chrome use Range requests on HTMLAudioElement. Verify that
// Sandforge's ordinary local test server can stream the ORIGINAL MP3 bytes
// without buffering the whole recording or returning application/octet-stream.
test('the game server streams MP3 via audio/mpeg and supports seeking/loops',async()=>{
 const file=join(process.cwd(),'dist/src/assets/reborn/music/http-range-fixture.mp3');
 mkdirSync(dirname(file),{recursive:true});
 const source=Buffer.from(Array.from({length:240},(_,n)=>n%256));
 writeFileSync(file,source);
 const port=await new Promise((resolve,reject)=>{
  const s=createServer();s.once('error',reject);
  s.listen(0,'127.0.0.1',()=>{
   const port=s.address().port;
   s.close(error=>error?reject(error):resolve(port));
  });
 });
 const server=spawn(process.execPath,['scripts/serve.mjs'],
  {env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 try{
  let ready=false;
  for(let n=0;n<50&&!ready;n++){
   try{const res=await fetch(base+'/healthz');ready=res.status===200;}
   catch{await new Promise(done=>setTimeout(done,65));}
  }
  assert.ok(ready,'local Sandforge static server should start');
  const url=base+'/src/assets/reborn/music/http-range-fixture.mp3';
  const whole=await fetch(url);
  assert.equal(whole.status,200);
  assert.equal(whole.headers.get('content-type'),'audio/mpeg');
  assert.equal(whole.headers.get('accept-ranges'),'bytes');
  assert.deepEqual(Buffer.from(await whole.arrayBuffer()),source);
  const partial=await fetch(url,{headers:{Range:'bytes=42-69'}});
  assert.equal(partial.status,206);
  assert.equal(partial.headers.get('content-type'),'audio/mpeg');
  assert.equal(partial.headers.get('content-range'),'bytes 42-69/240');
  assert.equal(partial.headers.get('content-length'),'28');
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()),source.subarray(42,70));
  const ending=await fetch(url,{headers:{Range:'bytes=-9'}});
  assert.equal(ending.status,206);
  assert.deepEqual(Buffer.from(await ending.arrayBuffer()),source.subarray(-9));
  const beyond=await fetch(url,{headers:{Range:'bytes=400-500'}});
  assert.equal(beyond.status,416);
 }finally{
  server.kill('SIGTERM');
  rmSync(file,{force:true});
 }
});
