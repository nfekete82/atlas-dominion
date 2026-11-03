import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';

async function openPort() {
 const server=createServer();
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('OrbStack HTTP: health check and WebGL asset respond after ready, including HEAD', {timeout:18000}, async()=>{
 const port=await openPort();
 const child=spawn(process.execPath,['scripts/serve.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},
  stdio:'ignore'
 });
 try {
  const root='http://127.0.0.1:'+port;
  let ready=false;
  for(let i=0;i<70;i++) {
   if(child.exitCode!==null)throw new Error('HTTP server exited early with code '+child.exitCode);
   try {
    const res=await fetch(root+'/healthz',{signal:AbortSignal.timeout(700)});
    if(res.ok) {
     assert.deepEqual(await res.json(),{ok:true,service:'sandforge'});
     ready=true;break;
    }
   }catch {}
   await sleep(110);
  }
  assert.ok(ready,'server did not become healthy within readiness window');
  for(const path of ['/','/webgl-preview.html','/webgl-preview.js','/vendor/three/three.module.js','/src/assets/reborn/canyon-3d/ruin-house.gltf']){
   const response=await fetch(root+path,{method:'HEAD',signal:AbortSignal.timeout(3500)});
   assert.equal(response.status,200,'HEAD '+path+' must respond 200');
  }
  const page=await fetch(root+'/webgl-preview.html',{signal:AbortSignal.timeout(3500)});
  assert.equal(page.status,200);
  assert.match(page.headers.get('content-type'),/text\/html/);
  assert.match(await page.text(),/Three\.js WebGL 3D/);
 } finally {
  child.kill('SIGTERM');
 }
});
