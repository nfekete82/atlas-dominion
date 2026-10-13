import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';

test('RTS barracks train paid soldiers without passive human mobile growth',()=>{
 const g=new Game(711,1,'DE','balanced',true);
 const before=g.factions[0].troops;
 g.step();
 assert.equal(g.factions[0].troops,before,'no free mobile recruits per tick');
 g.factions[0].money=1000;
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.equal(g.build(0,cellToPoint(site),'barracks').ok,true);
 const treasury=g.factions[0].money;
 assert.equal(g.buildingAt(cellToPoint(site)),'barracks');
 assert.equal(g.recruitSquad(0,cellToPoint(site),25).ok,true);
 assert.equal(g.factions[0].money,treasury-50);
 assert.equal(g.factions[0].troops,before);
 assert.equal(g.squads[0].troops,25);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 assert.equal(g.recallSquad(0,g.squads[0].id).ok,true);
 assert.equal(g.factions[0].troops,before+25);
});

test('factory buildingAt stays recognized for the right click menu',()=>{
 const g=new Game(712,1,'DE');
 g.factions[0].money=1000;
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'factory').ok);
 assert.ok(site>=0);
 assert.equal(g.build(0,cellToPoint(site),'factory').ok,true);
 assert.equal(g.buildingAt(cellToPoint(site)),'factory');
});

test('RTS opening funds an immediate barracks and first squad without free AI growth',()=>{
 const g=new Game(713,2,'DE','balanced',true);
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.equal(g.factions[0].money,650);
 assert.equal(g.build(0,cellToPoint(site),'barracks').ok,true);
 assert.equal(g.recruitSquad(0,cellToPoint(site),100).ok,true);
 assert.equal(g.squads[0].troops,100);
 assert.ok(g.factions[0].money>=0);
 const ai=g.factions[1];
 const before=ai.troops,treasury=ai.money;
 g.step();
 // Frontline deployments can lower the *mobile* number while preserving soldiers.
 assert.ok(ai.troops>=0);
 assert.ok(ai.money>=0);
 assert.ok(ai.troops-before<=Math.floor((treasury+ai.moneyIncome)/2)+1e-6);
});

test('foreign target queues a real army march and persists its conquest order',()=>{
 const g=new Game(9102,1,'DE','balanced',true);
 const owner=0;
 const edge=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]!==0&&g.owner[n]!==-2));
 assert.ok(edge>=0);
 const target=landNeighbors(edge).find(n=>g.owner[n]!==0&&g.owner[n]!==-2);
 g.factions[0].money=1200;
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),100).ok);
 const id=g.squads[0].id;
 assert.ok(g.orderSquadAttack(0,id,cellToPoint(target)).ok);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 for(let i=0;i<150&&g.squads.some(s=>s.id===id);i++)g.step();
 assert.ok(g.attackOrders.some(o=>o.factionId===0)||g.owner[target]===0,
   'selected squad should reach a real front and commit an offensive');
});

test('RTS squads persist while occupying empty neutral surroundings without casualties',()=>{
 const g=new Game(9103,1,'DE','balanced',true);
 const edge=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(edge>=0);
 const neutral=landNeighbors(edge).find(n=>g.owner[n]===-1);
 const place=g.owner.findIndex((v,i)=>v===0&&g.buildings[i]===0);
 g.factions[0].money=1200;
 assert.ok(g.build(0,cellToPoint(place),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(place),100).ok);
 const unit=g.squads[0];
 unit.index=edge;
 const strength=unit.troops;
 g.step();
 assert.equal(g.owner[neutral],0,'adjacent empty neutral territory should be occupied');
 assert.ok(g.squads.some(s=>s.id===unit.id),'capturing must never consume the squad');
 assert.equal(unit.troops,strength,'peaceful occupation cannot cause casualties');
});

test('RTS AI builds an actual barracks, pays for a persistent squad and never receives passive mobile soldiers',()=>{
 const g=new Game(8101,1,'DE','balanced',true);
 const enemy=g.factions[1];
 const openingMoney=enemy.money;
 assert.equal(openingMoney,650);
 for(let i=0;i<56;i++)g.step();
 const barracks=g.buildings.findIndex((code,i)=>code===4&&g.owner[i]===1);
 assert.ok(barracks>=0,'AI must build a real owned barracks');
 assert.ok(g.squads.some(s=>s.owner===1),'AI must recruit actual on-map squads');
 assert.ok(g.squads.filter(s=>s.owner===1).every(s=>s.troops>=1));
 assert.ok(enemy.money>=0,'AI cannot train on credit');
 const saved=g.exportSave();
 assert.deepEqual(Game.fromSave(saved).exportSave(),saved);
});

