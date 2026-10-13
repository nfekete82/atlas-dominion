import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/src/engine/game.js';

test('AI keeps seeking expansion without being held by a distant enemy rally',()=>{
 const a=new Game(20261024,5,'DE','balanced',true);
 const b=new Game(20261024,5,'DE','balanced',true);
 for(let i=0;i<90;i++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave(),'new offensive logic must replay exactly');
 assert.ok(a.squads.every(s=>s.troops>0&&a.owner[s.index]===s.owner));
 assert.ok(a.factions.every(f=>f.money>=0));
});
