import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {UPGRADES,UPGRADE_KINDS} from '../dist/src/reborn/strategic-tech.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const battlefield=source('scripts/webgl-battlefield.js');
const hud=source('scripts/webgl-classic-hud.js');
const css=source('src/reborn/webgl-classic-hud.css');

test('the global dock has four stable category tabs, no production-building selection needed',()=>{
 for(const [tab,name] of [
  ['buildings','GEBÄUDE'],['infantry','INFANTERIE'],
  ['vehicles','FAHRZEUGE'],['research','FORSCHUNG']]){
  assert.match(hud,new RegExp('data-tab="'+tab+'"[^>]*>'+name+'</button>'));
  assert.ok(battlefield.includes('data-sf-group="'+tab+'"')||
   battlefield.includes("data-sf-group=\\\""+tab+"\\\""));
  assert.ok(css.includes('[data-tab="'+tab+'"]'),
   'missing CSS for category '+tab);
 }
 assert.equal((hud.match(/<button data-tab=/g)||[]).length,4);
 assert.ok(hud.includes('panel.dataset.tab=\'buildings\''),'building tab initially shown');
 assert.ok(hud.includes('data-action="sectors"'),'sector navigation remains accessible');
 assert.ok(battlefield.includes('g.producer(0,unit)')||
  battlefield.includes('this.game.producer(0,unit)'),
  'production routes to authoritative global producer');
 assert.ok(!battlefield.includes("section.hidden=!context.producer"),
  'selectedBase must never hide another production building');
 assert.ok(battlefield.includes('const researchOnline=g.bases.some('));
});

const setup=()=>{
 const g=new Simulation(20261111,19);
 g.credits[0]=100000;
 let id=500000;
 const add=kind=>{
  const b={id:id++,kind,owner:0,x:2000,y:2000,hp:BUILDINGS[kind].hp,
   buildRemaining:0,radius:BUILDINGS[kind].radius,territory:0,
   queue:[],queueTypes:[],production:0,cooldown:0,rally:null};
  g.bases.push(b);return b;
 };
 return {g,add};
};

test('real simulation automatically chooses barracks/factory/airfield despite no selection',()=>{
 const {g,add}=setup();
 assert.equal(g.producer(0,'infantry'),undefined);
 const barracks=add('barracks'),factory=add('factory'),airfield=add('airfield');
 const cases=[
  ['engineer','headquarters'],['infantry','barracks'],['medic','barracks'],
  ['heavy','barracks'],['rocket','barracks'],
  ['rover','factory'],['tank','factory'],['artillery','factory'],
  ['scout','airfield'],['bomber','airfield']
 ];
 for(const [kind,sourceKind] of cases){
  const producer=g.producer(0,kind);
  assert.ok(producer,'global producer missing for '+kind);
  assert.equal(producer.kind,sourceKind);
  assert.equal(g.recruit(producer.id,kind),true,
   'global card must enqueue '+kind+' in real game');
  assert.ok(producer.queueTypes.includes(kind));
 }
 assert.equal(barracks.queueTypes.length,4);
 assert.equal(factory.queueTypes.length,3);
 assert.equal(airfield.queueTypes.length,2);
 assert.equal(g.count(0)+g.queued(0)<=48,true);
});

test('actual HUD click queues from auto-detected producer even if nothing is selected',()=>{
 const {g,add}=setup();
 add('barracks');add('factory');add('airfield');add('research');
 const listeners=new Map();
 const actions={scrollTop:50};
 const detail={textContent:''};
 const panel={dataset:{tab:'vehicles'},
  addEventListener:(name,cb)=>listeners.set(name,cb),
  querySelector(selector){
   if(selector==='#sf-map')return {addEventListener(){}};
   if(selector==='#sf-actions')return actions;
   if(selector==='#sf-catalog-detail')return detail;
   throw Error('Unexpected selector '+selector);
  }};
 const constructor=new Function('installClassicHud','BUILDINGS','UNITS','UPGRADES',
  'INTERCEPTOR_ENABLED','return class TestUI {'+
  battlefield.slice(battlefield.indexOf(' buildInterface(){'),
   battlefield.indexOf('\n saveGame(){',battlefield.indexOf(' buildInterface(){')))+
  '}');
 const UI=constructor(()=>panel,BUILDINGS,UNITS,UPGRADES,true);
 const ui=new UI();
 ui.game=g;ui.selected=new Set();ui.selectedBase=null;
 ui.sound={enabled:false};
 const messages=[];
 ui.message=s=>messages.push(s);
 ui.drawInterface=()=>{};
 ui.catalogContext=()=>({producer:null,engineer:false,canBuild:true});
 ui.buildInterface();
 const click=(dataset)=>listeners.get('click')({
  target:{closest:()=>({dataset})}
 });
 click({unit:'infantry'});
 click({unit:'tank'});
 click({unit:'bomber'});
 assert.equal(ui.selectedBase,null,'never auto-select a facility to train units');
 const queued=g.bases.flatMap(b=>b.queueTypes);
 assert.ok(queued.includes('infantry'));
 assert.ok(queued.includes('tank'));
 assert.ok(queued.includes('bomber'));
 assert.ok(messages.every(m=>!m.includes('auswählen')),
  'global training must never request clicking a production building');
 const freeTech=UPGRADE_KINDS.find(kind=>!UPGRADES[kind].requires);
 assert.ok(freeTech);
 ui.selectedBase=null;
 click({upgrade:freeTech});
 assert.equal(g.research[0].active,freeTech,
  'lab research must start without selecting research facility');
 assert.equal(ui.selectedBase,null);
 for(const tab of ['buildings','infantry','vehicles','research']){
  listeners.get('sandforge-tabchange')({detail:{tab}});
  assert.equal(panel.dataset.tab,'vehicles',
   'tab events must only change the clicked view, not force an unrelated selection');
 }
});

test('new production sources become available on completion, not while under construction',()=>{
 const {g,add}=setup();
 const barracks=add('barracks'),factory=add('factory'),airfield=add('airfield');
 for(const b of [barracks,factory,airfield])b.buildRemaining=12;
 assert.equal(g.producer(0,'infantry'),undefined);
 assert.equal(g.producer(0,'tank'),undefined);
 assert.equal(g.producer(0,'bomber'),undefined);
 factory.buildRemaining=0;
 assert.equal(g.producer(0,'tank')?.id,factory.id);
 assert.equal(g.producer(0,'bomber'),undefined);
 const lab=add('research');
 lab.buildRemaining=5;
 const tech=UPGRADE_KINDS.find(k=>!UPGRADES[k].requires);
 assert.equal(g.startResearch(0,tech),false,'incomplete lab cannot start tech');
 lab.buildRemaining=0;
 assert.equal(g.startResearch(0,tech),true);
});

test('more than one producer sends work to the shortest available queue',()=>{
 const {g,add}=setup();
 const first=add('factory'),second=add('factory');
 first.queueTypes=['rover','tank','rover'];
 first.queue=[11,18,11];first.production=2;
 assert.equal(g.producer(0,'tank')?.id,second.id);
 assert.ok(g.recruit(second.id,'tank'));
 assert.equal(second.queueTypes[0],'tank');
});
