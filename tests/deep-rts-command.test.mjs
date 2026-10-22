import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors,isSquadEmbarked} from '../dist/src/engine/game.js';
import {BUILDING_CODES} from '../dist/src/engine/economy.js';
import {chooseRTSTheaterTarget} from '../dist/src/engine/rts-strategy.js';
const unit=(id,owner,index,troops=100)=>({id,owner,index,troops,destination:null,attackTarget:null,campaignTarget:null,campaignOwner:null});
function fixture(opponents=1){
 const g=new Game(20261022,opponents,'DE','balanced',true);
 const site=g.owner.findIndex((owner,tile)=>owner===1&&g.canBuild(1,cellToPoint(tile),'barracks').ok);
 g.buildings[site]=BUILDING_CODES.barracks;g.factions[1].money=0;g.tick=1;
 const border=g.owner.findIndex((owner,tile)=>owner===1&&landNeighbors(tile).some(n=>g.owner[n]===-1));
 const target=landNeighbors(border).find(n=>g.owner[n]===-1);
 return {g,site,border,target};
}
function embark(squad,landing){Object.assign(squad,{seaRoute:[squad.index,squad.index+480,landing],seaLanding:landing,seaTicks:1});return squad;}

test('embarked armies cannot return instantly to land through orders, recall, or classic commitment',()=>{
 const {g,border,target}=fixture();g.owner[target]=0;
 const fleet=embark(unit(501,1,border),target);g.squads.push(fleet);
 const before=g.exportSave();assert.ok(isSquadEmbarked(fleet));
 assert.equal(g.orderSquad(1,fleet.id,cellToPoint(border)).ok,false);
 assert.equal(g.orderSquadAttack(1,fleet.id,cellToPoint(target)).ok,false);
 assert.equal(g.recallSquad(1,fleet.id).ok,false);
 assert.equal(g.attackWithSquad(1,fleet.id,cellToPoint(target)).ok,false);
 assert.deepEqual(g.exportSave(),before);
});

test('embarked armies do not project land threat; units still marching to port remain vulnerable',()=>{
 const {g,border,target}=fixture();g.owner[target]=0;
 const fleet=embark(unit(501,0,target),border);g.squads.push(fleet);
 assert.equal(g.rtsExposure(1,border),0);
 fleet.destination=target;
 assert.equal(isSquadEmbarked(fleet),false);
 assert.equal(g.rtsExposure(1,border),8.5);
});

test('a ship at its bookkeeping port cannot screen nearby neutral occupation',()=>{
 const {g,border,target}=fixture();
 const port=landNeighbors(target).find(n=>n!==border&&g.owner[n]!==-2);
 assert.ok(port!==undefined);g.owner[port]=0;
 const fleet=embark(unit(501,0,port),target),army=unit(502,1,border);
 g.squads.push(fleet,army);g.moveSquads();
 assert.equal(g.owner[target],1);
 assert.equal(fleet.troops,100);assert.equal(g.factions[0].attackFallen,0);
});

test('returned formations receive only affordable paid reinforcements at their physical barracks',()=>{
 const {g,site}=fixture();
 const remote=g.owner.findIndex((owner,tile)=>owner===1&&tile!==site);
 const returned=unit(501,1,site,20),away=unit(502,1,remote,20);
 g.squads.push(returned,away);g.factions[1].money=340;g.recount();
 const people=g.factions[1].population,mobile=g.factions[1].troops;
 g.commandRTSAI();g.recount();
 assert.equal(returned.troops,100);assert.equal(away.troops,20);
 assert.equal(g.factions[1].money,180);assert.equal(g.factions[1].population,people+80);
 assert.equal(g.factions[1].troops,mobile);
});

test('nearby actual connected reserves can coordinate an affordable assault',()=>{
 const {g,border,target}=fixture();g.owner[target]=0;
 const lead=unit(501,1,border),enemy=unit(504,0,target);
 g.squads.push(lead,unit(502,1,border),unit(503,1,border),enemy);
 assert.equal(g.rtsAssaultStrength(lead,target),300);
 assert.ok(g.orderSquadAttack(1,lead.id,cellToPoint(target)).ok);
 assert.equal(lead.troops,100);assert.equal(enemy.troops,100);
});

