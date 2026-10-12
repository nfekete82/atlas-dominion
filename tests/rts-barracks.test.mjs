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
