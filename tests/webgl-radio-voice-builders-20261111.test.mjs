import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Soundscape,preferredGermanVoice} from '../dist/src/reborn/audio.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {submitConstruction} from '../scripts/webgl-builder-input.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('German warning voices work on Chromium/macOS even without localService flag',()=>{
 const remoteGerman={lang:'de-DE',localService:false,name:'Deutsch Chrome'};
 const localGerman={lang:'de-AT',localService:true,name:'Deutsch macOS'};
 const english={lang:'en-US',localService:true,name:'English'};
 assert.equal(preferredGermanVoice([english,remoteGerman]),remoteGerman);
 assert.equal(preferredGermanVoice([remoteGerman,localGerman]),localGerman);
 assert.equal(preferredGermanVoice([english]),null);
 assert.equal(preferredGermanVoice([]),null,'browser uses de-DE default while voices load');
});

test('building completion is NOT lost if the radio is busy; it plays once channel clears',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 const oldSpeech=globalThis.SpeechSynthesisUtterance;
 const spoke=[];
 const voice={lang:'de-DE',localService:false,name:'Chrome German'};
 const synth={speaking:false,getVoices:()=>[voice],
  speak:u=>{spoke.push(u);},cancel:()=>{}};
 globalThis.window={speechSynthesis:synth};
 globalThis.document={hidden:false};
 globalThis.SpeechSynthesisUtterance=class {
  constructor(text){this.text=text}
 };
 try{
  const sound=new Soundscape();
  // Fake only the running audio clock: tones are silent in Node and no
  // browser AudioContext or network TTS is used by this regression test.
  sound.context={state:'running',currentTime:25};
  Object.defineProperty(sound.radio,'active',{configurable:true,value:1});
  sound.announceReady('building');
  assert.equal(spoke.length,0,'never talk over the unit radio');
  Object.defineProperty(sound.radio,'active',{configurable:true,value:0});
  sound.flushReadySpeech();
  assert.equal(spoke.length,1);
  assert.equal(spoke[0].text,'Bau abgeschlossen.');
  assert.equal(spoke[0].lang,'de-DE');
  assert.equal(spoke[0].voice,voice,
   'non-localService German browser voice must not be silently filtered');
  sound.flushReadySpeech();
  assert.equal(spoke.length,1,'do not repeatedly speak the same completion');
  sound.context.currentTime+=2;
  sound.announceAttack();
  assert.equal(spoke.at(-1).text,'Captain, wir werden angegriffen!');
  assert.equal(spoke.at(-1).voice,voice);
  sound.context.currentTime+=3;
  sound.announceReady('building');
  assert.equal(spoke.at(-1).text,'Bau abgeschlossen.');
  sound.setEnabled(false);
  sound.announceReady('building');
  assert.equal(spoke.length,3,'mute prevents additional speech');
 }finally{
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldSpeech===undefined)delete globalThis.SpeechSynthesisUtterance;
  else globalThis.SpeechSynthesisUtterance=oldSpeech;
 }
});

test('game keeps a real spoken German unit-ready cue and real attack-notice hook',()=>{
 const audio=source('src/reborn/audio.ts'),preview=source('scripts/webgl-preview.js');
 const battlefield=source('scripts/webgl-battlefield.js');
 assert.match(audio,/this\.announceReady\('unit'\)/);
 assert.match(audio,/this\.pendingReadySpeech=kind/);
 assert.match(audio,/if\(active\)this\.flushReadySpeech\(\)/);
 assert.match(preview,/sound\.announceAttack\(\)/);
 assert.match(battlefield,/this\.sound\.announceReady\('building'\)/);
});

function placeSite(game,kind,around,workers){
 for(let r=260;r<900;r+=90)for(let j=0;j<32;j++){
  const a=j*2*Math.PI/32,p={x:Math.round(around.x+r*Math.cos(a)),
   y:Math.round(around.y+r*Math.sin(a))};
  if(game.buildError(0,kind,p)!==null)continue;
  const created=submitConstruction(game,kind,p,new Set(workers.map(u=>u.id)));
  if(created.base)return created;
 }
 assert.fail('could not place '+kind);
}