test('ships and disconnected nearby territory cannot inflate assault strength',()=>{
 const {g,border,target}=fixture();
 const lead=unit(501,1,border),fleet=embark(unit(502,1,border),target);
 const island=border+3;g.owner[island]=1;g.owner[border+1]=-2;g.owner[border+2]=-2;
 // Isolate the additional army while retaining the lead formation's real land.
 for(const neighbor of landNeighbors(island))g.owner[neighbor]=-2;
 g.squads.push(lead,fleet,unit(503,1,island));
 assert.equal(g.rtsAssaultStrength(lead,target),100);
});

test('RTS economic development buys safe linked industry using the public prices',()=>{
 const {g,site}=fixture();g.factions[1].money=1000;g.recount();
 const people=g.factions[1].population,income=g.factions[1].moneyIncome;
 g.developRTSEconomy(g.factions[1],site,()=>0);g.recount();
 const factories=g.buildings.reduce((n,code)=>n+Number(code===BUILDING_CODES.factory),0);
 assert.equal(factories,1);assert.equal(g.factoryLinks.size,1);
 assert.equal(g.factions[1].money,800);assert.equal(g.factions[1].population,people);
 assert.ok(Math.abs(g.factions[1].moneyIncome-income-.75)<1e-9);
});

test('RTS economy preserves emergency gold and never builds in actual contact exposure',()=>{
 const {g,site}=fixture();g.factions[1].money=579;
 g.developRTSEconomy(g.factions[1],site,()=>0);
 assert.equal(g.factions[1].money,579);g.factions[1].money=1000;
 g.developRTSEconomy(g.factions[1],site,()=>1);
 assert.equal(g.factions[1].money,1000);assert.equal(g.factoryLinks.size,0);
});

test('RTS defensive fatalities remain visible for the tick in which the battle occurs',()=>{
 const {g,border,target}=fixture();g.owner[target]=0;
 g.factions.forEach(f=>f.ai=false);
 const attacker=unit(501,1,border),defender=unit(502,0,target);
 attacker.attackTarget=target;attacker.campaignTarget=target;attacker.campaignOwner=0;
 g.squads.push(attacker,defender);g.recount();
 const before=g.factions[0].defenseSpent;g.step();
 assert.ok(g.factions[0].defenseFallenTick>0);
 assert.equal(g.factions[0].defenseSpent-before,g.factions[0].defenseFallenTick);
});

test('RTS personalities choose different viable strategic goals from identical observed facts',()=>{
 const neutral={tile:10,neutral:true,defenderStrength:0,assaultStrength:100,distance:1,strategicValue:0,committed:0};
 const hostile={...neutral,tile:11,neutral:false,defenderStrength:20,strategicValue:30};
 assert.equal(chooseRTSTheaterTarget([neutral,hostile],'expansion'),10);
 assert.equal(chooseRTSTheaterTarget([neutral,hostile],'defensive'),10);
 assert.equal(chooseRTSTheaterTarget([neutral,hostile],'aggressive'),11);
 assert.equal(chooseRTSTheaterTarget([neutral,hostile],'opportunist'),11);
});

test('battle telemetry attributes simultaneous overkill to real fatalities only',()=>{
 const {g,border}=fixture();
 const positions=landNeighbors(border).filter(tile=>g.owner[tile]!==-2).slice(0,2);
 assert.equal(positions.length,2);
 const victim=unit(501,1,border,1);
 g.squads.push(victim,...positions.map((tile,i)=>{g.owner[tile]=0;return unit(502+i,0,tile);}));
 const people=g.squads.reduce((n,u)=>n+u.troops,0);g.resolveSquadContacts();
 const events=g.battleEvents.reduce((n,e)=>n+e.attackerLost+e.defenderLost,0);
 const losses=people-g.squads.reduce((n,u)=>n+u.troops,0);
 assert.ok(Math.abs(events-losses)<1e-9);
 const victimEvents=g.battleEvents.reduce((n,e)=>n+
  (e.attackerId===1?e.attackerLost:0)+(e.defenderId===1?e.defenderLost:0),0);
 assert.equal(victimEvents,1);
});

