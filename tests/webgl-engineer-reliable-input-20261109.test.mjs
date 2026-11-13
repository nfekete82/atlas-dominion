import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 pointerGestureIntent,availableEngineers,shouldAppendBuild,
 nearestEngineer,POINTER_CLICK_SLOP,PLACEMENT_CLICK_SLOP
} from '../scripts/webgl-builder-input.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

test('construction click tolerates natural pointer jitter and NEVER becomes a selection box',()=>{
 assert.equal(POINTER_CLICK_SLOP,12);
 assert.equal(PLACEMENT_CLICK_SLOP,24);
 for(const distance of [0,2,7,10,12,13,18,24]){
  assert.equal(pointerGestureIntent({distance,button:0,building:true}), 'click');
 }
 for(const distance of [25,80,150]){
  assert.equal(pointerGestureIntent({distance,button:0,building:true}), 'ignore-drag');
 }
 assert.equal(pointerGestureIntent({distance:35,button:0,rally:true}),'ignore-drag');
 assert.equal(pointerGestureIntent({distance:35,button:0,strategic:true}),'ignore-drag');
 assert.equal(pointerGestureIntent({distance:35,button:0}),'selection-box');
 assert.equal(pointerGestureIntent({distance:8,button:0}),'click');
 assert.equal(pointerGestureIntent({distance:80,button:2}),'ignore-drag');
 assert.equal(pointerGestureIntent({distance:0,button:2}),'click');
});

test('engineer recognition filters dead, embarked, enemy and non-engineer units',()=>{
 const units=[
  {id:1,owner:0,kind:'engineer',hp:80,carrier:null,x:15,y:20,orders:[]},
  {id:2,owner:0,kind:'engineer',hp:0,carrier:null,x:2,y:2,orders:[]},
  {id:3,owner:0,kind:'engineer',hp:75,carrier:123,x:7,y:7,orders:[]},
  {id:4,owner:1,kind:'engineer',hp:75,carrier:null,x:10,y:8,orders:[]},
  {id:5,owner:0,kind:'infantry',hp:75,carrier:null,x:2,y:8,orders:[]},
  {id:6,owner:0,kind:'engineer',hp:70,carrier:null,x:80,y:80,orders:[]}
 ];
 assert.deepEqual(availableEngineers(units,new Set([1,2,3,4,5])).map(u=>u.id),[1]);
 assert.equal(nearestEngineer(units,{x:77,y:79}).id,6);
 assert.equal(nearestEngineer(units,{x:16,y:21}).id,1);
 assert.equal(nearestEngineer(units.filter(u=>u.hp===0),{x:0,y:0}),null);
});

test('new building is enqueued while pioneer builds another site',()=>{
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;g.credits[0]=5000;
 g.explored[0].fill(1);g.visible[0].fill(1);g.world.blocked.fill(0);
 g.units=g.units.filter(u=>u.owner!==0);
 const position=kind=>{
  for(let y=300;y<g.world.size-200;y+=32)for(let x=250;x<g.world.size-200;x+=32)
   if(!g.buildError(0,kind,{x,y}))return {x,y};
  throw Error('No legal construction site');
 };
 const aPos=position('barracks');
 const worker=g.spawn(0,g.world.nearest({x:aPos.x+BUILDINGS.barracks.radius+52,y:aPos.y},g.obstacles()),'engineer');
 const selection=new Set([worker.id]);
 const available=availableEngineers(g.units,selection);
 assert.deepEqual(available.map(u=>u.id),[worker.id]);
 assert.equal(shouldAppendBuild(available),false);
 const first=g.build(0,'barracks',aPos,[worker.id],0,shouldAppendBuild(available));
 assert.ok(first);
 assert.equal(shouldAppendBuild(available),true);
 const second=g.build(0,'turret',position('turret'),[worker.id],0,shouldAppendBuild(available));
 assert.ok(second);
 assert.deepEqual(worker.orders.map(o=>o.kind),['build','build']);
 assert.deepEqual(worker.orders.map(o=>o.target),[first.id,second.id]);
 assert.equal(g.credits[0],5000-BUILDINGS.barracks.cost-BUILDINGS.turret.cost);
});

test('WebGL event pipeline protects build mode and lets users reselect a pioneer',()=>{
 const code=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(code,/pointerGestureIntent\(\{distance:moved,button:event\.button/);
 assert.match(code,/if\(gesture==='selection-box'\)/);
 assert.match(code,/if\(gesture==='ignore-drag'\)/);
 assert.match(code,/if\(this\.buildKind\|\|this\.rallyMode\|\|this\.strategicTargetMode\)return/);
 assert.match(code,/const hit=this\.friendlyAtPointer\(event\)/);
 assert.match(code,/if\(event\.button===0&&!this\.buildKind&&!this\.rallyMode&&!this\.strategicTargetMode\)/);
 assert.match(code,/this\.selected=new Set\(\[worker\.id\]\)/);
 assert.match(code,/submitConstruction\(this\.game,kind,p,this\.selected/);
 assert.match(code,/event\.code==='KeyP'/);
 assert.match(hud,/data-action="select-engineer"/);
 assert.match(build,/webgl-builder-input\.js/);
});

test('selection HUD has one bounded LP row in a single continuous screen-wide dock',()=>{
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const css=readFileSync('src/reborn/webgl-classic-hud.css','utf8');
 assert.match(ui,/class="sf-health-row"/);
 assert.match(ui,/healthPct\.toFixed\(1\)/);
 assert.match(ui,/sf-health-label/);
 assert.match(hud,/dock\.append\(panel\.querySelector\('#sf-selection-panel'\)\)/);
 assert.match(css,/grid-template-columns:var\(--sf-dock-radar\) minmax\(0,1fr\) var\(--sf-dock-production\) var\(--sf-dock-command\)/);
 assert.match(css,/\.sf-health-row \.health-track/);
});
