import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,NEUTRAL,landNeighbors,cellToPoint } from '../dist/src/engine/game.js';
import {attackerCasualties,campaignEffort} from '../dist/src/engine/warfare.js';

const nearNeutral=g=>g.owner.findIndex((owner,i)=>owner===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===0));

test('mobilizing an army is not a death; unoccupied land has no combat casualties',()=>{
  const g=new Game(410,0);
  const before=g.populationOf(0),front=nearNeutral(g);
  assert.ok(front>=0);
  const order=g.launchAttack(0,cellToPoint(front),50);
  assert.ok(order.ok);
  assert.ok(Math.abs(g.populationOf(0)-before)<1e-8);
  assert.equal(g.attackOrders[0].remaining,order.sent);
  assert.ok(g.attackOrders[0].effort>order.sent);
  g.step();
  assert.equal(g.factions[0].attackFallen,0);
  assert.equal(g.factions[0].enemyFallen,0);
  assert.ok(g.factions[0].captured>0);
  assert.ok(campaignEffort(order.sent)>order.sent);
});

test('neutral offensives eventually return survivors and cannot expand forever',()=>{
  // With zero opponents the game wins after its first tick and stops the
  // simulation, leaving unfinished orders frozen. Keep one AI opponent so
  // this test actually exercises the full duration of a neutral offensive.
  const g=new Game(128,1);
  assert.equal(g.factions.length,2);
  const target=nearNeutral(g),pop=g.populationOf(0);
  assert.ok(g.launchAttack(0,cellToPoint(target),100).ok);
  for(let i=0;i<120&&g.attackOrders.length;i++)g.step();
  assert.equal(g.attackOrders.length,0);
  assert.equal(g.factions[0].attackFallen,0);
  assert.ok(g.populationOf(0)>=pop);
  assert.ok(g.factions[0].troops>0);
});

test('attacking defended positions reduces both attacking and defending population',()=>{
  const g=new Game(4321,1);
  const target=g.cities[1].index;
  const attacking=g.factions[0],defending=g.factions[1];
  g.frontline[target]=18;
  const popAttacker=g.populationOf(0),popDefender=g.populationOf(1);
  assert.equal(g.attack(attacking,target),true);
  assert.ok(g.populationOf(0)<popAttacker);
  assert.ok(g.populationOf(1)<popDefender);
  assert.ok(attacking.attackFallen>0);
  assert.ok(attacking.enemyFallen>0);
  assert.ok(defending.defenseSpent>0);
  assert.ok(attacking.troops>=0&&defending.troops>=0);
});

test('better defended capitals impose higher casualty fractions than unopposed land',()=>{
  assert.equal(attackerCasualties(21,100,true,true),0);
  assert.ok(attackerCasualties(21,100,false,true)>attackerCasualties(21,5,false,false));
  assert.ok(attackerCasualties(20,200,false,true)<=20);
  assert.equal(attackerCasualties(0,200,false,true),0);
  assert.equal(campaignEffort(0),0);
});

test('population, offensive casualties and surviving forces replay deterministically',()=>{
  const a=new Game(902,1),b=new Game(902,1);
  const border=nearNeutral(a);
  assert.deepEqual(a.launchAttack(0,cellToPoint(border),75),b.launchAttack(0,cellToPoint(border),75));
  for(let i=0;i<32;i++){a.step();b.step();}
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual(a.attackOrders,b.attackOrders);
  assert.deepEqual(a.factions.map(f=>[f.troops,f.attackFallen,f.defenseSpent,f.enemyFallen]),
    b.factions.map(f=>[f.troops,f.attackFallen,f.defenseSpent,f.enemyFallen]));
});

test('AI neutral land expansion has a finite, regenerating marching budget',()=>{
  const g=new Game(607,1);
  const ai=g.factions[1];
  const frontier=g.owner.findIndex((owner,i)=>owner===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===1));
  assert.ok(frontier>=0);
  ai.campaignEnergy=0;
  const before=g.populationOf(1);
  assert.equal(g.attack(ai,frontier),false);
  assert.equal(g.populationOf(1),before);
  ai.campaignEnergy=8;
  assert.equal(g.attack(ai,frontier),true);
  assert.equal(ai.campaignEnergy,0);
  assert.equal(ai.attackFallen,0);
  g.step();
  assert.ok(ai.campaignEnergy>0);
  assert.ok(ai.campaignEnergy<=160);
});

test('hostile assaults have meaningful losses and typically cost more lives than defending',()=>{
  const neutral=attackerCasualties(30,20,true,false,1,6);
  const hostile=attackerCasualties(30,20,false,false,1,6);
  const powerfulEnemy=attackerCasualties(30,20,false,false,.70,6);
  assert.equal(neutral,0,'neutral land remains free of combat fatalities');
  assert.ok(hostile>=6*1.7,'attacking six defenders must be visibly costly');
  assert.ok(hostile<=30,'cannot lose more soldiers than were engaged');
  assert.ok(powerfulEnemy>hostile,'an overwhelming defender increases attacker losses');
  assert.ok(attackerCasualties(21,0,false,false,1,0)>=1.7,
    'even lightly guarded hostile territory causes frontline attrition');
});

test('a real player offensive reduces total population during a defended battle',()=>{
  const g=new Game(418,1);
  const border=g.owner.findIndex((owner,i)=>owner===NEUTRAL&&landNeighbors(i).some(n=>g.owner[n]===0));
  assert.ok(border>=0);
  // Convert an accessible neutral frontier into a defended enemy sector.
  g.owner[border]=1;
  g.frontline[border]=7;
  g.defense[border]=12;
  g.recount();
  const populationBefore=g.populationOf(0);
  const attack=g.launchAttack(0,cellToPoint(border),80);
  assert.equal(attack.ok,true);
  assert.equal(g.populationOf(0),populationBefore,'mobilization only binds citizens');
  g.step();
  assert.ok(g.factions[0].attackFallen>0,'actual hostile contact must produce casualties');
  assert.ok(g.factions[0].enemyFallen>0,'the defender must also take losses');
  assert.ok(g.populationOf(0)<populationBefore,
    'real combat fatalities should outweigh one tick of natural population growth');
  assert.equal(g.factions[0].attackFallen,g.attackOrders.reduce((sum,o)=>sum+o.fallen,0),
    'active order casualties must agree with national deaths');
});
