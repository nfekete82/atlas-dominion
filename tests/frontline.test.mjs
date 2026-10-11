import test from 'node:test';
import assert from 'node:assert/strict';
import { armyIncome, attackFrontWidth, frontierTarget, frontierBudget, localDefenseStrength } from '../dist/src/engine/frontline.js';
import { Game, NEUTRAL, neighbors, landNeighbors, cellToPoint } from '../dist/src/engine/game.js';

test('bigger empires produce disproportionately more recruits with no 9000 ceiling',()=>{
  const small=armyIncome(100,1,19804), mid=armyIncome(2500,5,19804), large=armyIncome(9000,8,19804);
  assert.ok(small>0 && mid>small*10 && large>mid*3);
  const game=new Game(135,0);
  game.factions[0].troops=12000;
  game.step();
  assert.ok(game.factions[0].troops>12000);
  assert.equal(armyIncome(0,0,19804),0);
});

test('frontline budgeting preserves reserves and scales with available income',()=>{
  assert.equal(frontierBudget(20,10),0);
  assert.ok(frontierBudget(2000,300)>frontierBudget(200,10));
  assert.ok(frontierBudget(2000,300)<2000);
  assert.ok(frontierTarget(7000,30000,true,true)>frontierTarget(100,100,false,false));
  assert.ok(localDefenseStrength(10,90)>localDefenseStrength(10,3));
});

test('local troop stations are real, distinct from reserves, and redeploy when front disappears',()=>{
  const game=new Game(13,1);
  const g=game.factions[0];
  const enemy=game.owner.findIndex((owner,i)=>owner===1 && landNeighbors(i).some(n=>game.owner[n]===NEUTRAL));
  const adjacent=landNeighbors(enemy).find(i=>game.owner[i]===NEUTRAL);
  assert.ok(enemy>=0 && adjacent!==undefined);
  game.owner[adjacent]=0;
  game.factions[0].troops=1500;
  game.redistributeFrontline();
  const deployed=game.frontline[adjacent];
  assert.ok(deployed>0);
  assert.ok(g.troops<1500);
  const after=g.troops+deployed;
  // Remove the entire opposing frontier; all stationed soldiers return to reserve.
  for(let i=0;i<game.owner.length;i++)if(game.owner[i]===1)game.owner[i]=NEUTRAL;
  game.redistributeFrontline();
  assert.equal(game.frontline[adjacent],0);
  assert.ok(Math.abs(g.troops-after)<1e-6);
});

test('the same defender has different survival chances along strong and weak frontier',()=>{
  const a=new Game(44,1), b=new Game(44,1);
  const index=a.cities[0].index;
  a.frontline[index]=140;
  b.frontline[index]=0;
  const initial=a.defense[index];
  a.strike(a.factions[1],index,30);
  b.strike(b.factions[1],index,30);
  assert.ok(a.defense[index]>b.defense[index]);
  assert.ok(a.frontline[index]<140);
  assert.ok(a.factions[0].defenseSpent>b.factions[0].defenseSpent);
  assert.ok(a.defense[index]<=initial);
});

test('territory and reserve deployment are deterministic over equal command sequences',()=>{
  const a=new Game(9191),b=new Game(9191);
  const border=a.owner.findIndex((o,i)=>o===NEUTRAL && landNeighbors(i).some(n=>a.owner[n]===0));
  assert.deepEqual(a.launchAttack(0,cellToPoint(border),35),b.launchAttack(0,cellToPoint(border),35));
  for(let i=0;i<25;i++){a.step();b.step();}
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual([...a.frontline],[...b.frontline]);
  assert.deepEqual(a.factions.map(x=>[x.troops,x.income,x.defenseSpent]),b.factions.map(x=>[x.troops,x.income,x.defenseSpent]));
});

test('larger armies can attack across a wider local front, without an unlimited tick burst',()=>{
  const small=attackFrontWidth(80,false,false);
  const large=attackFrontWidth(18000,false,false);
  assert.ok(large>small);
  assert.ok(large<=22);
  assert.ok(attackFrontWidth(500,true,false)>attackFrontWidth(500,false,false));
  assert.ok(attackFrontWidth(500,false,true)>attackFrontWidth(500,false,false));
});
