import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {World} from '../dist/src/reborn/world.js';
import {navigationLine} from '../dist/src/reborn/navigation-line.js';
import {RULES,distance} from '../dist/src/reborn/config.js';

test('navigation: a subpixel cliff intersection cannot disappear between line samples',()=>{
 const blocked=new Uint8Array(100);blocked[55]=1;
 const a={x:49.95,y:50.08},b={x:80,y:20};
 assert.equal(navigationLine(a,b,10,10,blocked,[],0,0),false);
 assert.equal(navigationLine(b,a,10,10,blocked,[],0,0),false);
 assert.equal(navigationLine({...a,y:48.5},{...b,y:19.5},10,10,blocked,[],0,0),true);
 assert.equal(navigationLine({x:49.95,y:49},b,10,10,blocked,[],0,0),true,'an endpoint on a grid boundary cannot overshoot into another cell');
});

test('navigation: clearance probes and circular footprints prevent corner cutting in either direction',()=>{
 const blocked=new Uint8Array(100);blocked[55]=1;
 const a={x:40,y:48},b={x:70,y:48};
 assert.equal(navigationLine(a,b,10,10,blocked,[],0,0),true);
 assert.equal(navigationLine(a,b,10,10,blocked,[],0,3),false);
 const circle={x:55,y:51,radius:1};blocked.fill(0);
 for(const [from,to] of [[a,b],[b,a]])assert.equal(navigationLine(from,to,10,10,blocked,[circle],0,3),false);
 assert.equal(navigationLine(a,b,10,10,blocked,[],0,3),true,'changed obstacles are observed immediately');
});

test('navigation: returned vehicle routes remain walkable between every waypoint',()=>{
 const w=new World(98251,5),start={x:3095.0501807567116,y:1556.7869575694258},target={x:2281.0535877435677,y:3180.01625560605};
 const route=w.path(start,target,[],10,undefined,false,true);assert.ok(route.length);
 let previous=start;
 for(const p of route){
  assert.ok(navigationLine(previous,p,w.cell,RULES.grid,w.blocked,[],RULES.infantry.radius,10));
  const d=distance(previous,p),steps=Math.ceil(d/.25);
  for(let i=0;i<=steps;i++)assert.ok(w.walkable({x:previous.x+(p.x-previous.x)*i/steps,y:previous.y+(p.y-previous.y)*i/steps},[],10));
  previous=p;
 }
 assert.ok(distance(route.at(-1),target)<.001);
});

test('navigation: artillery escapes the observed cliff edge and resumes identically after a save',()=>{
 const g=new Simulation(98251,5);g.units=[];g.credits=[0,0];
 const start={x:3095.0501807567116,y:1556.7869575694258},u=g.spawn(0,start,'artillery');
 g.command([u.id],{kind:'move',x:2281.0535877435677,y:3180.01625560605});
 for(let i=0;i<60;i++)g.step(.05);
 assert.ok(u.exactPath===undefined||u.exactPath===true,'clear paths stay ordinary; encountered obstructions may enable exact routing');
 assert.ok(distance(u,start)>100,'a healthy paid vehicle must not endlessly replan at the cliff');
 const loaded=Simulation.load(structuredClone(g.save()));
 for(let i=0;i<60;i++){g.step(.05);loaded.step(.05);}
 const original=g.save(),restored=loaded.save();
 // Loading deliberately resets the transient repath timer; positions, orders,
 // paths, resources and all persisted gameplay state must still agree.
 for(const saved of [original,restored])for(const unit of saved.units)unit.repath=0;
 assert.deepEqual(restored,original);
 const invalid=g.save();invalid.units[0].exactPath='yes';assert.throws(()=>Simulation.load(invalid));
});
test('navigation: unobstructed modern travel and old saves need no exact-path state',()=>{
 const g=new Simulation(2026,4);g.units=[];g.world.blocked.fill(0);g.world.components.fill(0);g.credits=[0,0];
 const u=g.spawn(0,{x:1500,y:1500},'artillery');g.command([u.id],{kind:'move',x:1700,y:1500});
 for(let i=0;i<20;i++)g.step(.05);
 assert.ok(u.x>1500);assert.equal(u.exactPath,undefined);
 const raw=g.save();delete raw.units[0].exactPath;assert.ok(Simulation.load(raw));
});
