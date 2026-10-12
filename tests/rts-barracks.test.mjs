import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,LAND_NEIGHBORS} from '../dist/src/engine/game.js';

test('barracks recruit exactly from living mobile troops and survive save reload',()=>{
 const g=new Game(711,1,'DE');
 g.factions[0].money=1000;
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.equal(g.build(0,cellToPoint(site),'barracks').ok,true);
 g.factions[0].troops=200;g.recount();
 assert.equal(g.buildingAt(cellToPoint(site)),'barracks');
 const before=g.factions[0].troops;
 assert.equal(g.recruitSquad(0,cellToPoint(site),25).ok,true);
 assert.equal(g.factions[0].troops,before-25);
 assert.equal(g.squads[0].troops,25);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 assert.equal(g.recallSquad(0,g.squads[0].id).ok,true);
 assert.equal(g.factions[0].troops,before);
});

test('factory buildingAt stays recognized for the right click menu',()=>{
 const g=new Game(712,1,'DE');
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'factory').ok);
 assert.equal(g.build(0,cellToPoint(site),'factory').ok,true);
 assert.equal(g.buildingAt(cellToPoint(site)),'factory');
});
