import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,NEUTRAL,cellToPoint} from '../dist/src/engine/game.js';
import {cityUpgradeCost,BUILDINGS} from '../dist/src/engine/economy.js';

const create=()=>new Game(751,3,'DE','balanced');

test('AI development scales beyond one action and finishes high-level cities using real gold',()=>{
 const g=create(),id=1;
 let claimed=0;
 for(let i=0;i<g.owner.length&&claimed<2400;i++){
   if(g.owner[i]!==NEUTRAL)continue;
   g.owner[i]=id;claimed++;
 }
 assert.equal(claimed,2400);
 const sites=[];
 for(let i=0;i<g.owner.length&&sites.length<42;i++){
   if(g.owner[i]!==id||g.buildings[i])continue;
   g.buildings[i]=1;g.cityUpgrades[i]=sites.length<3?4:0;sites.push(i);
 }
 g.recount();g.factions[id].money=25000;
 const before=Array.from(g.cityUpgrades);
 const gold=g.factions[id].money;
 const income=g.factions[id].income;
 g['developAI']();
 const upgraded=sites.filter(i=>g.cityUpgrades[i]>before[i]);
 assert.ok(upgraded.length>=2,'large AI economy buys multiple upgrades per interval');
 assert.ok(upgraded.every(i=>before[i]===4),'finish developed cities before newly founded ones');
 const actualCost=sites.reduce((sum,i)=>sum+
   (g.cityUpgrades[i]>before[i]?cityUpgradeCost(before[i]):0),0);
 assert.equal(gold-g.factions[id].money,actualCost,'every upgrade must cost real gold');
 assert.ok(g.factions[id].income>income);
 assert.ok(g.factions[id].money>=0);
});

test('AI can build multiple affordable spaced settlements when empire is underdeveloped',()=>{
 const g=create(),id=1;
 let claimed=0;
 for(let i=0;i<g.owner.length&&claimed<4500;i++){
   if(g.owner[i]!==NEUTRAL)continue;g.owner[i]=id;claimed++;
 }
 g.recount();g.factions[id].money=3000;
 const existing=Array.from(g.buildings).filter(x=>x===1).length;
 const gold=g.factions[id].money;
 g['developAI']();
 const built=Array.from(g.buildings).filter(x=>x===1).length-existing;
 assert.ok(built>=1&&built<=2,'spaced AI construction is gradual but can exceed one action');
 assert.ok(g.factions[id].money<=gold-built*BUILDINGS[0].cost);
 assert.ok(g.factions[id].money>=0);
});

test('alliance help is actual AI-owned soldiers travelling for eight ticks',()=>{
 const g=create();
 assert.equal(g.offerAlliance(0,1).ok,true);
 const index=g.owner.findIndex(v=>v===0);
 g.attackOrders.push({id:982,factionId:2,targetOwner:0,anchor:cellToPoint(index),
   committed:100,remaining:100,effort:100,fallen:0,conquered:0});
 g.factions[1].troops=1000;g.factions[1].income=20;
 g.tick=24;
 const originalSender=g.factions[1].troops,originalRecipient=g.factions[0].troops;
 g['dispatchDefensiveAid']();
 assert.equal(g.defenseAid.length,1);
 const shipment=g.defenseAid[0];
 assert.ok(shipment.troops>0&&shipment.troops<=36);
 assert.equal(shipment.from,1);assert.equal(shipment.to,0);
 assert.equal(shipment.arrivalTick,32);
 assert.equal(g.factions[1].troops,originalSender-shipment.troops);
 assert.equal(g.factions[0].troops,originalRecipient);
 g['dispatchDefensiveAid']();
 assert.equal(g.defenseAid.length,1,'duplicate convoys prohibited');
 g.tick=31;g['deliverDefensiveAid']();
 assert.equal(g.factions[0].troops,originalRecipient,'no teleporting troops');
 g.tick=32;g['deliverDefensiveAid']();
 assert.equal(g.defenseAid.length,0);
 assert.equal(g.factions[0].troops,originalRecipient+shipment.troops);
 assert.equal(g.factions[1].troops+g.factions[0].troops,originalSender+originalRecipient);
});

test('broken alliances turn convoys around; v1 saves with no aid still load',()=>{
 const g=create();g.offerAlliance(0,1);
 const index=g.owner.findIndex(v=>v===0);
 g.attackOrders.push({id:984,factionId:2,targetOwner:0,anchor:cellToPoint(index),
   committed:40,remaining:40,effort:40,fallen:0,conquered:0});
 g.factions[1].troops=400;g.factions[1].income=14;g.tick=24;
 const initial=g.factions[1].troops;
 g['dispatchDefensiveAid']();
 const shipment=g.defenseAid[0];
 assert.ok(shipment);
 g.recount();
 const restored=Game.fromSave(JSON.parse(JSON.stringify(g.exportSave())));
 assert.deepEqual(restored.exportSave(),g.exportSave());
 g.leaveAlliance(0,1);
 g.tick=shipment.arrivalTick;
 g['deliverDefensiveAid']();
 assert.equal(g.factions[1].troops,initial);
 assert.equal(g.defenseAid.length,0);
 const legacy=restored.exportSave();delete legacy.defenseAid;
 const old=Game.fromSave(legacy);
 assert.deepEqual(old.defenseAid,[]);
 assert.throws(()=>Game.fromSave({...legacy,defenseAid:[{from:1,to:0,troops:-2,arrivalTick:80}]}),/Bündnisverstärkung/);
});
