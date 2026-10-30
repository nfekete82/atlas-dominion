import {test} from 'node:test';
import assert from 'node:assert/strict';
import {artilleryFiringState,createArtilleryObserver} from '../scripts/ai-artillery-observer.mjs';

const UNITS={artillery:{range:680}};
function fixture(){
 const target={id:1004,owner:0,kind:'turret',hp:650,x:500,y:200};
 const rocket={id:17,owner:1,kind:'artillery',hp:340,x:100,y:200,carrier:false,cooldown:0,
  orders:[{kind:'attack',target:1004,x:500,y:200}]};
 const g={time:45,units:[rocket],bases:[target],missiles:[],tactical:{state:{phase:'attack',
  commander:{mission:{kind:'structure',objective:1004,sector:2,since:10,progressAt:40}}}},
  canSee:()=>true,obstacles:()=>[],world:{line:()=>true}};
 return {g,rocket,target};
}
test('classification distinguishes a blocked real firing lane from distance, movement and reload',()=>{
 const {g,rocket,target}=fixture();
 assert.equal(artilleryFiringState(g,rocket,UNITS),'can-fire');
 rocket.cooldown=1;assert.equal(artilleryFiringState(g,rocket,UNITS),'reloading');rocket.cooldown=0;
 g.world.line=()=>false;assert.equal(artilleryFiringState(g,rocket,UNITS),'line-blocked');
 g.canSee=()=>false;assert.equal(artilleryFiringState(g,rocket,UNITS),'target-not-visible');
 g.canSee=()=>true;rocket.x=-300;assert.equal(artilleryFiringState(g,rocket,UNITS),'out-of-range');
 rocket.x=100;rocket.orders=[{kind:'move',x:200,y:200}];assert.equal(artilleryFiringState(g,rocket,UNITS),'moving-to-waypoint');
 rocket.orders=[];assert.equal(artilleryFiringState(g,rocket,UNITS),'idle');
 target.hp=0;rocket.orders=[{kind:'attack',target:1004,x:500,y:200}];assert.equal(artilleryFiringState(g,rocket,UNITS),'target-absent');
});
test('one sample per simulation second, mission link and non-mutating telemetry',()=>{
 const {g,rocket}=fixture();
 const observer=createArtilleryObserver(UNITS);
 const originalOrders=JSON.stringify(rocket.orders);
 observer.sample(g);observer.sample(g);
 assert.equal(observer.snapshot().samples,1);
 assert.equal(observer.snapshot().gunSeconds['can-fire'],1);
 assert.equal(observer.snapshot().targetAttackSeconds,1);
 assert.equal(observer.snapshot().missionAttackSeconds,1);
 g.time=46;g.world.line=()=>false;observer.sample(g);
 assert.equal(observer.snapshot().gunSeconds['line-blocked'],1);
 assert.equal(JSON.stringify(rocket.orders),originalOrders);
 assert.equal(observer.snapshot().shots,0,'observed attack orders are not shots');
});
test('counts only actual attack replacements, explicit stops, and launched shots',()=>{
 const {g,rocket,target}=fixture();
 const observer=createArtilleryObserver(UNITS);
 let before=observer.beforeCommand(g,[rocket.id]);
 rocket.orders=[{kind:'move',x:400,y:200}];
 observer.afterCommand(g,before,false);
 assert.equal(observer.snapshot().attackOrderReplacements,1);
 assert.equal(observer.snapshot().attackOrderReplacementKinds.move,1);
 rocket.orders=[{kind:'attack',target:target.id,x:target.x,y:target.y}];
 before=observer.beforeCommand(g,[rocket.id]);
 observer.afterCommand(g,before,true);
 assert.equal(observer.snapshot().attackOrderReplacements,1,'queued append is not replacement');
 const stopped=observer.beforeStop(g,[rocket.id]);rocket.orders=[];
 observer.afterStop(g,stopped);
 assert.equal(observer.snapshot().attackOrdersStopped,1);
 observer.shot(g,rocket,target);
 assert.equal(observer.snapshot().shots,1);
 assert.equal(observer.snapshot().shotsByTargetKind.turret,1);
 assert.equal(observer.snapshot().firstTurretShot,45);
});
test('observer preserves 30-second timeline, excludes opposing artillery',()=>{
 const {g,rocket}=fixture();
 const obs=createArtilleryObserver(UNITS);
 g.time=60;obs.sample(g);
 assert.equal(obs.snapshot().timeline.length,1);
 assert.equal(obs.snapshot().timeline[0].guns,1);
 assert.equal(obs.snapshot().timeline[0].mission.objective,1004);
 obs.shot(g,{...rocket,owner:0},{id:1004,kind:'turret'});
 assert.equal(obs.snapshot().shots,0);
});
