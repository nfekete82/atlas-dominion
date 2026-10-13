import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';

test('a captured campaign goal is cleared without sending a squad backwards',()=>{
 const game=new Game(2026101313,1,'DE','balanced',true);
 const start=game.owner.findIndex((holder,i)=>holder===0&&
   landNeighbors(i).some(next=>game.owner[next]===-1));
 assert.ok(start>=0);
 const goal=landNeighbors(start).find(i=>game.owner[i]===-1);
 assert.ok(goal!==undefined);
 const squad={id:2026101313,owner:0,index:start,troops:100,
   destination:null,attackTarget:null,campaignTarget:goal,campaignOwner:-1};
 game.squads.push(squad);
 // A different formation has already secured this target.
 game.owner[goal]=0;
 game.step();
 assert.equal(squad.campaignTarget,null,
   'completed objective must not keep the squad marching to stale territory');
 assert.equal(squad.index,start,
   'a captured waypoint cannot cause a backwards march');
});
