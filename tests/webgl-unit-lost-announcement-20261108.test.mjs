import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UnitLossMonitor} from '../dist/src/reborn/unit-loss-monitor.js';
import {Soundscape} from '../dist/src/reborn/audio.js';

const unit=(id,owner=0,extras={})=>({id,owner,kind:'infantry',hp:100,...extras});

test('friendly casualties are detected exactly once, enemies are not',()=>{
 const m=new UnitLossMonitor();
 const units=[unit(1),unit(2),unit(3,1),unit(4,1)];
 m.reset(units,0);
 assert.equal(m.poll(units,.05),0);
 assert.equal(m.poll(units.filter(u=>u.id!==3),.10),0,'enemy loss is silent');
 const next=units.filter(u=>![1,3].includes(u.id));
 assert.equal(m.poll(next,.15),1);
 assert.equal(m.poll(next,.15),0,'repeat frame does not announce twice');
 assert.equal(m.poll(next,.20),0);
 assert.equal(m.poll(next.map(u=>({...u})),.25),0);
});

test('boarding, disembark and production are not casualties',()=>{
 const m=new UnitLossMonitor();
 const living=[unit(5),unit(6,0,{carrier:20}),unit(20),unit(90,1)];
 m.reset(living,0);
 assert.equal(m.poll(living.map(u=>u.id===6?{...u,carrier:null}:u),.05),0);
 assert.equal(m.poll([...living,unit(7)],.10),0,'production is not loss');
 assert.equal(m.poll([...living.filter(u=>u.id!==5),unit(7)],.15),1);
 assert.equal(m.poll([unit(6,0,{carrier:20}),unit(7),unit(90,1)],.25),1,'lost transport counts');
 assert.equal(m.poll([unit(90,1)],.30),2,'passengers lost with carrier count');
});

test('monitor resets after loading another game',()=>{
 const monitor=new UnitLossMonitor();
 monitor.reset([unit(1)],18);
 assert.equal(monitor.poll([],18),0);
 assert.equal(monitor.poll([],18.05),1);
 monitor.reset([unit(55,1),unit(56)],0);
 assert.equal(monitor.poll([unit(55,1),unit(56)],.05),0);
 assert.equal(monitor.poll([],NaN),0);
});

test('soundscape uses German local voice, batches multiple deaths, respects mute and cooldown',()=>{
 const originalDoc=globalThis.document,originalWin=globalThis.window,
  originalUtterance=globalThis.SpeechSynthesisUtterance;
 let messages=[],cancels=0,toneCalls=[];
 try{
  globalThis.document={hidden:false};
  globalThis.SpeechSynthesisUtterance=class {
   constructor(text){this.text=text;}
  };
  globalThis.window={speechSynthesis:{
   getVoices:()=>[{lang:'de-DE',localService:true,name:'System German'}],
   cancel:()=>{cancels++;},
   speak:u=>messages.push(u)
  }};
  const sound=new Soundscape();
  sound.context={currentTime:10,state:'running'};
  sound.tone=(...args)=>toneCalls.push(args);
  assert.equal(sound.played.losses,0);
  sound.announceUnitLost();
  assert.equal(sound.played.losses,1);
  assert.equal(messages[0].text,'Einheit verloren');
  assert.equal(messages[0].lang,'de-DE');
  assert.ok(messages[0].volume>0&&messages[0].volume<=.70);
  assert.equal(toneCalls.length,2);
  assert.equal(cancels,1);
  sound.announceUnitLost();
  assert.equal(sound.played.losses,1,'at most once during a burst');
  sound.context.currentTime=13;
  sound.announceUnitLost();
  assert.equal(sound.played.losses,2);
  sound.setEnabled(false);
  sound.announceUnitLost();
  assert.equal(sound.played.losses,2,'mute suppresses speech and tones');
 }finally{
  if(originalDoc===undefined)delete globalThis.document;
  else globalThis.document=originalDoc;
  if(originalWin===undefined)delete globalThis.window;
  else globalThis.window=originalWin;
  if(originalUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;
  else globalThis.SpeechSynthesisUtterance=originalUtterance;
 }
});

test('a new soundscape tracks only own losses, including outside camera',()=>{
 const oldDocument=globalThis.document;
 try{
  globalThis.document={hidden:false};
  const g={time:0,paused:false,territories:[],units:[unit(1),unit(2,1),unit(3)]};
  const sound=new Soundscape();
  sound.bindGame(g);
  let warnings=0;
  sound.announceUnitLost=()=>{warnings++;};
  g.time=.05;
  g.units=g.units.filter(u=>u.id!==2);
  assert.equal(sound.reportUnitLosses(g),0);
  g.time=.10;
  g.units=g.units.filter(u=>u.id!==1);
  assert.equal(sound.reportUnitLosses(g),1);
  assert.equal(warnings,1);
  g.time=.10;
  assert.equal(sound.reportUnitLosses(g),0);
  assert.equal(warnings,1);
  g.time=.15;
  g.units=g.units.filter(u=>u.id!==3);
  assert.equal(sound.reportUnitLosses(g),1);
  assert.equal(warnings,2);
 }finally{
  if(oldDocument===undefined)delete globalThis.document;
  else globalThis.document=oldDocument;
 }
});

test('real WebGL invokes loss reporting after simulation and writes a HUD notice',()=>{
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(source,/sound\.reportUnitLosses\(game\)/);
 assert.match(source,/battlefield\.message\(lost===1\?'Einheit verloren'/);
 assert.match(source,/if\(running\)\{\s*accumulator=/);
 assert.match(audio,/this\.unitLosses\.reset\(g\.units,g\.time\)/);
 assert.match(audio,/new SpeechSynthesisUtterance\('Einheit verloren'\)/);
 assert.match(audio,/a\.currentTime-this\.lastLossSignal<2\.8/);
 assert.match(audio,/german\.find\(v=>v\.localService\)\?\?german\[0\]/);
});
