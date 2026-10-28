import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {infantryRole,roleStyle,ROLE_BADGE_RADIUS,drawInfantryRoleBadge} from '../dist/src/reborn/role-visuals.js';

const mock=()=>({
 calls:[],fillStyle:'',strokeStyle:'',lineWidth:1,
 save(){this.calls.push({name:'save'});},
 restore(){this.calls.push({name:'restore'});},
 translate(x,y){this.calls.push({name:'translate',x,y});},
 rotate(angle){this.calls.push({name:'rotate',angle});},
 fillRect(x,y,w,h){this.calls.push({name:'rect',x,y,w,h,color:this.fillStyle});},
 beginPath(){this.calls.push({name:'begin'});},
 arc(x,y,r){this.calls.push({name:'arc',x,y,r});},
 fill(){this.calls.push({name:'fill',color:this.fillStyle});},
 stroke(){this.calls.push({name:'stroke',color:this.strokeStyle});},
 moveTo(){},lineTo(){}
});

test('role markers: smaller circles have blue rifle, green white cross, yellow white hammer',()=>{
 assert.equal(ROLE_BADGE_RADIUS,5.3);
 assert.deepEqual(['infantry','medic','engineer'].map(infantryRole),['infantry','medic','engineer']);
 assert.equal(infantryRole('tank'),null);
 assert.equal(roleStyle('infantry').accent,'#277fce');
 assert.equal(roleStyle('medic').accent,'#269b62');
 assert.equal(roleStyle('engineer').accent,'#d69d1c');
 for(const role of ['infantry','medic','engineer']){
  const c=mock();drawInfantryRoleBadge(c,role,0,{x:100,y:200});
  const circles=c.calls.filter(x=>x.name==='arc');
  assert.equal(circles.length,1,role+' uses exactly one circle');
  assert.equal(circles[0].r,5.3);
  assert.deepEqual(c.calls.find(x=>x.name==='translate'),{name:'translate',x:114,y:195});
  assert.equal(c.calls.find(x=>x.name==='fill').color,roleStyle(role).accent);
  const shapes=c.calls.filter(x=>x.name==='rect');
  assert.ok(shapes.length>=2);
  assert.ok(shapes.every(s=>s.color==='#fff'),role+' uses white pictogram');
  assert.equal(c.calls[0].name,'save');
  assert.equal(c.calls.at(-1).name,'restore');
 }
});

test('role markers: white weapon, cross and hammer have different geometry',()=>{
 const shapes=role=>{
  const c=mock();drawInfantryRoleBadge(c,role,1,{x:100,y:200});
  return c.calls.filter(x=>x.name==='rect').map(x=>[x.x,x.y,x.w,x.h]);
 };
 const [rifle,cross,hammer]=['infantry','medic','engineer'].map(shapes);
 assert.notDeepEqual(rifle,cross);
 assert.notDeepEqual(hammer,cross);
 assert.notDeepEqual(hammer,rifle);
 assert.equal(cross.length,2);
 assert.equal(hammer.length,2);
});

test('role markers: no extra backpack or giant kit is drawn onto the animated characters',()=>{
 const presentation=readFileSync(new URL('../src/reborn/unit-presentation.ts',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../src/reborn/renderer.ts',import.meta.url),'utf8');
 const roles=readFileSync(new URL('../src/reborn/role-visuals.ts',import.meta.url),'utf8');
 assert.doesNotMatch(presentation,/drawSupportPack|drawSupportPatch/);
 assert.doesNotMatch(roles,/drawSupportPack|drawSupportPatch|drawImage/);
 assert.match(renderer,/drawInfantryRoleBadge\(c,u\.kind,u\.owner,p\)/);
});

test('role markers: drawing does not change combat, saved game or unrelated units',()=>{
 const game=new Simulation(),actors=['infantry','engineer','medic'].map(kind=>
   game.units.find(u=>u.kind===kind)??game.spawn(0,{x:1950,y:2050},kind));
 const saved=game.save();
 for(const u of actors){
  const c=mock();drawInfantryRoleBadge(c,u.kind,u.owner,u);
  assert.equal(c.calls[0].name,'save');
 }
 const unrelated=mock();drawInfantryRoleBadge(unrelated,'tank',0,{x:1,y:2});
 assert.equal(unrelated.calls.length,0);
 assert.deepEqual(game.save(),saved);
});
