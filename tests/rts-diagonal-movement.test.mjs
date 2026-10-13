import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,pointToIndex} from '../dist/src/engine/game.js';

function diagonalScenario(seed){
  const g=new Game(seed,1,'DE','balanced',true);
  let origin=-1,goal=-1;
  for(let i=0;i<g.owner.length;i++){
    if(g.owner[i]!==0)continue;
    const p=cellToPoint(i);
    const across=pointToIndex({x:p.x+1,y:p.y+1});
    const sideX=pointToIndex({x:p.x+1,y:p.y});
    const sideY=pointToIndex({x:p.x,y:p.y+1});
    if(across!==i&&g.owner[across]===0&&g.owner[sideX]===0&&g.owner[sideY]===0){
      origin=i;goal=across;break;
    }
  }
  assert.ok(origin>=0,'a legal friendly diagonal must exist');
  return {g,origin,goal};
}

test('RTS formation uses a legal diagonal rather than two orthogonal marches',()=>{
  const {g,origin,goal}=diagonalScenario(221041);
  const unit={id:221041,owner:0,index:origin,troops:35,destination:null,attackTarget:null};
  g.squads.push(unit);
  assert.equal(g.orderSquad(0,unit.id,cellToPoint(goal)).ok,true);
  g.step();
  assert.equal(unit.index,goal,'diagonal route should need only one tick');
});

test('RTS formation cannot cut across an enemy or water corner',()=>{
  const {g,origin,goal}=diagonalScenario(221042);
  const p=cellToPoint(origin);
  const side=pointToIndex({x:p.x+1,y:p.y});
  // Prevent cutting the corner. The planner may still use a longer legal
  // route through the remaining friendly territory.
  g.owner[side]=-1;
  const unit={id:221042,owner:0,index:origin,troops:35,destination:null,attackTarget:null};
  g.squads.push(unit);
  assert.equal(g.orderSquad(0,unit.id,cellToPoint(goal)).ok,true);
  g.step();
  assert.notEqual(unit.index,goal,'corner blocking forces a different step');
});
