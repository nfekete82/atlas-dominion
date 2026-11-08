import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Execute the shipped pause menu itself (without a browser). The fixture
// models the real document keyboard listener, modal lifecycle and game API.
const source=readFileSync(new URL('../scripts/webgl-title-menu.js',import.meta.url),'utf8');
class FakeElement {
 constructor(){this.open=false;this.hidden=false;this.disabled=false;this.textContent='';this.value='';
  this.checked=false;this.listeners=new Map();this.isEditable=false;this.tagName='BUTTON';}
 addEventListener(type,callback){const list=this.listeners.get(type)??[];list.push(callback);this.listeners.set(type,list);}
 fire(type,event={}){for(const cb of this.listeners.get(type)??[])cb(event);}
 showModal(){this.open=true;}
 close(){this.open=false;this.fire('close');}
 click(){this.fire('click');}
 matches(selector){return this.isEditable&&selector.includes('contenteditable');}
 setAttribute(){}
}
function fixture({credits=500,loaded=true,status='playing',running=true}={}){
 const nodes=new Map(),get=id=>{
  if(!nodes.has(id))nodes.set(id,new FakeElement());
  return nodes.get(id);
 };
 const handlers=new Map();
 const document={
  getElementById:get,
  querySelectorAll:()=>[],
  addEventListener:(type,handler)=>{const old=handlers.get(type)??[];old.push(handler);handlers.set(type,old);}
 };
 let refreshed=0;
 const game={credits:[credits,500],status};
 const runtime={loaded,simulationRunning:running,game,battlefield:{drawInterface(){refreshed++;}}};
 const window={__sandforgeWebGL:runtime};
 const location={search:'',pathname:'/webgl-preview.html',assign(){}};
 const localStorage={getItem:()=>null,setItem(){}};
 get('simulation').addEventListener('click',()=>{runtime.simulationRunning=!runtime.simulationRunning;});
 runInNewContext(source,{document,window,location,localStorage,URLSearchParams,Element:FakeElement,console,Math,JSON,Number,Uint32Array});
 // The initial title modal is closed by starting a campaign in the real UI.
 get('main-dialog').close();
 const press=(letter,overrides={})=>{
  let prevented=false,stopped=false;
  const event={
   key:letter,code:letter===' '?'Space':'Key'+letter.toUpperCase(),
   repeat:false,ctrlKey:false,metaKey:false,altKey:false,target:new FakeElement(),
   preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;},
   ...overrides
  };
  for(const handler of handlers.get('keydown')??[]){
   if(stopped)break;
   handler(event);
  }
  return {prevented,stopped};
 };
 const type=text=>[...text].forEach(letter=>press(letter));
 return {nodes,get,runtime,game,press,type,
  openPause:()=>window.Sandforge3DMenu.openPause(),
  get refreshed(){return refreshed;}};
}

test('IDDQD grants precisely 1,000 player credits while tactical pause is open, repeats, updates HUD, no game tick',()=>{
 const f=fixture();
 f.type('iddqd');assert.equal(f.game.credits[0],500,'code does not work while playing');
 f.openPause();
 assert.equal(f.get('sf3d-pause-dialog').open,true);
 assert.equal(f.runtime.simulationRunning,false);
 f.type('iddq');assert.equal(f.game.credits[0],500,'incomplete code has no effect');
 const last=f.press('d');
 assert.equal(last.prevented,true);
 assert.equal(last.stopped,true,'background movement hotkeys should not run');
 assert.equal(f.game.credits[0],1500);
 assert.equal(f.game.credits[1],500,'enemy credits remain unchanged');
 assert.equal(f.refreshed,1,'HUD must update immediately, without unpausing');
 assert.match(f.get('sf3d-pause-status').textContent,/\+1\.000 CREDITS/);
 assert.equal(f.runtime.simulationRunning,false);
 f.type('iddqd');assert.equal(f.game.credits[0],2500);
 assert.equal(f.refreshed,2);
 f.get('sf3d-pause-resume').click();
 assert.equal(f.get('sf3d-pause-dialog').open,false);
 assert.equal(f.runtime.simulationRunning,true);
 f.type('iddqd');assert.equal(f.game.credits[0],2500);
});

test('code is case-insensitive; wrong letters, spaces and pause reopening reset sequence',()=>{
 const f=fixture();
 f.openPause();
 f.type('idxxd');assert.equal(f.game.credits[0],500);
 f.type('IdDqD');assert.equal(f.game.credits[0],1500);
 f.type('iddq');
 f.get('sf3d-pause-resume').click();
 f.openPause();
 f.press('d');
 assert.equal(f.game.credits[0],1500,'partial code must not survive pause/reopen');
 f.type('id dq d');assert.equal(f.game.credits[0],1500,'spaces break the sequence');
 f.type('iddqd');assert.equal(f.game.credits[0],2500);
});

test('editable inputs, modifiers, key repeats and nested options cannot trigger cheat',()=>{
 const f=fixture();
 f.openPause();
 f.press('i',{repeat:true});f.type('ddqd');
 assert.equal(f.game.credits[0],500);
 f.press('i',{ctrlKey:true});f.type('ddqd');
 assert.equal(f.game.credits[0],500);
 const editable=new FakeElement();editable.isEditable=true;
 f.press('i',{target:editable});f.type('ddqd');
 assert.equal(f.game.credits[0],500);
 f.get('sf3d-pause-options').click();
 assert.equal(f.get('sf3d-options-dialog').open,true);
 f.type('iddqd');assert.equal(f.game.credits[0],500);
 f.get('sf3d-options-dialog').close();
 f.type('iddqd');assert.equal(f.game.credits[0],1500);
});

test('never grants credits after the match or while game not loaded',()=>{
 const finished=fixture({status:'victory'});
 finished.openPause();finished.type('iddqd');
 assert.equal(finished.game.credits[0],500);
 const loading=fixture({loaded:false});
 loading.openPause();loading.type('iddqd');
 assert.equal(loading.game.credits[0],500);
 assert.equal(loading.get('sf3d-pause-dialog').open,false);
});

test('build embeds the real pause-menu script and leaves existing menu & saves intact',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 assert.match(build,/cpSync\('scripts\/webgl-title-menu\.js','dist\/webgl-title-menu\.js'\)/);
 assert.match(menu,/g\.credits\[0\]\+=1000/);
 assert.match(menu,/active\.battlefield\?\.drawInterface\?\.\(\)/);
 assert.match(menu,/pauseDialog\.open&&!menu\.open&&!newDialog\.open&&!optionsDialog\.open/);
 assert.match(menu,/\$\('sf3d-pause-save'\)\.addEventListener/);
});
