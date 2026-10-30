import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {verifiedBlockedArtillery} from '../dist/src/reborn/tactical-ai.js';

test('4.7: actual blocked firing requires a stationary observed gun in range with an active attack order',()=>{
 const goal={x:400,y:300,id:1004};
 const gun={kind:'artillery',hp:340,x:150,y:300,moving:false,cooldown:0,
  orders:[{kind:'attack',x:400,y:300,target:1004}]};
 assert.equal(verifiedBlockedArtillery([gun],goal,true,()=>false),true);
 assert.equal(verifiedBlockedArtillery([gun],goal,false,()=>false),false);
 assert.equal(verifiedBlockedArtillery([gun],goal,true,()=>true),false);
 assert.equal(verifiedBlockedArtillery([{...gun,moving:true}],goal,true,()=>false),false);
 assert.equal(verifiedBlockedArtillery([{...gun,cooldown:1.2}],goal,true,()=>false),false);
 assert.equal(verifiedBlockedArtillery([{...gun,x:-320}],goal,true,()=>false);
 assert.equal(verifiedBlockedArtillery([{...gun,orders:[{kind:'move',x:400,y:300}]}],goal,true,()=>false),false);
 assert.equal(verifiedBlockedArtillery([{...gun,orders:[{kind:'attack',target:999,x:400,y:300}]}],goal,true,()=>false),false);
 assert.equal(verifiedBlockedArtillery([],goal,true,()=>false),false);
 assert.equal(verifiedBlockedArtillery([gun,{...gun,cooldown:1.2}],goal,true,()=>false),false);
});

function fixture(){
 const g=new Simulation(2031,4);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const gun=g.spawn(1,{x:home.x+80,y:home.y+110},'artillery');
 assert.ok(gun);
 const target={id:1004,x:gun.x+260,y:gun.y+70};
 g.time=200;
 gun.orders=[{kind:'attack',x:target.x,y:target.y,target:target.id}];
 gun.cooldown=0;
 gun.moving=false;
 g.tactical.state.knownTurrets=[{...target,range:600,hp:650,seenAt:200}];
 g.tactical.state.commander={...newCampaign(),
  mission:{kind:'structure',sector:1,objective:1004,x:target.x,y:target.y,
   hp:650,since:140,progressAt:160,distance:260}};
 g.world.line=()=>false;
 g.canSee=()=>true;
 return {g,gun,target};
}

test('4.7: midgame artillery must stay physically blocked over 12 seconds before rerouting',()=>{
 const {g,gun,target}=fixture();
 let reroutes=0;
 g.tactical.standoffSiege=()=>{reroutes++;return true;};
 assert.equal(g.tactical.siege([gun],target),true);
 assert.equal(reroutes,0);
 g.time=209;
 g.tactical.siege([gun],target);
 assert.equal(reroutes,0);
 g.time=212;
 g.tactical.siege([gun],target);
 assert.equal(reroutes,1);
});

test('4.7: moving or firing artillery resets the failure timer instead of rerouting',()=>{
 const {g,gun,target}=fixture();
 let reroutes=0;
 g.tactical.standoffSiege=()=>{reroutes++;return true;};
 g.tactical.siege([gun],target);
 g.time=207;gun.cooldown=1;
 g.tactical.siege([gun],target);
 g.time=215;gun.cooldown=0;
 g.tactical.siege([gun],target);
 assert.equal(reroutes,0);
 g.time=227;g.tactical.siege([gun],target);
 assert.equal(reroutes,1);
});

test('4.7: completed detour keeps the queued move + attack despite director macro pulses',()=>{
 const {g,gun,target}=fixture();
 g.tactical.standoffSiege=()=>{
  gun.orders=[{kind:'move',x:target.x-200,y:target.y-150},
   {kind:'attack',x:target.x,y:target.y,target:target.id}];
  return true;
 };
 g.tactical.siege([gun],target);
 g.time=213;assert.equal(g.tactical.siege([gun],target),true);
 assert.equal(gun.orders[0].kind,'move');
 g.time=216;assert.equal(g.tactical.siege([gun],target),true);
 assert.equal(gun.orders[0].kind,'move','movement is not erased before rocket arrives');
 // Once the move has finished, ordinary attacks become authoritative again.
 gun.orders.shift();
 g.time=220;g.tactical.siege([gun],target);
 assert.equal(gun.orders[0].kind,'attack');
});

test('4.7: a failed alternate search retains the AI 4.5 attack order',()=>{
 const {g,gun,target}=fixture();
 let tried=0;
 g.tactical.standoffSiege=()=>{tried++;return false;};
 g.tactical.siege([gun],target);
 g.time=213;assert.equal(g.tactical.siege([gun],target),true);
 assert.equal(tried,1);
 assert.equal(gun.orders[0].kind,'attack');
 assert.equal(gun.orders[0].target,target.id);
});
