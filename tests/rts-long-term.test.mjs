import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';
import {MaritimeNavigation,COASTS,validSeaRoute} from '../dist/src/engine/navigation.js';
import {nextRTSCampaignStep} from '../dist/src/engine/rts-path.js';
import {rtsActualLoss} from '../dist/src/engine/rts-frontage.js';

const unit=(id,owner,index,troops)=>({id,owner,index,troops,destination:null,
  attackTarget:null,campaignTarget:null,campaignOwner:null});
function borderScenario(){
  const g=new Game(20261013,1,'DE','balanced',true);
  const start=g.owner.findIndex((owner,tile)=>owner===1&&landNeighbors(tile).some(n=>g.owner[n]===-1));
  const target=landNeighbors(start).find(tile=>g.owner[tile]===-1);
  const barracks=g.owner.findIndex((owner,tile)=>owner===1&&g.canBuild(1,cellToPoint(tile),'barracks').ok);
  assert.ok(start>=0&&target!==undefined&&barracks>=0);
  g.buildings[barracks]=4;g.factions[1].money=0;g.owner[target]=0;g.tick=1;
  const army=unit(100,1,start,100),enemy=unit(101,0,target,300);
  g.squads.push(army,enemy);
  return {g,start,target,barracks,army,enemy};
}

test('a rejected costly target is not retried until reassessment, without blocking other objectives',()=>{
  const {g,target,army,enemy}=borderScenario();
  const before=army.troops;
  assert.equal(g.orderSquadAttack(1,army.id,cellToPoint(target)).ok,false);
  g.squads.splice(g.squads.indexOf(enemy),1);
  for(let tick=2;tick<65;tick++){
    g.tick=tick;
    assert.equal(g.orderSquadAttack(1,army.id,cellToPoint(target)).ok,false);
  }
  assert.equal(army.troops,before);
  const neutral=landNeighbors(army.index).find(tile=>g.owner[tile]===-1);
  assert.ok(neutral!==undefined);
  assert.equal(g.orderSquadAttack(1,army.id,cellToPoint(neutral)).ok,true);
  g.tick=65;
  assert.equal(g.orderSquadAttack(1,army.id,cellToPoint(target)).ok,true);
});

test('a costly active campaign disengages over real owned steps even when the first step remains exposed',()=>{
  const {g,start,target,barracks,army,enemy}=borderScenario();
  enemy.troops=100;army.troops=75;army.aiCampaignStrength=100;
  army.campaignTarget=target;army.campaignOwner=0;
  const soldiers=g.squads.reduce((n,s)=>n+s.troops,0);
  assert.equal(g.recoverRTSSquad(army,barracks,true,tile=>g.rtsExposure(1,tile)),true);
  assert.equal(army.campaignTarget,null);
  assert.equal(army.aiRejectedTarget,target);
  assert.ok(army.destination!=null&&army.destination!==start);
  assert.equal(g.rtsExposure(1,army.destination),0);
  assert.equal(g.squads.reduce((n,s)=>n+s.troops,0),soldiers);
  g.moveSquads();
  const dx=Math.abs(army.index%480-start%480),dy=Math.abs(Math.floor(army.index/480)-Math.floor(start/480));
  assert.ok(dx<=1&&dy<=1&&dx+dy>0,'withdrawal must march, never teleport');
});

test('valuable affordable assaults remain possible while disproportionate ordinary targets are rejected',()=>{
  const {g,target,army,enemy}=borderScenario();
  enemy.troops=100;
  assert.equal(g.orderSquadAttack(1,army.id,cellToPoint(target)).ok,false);
  g.capitalSites.add(target);g.tick=65;
  assert.equal(g.orderSquadAttack(1,army.id,cellToPoint(target)).ok,true);
  assert.equal(army.troops,100);
});

test('bounded path searches cannot flood an unreachable map indefinitely',()=>{
  const width=100,height=100;
  const neighbors=Array.from({length:width*height},(_,tile)=>[
    ...(tile%width?[tile-1]:[]),...(tile%width<width-1?[tile+1]:[]),
    ...(tile>=width?[tile-width]:[]),...(tile<(height-1)*width?[tile+width]:[])
  ]);
  let inspected=0,path;
  const next=nextRTSCampaignStep(0,width*height-1,width,neighbors,tile=>{
    inspected++;return Math.floor(tile/width)!==60;
  },{maxVisits:64,onPath:route=>{path=route;}});
  assert.equal(next,null);
  assert.equal(path,undefined);
  assert.ok(inspected<=257,`64 expanded nodes inspected ${inspected} entries`);
});

