import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {BOMBER_ORBIT_SPEED,advanceBomberOrbit} from '../dist/src/reborn/bomber-orbit.js';
import {selectedInfantryForTransport,selectedLoadedTransports} from '../scripts/webgl-transport-controls.js';
import {visualUnitScale,unitVisualYaw,unitRenderAltitude} from '../scripts/webgl-scale.js';

test('3D scale and bomber orientation are presentation-only',()=>{
 assert.equal(visualUnitScale('tank'),1.44);
 assert.equal(visualUnitScale('scout'),1.34);
 for(const kind of ['infantry','medic','engineer'])assert.equal(visualUnitScale(kind),.56);
 assert.equal(visualUnitScale('heavy'),.58);
 assert.equal(visualUnitScale('bomber'),1.03);
 for(const angle of [0,Math.PI/3,Math.PI,Math.PI*1.5]){
  assert.ok(Math.abs(unitVisualYaw('bomber',angle)-unitVisualYaw('scout',angle)-Math.PI)<1e-9);
 }
});

test('rendered helicopter lands on ground and takes off smoothly; bomber stays airborne',()=>{
 assert.equal(unitRenderAltitude('scout',0),3);
 assert.equal(unitRenderAltitude('scout',.5),89);
 assert.equal(unitRenderAltitude('scout',1),175);
 assert.equal(unitRenderAltitude('scout'),175);
 assert.equal(unitRenderAltitude('bomber',0),175);
 assert.equal(unitRenderAltitude('tank'),0);
 assert.equal(unitRenderAltitude('scout',-1),3);
 assert.equal(unitRenderAltitude('scout',2),175);
});

test('bomber has much higher commanded speed and twice as fast an idle orbit',()=>{
 assert.equal(UNITS.bomber.speed,350);
 assert.equal(BOMBER_ORBIT_SPEED,145);
 const orbit={cx:2000,cy:2000,radius:78,phase:0,direction:1};
 const next=advanceBomberOrbit(orbit,.05);
 assert.ok(Math.abs(next.arc-7.25)<1e-8);
 assert.ok(Math.abs(Math.hypot(next.x-orbit.cx,next.y-orbit.cy)-78)<1e-8);
});

test('3D can board and unload both Humvee and ten-seat helicopter',()=>{
 const helicopter={id:70,kind:'scout',owner:0,hp:360};
 const humvee={...helicopter,id:71,kind:'rover'};
 const troops=[
  ...['infantry','medic','engineer','heavy'].map((kind,i)=>({id:i+1,kind,owner:0,hp:100})),
  {id:5,kind:'tank',owner:0,hp:100},
  {id:6,kind:'infantry',owner:1,hp:100},
  {id:7,kind:'infantry',owner:0,hp:0},
  {id:8,kind:'infantry',owner:0,hp:100,carrier:70},
 ];
 const selected=new Set(troops.map(u=>u.id));
 assert.deepEqual(selectedInfantryForTransport(troops,selected,helicopter),[1,2,3,4]);
 assert.deepEqual(selectedInfantryForTransport(troops,selected,humvee),[1,2,3,4]);
 assert.deepEqual(selectedInfantryForTransport(troops,selected,{...helicopter,owner:1}),[6]);
 const loaded={...helicopter,transport:{cargo:[1,2],phase:'cruise'}};
 assert.deepEqual(selectedLoadedTransports([loaded],new Set([70])),[loaded]);
 assert.deepEqual(selectedLoadedTransports([loaded],new Set([71])),[]);
 assert.deepEqual(selectedLoadedTransports([{...loaded,transport:{cargo:[]}}],new Set([70])),[]);
 const src=readFileSync(new URL('../scripts/webgl-battlefield.js',import.meta.url),'utf8');
 const hud=readFileSync(new URL('../scripts/webgl-classic-hud.js',import.meta.url),'utf8');
 assert.match(src,/\['rover','scout'\]\.includes\(u\.kind\)/);
 assert.match(src,/kind:'board',target:carrier\.id,x:carrier\.x,y:carrier\.y/);
 assert.match(src,/this\.game\.transports\.unload\(carrier\.id,point\)/);
 assert.match(src,/unitRenderAltitude\(u\.kind,u\.flightHeight\?\?1\)/);
 assert.match(hud,/Transporthubschrauber ausladen/);
});

test('real 20Hz ten-seat helicopter lands, loads, lifts off, lands and unloads',()=>{
 const g=new Simulation(2074,4);g.aiClock=1e8;g.units=[];g.bases=[];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.status='playing';g.paused=false;
 const heli=g.spawn(0,{x:1800,y:2000},'scout');
 const troops=Array.from({length:10},(_,i)=>g.spawn(0,{
  x:1720+(i%5)*32,y:1910+Math.floor(i/5)*32
 },'infantry'));
 const count=g.units.length;
 assert.equal(g.command(troops.map(u=>u.id),{kind:'board',target:heli.id,x:heli.x,y:heli.y}),10);
 let loading=false,takeoff=false,cruising=false,landed=false;
 for(let i=0;i<600;i++){
  g.step(.05);
  const t=heli.transport;
  if(t?.phase==='landing')landed=true;
  if(t?.phase==='loading'){loading=true;assert.equal(heli.flightHeight,0);}
  if(t?.phase==='takeoff')takeoff=true;
  if(t?.phase==='cruise'&&t.cargo.length===10){cruising=true;break;}
 }
 assert.ok(landed,'helicopter must descend to land');
 assert.ok(loading,'helicopter must wait at ground altitude while loading');
 assert.ok(takeoff,'helicopter must take off after boarding');
 assert.ok(cruising,'all ten passengers must actually board');
 assert.equal(heli.flightHeight,1);
 assert.equal(g.units.length,count);
 assert.equal(troops.filter(u=>u.carrier===heli.id).length,10);
 assert.equal(g.save().units.find(u=>u.id===heli.id).transport.cargo.length,10);
 const destination={x:heli.x+160,y:heli.y+110};
 assert.equal(g.transports.unload(heli.id,destination),true);
 let unloading=false,landedAgain=false,tookOffAgain=false,finished=false;
 for(let i=0;i<600;i++){
  g.step(.05);
  const t=heli.transport;
  if(t?.phase==='landing')landedAgain=true;
  if(t?.phase==='unloading'){unloading=true;assert.equal(heli.flightHeight,0);}
  if(t?.phase==='takeoff')tookOffAgain=true;
  if(t?.phase==='cruise'&&t.cargo.length===0){finished=true;break;}
 }
 assert.ok(landedAgain,'helicopter lands again to unload');
 assert.ok(unloading,'passengers are released only with helicopter on ground');
 assert.ok(tookOffAgain,'helicopter departs after unloading');
 assert.ok(finished,'all ten passengers must successfully disembark');
 assert.equal(heli.flightHeight,1);
 assert.equal(troops.filter(u=>u.carrier).length,0);
 assert.equal(g.units.length,count);
});
