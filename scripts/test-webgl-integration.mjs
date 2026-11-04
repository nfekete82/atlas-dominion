import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const host='127.0.0.1';
const playwright=resolve(root,'tests/browser/node_modules/.bin/playwright');
const config='tests/browser/playwright.config.mjs';
const specs=[
  'tests/browser/webgl-territory-rally-cliffs.spec.mjs',
  'tests/browser/webgl-playable.spec.mjs',
  'tests/browser/webgl-construction-audio.spec.mjs',
  'tests/browser/webgl-classic-parity.spec.mjs',
  'tests/browser/webgl-visual-parity.spec.mjs',
  'tests/browser/webgl-settings-close.spec.mjs'
];

function reservePort(){
  return new Promise((resolvePort,reject)=>{
    const socket=createServer();
    socket.once('error',reject);
    socket.listen(0,host,()=>{
      const port=socket.address().port;
      socket.close(error=>error?reject(error):resolvePort(port));
    });
  });
}
function waitForExit(child){
  return new Promise(resolveExit=>child.once('exit',(code,signal)=>resolveExit({code,signal})));
}
async function ready(port,server){
  const url='http://'+host+':'+port+'/healthz';
  for(let i=0;i<50;i++){
    if(server.exitCode!==null)throw new Error('Preview server exited before health check');
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(1200)});
      if(response.ok)return;
    }catch{}
    await delay(200);
  }
  throw new Error('Preview server not ready at '+url);
}

let server,tests;
const shutdown=()=>{
  if(tests&&!tests.killed)tests.kill('SIGTERM');
  if(server&&!server.killed)server.kill('SIGTERM');
};
process.once('SIGINT',()=>{shutdown();process.exitCode=130;});
process.once('SIGTERM',()=>{shutdown();process.exitCode=143;});
try{
  const port=await reservePort();
  const base='http://'+host+':'+port;
  console.log('Sandforge integration server:',base);
  server=spawn(process.execPath,['scripts/serve.mjs'],{
    cwd:root,env:{...process.env,PORT:String(port),HOST:host},
    stdio:['ignore','inherit','inherit']
  });
  await ready(port,server);
  tests=spawn(playwright,['test','--config='+config,...specs,'--workers=2','--max-failures=3','--reporter=line'],{
    cwd:root,
    env:{...process.env,ATLAS_BASE_URL:base},
    stdio:'inherit'
  });
  const outcome=await waitForExit(tests);
  process.exitCode=outcome.code??1;
}catch(error){
  console.error('WebGL integration test failed:',error.message);
  process.exitCode=1;
}finally{
  shutdown();
  if(server&&server.exitCode===null)await Promise.race([waitForExit(server),delay(2000)]);
}
