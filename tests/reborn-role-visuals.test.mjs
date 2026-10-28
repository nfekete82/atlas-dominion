import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {infantryRole,roleStyle,drawSupportPack,drawSupportPatch,drawInfantryRoleBadge} from '../dist/src/reborn/role-visuals.js';

const fakeContext=()=>({
 calls:[],fillStyle:'',strokeStyle:'',lineWidth:1,lineCap:'',
 save(){this.calls.push('save');},restore(){this.calls.push('restore');},
 translate(){this.calls.push('translate');},rotate(){this.calls.push('rotate');},
 fillRect(){this.calls.push('fillRect');},beginPath(){},arc(){this.calls.push('arc');},
 fill(){this.calls.push('fill');},stroke(){this.calls.push('stroke');},
 moveTo(){},lineTo(){}
});

test('role visuals: soldier rifle, engineer wrench and medic cross have distinct color identities',()=>{
 assert.deepEqual(['infantry','engineer','medic'].map(infantryRole),['infantry','engineer','medic']);
 assert.equal(infantryRole('tank'),null);
 assert.notEqual(roleStyle('infantry').accent,roleStyle('engineer').accent);
 assert.notEqual(roleStyle('medic').accent,roleStyle('engineer').accent);
 assert.equal(roleStyle('medic').label,'SANITÄTER');
 for(const role of ['infantry','engineer','medic']){
  const c=fakeContext();drawInfantryRoleBadge(c,role,0,{x:40,y:60});
  assert.ok(c.calls.includes('arc'));assert.ok(c.calls.includes('fill'));
  assert.equal(c.calls[0],'save');assert.equal(c.calls.at(-1),'restore');
 }
});

test('role visuals: support equipment is drawn at animated body position for both factions',()=>{
 for(const role of ['engineer','medic'])for(const angle of [0,Math.PI/2,Math.PI]){
  const c=fakeContext();
  drawSupportPack(c,role,{x:100,y:100},angle);
  drawSupportPatch(c,role,{x:100,y:100},angle);
  assert.ok(c.calls.filter(v=>v==='fillRect').length>=8);
  assert.equal(c.calls.filter(v=>v==='save').length,2);
  assert.equal(c.calls.filter(v=>v==='restore').length,2);
 }
 const c=fakeContext();
 drawSupportPack(c,'infantry',{x:10,y:20},0);
 drawSupportPatch(c,'infantry',{x:10,y:20},0);
 assert.deepEqual(c.calls,[],'original rifle silhouette must not be covered by support kit');
});

test('role visuals: new role graphics leave battle data and animation atlases unchanged',()=>{
 const game=new Simulation(),before=game.save(),c=fakeContext();
 for(const kind of ['infantry','engineer','medic']){
  const u=game.units.find(u=>u.kind===kind)??game.spawn(0,{x:1950,y:2050},kind);
  drawSupportPack(c,kind,u,u.angle);
  drawSupportPatch(c,kind,u,u.angle);
  drawInfantryRoleBadge(c,kind,u.owner,u);
 }
 assert.deepEqual(game.save().units,before.units.length===game.units.length?before.units:game.units,
  'role-only renderer must not change HP, orders or movement');
 const renderer=readFileSync(new URL('../src/reborn/renderer.ts',import.meta.url),'utf8');
 const presentation=readFileSync(new URL('../src/reborn/unit-presentation.ts',import.meta.url),'utf8');
 assert.match(renderer,/drawInfantryRoleBadge\(c,u\.kind,u\.owner,p\)/);
 assert.match(presentation,/drawSupportPack\(c,v\.unit\.kind,at,v\.bodyAngle\)/);
 assert.match(presentation,/drawSupportPatch\(c,v\.unit\.kind,at,v\.bodyAngle\)/);
});
