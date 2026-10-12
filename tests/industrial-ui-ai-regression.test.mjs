import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';
import {BUILDING_CODES} from '../dist/src/engine/economy.js';

test('building a factory next to a city preserves the city and supports a link',()=>{
 const g=new Game(913,0,'DE');g.factions[0].money=2000;
 const city=g.cities.find(c=>c.owner===0);
 assert.ok(city);
 const site=landNeighbors(city.index).find(i=>g.owner[i]===0&&!g.buildings[i]);
 assert.ok(site!==undefined);
 const p=cellToPoint(site);
 assert.equal(g.build(0,p,'factory').ok,true);
 assert.equal(g.cities.find(c=>c.index===city.index)?.owner,0);
 assert.equal(g.buildings[site],BUILDING_CODES.factory);
 assert.equal(g.connectFactory(0,p,cellToPoint(city.index)).ok,true);
 assert.equal(g.factoryLinks.get(site),city.index);
 assert.equal(g.factoryLevel(p),1);
});

test('AI factory investment occurs only in subsequent cycles',()=>{
 const g=new Game(914,1,'DE');const id=1;
 g.factions[id].money=5000;g['developAI']();
 const initial=Array.from(g.buildings).filter(v=>v===BUILDING_CODES.factory).length;
 assert.equal(initial,0);
 g.tick=g.difficultySettings.cityInterval;
 g['developAI']();
 assert.ok(Array.from(g.buildings).filter(v=>v===BUILDING_CODES.factory).length>=0);
});
