import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {stalledObservedSiege} from '../dist/src/reborn/tactical-ai.js';

test('4.6: stalled siege requires same observed objective, 60s mission age and 42s without progress',()=>{
 const mission={kind:'structure',objective:1004,since:100,progressAt:113};
 assert.equal(stalledObservedSiege(mission,1004,160),true);
 assert.equal(stalledObservedSiege(mission,1004,153),false,'under 42s without progress');
 assert.equal(stalledObservedSiege(mission,1004,159.9),false,'mission younger than 60s');
 assert.equal(stalledObservedSiege({...mission,progressAt:125},1004,160),false,'recent progress');
 assert.equal(stalledObservedSiege({...mission,kind:'capture'},1004,160),false,'not a structure');
 assert.equal(stalledObservedSiege(mission,1005,160),false,'different objective');
 assert.equal(stalledObservedSiege(undefined,1004,160),false,'no mission');
});

function fixture({known=true,clear=false,stalled=true}={}){
 const g=new Simulation(2028,4);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const rocket=g.spawn(1,{x:home.x+90,y:home.y+140},'artillery');
 assert.ok(rocket);
 const target={id:1004,x:home.x+470,y:home.y+220};
 if(known)g.tactical.state.knownTurrets=[{...target,hp:650,range:600,seenAt:180}];
 g.time=210;
 g.tactical.state.commander={...newCampaign(),mission:{
   kind:'structure',sector:1,objective:target.id,x:target.x,y:target.y,
   hp:650,since:140,progressAt:stalled?165:196,distance:800
 }};
 g.world.line=()=>clear;
 return {g,rocket,target};
}

test('4.6: an already known, blocked and stalled turret triggers bounded standoff even before HQ destruction',()=>{
 const {g,rocket,target}=fixture();
 let attempts=0;
 g.tactical.standoffSiege=(_members,_target,_guns,fallback)=>{
  attempts++;
  assert.equal(fallback,true);
  return true;
 };
 assert.equal(g.tactical.siege([rocket],target),true);
 assert.equal(attempts,1);
});

test('4.6: recent mission progress or clear line preserves baseline direct attack',()=>{
 for(const options of [{stalled:false},{clear:true},{known:false}]){
  const {g,rocket,target}=fixture(options);
  let attempts=0;
  g.tactical.standoffSiege=()=>{attempts++;return true;};
  g.tactical.siege([rocket],target);
  assert.equal(attempts,0);
 }
});

test('4.6: rejected alternate position cannot strand artillery or cancel direct assault',()=>{
 const {g,rocket,target}=fixture();
 let attempts=0;
 g.tactical.standoffSiege=()=>{attempts++;return false;};
 assert.equal(g.tactical.siege([rocket],target),true);
 assert.equal(attempts,1);
 assert.equal(rocket.orders[0]?.kind,'attack');
 assert.equal(rocket.orders[0]?.target,target.id);
 assert.equal(rocket.orders[0]?.tactical?.mode,'assault');
});
