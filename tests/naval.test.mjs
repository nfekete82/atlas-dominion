import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Game,cellToPoint,pointToIndex,geoToCell,landNeighbors,WATER,NEUTRAL} from '../dist/src/engine/game.js';
import {MAP_WIDTH as W,MAP_HEIGHT as H} from '../dist/src/data/europe.js';
import {MaritimeNavigation,COASTS,NAV_LAND,validSeaRoute,voyageTicks,routeDistance} from '../dist/src/engine/navigation.js';
import {voyageGeometry,voyagePosition} from '../dist/src/render/sea-voyages.js';
function coast(lon,lat){const p=geoToCell(lon,lat);return COASTS.reduce((a,b)=>{const d=i=>(i%W-p.x)**2+(Math.floor(i/W)-p.y)**2;return d(b)<d(a)?b:a;});}
function fixture(from=[-3,53.4],to=[-6.1,53.3]){
  const g=new Game(52,3,'GB');for(const f of g.factions)f.ai=false;
  const a=coast(...from),b=coast(...to);g.owner[a]=0;g.owner[b]=NEUTRAL;g.factions[0].troops=1000;g.recount();g.rebuildFrontierCandidates();
  return {g,a,b};
}
function launch(f){const r=f.g.launchAttack(0,cellToPoint(f.b),35);assert.equal(r.ok,true,r.reason);return f.g.attackOrders.find(o=>o.landing);}
function stepLedger(g){const pop=g.populationOf(0),loss=g.factions[0].attackFallen;g.recount();const growth=g.factions[0].income;g.step();assert.ok(Math.abs(g.populationOf(0)-(pop+growth-(g.factions[0].attackFallen-loss)))<1e-6);}
for(const [label,from,to] of [
 ['Britain–Ireland',[-3,53.4],[-6.1,53.3]],['Norway–Iceland',[5,60],[-18,65]],
 ['Italy–Sardinia',[10.2,43.5],[9.6,40]],['Italy–Sicily',[15.8,38.2],[15.5,38.1]],
 ['France–Britain',[1.6,50.7],[1.3,51.1]],
])test(`real ocean route ${label} has adjacent water cells and real coastal endpoints`,()=>{
  const {g,a,b}=fixture(from,to),nav=new MaritimeNavigation(),route=nav.route(g.owner,0,b);
  assert.ok(route);assert.ok(validSeaRoute(route.cells));assert.equal(g.owner[route.cells[0]],0);assert.equal(route.cells.at(-1),b);
  for(const i of route.cells.slice(1,-1)){assert.equal(NAV_LAND[i],0);assert.ok(i>=0&&i<W*H);}
  assert.ok(route.distanceKm>0);assert.equal(route.distanceKm,routeDistance(route.cells));
});
test('normal left-click launch prefers real landfronts, otherwise sails to an island without Shift',()=>{
  const f=fixture(),order=launch(f);assert.ok(order.seaRoute);assert.equal(f.g.owner[f.b],NEUTRAL);
  const land=f.g.owner.findIndex((v,i)=>v===NEUTRAL&&landNeighbors(i).some(n=>f.g.owner[n]===0));
  assert.ok(f.g.launchAttack(0,cellToPoint(land),15).ok);assert.equal(f.g.attackOrders.at(-1).landing,false);
});
test('inland targets only reach coasts in their own connected owner region',()=>{
  const {g}=fixture();const inland=pointToIndex(geoToCell(25,52));g.owner[inland]=2;
  for(const n of landNeighbors(inland))if(g.owner[n]!==WATER)g.owner[n]=1;
  assert.equal(g.landingTarget(0,cellToPoint(inland)),null);
  assert.equal(g.landingTarget(0,{x:-1,y:5}),null);assert.equal(g.landingTarget(0,{x:W,y:H}),null);
});
test('route validator rejects land interiors, map edges, nonadjacent jumps and row wraps',()=>{
  const f=fixture(),r=new MaritimeNavigation().route(f.g.owner,0,f.b).cells;
  const land=f.g.owner.findIndex(v=>v===0),bad=r.slice();bad[1]=land;assert.equal(validSeaRoute(bad),false);
  for(const corrupt of [[r[0],-1,r.at(-1)],[r[0],W*H,r.at(-1)],[r[0],r.at(-1)],[]])assert.equal(validSeaRoute(corrupt),false);
  const jump=r.slice();jump.splice(1,2);assert.equal(validSeaRoute(jump),false);
});
test('coast ownership invalidates cached departure fields',()=>{
  const f=fixture(),nav=new MaritimeNavigation(),first=nav.route(f.g.owner,0,f.b);assert.ok(first);
  for(const i of COASTS)if(f.g.owner[i]===0)f.g.owner[i]=NEUTRAL;
  assert.equal(nav.route(f.g.owner,0,f.b),null);
});
test('real non-playable African and Asian land blocks navigation without acquiring game ownership',()=>{
 const g=new Game(55);
 for(const [lon,lat] of [[9.5,35.8],[38,35],[48,35]]){
   const i=pointToIndex(geoToCell(lon,lat));assert.equal(g.owner[i],WATER);assert.equal(NAV_LAND[i],1);
   assert.equal(g.canLand(0,cellToPoint(i)),false);
 }
 const sea=pointToIndex(geoToCell(7,38));assert.equal(NAV_LAND[sea],0);
});
test('distance controls bounded travel duration, with no combat before arrival',()=>{
  const short=fixture(),long=fixture([5,60],[-18,65]);const a=launch(short),b=launch(long);
  assert.ok(b.seaDistanceKm>a.seaDistanceKm);assert.ok(b.arrivalTick-b.startedTick>a.arrivalTick-a.startedTick);
  assert.equal(voyageTicks(0),8);assert.equal(voyageTicks(1e6),96);
  for(let n=1;n<a.arrivalTick;n++){stepLedger(short.g);assert.equal(short.g.owner[short.b],NEUTRAL);assert.equal(a.fallen,0);}
  stepLedger(short.g);assert.equal(short.g.owner[short.b],0);assert.ok(a.fallen>0);
});
test('departure, travel, landing and retreat conserve paid living soldiers minus real casualties',()=>{
  const f=fixture(),before=f.g.populationOf(0),reserve=f.g.factions[0].troops,o=launch(f);
  assert.equal(f.g.factions[0].troops,reserve-o.committed);assert.equal(f.g.populationOf(0),before);
  for(let i=0;i<o.arrivalTick+3;i++)stepLedger(f.g);
  if(f.g.attackOrders.includes(o)){const living=o.remaining;const reserve=f.g.factions[0].troops;assert.equal(f.g.cancelAttack(o.id),true);assert.equal(f.g.factions[0].troops,reserve+living);}
});
test('canceling a sailing fleet returns along its route and refunds survivors only on return',()=>{
  const f=fixture(),o=launch(f);for(let i=0;i<3;i++)stepLedger(f.g);
  const geom=voyageGeometry(o.seaRoute),turn=voyagePosition(o,f.g.tick,geom),reserve=f.g.factions[0].troops;
  assert.ok(f.g.cancelAttack(o.id));assert.equal(o.returning,true);assert.equal(f.g.factions[0].troops,reserve);
  assert.deepEqual(voyagePosition(o,f.g.tick,geom),turn);
  while(f.g.tick<o.returnArrivalTick)stepLedger(f.g);
  assert.ok(!f.g.attackOrders.includes(o));assert.equal(f.g.owner[f.b],NEUTRAL);
});
for(const what of ['departure','target'])test(`lost ${what} safely turns an expedition back`,()=>{
  const f=fixture(),o=launch(f);f.g.step();f.g.step();f.g.owner[what==='departure'?o.seaRoute[0]:f.b]=2;
  f.g.step();assert.equal(o.returning,true);
  while(f.g.tick<o.returnArrivalTick)stepLedger(f.g);
  assert.ok(!f.g.attackOrders.includes(o));assert.notEqual(f.g.owner[f.b],0);
});
test('pause freezes simulation, fleet position and route progress; resume continues',()=>{
  const f=fixture(),o=launch(f);f.g.step();f.g.paused=true;const save=f.g.exportSave(),geom=voyageGeometry(o.seaRoute),pos=voyagePosition(o,f.g.tick,geom);
  for(let i=0;i<20;i++)f.g.step();assert.deepEqual(f.g.exportSave(),save);assert.deepEqual(voyagePosition(o,f.g.tick,geom),pos);
  f.g.paused=false;f.g.step();assert.notDeepEqual(voyagePosition(o,f.g.tick,geom),pos);
});
for(const returning of [false,true])test(`save/load deterministic replay of ${returning?'returning':'outbound'} fleets`,()=>{
  const f=fixture(),o=launch(f);f.g.step();f.g.step();if(returning)f.g.cancelAttack(o.id);
  const save=JSON.parse(JSON.stringify(f.g.exportSave())),restored=Game.fromSave(save);assert.deepEqual(restored.exportSave(),save);
  for(let i=0;i<35;i++){f.g.step();restored.step();}assert.deepEqual(restored.exportSave(),f.g.exportSave());
});
test('legacy v1 fixed-crossing voyage migrates to a legal route with preserved elapsed fraction and troops',()=>{
  const f=fixture(),o=launch(f);f.g.step();f.g.step();const save=f.g.exportSave(),old=save.attackOrders[0];delete old.seaRoute;delete old.seaDistanceKm;old.arrivalTick=old.startedTick+8;
  const restored=Game.fromSave(save),m=restored.attackOrders[0];assert.ok(validSeaRoute(m.seaRoute));assert.equal(restored.populationOf(0),f.g.populationOf(0));
  assert.ok(Math.abs((restored.tick-m.startedTick)/(m.arrivalTick-m.startedTick)-.25)<.13);
  assert.deepEqual(Game.fromSave(restored.exportSave()).exportSave(),restored.exportSave());
});
test('malformed saved routes or nonfinite voyage times are rejected',()=>{
  const f=fixture();launch(f);const save=f.g.exportSave();save.attackOrders[0].seaRoute[1]=-1;assert.throws(()=>Game.fromSave(save),/Seeroute/);
  const timing=f.g.exportSave();timing.attackOrders[0].arrivalTick=NaN;assert.throws(()=>Game.fromSave(timing),/Reisezeit/);
});
test('AI launches while land expansion remains available, uses real reserves and limits parallel fleets',()=>{
  const f=fixture();f.g.factions[0].ai=true;assert.ok(f.g.chooseFront(0)>=0);
  const reserve=f.g.factions[0].troops;assert.equal(f.g.tryNavalAttack(0,35),true);
  const o=f.g.attackOrders.at(-1);assert.ok(o.seaRoute);assert.equal(f.g.factions[0].troops,reserve-o.committed);
  assert.equal(f.g.tryNavalAttack(0,35),false);
});
test('AI coastal invasion waits for mobilization window and refuses a superior defender',()=>{
  const f=fixture();for(const i of f.g.owner.keys())if(f.g.owner[i]===NEUTRAL)f.g.owner[i]=1;
  f.g.tick=100;f.g.recount();assert.equal(f.g.tryNavalAttack(0,35),true);assert.ok(f.g.attackOrders.at(-1).targetOwner>=0);
  const weak=fixture();for(let i=0;i<weak.g.owner.length;i++)if(weak.g.owner[i]===NEUTRAL)weak.g.owner[i]=1;
  weak.g.tick=100;weak.g.factions[0].troops=90;weak.g.factions[1].troops=1e6;weak.g.recount();assert.equal(weak.g.tryNavalAttack(0,35),false);
});
test('maritime AI respects peaceful opening and existing multi-nation anti-dogpile limits',()=>{
  const f=fixture();for(let i=0;i<f.g.owner.length;i++)if(f.g.owner[i]===NEUTRAL)f.g.owner[i]=1;
  f.g.recount();assert.equal(f.g.tryNavalAttack(0,35),false);
  f.g.tick=100;
  for(const id of [2,3])f.g.attackOrders.push({id:100+id,factionId:id,targetOwner:1,anchor:cellToPoint(f.b),remaining:8,committed:8,effort:10,fallen:0,conquered:0});
  assert.equal(f.g.tryNavalAttack(0,35),false);
});
test('cached water fields serve 100 parallel route requests without full-map work per fleet',()=>{
  const f=fixture(),nav=new MaritimeNavigation();const field=nav.field(f.g.owner,0),t=performance.now();
  for(let i=0;i<100;i++){const route=nav.route(f.g.owner,0,f.b);assert.ok(validSeaRoute(route.cells));assert.equal(nav.field(f.g.owner,0),field);}
  const ms=performance.now()-t;assert.ok(ms<1000,`100 cached routes took ${ms}ms`);console.log('NAVIGATION cached 100 routes ms:',ms.toFixed(2));
});
test('failed coastal assault returns its survivors by sea instead of instantly refunding them',()=>{
 const f=fixture();f.g.owner[f.b]=1;f.g.frontline[f.b]=10000;f.g.factions[1].troops=100;f.g.factions[0].troops=10;f.g.recount();
 // Keep this coastal garrison stationed by giving it a hostile land border.
 // Quiet frontier posts otherwise correctly demobilize during step().
 const neighbor=landNeighbors(f.b).find(i=>f.g.owner[i]!==WATER);assert.ok(neighbor>=0);f.g.owner[neighbor]=2;
 assert.equal(f.g.launchLanding(0,cellToPoint(f.b),100).ok,true);const o=f.g.attackOrders.at(-1);
 for(let i=0;i<140&&!o.returning;i++)stepLedger(f.g);
 assert.equal(o.returning,true);assert.ok(f.g.attackOrders.includes(o));assert.notEqual(f.g.owner[f.b],0);
 while(f.g.tick<o.returnArrivalTick)stepLedger(f.g);assert.ok(!f.g.attackOrders.includes(o));
});
test('eliminated homeland records stranded fleet losses once and removes the expedition',()=>{
 const f=fixture(),o=launch(f),fallen=f.g.factions[0].attackFallen;
 for(let i=0;i<f.g.owner.length;i++)if(f.g.owner[i]===0)f.g.owner[i]=NEUTRAL;
 f.g.step();assert.equal(f.g.status,'defeat');assert.ok(!f.g.attackOrders.includes(o));assert.equal(f.g.factions[0].attackFallen,fallen+o.remaining);
});
test('legacy voyage with no surviving departure coast refunds its paid survivors safely',()=>{
 const f=fixture();launch(f);const save=f.g.exportSave();delete save.attackOrders[0].seaRoute;delete save.attackOrders[0].seaDistanceKm;
 for(const i of COASTS)if(save.owner[i]===0)save.owner[i]=NEUTRAL;
 const reserve=save.factions[0].troops,living=save.attackOrders[0].remaining,restored=Game.fromSave(save);
 assert.equal(restored.factions[0].troops,reserve+living);assert.equal(restored.attackOrders[0].remaining,0);
});
test('a legacy political-boundary port surrounded by real land cannot launch a fleet',()=>{
 const g=new Game(618,3,'DE'),oldPort=118909,destination=115549;g.owner[oldPort]=0;g.owner[destination]=NEUTRAL;
 assert.ok(landNeighbors(oldPort).every(i=>NAV_LAND[i]===1));
 assert.equal(g.launchLanding(0,cellToPoint(destination),35).ok,false);
});