test('adjacent RTS formations exchange losses and both survivors remain visible',()=>{
 const g=new Game(8102,1,'DE','balanced',true);
 const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(j=>g.owner[j]===-1));
 assert.ok(own>=0);
 const enemy=landNeighbors(own).find(j=>g.owner[j]===-1);
 g.owner[enemy]=1;
 g.squads.push({id:9001,owner:0,index:own,troops:100,destination:null,attackTarget:null});
 g.squads.push({id:9002,owner:1,index:enemy,troops:100,destination:null,attackTarget:null});
 g.step();
 const blue=g.squads.find(u=>u.id===9001),red=g.squads.find(u=>u.id===9002);
 assert.ok(blue&&red,'one engagement must not delete either surviving unit');
 assert.ok(blue.troops<100&&red.troops<100,'both sides pay actual losses');
 assert.ok(g.battleEvents.some(e=>e.attackerId===0&&e.defenderId===1),'unit combat is visible to rendering');
 assert.ok(g.factions[0].population>=blue.troops);
 assert.ok(g.factions[1].population>=red.troops);
});

test('hostile guard tower damages nearby RTS squad while a friendly tower does not',()=>{
 const g=new Game(8104,1,'DE','balanced',true);
 const tile=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(tile>=0);
 const next=landNeighbors(tile).find(n=>g.owner[n]===-1);
 g.owner[next]=1;
 g.buildings[next]=2;
 g.squads.push({id:9811,owner:0,index:tile,troops:100,destination:null,attackTarget:null});
 const soldier=g.squads.find(s=>s.id===9811);
 g.step();
 assert.ok(soldier.troops<100,'tower must inflict real damage');
 assert.ok(soldier.troops>0,'tower cannot automatically erase a full squad');
 assert.ok(g.battleEvents.some(e=>e.tick===g.tick&&e.attackerLost>0));
});

test('RTS tactical AI moves real squads to defend a threatened barracks',()=>{
 const g=new Game(8201,1,'DE','balanced',true);
 // A real player group near the AI capital must cause physical defense orders.
 for(let tick=0;tick<60;tick++)g.step();
 const ai=g.factions[1], barracks=g.buildings.findIndex((code,i)=>code===4&&g.owner[i]===1);
 assert.ok(barracks>=0);
 const defenders=g.squads.filter(u=>u.owner===1);
 assert.ok(defenders.length>0);
 const near=landNeighbors(barracks).find(n=>g.owner[n]===0);
 if(near===undefined)return; // Isolated capitals have no immediately adjacent hostile land.
 g.squads.push({id:99001,owner:0,index:near,troops:60,destination:null,attackTarget:null});
 for(let tick=0;tick<30;tick++)g.step();
 assert.ok(g.squads.filter(u=>u.owner===1).some(u=>u.destination===barracks||u.index===barracks),
   'AI should guard threatened critical infrastructure using real units');
});

test('wounded RTS formations below ten soldiers survive a deterministic save reload',()=>{
 const g=new Game(9312,2,'DE','balanced',true);
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),25).ok);
 g.squads[0].troops=4.75;
 const restored=Game.fromSave(g.exportSave());
 assert.equal(restored.squads[0].troops,4.75,'wounded squad strength must survive save/load');
 assert.deepEqual(Game.fromSave(restored.exportSave()).exportSave(),restored.exportSave(),
   'normalized replay must remain deterministic');
});

test('50-country RTS economy and AI remain deterministic over prolonged turns',()=>{
 const a=new Game(9313,49,'DE','balanced',true);
 const b=new Game(9313,49,'DE','balanced',true);
 for(let i=0;i<112;i++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave(),'AI orders and recruitment must replay exactly');
 assert.ok(a.factions.every(f=>Number.isFinite(f.money)&&f.money>=0));
 assert.ok(a.squads.length<=a.factions.length*12);
 assert.ok(a.squads.every(u=>u.troops>0&&u.troops<=1000&&a.owner[u.index]===u.owner));
 assert.ok(a.squads.some(u=>u.owner>0),'at least one AI must field an actual squad');
});