test('tower telemetry identifies the actual enemy and does not invent defending infantry',()=>{
 const {g,border,target}=fixture();g.owner[target]=0;g.buildings[target]=BUILDING_CODES.tower;
 g.squads.push(unit(501,1,border));g.resolveSquadContacts();
 assert.equal(g.battleEvents.length,1);
 const event=g.battleEvents[0];assert.equal(event.attackerId,1);assert.equal(event.defenderId,0);
 assert.equal(event.defending,0);assert.equal(event.attackerLost,3);
});

function remnantScenario(){
 const {g,site,border,target}=fixture();
 // Controlled late-game ownership, using only the real map's land cells.
 for(let tile=0;tile<g.owner.length;tile++){
  if(g.owner[tile]===0)g.owner[tile]=-1;
  const dx=Math.abs(tile%480-site%480),dy=Math.abs(Math.floor(tile/480)-Math.floor(site/480));
  if(dx<=22&&dy<=22&&g.owner[tile]!==-2)g.owner[tile]=1;
 }
 g.owner[target]=0;g.tick=601;
 const army=unit(501,1,border);g.squads.push(army);g.recount();g.rebuildFrontierCandidates();
 assert.ok(g.factions[1].territory>=200);assert.equal(g.factions[0].territory,1);
 return {g,army,target};
}

test('late-game commander finishes a nearby safe remnant with a real campaign despite neutral outlets',()=>{
 const {g,army,target}=remnantScenario();const troops=army.troops,owner=g.owner.slice();
 g.commandRTSAI();
 assert.equal(army.campaignTarget,target);assert.equal(army.campaignOwner,0);
 assert.equal(army.troops,troops);assert.deepEqual(g.owner,owner,'planning cannot annex remote sectors');
 g.moveSquads();assert.equal(g.owner[target],1,'only physical occupation finishes the remnant');
});

test('cleanup priority respects real defenders and diplomatic allies',()=>{
 const {g,army,target}=remnantScenario();g.squads.push(unit(502,0,target));
 g.commandRTSAI();assert.notEqual(army.campaignTarget,target);
 const allied=remnantScenario();allied.g.alliances.push({a:0,b:1,sinceTick:0});
 allied.g.commandRTSAI();assert.notEqual(allied.army.campaignTarget,allied.target);
});

test('remnant selection has a stable tile tie-break across rebuilt and reversed frontier sets',()=>{
 const {g,army,target}=remnantScenario();
 const other=landNeighbors(army.index).find(tile=>g.owner[tile]===1&&!g.buildings[tile]&&!g.capitalSites.has(tile));
 assert.ok(other!==undefined);g.owner[other]=0;g.recount();g.rebuildFrontierCandidates();
 const restored=Game.fromSave(JSON.parse(JSON.stringify(g.exportSave())));
 g.frontierCandidates[1]=new Set([...g.frontierCandidates[1]].reverse());
 g.commandRTSAI();restored.commandRTSAI();
 assert.equal(army.campaignTarget,Math.min(target,other));
 assert.equal(restored.squads.find(u=>u.id===army.id).campaignTarget,army.campaignTarget);
});

test('an exposed AI army silences a lone tower by a real paid-strength assault',()=>{
 const {g,border,target}=fixture();g.owner[target]=0;g.buildings[target]=BUILDING_CODES.tower;
 const army=unit(501,1,border);g.squads.push(army);g.recount();
 const troops=army.troops,money=g.factions[1].money;
 g.commandRTSAI();
 assert.equal(army.campaignTarget,target);assert.equal(army.campaignOwner,0);
 assert.equal(g.owner[target],0,'planning cannot capture the tower');
 assert.equal(army.troops,troops);assert.equal(g.factions[1].money,money);
 g.moveSquads();
 assert.equal(g.owner[target],1);assert.equal(army.index,target);
 assert.ok(army.troops<troops&&army.troops>troops-10);
 assert.ok(Math.abs(troops-army.troops-g.factions[1].attackFallen)<1e-9);
});