test('RTS planning reuses the maintained frontier index instead of rebuilding the map per command',()=>{
  const g=new Game(20261013,8,'DE','balanced',true);
  for(let i=0;i<12;i++)g.step();
  const rebuild=g.rebuildFrontierCandidates.bind(g);let rebuilds=0;
  g.rebuildFrontierCandidates=()=>{rebuilds++;return rebuild();};
  for(let i=0;i<4;i++)g.commandRTSAI();
  assert.equal(rebuilds,0);
  const target=[...g.frontierCandidates[1]].find(tile=>g.owner[tile]===-1);
  assert.ok(target!==undefined);
  g.captureTile(g.factions[1],target);
  for(const tile of landNeighbors(target))if(g.owner[tile]!==1&&g.owner[tile]!==-2)
    assert.ok(g.frontierCandidates[1].has(tile),'captures must maintain the reused index');
});

test('defeated fractional remnants are included in real casualties',()=>{
  assert.equal(rtsActualLoss(1.44,1),1.44);
  assert.equal(rtsActualLoss(100,1),1);
  assert.equal(rtsActualLoss(5,100),5);
  assert.equal(rtsActualLoss(.5,0),0);
});

test('RTS occupation books real posted guards when bypassing classic strikes',()=>{
  const {g,target}=borderScenario();
  g.frontline[target]=1.4958208006428322;
  const before=g.factions[0].defenseSpent;
  g.captureTile(g.factions[1],target);
  assert.equal(g.frontline[target],0);
  assert.equal(g.factions[0].defenseSpent-before,1.4958208006428322);
  g.captureTile(g.factions[1],target);
  assert.equal(g.factions[0].defenseSpent-before,1.4958208006428322,'no double casualty booking');
});

test('removing an earlier defeated defender cannot process the attacker twice in one tick',()=>{
  const g=new Game(20261013,1,'DE','balanced',true);
  const start=g.owner.findIndex((owner,tile)=>owner===0&&tile%480<478&&
    g.owner[tile+1]===-1&&g.owner[tile+2]===-1);
  assert.ok(start>=0);
  const target=start+1;g.owner[target]=1;
  const defender=unit(100,1,target,1),attacker=unit(101,0,start,100);
  attacker.attackTarget=target;attacker.campaignTarget=start+2;attacker.campaignOwner=-1;
  g.squads.push(defender,attacker);
  g.moveSquads();
  assert.equal(attacker.index,target,'one physical step per simulation tick');
  assert.ok(!g.squads.includes(defender));
});

