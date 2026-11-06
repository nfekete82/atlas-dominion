import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

function arena(){
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.units=[];g.memories=[[],[]];
 for(const t of g.territories)t.owner=-1;
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 Object.assign(hq,{x:2700,y:2000});g.bases=[hq];
 return {g,hq};
}
const advance=(g,seconds)=>{for(let i=0;i<seconds/.05;i++)g.step(.05);};

for(const mode of ['director','baseline'])test(`combat missions: ${mode} attack-move respects its pursuit limit`,()=>{
 const {g}=arena();g.tactical.mode=mode;
 const fighter=g.spawn(1,{x:2000,y:2000},'infantry');
 const decoy=g.spawn(0,{x:2000,y:2260},'engineer');decoy.hold=true;
 g.command([fighter.id],{x:3000,y:2000,kind:'attackMove'});
 fighter.orders[0].tactical={group:1,mode:'assault'};
 const before=fighter.x;
 for(let i=0;i<80;i++){
  // A retreating decoy remains visible but outside this rifle's weapon range.
  decoy.x=fighter.x;decoy.y=fighter.y+260;g.updateVision();g.step(.05);
 }
 if(mode==='director')assert.ok(fighter.x>before+70,'the column must continue its mission after exhausting a diversion');
 else assert.equal(fighter.x,before,'the benchmark reference behavior remains unchanged');
 assert.deepEqual(fighter.pursuitOrigin,{x:2000,y:2000},'continued contact must not reset the leash every tick');
 assert.equal(decoy.hp,110,'continuing a mission must not extend the weapon range');
});

function rememberedTarget(){
 const {g,hq}=arena();
 const observer=g.spawn(1,{x:hq.x-160,y:hq.y},'infantry');g.updateVision();
 assert.ok(g.memories[1].some(m=>m.id===hq.id&&m.hp===1200));
 g.units=g.units.filter(u=>u.id!==observer.id);
 const artillery=g.spawn(1,{x:1500,y:2000},'artillery');g.updateVision();
 assert.equal(g.canSee(1,hq),false);
 g.command([artillery.id],{x:hq.x,y:hq.y,kind:'attack',target:hq.id});
 artillery.orders[0].tactical={group:1,mode:'assault'};
 return {g,hq,artillery};
}

test('combat missions: remembered building attack survives fog, approaches and fires only after real reacquisition',()=>{
 const {g,hq,artillery}=rememberedTarget();
 advance(g,2);
 assert.equal(artillery.orders[0]?.kind,'attack');
 assert.equal(artillery.orders[0]?.target,hq.id);
 assert.ok(artillery.x>1550,'the remembered location must cause physical reconnaissance');
 assert.equal(hq.hp,1200);assert.equal(g.missiles.length,0,'no projectile may target an unseen building');
 let fired=false;
 for(let i=0;i<500&&!fired;i++){
  g.step(.05);
  if(g.missiles.some(m=>m.owner===1)){
   fired=true;assert.ok(g.canSee(1,hq),'the target must actually be visible when the first rocket launches');
  }
 }
 assert.ok(fired,'the retained explicit attack must eventually engage the legally rediscovered building');
});

test('combat missions: hidden building destruction cannot change remembered attack orders or health knowledge',()=>{
 const a=rememberedTarget(),b=rememberedTarget();
 b.hq.hp=0;
 // Preserve a real blue unit so hidden destruction cannot end the game.
 a.g.spawn(0,{x:2900,y:2900},'engineer');b.g.spawn(0,{x:2900,y:2900},'engineer');
 advance(a.g,2);advance(b.g,2);
 assert.deepEqual(b.artillery.orders,a.artillery.orders);
 assert.equal(b.artillery.x,a.artillery.x);assert.equal(b.artillery.y,a.artillery.y);
 assert.deepEqual(b.g.memories[1],a.g.memories[1],'unseen HP and existence must remain unknown');
 assert.equal(b.g.missiles.length,0);assert.equal(a.g.missiles.length,0);
});

test('combat missions: an unobserved target ID cannot create a remembered attack',()=>{
 const {g,hq}=arena(),artillery=g.spawn(1,{x:1500,y:2000},'artillery');
 g.command([artillery.id],{x:hq.x,y:hq.y,kind:'attack',target:hq.id});
 artillery.orders[0].tactical={group:1,mode:'assault'};
 advance(g,.05);
 assert.equal(artillery.orders[0]?.kind,'attackMove');assert.equal(artillery.orders[0]?.target,undefined);
 assert.equal(g.missiles.length,0);assert.equal(g.memories[1].length,0);
});

test('combat missions: a vehicle returning for repair cannot pull the frontline medic home',()=>{
 const {g}=arena();
 const fighter=g.spawn(1,{x:2300,y:2000},'infantry');
 const tank=g.spawn(1,{x:1300,y:2000},'tank');
 const medic=g.spawn(1,{x:2150,y:2000},'medic');
 g.command([fighter.id,tank.id,medic.id],{x:3000,y:2000,kind:'attackMove'});
 fighter.orders=[];tank.orders=[];
 g.tactical.state.recovering=[tank.id];
 const before=medic.x;advance(g,.5);
 assert.ok(medic.x>before+20,'medic must follow the surviving fighting front while the vehicle leaves for repair');
 assert.equal(tank.x,1300,'cohort cleanup cannot cancel or move the real recovering unit');
});
