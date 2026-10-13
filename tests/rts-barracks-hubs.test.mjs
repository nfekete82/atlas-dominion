import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../dist/src/engine/game.js';

test('AI chooses a bounded number of existing recruitment hubs instead of constructing replacements',()=>{
 const engine=readFileSync(new URL('../src/engine/game.ts',import.meta.url),'utf8');
 assert.match(engine,/ownedBarracks\[id\]\.push\(tile\)/);
 assert.match(engine,/const activeLimit=Math\.min\(3,Math\.max\(1,Math\.ceil\(faction\.territory\/450\)\)\)/);
 assert.match(engine,/const activeBarracks=rankedBarracks\.slice\(0,activeLimit\)/);
 assert.match(engine,/this\.recruitSquad\(faction\.id,cellToPoint\(deployment\),recruitCount\)/);
});

test('captured RTS military bases remain physical and save/load replay stays deterministic',()=>{
 const game=new Game(20923,4,'DE','balanced',true);
 for(let i=0;i<80;i++)game.step();
 const resumed=Game.fromSave(JSON.parse(JSON.stringify(game.exportSave())));
 for(let i=0;i<35;i++){game.step();resumed.step();}
 assert.deepEqual(game.exportSave(),resumed.exportSave());
});

test('AI barracks markers are visually clustered only at overview zoom',()=>{
 const map=readFileSync(new URL('../src/render/map.ts',import.meta.url),'utf8');
 assert.match(map,/marker\.code===4&&marker\.owner>0&&this\.zoom<1\.5/);
 assert.match(map,/shownAiBarracks\.some/);
});