test('a saved owned march retains its route and replans when the next cell is blocked',()=>{
  const g=new Game(221041,1,'DE','balanced',true);
  const start=g.owner.findIndex((holder,tile)=>holder===0&&
    [tile+1,tile+2,tile+3,tile+480,tile+481,tile+482,tile+483].every(n=>g.owner[n]===0));
  assert.ok(start>=0);
  const army=unit(100,0,start,35);g.squads.push(army);
  assert.ok(g.orderSquad(0,army.id,cellToPoint(start+3)).ok);
  g.moveSquads();
  assert.ok(army.marchRoute?.length>=2);
  g.recount();
  const snapshot=g.exportSave();
  const restored=Game.fromSave(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(restored.exportSave(),snapshot);
  const restoredArmy=restored.squads.find(s=>s.id===army.id),cached=restoredArmy.marchRoute;
  restored.moveSquads();
  assert.equal(restoredArmy.marchRoute,cached,'an unchanged legal march must reuse its route');
  const blocked=army.marchRoute[0];g.owner[blocked]=-2;
  const previous=army.index;g.moveSquads();
  assert.notEqual(army.index,blocked);
  assert.ok(Math.abs(previous%480-army.index%480)<=1&&
    Math.abs(Math.floor(previous/480)-Math.floor(army.index/480))<=1);
});

test('retired highest squad identifiers remain retired across JSON save/load',()=>{
  const g=new Game(713,1,'DE','balanced',true);
  const site=g.owner.findIndex((holder,tile)=>holder===0&&g.canBuild(0,cellToPoint(tile),'barracks').ok);
  assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
  g.factions[0].money=2000;
  assert.ok(g.recruitSquad(0,cellToPoint(site),100).ok);
  const retired=g.squads.pop().id;
  const save=JSON.parse(JSON.stringify(g.exportSave()));
  const restored=Game.fromSave(save);
  assert.ok(restored.recruitSquad(0,cellToPoint(site),100).ok);
  assert.ok(restored.squads[0].id>retired);
  const legacy=structuredClone(save);delete legacy.nextSquadId;
  assert.doesNotThrow(()=>Game.fromSave(legacy));
  assert.throws(()=>Game.fromSave({...save,nextSquadId:0}));
});

test('navigation retains current country fields and bounded memory without landlocked cache pollution',()=>{
  const g=new Game(20261013,49,'DE','balanced',true),nav=new MaritimeNavigation();
  const owners=[...new Set(COASTS.map(tile=>g.owner[tile]).filter(owner=>owner>=0))].slice(0,9);
  assert.equal(owners.length,9);
  for(const owner of owners)nav.field(g.owner,owner);
  assert.equal(nav.cache.size,8);
  const owner=owners.at(-1),field=nav.field(g.owner,owner);
  const empty=nav.field(g.owner,999);
  for(let id=1000;id<1020;id++)assert.equal(nav.field(g.owner,id),empty);
  assert.equal(nav.field(g.owner,owner),field);
  assert.equal(nav.cache.size,8);
});

test('embarked soldiers neither receive nor deal inland contact or tower damage from a port marker',()=>{
  const g=new Game(20261013,1,'DE','balanced',true);
  const start=COASTS.find(tile=>g.owner[tile]===-1&&landNeighbors(tile).some(n=>g.owner[n]!==-2));
  assert.ok(start!==undefined);g.owner[start]=1;
  let route;
  for(const tile of COASTS)if(g.owner[tile]===-1){
    const candidate=g.maritimeRoute(1,cellToPoint(tile));
    if(candidate&&validSeaRoute(candidate.cells)&&candidate.cells[0]===start){route=candidate;break;}
  }
  assert.ok(route);
  const adjacent=landNeighbors(start).find(tile=>g.owner[tile]!==-2);
  assert.ok(adjacent!==undefined);g.owner[adjacent]=0;g.buildings[adjacent]=2;
  const fleet=unit(100,1,start,100),enemy=unit(101,0,adjacent,100);
  Object.assign(fleet,{seaRoute:route.cells,seaLanding:route.cells.at(-1),seaTicks:1});
  g.squads.push(fleet,enemy);g.resolveSquadContacts();
  assert.equal(fleet.troops,100);assert.equal(enemy.troops,100);
  fleet.destination=start;g.resolveSquadContacts();
  assert.ok(fleet.troops<100&&enemy.troops<100,'soldiers awaiting departure still fight on land');
});

test('a 1000-tick campaign replays identically after a real JSON save/load at tick 500',()=>{
  const original=new Game(20261024,8,'DE','balanced',true);
  const initialPeople=original.factions.reduce((n,f)=>n+f.population,0);
  let recruits=0;
  const recruit=original.recruitSquad.bind(original);
  original.recruitSquad=(...args)=>{
    const result=recruit(...args);if(result.ok)recruits+=args[2];return result;
  };
  const balanced=()=>{
    const people=original.factions.reduce((n,f)=>n+f.population,0);
    const losses=original.factions.reduce((n,f)=>n+f.attackFallen+f.defenseSpent,0);
    assert.ok(Math.abs(initialPeople+recruits-losses-people)<1e-6,
      `unbalanced soldier count at tick ${original.tick}`);
  };
  for(let tick=0;tick<500;tick++){original.status='playing';original.step();balanced();}
  const snapshot=original.exportSave();
  const restored=Game.fromSave(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(restored.exportSave(),snapshot);
  for(let tick=500;tick<1000;tick++){
    original.status='playing';restored.status='playing';original.step();restored.step();
    balanced();
  }
  assert.deepEqual(original.exportSave(),restored.exportSave());
  assert.ok(original.squads.every(s=>s.troops>0&&original.owner[s.index]===s.owner));
});