test('tower suppression respects real guards, allied land, truces and depleted armies',()=>{
 for(const condition of ['guard','ally','truce','depleted']){
  const {g,border,target}=fixture(condition==='truce'?2:1),holder=condition==='truce'?2:0;
  g.owner[target]=holder;g.buildings[target]=BUILDING_CODES.tower;
  const army=unit(501,1,border,condition==='depleted'?30:100);g.squads.push(army);
  if(condition==='guard')g.squads.push(unit(502,0,target));
  if(condition==='ally')g.alliances.push({a:0,b:1,sinceTick:0});
  if(condition==='truce'){g.factions[2].ai=false;g.warTruces.push({a:1,b:2,untilTick:g.tick+100});}
  g.recount();g.commandRTSAI();
  assert.notEqual(army.campaignTarget,target,condition);
  assert.equal(g.owner[target],holder);assert.equal(g.buildings[target],BUILDING_CODES.tower);
 }
});

test('a two-sector tower assault survives an emergency alert and a JSON reload',()=>{
 const {g,border,target}=fixture();
 const start=landNeighbors(border).find(tile=>g.owner[tile]===1&&tile!==target&&
  !landNeighbors(tile).includes(target));assert.ok(start!==undefined);
 g.owner[target]=0;g.buildings[target]=BUILDING_CODES.tower;
 const invader=g.owner.findIndex((holder,tile)=>holder===-1&&landNeighbors(tile).some(n=>g.owner[n]===1)&&
  Math.abs(tile%480-target%480)+Math.abs(Math.floor(tile/480)-Math.floor(target/480))>8);
 assert.ok(invader>=0);g.owner[invader]=0;g.squads.push(unit(502,0,invader,30));
 const army=unit(501,1,start);g.squads.push(army);g.recount();g.commandRTSAI();
 assert.equal(army.campaignTarget,target);
 const restored=Game.fromSave(JSON.parse(JSON.stringify(g.exportSave())));
 for(let tick=0;tick<2;tick++){
  for(const game of [g,restored]){game.tick++;game.commandRTSAI();game.moveSquads();game.resolveSquadContacts();}
 }
 assert.equal(g.owner[target],1);assert.equal(army.index,target);
 assert.deepEqual(restored.exportSave(),g.exportSave());
});

test('a late friendly capture clears a marching attack waypoint before saving the tick',()=>{
 const {g,border,target}=fixture();g.factions.forEach(f=>f.ai=false);
 const remote=g.owner.findIndex((holder,tile)=>holder===1&&
  Math.abs(tile%480-border%480)+Math.abs(Math.floor(tile/480)-Math.floor(border/480))>3);
 assert.ok(remote>=0);g.owner[target]=0;g.buildings[target]=BUILDING_CODES.tower;
 const attacker=unit(501,1,border),marcher=unit(502,1,remote);
 Object.assign(attacker,{attackTarget:target,campaignTarget:target,campaignOwner:0});
 Object.assign(marcher,{destination:border,attackTarget:target,campaignTarget:target,campaignOwner:0});
 // Reverse movement order: the distant army marches first; the local army
 // captures its future waypoint afterwards in the same simulation tick.
 g.squads.push(attacker,marcher);g.recount();g.step();
 assert.equal(g.owner[target],1);assert.notEqual(marcher.destination,null);
 assert.equal(marcher.attackTarget,null);assert.equal(marcher.campaignTarget,target);
 const save=g.exportSave();assert.deepEqual(Game.fromSave(JSON.parse(JSON.stringify(save))).exportSave(),save);
});