test('REAL game: two selected pioneers do not block each other at a single site',()=>{
 const g=new Simulation(20261111,19);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 g.credits[0]=25000;g.explored[0].fill(1);
 const pioneer=g.units.find(u=>u.kind==='engineer'&&u.owner===0);
 assert.ok(pioneer);
 const location=g.world.nearest({x:pioneer.x+170,y:pioneer.y+95},g.obstacles())??
  {x:pioneer.x+170,y:pioneer.y+95};
 const second=g.spawn(0,location,'engineer');
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const first=placeSite(g,'barracks',hq,[pioneer,second]);
 assert.equal(first.workers.length,1,'never send two builders to one entrance');
 assert.equal(first.workers[0].orders[0].target,first.base.id);
 const idle=[pioneer,second].find(u=>u.id!==first.workers[0].id);
 assert.deepEqual(idle.orders,[],'second pioneer stays free for another job');
 for(let n=0;n<100&&g.status==='playing';n++)g.step(.05);
 assert.deepEqual(idle.orders,[],'automatic scheduler may not crowd a staffed site');
});

test('REAL game: idle engineer automatically seeks a DIFFERENT unattended site',()=>{
 const g=new Simulation(20261111,19);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 g.credits[0]=25000;g.explored[0].fill(1);
 const pioneer=g.units.find(u=>u.kind==='engineer'&&u.owner===0);
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const first=placeSite(g,'barracks',hq,[pioneer]);
 const location=g.world.nearest({x:pioneer.x+160,y:pioneer.y+60},g.obstacles())??
  {x:pioneer.x+160,y:pioneer.y+60};
 const second=g.spawn(0,location,'engineer');
 // Intentionally queue site two on the busy first worker, leaving site two
 // with zero active builders. The idle second pioneer must pick it up.
 const extra=placeSite(g,'generator',hq,[pioneer]);
 assert.ok(extra.base);
 assert.equal(second.orders.length,0);
 for(let n=0;n<85&&g.status==='playing'&&
  second.orders[0]?.target!==extra.base.id;n++)g.step(.05);
 assert.equal(second.orders[0]?.target,extra.base.id,
  'idle reinforcement takes ONLY the otherwise unattended generator');
 assert.equal(pioneer.orders[0]?.target,first.base.id,
  'the first pioneer keeps his active barracks work');
});

test('REAL game: two construction sites get one pioneer each and advance independently',()=>{
 const g=new Simulation(20261111,19);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 g.credits[0]=25000;g.explored[0].fill(1);
 const pioneer=g.units.find(u=>u.kind==='engineer'&&u.owner===0);
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const second=g.spawn(0,g.world.nearest({x:pioneer.x+100,y:pioneer.y+70},
  g.obstacles())??{x:pioneer.x+100,y:pioneer.y+70},'engineer');
 const one=placeSite(g,'barracks',hq,[pioneer,second]);
 assert.equal(one.workers.length,1);
 const unassigned=[pioneer,second].find(u=>u.id!==one.workers[0].id);
 assert.equal(unassigned.orders.length,0);
 const two=placeSite(g,'generator',hq,[pioneer,second]);
 assert.deepEqual(two.workers.map(u=>u.id),[unassigned.id]);
 assert.equal(two.append,false,'second site starts immediately');
 const ids=[pioneer,second].map(u=>u.orders[0]?.target).sort();
 assert.deepEqual(ids,[one.base.id,two.base.id].sort());
 const previous=[one.base.buildRemaining,two.base.buildRemaining];
 for(let n=0;n<1200&&g.status==='playing'&&
  (one.base.buildRemaining>=previous[0]||two.base.buildRemaining>=previous[1]);n++)
  g.step(.05);
 assert.ok(one.base.buildRemaining<previous[0]);
 assert.ok(two.base.buildRemaining<previous[1]);
});
