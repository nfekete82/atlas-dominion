import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {distance} from '../dist/src/reborn/config.js';

function setup(kind='infantry'){
 const game=new Simulation();game.units=[];game.aiClock=-1e8;
 const blue=game.spawn(0,{x:1900,y:2100},kind);
 const red=game.spawn(1,{x:2050,y:2100},'infantry');
 game.updateVision();
 return {game,blue,red};
}
const advance=(g,n)=>{for(let i=0;i<n;i++)g.step(.05);};

for(const kind of ['infantry','heavy']){
 test('stop-to-defend: '+kind+' cancels all queued marching legs after the first incoming shot',()=>{
  const {game,blue,red}=setup(kind);
  assert.equal(game.command([blue.id],{kind:'move',x:2350,y:2100}),1);
  assert.equal(game.command([blue.id],{kind:'move',x:2400,y:2200},true),1);
  assert.equal(blue.orders.length,2);
  advance(game,2);
  assert.ok(blue.hp<UNITS[kind].hp,'enemy must deliver damage');
  assert.deepEqual(blue.orders,[]);
  assert.deepEqual(blue.path,[]);
  assert.equal(blue.hold,true);
  assert.equal(blue.moving,false);
  const remaining=red.hp;
  advance(game,4);
  assert.ok(red.hp<remaining,'soldier returns fire while standing');
  red.hp=0;advance(game,1);
  const stand={x:blue.x,y:blue.y};advance(game,30);
  assert.ok(distance(blue,stand)<.01,'no implicit resumption when attacker disappears');
  const saved=Simulation.load(game.save());
  const restored=saved.units.find(u=>u.id===blue.id);
  assert.deepEqual(restored.orders,[]);
  assert.equal(restored.hold,true);
  assert.equal(game.command([blue.id],{kind:'move',x:2330,y:2100}),1);
  assert.equal(blue.hold,false);
  advance(game,12);
  assert.ok(distance(blue,stand)>20,'fresh click permits movement again');
 });
}
test('stop-to-defend: without damage the original move order remains authoritative',()=>{
 const {game,blue,red}=setup();
 red.cooldown=1e8;
 game.command([blue.id],{kind:'move',x:2300,y:2100});
 advance(game,5);
 assert.equal(blue.orders[0].kind,'move');
 assert.equal(blue.hold,false);
 assert.ok(blue.x>1900);
 assert.equal(red.hp,UNITS.infantry.hp,'strict move does not start shooting without being attacked');
});
test('stop-to-defend: red AI squads still use their preexisting tactical orders',()=>{
 const {game,blue,red}=setup();
 blue.cooldown=1e8;
 game.command([red.id],{kind:'move',x:1740,y:2100});
 // A red squad may take damage while moving. The player-only rule must not
 // silently clear its tactical orders.
 red.orders=[{x:1740,y:2100,kind:'move'}];
 blue.cooldown=0;blue.hold=false;
 game.command([blue.id],{kind:'attack',target:red.id,x:red.x,y:red.y});
 advance(game,3);
 assert.ok(red.hp<UNITS.infantry.hp);
 assert.equal(red.orders[0]?.kind,'move');
});
