import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,cellToPoint} from '../dist/src/engine/game.js';

test('barracks menu offers affordable MAX before fixed 10/50/100/500 presets',()=>{
 const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 assert.match(ui,/\[maxRecruit,10,50,100,500\]/);
 assert.match(ui,/Math\.min\(1000,Math\.floor\(game\.factions\[0\]\.money\/2\)\)/);
 assert.match(ui,/count>=10&&!recruitmentFull/);
 assert.match(ui,/MAX – /);
});

test('MAX recruitment respects affordability and the physical 1000-soldier cap',()=>{
 const game=new Game(82311,1,'DE','balanced',true);
 const site=game.owner.findIndex((owner,i)=>owner===0&&!game.buildings[i]&&
   game.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 game.factions[0].money=3000;
 assert.equal(game.build(0,cellToPoint(site),'barracks').ok,true);
 const max=Math.min(1000,Math.floor(game.factions[0].money/2));
 assert.equal(max,1000);
 assert.equal(game.recruitSquad(0,cellToPoint(site),max).ok,true);
 assert.equal(game.squads[0].troops,1000);
 assert.equal(game.recruitSquad(0,cellToPoint(site),1000).ok,false);
});
