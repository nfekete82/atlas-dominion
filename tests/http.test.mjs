import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';

const availablePort = () => new Promise((resolve,reject)=>{
  const socket=net.createServer();
  socket.on('error',reject);
  socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});
});
const waitReady=async(base,proc)=>{
  for(let i=0;i<50;i++){
    if(proc.exitCode!==null)throw new Error(`Server exit code ${proc.exitCode}`);
    try {const r=await fetch(base);if(r.ok)return; }catch{}
    await new Promise(r=>setTimeout(r,60));
  }
  throw new Error('HTTP server did not become ready');
};

test('Prebuilt client serves HTML, CSS, JS and no source secrets',async()=>{
  const port=await availablePort();
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:'ignore'});
  try{
    const base=`http://127.0.0.1:${port}`;
    await waitReady(base,server);
    const html=await fetch(base+'/').then(r=>r.text());
    assert.match(html,/ATLAS DOMINION/);
    assert.match(html,/id="countryPicker"/);
    assert.match(html,/id="countrySearch"/);
    assert.match(html,/id="countryGrid"/);
    assert.match(html,/id="playerName"/);
    assert.match(html,/id="buildMenu"/);
    assert.match(html,/id="cityCount"/);
    assert.match(html,/id="moneyCount"/);
    for(const id of ["mobileTroops","frontTroops","offensiveTroops","fallenTroops"])assert.ok(html.includes(`id="${id}"`),id);
    for(const [path,contentType] of [['/style.css','text/css'],['/src/main.js','text/javascript'],['/src/engine/game.js','text/javascript'],['/src/data/europe.js','text/javascript'],['/src/data/countries.js','text/javascript'],['/src/engine/economy.js','text/javascript'],['/src/render/building-markers.js','text/javascript']]){
      const response=await fetch(base+path);
      assert.equal(response.status,200,path);
      assert.ok(response.headers.get('content-type').includes(contentType),path);
      assert.ok((await response.text()).length>10,path);
    }
    assert.equal((await fetch(base+'/README.md')).status,404);
    assert.equal((await fetch(base+'/../package.json')).status,404);
  }finally{server.kill();}
});
