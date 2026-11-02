import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {canCaptureSector,captureSeconds,comebackPressure,chooseComebackOpportunity} from '../dist/src/reborn/territory-warfare.js';

const sector=(id,owner,neighbors,income=25)=>({id,owner,neighbors,income,
 point:{x:400+id*400,y:450},capturing:-1,progress:0,value:1,name:'Sector '+id,polygon:[]});
const step=(g,seconds)=>{for(let n=0;n<Math.round(seconds/.05);n++)g.step(.05);};

test('territory-war: free remote capture applies symmetrically to hostile and neutral sectors on all maps',()=>{
 const sectors=[sector(0,0,[1]),sector(1,-1,[0,2]),sector(2,1,[1,3]),sector(3,-1,[2])];
 for(const version of [1,10,11,14]){
  assert.equal(canCaptureSector(sectors,sectors[2],0,version),true,'BLUE may capture a remote hostile sector');
  assert.equal(canCaptureSector(sectors,sectors[0],1,version),true,'RED may capture a remote hostile sector');
  assert.equal(canCaptureSector(sectors,sectors[3],0,version),true,'BLUE may capture an isolated neutral sector');
  assert.equal(canCaptureSector(sectors,sectors[1],1,version),true,'RED may capture a neutral sector');
  assert.equal(canCaptureSector(sectors,sectors[0],0,version),false,'a faction never recaptures its own sector');
  assert.equal(canCaptureSector(sectors,sectors[2],-1,version),false,'neutral is not a capturing faction');
 }
});

test('territory-war: remote neutral bastions capture in real simulation for BLUE and RED',()=>{
 for(const version of [1,10,14]){
  for(const owner of [0,1]){
   const g=new Simulation(2026,version);g.aiClock=-1e8;g.units=[];
   const remote=g.territories.find(t=>t.owner===-1&&!t.neighbors.some(id=>g.territories[id].owner===owner));
   assert.ok(remote,'a nonadjacent neutral sector is available');
   const soldier=g.spawn(owner,{...remote.point},'infantry');
   assert.ok(soldier);
   assert.equal(g.captureReadiness(remote,owner),'capturing');
   step(g,RULES.captureTime+0.2);
   assert.equal(remote.owner,owner,'capture works without controlling a neighboring sector');
  }
 }
});

test('territory-war: 5 seconds only for exposed enemy territory; protected guns or guards preserve 8 seconds',()=>{
 const t=sector(1,1,[0],35);
 const input={version:14,territory:t,attacker:0,units:[],bases:[]};
 assert.equal(captureSeconds(input),5);
 assert.equal(captureSeconds({...input,version:10}),RULES.captureTime);
 assert.equal(captureSeconds({...input,territory:{...t,owner:-1}}),RULES.captureTime);
 assert.equal(captureSeconds({...input,units:[{owner:1,hp:100,x:t.point.x+230,y:t.point.y}]}),8);
 assert.equal(captureSeconds({...input,units:[{owner:1,hp:0,x:t.point.x+10,y:t.point.y}]}),5);
 assert.equal(captureSeconds({...input,bases:[{owner:1,kind:'turret',hp:650,buildRemaining:0,x:t.point.x+610,y:t.point.y}]}),8);
 assert.equal(captureSeconds({...input,bases:[{owner:1,kind:'turret',hp:650,buildRemaining:4,x:t.point.x+600,y:t.point.y}]}),5);
 assert.equal(captureSeconds({...input,bases:[{owner:1,kind:'turret',hp:0,x:t.point.x+300,y:t.point.y}]}),5);
 assert.equal(captureSeconds({...input,attacker:1,territory:{...t,owner:0}}),5,'red receives the same rule');
});

test('territory-war: real 20-Hz simulation captures an exposed enemy bastion in 5s with full income and saves intact',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;g.units=[];
 const home=g.territories.find(t=>t.owner===0),hqs=g.bases.filter(b=>b.kind==='headquarters');
 const t=home.neighbors.map(i=>g.territories[i]).find(t=>t.owner===-1&&!hqs.some(h=>h.territory===t.id));
 assert.ok(t,'safe adjacent test bastion');
 t.owner=1;const before=g.income(0);
 const infantry=g.spawn(0,{...t.point});assert.ok(infantry);
 assert.equal(g.captureReadiness(t,0),'capturing');
 step(g,4.85);assert.equal(t.owner,1);
 step(g,.30);assert.equal(t.owner,0);
 assert.equal(g.income(0),before+t.income,'no hidden income handicap');
 const restored=Simulation.load(g.save());
 assert.equal(restored.territories[t.id].owner,0);
 assert.equal(restored.income(0),g.income(0));
});

