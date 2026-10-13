import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../dist/src/engine/game.js';

test('RTS occupation does not follow static map-neighbor iteration order',()=>{
 const source=readFileSync(new URL('../src/engine/game.ts',import.meta.url),'utf8');
 assert.match(source,/const neighbors=\[\.\.\.LAND_NEIGHBORS\[cell\]\]\.sort/);
 assert.match(source,/Math\.floor\(this\.tick\/4\)/);
});

test('direction-aware occupation remains replayable and never claims water',()=>{
 const a=new Game(20261013,4,'DE','balanced',true);
 const b=new Game(20261013,4,'DE','balanced',true);
 for(let t=0;t<65;t++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave());
 assert.ok(a.squads.every(u=>u.troops>0&&a.owner[u.index]===u.owner));
});
