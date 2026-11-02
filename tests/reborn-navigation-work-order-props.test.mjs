import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {buildingProps} from '../dist/src/reborn/building-decor.js';
import {propSiteClear} from '../dist/src/reborn/prop-placement.js';
import {preserveAssignedWork} from '../dist/src/reborn/work-order-guard.js';
import {Input} from '../dist/src/reborn/input.js';
import {RULES,distance} from '../dist/src/reborn/config.js';

test('work: routine right-click preserves active engineer build/repair; explicit commands override',()=>{
 for(const current of ['build','repair']){
  assert.equal(preserveAssignedWork(current,'move',false),true);
  assert.equal(preserveAssignedWork(current,'move',false,true),false);
  assert.equal(preserveAssignedWork(current,'move',true),false);
  assert.equal(preserveAssignedWork(current,'attack',false),false);
 }
 assert.equal(preserveAssignedWork(undefined,'move',false),false);
});

test('work: canvas terrain click only moves idle units and leaves building worker assigned',()=>{
 const g=new Simulation(2026,4),engineer=g.units.find(u=>u.owner===0&&u.kind==='engineer');
 const infantry=g.units.find(u=>u.owner===0&&u.kind==='infantry');
 assert.ok(engineer&&infantry);
 const base=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 base.hp-=50;
 assert.equal(g.command([engineer.id],{kind:'repair',target:base.id,x:base.x,y:base.y}),1);
 const original=engineer.orders[0],notices=[];
 const fake={renderer:{game:g,selected:new Set([engineer.id,infantry.id]),canvas:{classList:{remove(){}}},attackMode:false,marker:null},
  notify:s=>notices.push(s),acknowledge(){},onSelection(){}};
 Input.prototype.commandSelected.call(fake,{x:infantry.x+120,y:infantry.y+80},'move',false);
 assert.equal(engineer.orders[0],original,'repair work must not be replaced by casual terrain click');
 assert.equal(infantry.orders[0]?.kind,'move');
 Input.prototype.commandSelected.call(fake,{x:engineer.x+100,y:engineer.y+50},'move',false,undefined,true);
 assert.equal(engineer.orders[0]?.kind,'move','explicit move can override assigned work');
});

test('vehicles: completed visible crates/lamps physically block direct travel, while infantry retains ordinary route',()=>{
 const g=new Simulation(2026,4);
 g.world.blocked.fill(0);g.world.components.fill(0);
 const base=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0);
 const props=buildingProps(base.kind,base,base.radius,base.id,g.seed,base.facing??0)
   .filter(p=>propSiteClear(p,p.size,g,{base:base.id}));
 assert.ok(props.some(p=>p.kind==='service-lamp'));
 assert.ok(props.some(p=>p.kind.includes('crate')));
 const p=props.find(p=>p.kind==='service-lamp');
 const obstacles=[{x:p.x,y:p.y,radius:p.size*.43}];
 const start={x:p.x-75,y:p.y},end={x:p.x+75,y:p.y};
 assert.equal(g.world.line(start,end,obstacles,Math.max(0,RULES.rover.radius-10)),false);
 const route=g.world.path(start,end,[...g.obstacles(),...obstacles],Math.max(0,RULES.rover.radius-10),undefined,false,true);
 assert.ok(route.length,'ground vehicle can find detour round service prop');
});

test('navigation: exact cliff line rejects blocked corners even for infantry with zero additional clearance',()=>{
 const g=new Simulation(2026,4),w=g.world;
 w.blocked.fill(0);w.components.fill(0);
 const c=w.cell,x=40*c,y=40*c;
 w.blocked[40*RULES.grid+41]=1;
 const start={x,y},target={x:43*c,y:43*c};
 const route=w.path(start,target,[],0,undefined,false,true);
 assert.ok(route.length);
 assert.ok(route.every(p=>w.walkable(p)));
});