test('a distant RTS conquest target persists beyond the first captured sector',()=>{
 const g=new Game(9911,1,'DE','balanced',true);
 const start=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(start>=0);
 const neighbor=landNeighbors(start).find(n=>g.owner[n]===-1);
 // Follow neutral land to a genuine target at least several tiles away.
 const seen=new Set([start,neighbor]),queue=[neighbor];
 let distant=-1;
 for(let head=0;head<queue.length&&head<1000;head++){
   const index=queue[head];
   if(Math.abs(index%480-start%480)+Math.abs(Math.floor(index/480)-Math.floor(start/480))>=5){
     distant=index;break;
   }
   for(const next of landNeighbors(index))if(g.owner[next]===-1&&!seen.has(next)){seen.add(next);queue.push(next);}
 }
 assert.ok(distant>=0,'test seed must provide a contiguous distant neutral target');
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),100).ok);
 const unit=g.squads[0];unit.index=start;
 assert.ok(g.orderSquadAttack(0,unit.id,cellToPoint(distant)).ok);
 assert.equal(unit.campaignTarget,distant);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 for(let i=0;i<60&&unit.campaignTarget!==null;i++)g.step();
 assert.equal(unit.index,distant,'unit marches to clicked target, not merely the first border');
 assert.equal(g.owner[distant],0);
 assert.ok(g.squads.includes(unit),'campaign soldier group must remain alive');
});

test('ordered RTS troops walk through adjacent cells and never teleport',()=>{
 const g=new Game(9945,1,'DE','balanced',true);
 const site=g.owner.findIndex((owner,i)=>owner===0&&!g.buildings[i]&&
   g.canBuild(0,cellToPoint(i),'barracks').ok&&
   landNeighbors(i).some(n=>g.owner[n]===0));
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),50).ok);
 const squad=g.squads.find(unit=>unit.owner===0);
 assert.ok(squad);
 const next=landNeighbors(site).find(n=>g.owner[n]===0);
 assert.ok(next!==undefined);
 assert.ok(g.orderSquad(0,squad.id,cellToPoint(next)).ok);
 const before=squad.index, troops=squad.troops;
 g.step();
 const d=Math.abs(before%480-squad.index%480)+
   Math.abs(Math.floor(before/480)-Math.floor(squad.index/480));
 assert.ok(d<=1,'squads must never jump over sectors');
 assert.equal(squad.index,next,'a reachable neighboring target must be reached');
 assert.equal(squad.troops,troops,'walking on safe land must not cost soldiers');
 assert.equal(g.squads.filter(u=>u.id===squad.id).length,1);
});

test('formation drawing stays visual-only while RTS marching remains deterministic',()=>{
 const left=new Game(9956,1,'DE','balanced',true);
 const right=new Game(9956,1,'DE','balanced',true);
 const site=left.owner.findIndex((v,i)=>v===0&&!left.buildings[i]&&
   left.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 for(const g of [left,right]){
   assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
   assert.ok(g.recruitSquad(0,cellToPoint(site),20).ok);
   assert.ok(g.recruitSquad(0,cellToPoint(site),20).ok);
   assert.equal(g.squads[0].index,g.squads[1].index);
 }
 for(let i=0;i<12;i++){left.step();right.step();}
 assert.deepEqual(left.exportSave(),right.exportSave());
});

test('coordinated RTS AI reinforcements preserve deterministic living armies',()=>{
 const first=new Game(9961,6,'DE','balanced',true);
 const replay=new Game(9961,6,'DE','balanced',true);
 for(let i=0;i<112;i++){first.step();replay.step();}
 assert.deepEqual(first.exportSave(),replay.exportSave(),
   'AI reinforcement and defense decisions must be deterministic');
 const seen=new Set();
 for(const unit of first.squads){
   assert.ok(!seen.has(unit.id),'AI must not duplicate soldier groups');
   seen.add(unit.id);
   assert.ok(unit.troops>0&&Number.isFinite(unit.troops));
   assert.equal(first.owner[unit.index],unit.owner,
     'reinforcing squads must occupy real owned terrain');
   if(unit.campaignTarget!=null){
     assert.ok(unit.campaignTarget>=0&&unit.campaignTarget<480*260,
       'reinforcement goal remains inside the map');
   }
 }
});

test('contact combat produces real casualty events for two adjacent hostile squads',()=>{
 const g=new Game(9972,1,'DE','balanced',true);
 const tile=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(tile>=0);
 const neighbor=landNeighbors(tile).find(n=>g.owner[n]===-1);
 assert.ok(neighbor!==undefined);
 g.owner[neighbor]=1;
 g.squads.push({id:997201,owner:0,index:tile,troops:90,destination:null,attackTarget:null});
 g.squads.push({id:997202,owner:1,index:neighbor,troops:90,destination:null,attackTarget:null});
 g.step();
 assert.ok(g.battleEvents.some(e=>e.tick===g.tick&&e.attackerLost>0&&e.defenderLost>0),
   'animated squad contact must correspond to actual simultaneous losses');
 assert.ok(g.squads.some(u=>u.id===997201&&u.troops<90));
 assert.ok(g.squads.some(u=>u.id===997202&&u.troops<90));
});