test('territory-war: simulation blocks enemy HQ and contest even when two-hop flank qualifies',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;g.units=[];
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'),t=g.territories[hq.territory];
 const neighbor=t.neighbors[0];g.territories[neighbor].owner=-1;
 const landing=g.territories[neighbor].neighbors.find(id=>id!==t.id);
 assert.ok(landing!==undefined);
 g.territories[landing].owner=0;
 assert.equal(canCaptureSector(g.territories,t,0,14),true);
 const infantry=g.spawn(0,{...t.point});
 assert.equal(g.captureReadiness(t,0),'enemy-hq');
 step(g,6);
 assert.equal(t.owner,1,'HQ fortification must survive a bypass');
 hq.hp=0;g.bases=g.bases.filter(b=>b!==hq);
 assert.equal(g.captureReadiness(t,0),'capturing');
 const defender=g.spawn(1,{...t.point});
 assert.equal(g.captureReadiness(t,0),'contested');
 void infantry;void defender;
});

test('territory-war: observable two-bastion deficit activates comeback; prioritize income and avoid guarded routes',()=>{
 const t=[sector(0,0,[1]),sector(1,0,[0,2]),sector(2,0,[1,3]),sector(3,1,[2])];
 assert.equal(comebackPressure(t,1),true);
 assert.equal(comebackPressure(t,0),false);
 t[1].owner=1;assert.equal(comebackPressure(t,1),false);
 const fronts=[
  {id:2,owner:0,income:35,routeLength:650,routeRisk:1,protected:false,recentlyLost:false},
  {id:1,owner:0,income:15,routeLength:700,routeRisk:1,protected:false,recentlyLost:false},
  {id:3,owner:0,income:50,routeLength:300,routeRisk:0,protected:true,recentlyLost:false},
  {id:4,owner:0,income:50,routeLength:100,routeRisk:9,protected:false,recentlyLost:false}
 ];
 assert.equal(chooseComebackOpportunity(fronts)?.id,2,'prefer lucrative but safe sector');
 assert.equal(chooseComebackOpportunity(fronts.map(f=>({...f,protected:true}))),undefined);
 assert.equal(chooseComebackOpportunity(fronts.filter(f=>f.owner!==0)),undefined);
});

test('territory-war: AI may assign two paid mobile fighters to a reachable exposed counterraid',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;g.time=90;g.credits[1]=0;
 const red=g.territories.find(t=>t.owner===1),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const candidates=red.neighbors.map(i=>g.territories[i]).filter(t=>t.owner===-1);
 assert.ok(candidates.length>=2);
 for(const t of candidates.slice(0,2))t.owner=0;
 assert.equal(comebackPressure(g.territories,1),true);
 const fighters=[];g.units=[];
 for(let i=0;i<6;i++)fighters.push(g.spawn(1,g.world.nearest({
  x:home.x+(home.x>g.world.size/2?-150:150)+(i%3)*22,
  y:home.y+(home.y>g.world.size/2?-150:150)+Math.floor(i/3)*22
 },g.obstacles())??{x:home.x+160,y:home.y+160},i%2?'rover':'infantry'));
 g.updateVision();
 const raids=g.tactical.secondaryPressure(fighters,{sector:red.id},home);
 assert.equal(raids.size,2,'only two of six existing fighters may raid');
 assert.ok(g.tactical.state.battle.squads.some(s=>s.role==='raid'&&s.ids.length===2));
 assert.ok(fighters.filter(f=>!raids.has(f.id)).length>=4,'main body remains intact');
 for(const id of raids){
  const u=fighters.find(f=>f.id===id);
  assert.equal(u.orders[0]?.kind,'attackMove');
  const target=g.tactical.state.battle.squads.find(s=>s.role==='raid').target;
  assert.equal(g.territories[target].owner,0);
 }
});
