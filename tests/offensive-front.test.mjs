import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAdvancingSector,canReinforceFront} from '../dist/src/engine/offensive-front.js';
import {Game,NEUTRAL,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';

test('a single invasion advances 25 sectors from one original click without an artificial radius',()=>{
  const width=35,owners=new Int16Array(width).fill(1);
  owners[0]=0;
  const trail=[];
  for(let index=1;index<=25;index++){
    const candidates=new Set(Array.from({length:width-1},(_,i)=>i+1));
    const chosen=chooseAdvancingSector({owners,width,attackerId:0,targetOwner:1,
      candidates,anchor:1,trail});
    assert.equal(chosen,index,'front should keep expanding through actual touching sectors');
    owners[chosen]=0;trail.push(chosen);
  }
  assert.equal(owners[25],0);
  assert.equal(owners[26],1);
});

test('does not jump to other borders, wrap rows, cross foreign countries or water',()=>{
  const width=6;
  const owners=Int16Array.from([0,1,1,2,-2,2, 2,-2,2,1,1,1]);
  const noJump=chooseAdvancingSector({owners,width,attackerId:0,targetOwner:1,
    candidates:[1,9,10,11],anchor:1,trail:[]});
  assert.equal(noJump,1);
  owners[1]=0;
  assert.equal(chooseAdvancingSector({owners,width,attackerId:0,targetOwner:1,
    candidates:[9,10,11],anchor:1,trail:[1]}),-1);
  // A tile at row end is NOT next to first tile of following row.
  const wrap=Int16Array.from([2,2,2,2,2,0, 1,2,2,2,2,2]);
  assert.equal(chooseAdvancingSector({owners:wrap,width,attackerId:0,targetOwner:1,
    candidates:[6],anchor:6,trail:[]}),-1);
});

test('front selection holds contested contact and takes rounded multi-neighbor front over isolated edges',()=>{
  const owners=Int16Array.from([
    0,0,0,1,1,
    0,0,0,1,1,
    0,0,0,1,1,
  ]);
  const common={owners,width:5,attackerId:0,targetOwner:1,
    candidates:new Set([3,8,13]),anchor:8,trail:[]};
  assert.equal(chooseAdvancingSector({...common,contested:13}),13);
  assert.equal(chooseAdvancingSector({...common,contested:3}),3);
});

test('repeat clicks reinforce one local attack; distant neutral regions cannot be merged',()=>{
  assert.equal(canReinforceFront(-1,5,12,30),true);
  assert.equal(canReinforceFront(-1,5,25,30),false);
  assert.equal(canReinforceFront(3,5,19,30),true);
  assert.equal(canReinforceFront(3,5,25,30),false);
});

test('neutral expansion no longer generates a feed event per short sortie',()=>{
  const g=new Game(807,1,'DE');
  const neutral=g.owner.findIndex((owner,i)=>owner===NEUTRAL&&
    landNeighbors(i).some(n=>g.owner[n]===0));
  assert.ok(neutral>=0);
  const before=g.events.length;
  assert.equal(g.launchAttack(0,cellToPoint(neutral),25).ok,true);
  assert.equal(g.events.length,before,'neutral launch only reports in command status, not strategic feed');
  // The event feed should continue to show genuine strategic events.
  assert.equal(g.factions[0].troops,90-Math.floor(90*.25));
});

test('reinforcements preserve total population, avoid extra attack orders and remain deterministic',()=>{
  const a=new Game(3009,2,'DE'),b=new Game(3009,2,'DE');
  const t=a.owner.findIndex((o,i)=>o===NEUTRAL&&landNeighbors(i).some(n=>a.owner[n]===0));
  assert.ok(t>=0);
  for(const game of [a,b]){
    const first=game.launchAttack(0,cellToPoint(t),30);
    const second=game.launchAttack(0,cellToPoint(t),35);
    assert.ok(first.ok&&second.ok);
    assert.equal(game.attackOrders.length,1);
    assert.equal(game.attackOrders[0].remaining,first.sent+second.sent);
  }
  for(let tick=0;tick<12;tick++){a.step();b.step();}
  assert.deepEqual(a.attackOrders,b.attackOrders);
  assert.deepEqual([...a.owner],[...b.owner]);
  assert.deepEqual(a.events,b.events);
});
