import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {selectedInfantryForTransport,selectedLoadedRovers} from '../scripts/webgl-transport-controls.js';

test('selection includes only friendly living foot soldiers and all 4 infantry types',()=>{
 const h={id:90,kind:'rover',owner:0,hp:295,x:100,y:100};
 const units=[
  ...['infantry','medic','engineer','heavy'].map((kind,i)=>({id:i+1,kind,owner:0,hp:100})),
  {id:10,kind:'rover',owner:0,hp:295},
  {id:11,kind:'infantry',owner:1,hp:100},
  {id:12,kind:'infantry',owner:0,hp:0},
  {id:13,kind:'infantry',owner:0,hp:100,carrier:90},
 ];
 const selected=new Set(units.map(u=>u.id));
 assert.deepEqual(selectedInfantryForTransport(units,selected,h),[1,2,3,4]);
 assert.deepEqual(selectedInfantryForTransport(units,selected,{...h,owner:1}),[11]);
 assert.deepEqual(selectedInfantryForTransport(units,selected,{...h,kind:'tank'}),[]);
 assert.deepEqual(selectedInfantryForTransport(units,selected,null),[]);
});

test('only a selected occupied Humvee exposes the disembark action',()=>{
 const u={id:4,kind:'rover',owner:0,hp:295,transport:{cargo:[2],phase:'cruise'}};
 assert.deepEqual(selectedLoadedRovers([u],new Set([4])),[u]);
 assert.deepEqual(selectedLoadedRovers([u],new Set([1])),[]);
 assert.deepEqual(selectedLoadedRovers([{...u,transport:{cargo:[]}}],new Set([4])),[]);
});

test('real 20Hz simulation boards four soldiers and returns them on unload',()=>{
 const g=new Simulation(2074,4);g.aiClock=1e8;g.units=[];g.bases=[];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.status='playing';g.paused=false;
 const humvee=g.spawn(0,{x:1800,y:2000},'rover');
 const troops=Array.from({length:5},(_,i)=>g.spawn(0,
  {x:1755-(i%2)*14,y:1940+Math.floor(i/2)*18},'infantry'));
 const before=g.units.length;
 assert.equal(g.command(troops.map(u=>u.id),{
  kind:'board',target:humvee.id,x:humvee.x,y:humvee.y}),4);
 assert.deepEqual(humvee.transport.pickup.length,4);
 for(let i=0;i<280;i++)g.step(.05);
 assert.equal(humvee.transport.cargo.length,4,'all four seats should load');
 assert.equal(g.units.length,before,'boarding must not destroy or duplicate a soldier');
 assert.equal(troops.filter(u=>u.carrier===humvee.id).length,4);
 assert.equal(troops.filter(u=>!u.carrier).length,1);
 assert.equal(g.command([troops[4].id],{
  kind:'board',target:humvee.id,x:humvee.x,y:humvee.y}),0,'full Humvee rejects extra passenger');
 // This fixture deliberately clears the game's bases and obstacles. Its
 // saved map would fail normal validation; assert exact cargo serialization
 // and independently ensure pristine campaign saves still round-trip.
 const packed=g.save();
 assert.equal(packed.units.find(u=>u.id===humvee.id).transport.cargo.length,4);
 const pristine=new Simulation(2074,4);
 assert.ok(Simulation.load(pristine.save()));
 assert.equal(g.transports.unload(humvee.id,{x:humvee.x+120,y:humvee.y+80}),true);
 for(let i=0;i<300;i++)g.step(.05);
 assert.equal(humvee.transport.cargo.length,0,'all passengers should disembark');
 assert.equal(troops.filter(u=>u.carrier===humvee.id).length,0);
});

test('3D right-click route dispatches boarding before generic terrain movement',()=>{
 const js=readFileSync(new URL('../scripts/webgl-battlefield.js',import.meta.url),'utf8');
 const hud=readFileSync(new URL('../scripts/webgl-classic-hud.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const pos=js.indexOf('const carrier=this.transportAtPointer(event);');
 assert.ok(pos>js.indexOf('pointerUp(event){'));
 assert.ok(pos<js.indexOf('const groundPoint='),'boarding must precede terrain picking');
 assert.match(js,/kind:'board',target:carrier\.id,x:carrier\.x,y:carrier\.y/);
 assert.match(js,/this\.game\.transports\.unload\(carrier\.id,point\)/);
 assert.match(hud,/data-action="unload"/);
 assert.match(build,/webgl-transport-controls\.js/);
});
