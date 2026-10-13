import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,cellToPoint} from '../dist/src/engine/game.js';

const make=()=>{
 const g=new Game(41044,1,'DE','balanced',true);
 g.factions[0].money=4000;
 const tile=g.owner.findIndex((o,i)=>o===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(tile>=0);
 assert.equal(g.build(0,cellToPoint(tile),'barracks').ok,true);
 return {g,tile};
};

test('merge and split conserve paid troops and replay across JSON saves',()=>{
 const {g,tile}=make();
 assert.equal(g.recruitSquad(0,cellToPoint(tile),100).ok,true);
 assert.equal(g.recruitSquad(0,cellToPoint(tile),50).ok,true);
 const [a,b]=g.squads.map(s=>s.id);
 assert.equal(g.mergeSquads(0,[a,b]).ok,true);
 assert.equal(g.squads.length,1);
 assert.equal(g.squads[0].troops,150);
 assert.equal(g.splitSquad(0,a,70).ok,true);
 assert.equal(g.squads.length,2);
 assert.equal(g.squads.reduce((n,s)=>n+s.troops,0),150);
 assert.deepEqual(Game.fromSave(JSON.parse(JSON.stringify(g.exportSave()))).exportSave(),g.exportSave());
 assert.equal(g.mergeSquads(0,[a,a]).ok,false);
 assert.equal(g.splitSquad(0,a,1000).ok,false);
});

test('barracks reinforce costs two gold per real soldier and does not create another group',()=>{
 const {g,tile}=make();
 assert.equal(g.recruitSquad(0,cellToPoint(tile),100).ok,true);
 const id=g.squads[0].id;
 const money=g.factions[0].money;
 assert.equal(g.reinforceSquad(0,id,cellToPoint(tile),500).ok,true);
 assert.equal(g.squads.length,1);
 assert.equal(g.squads[0].troops,600);
 assert.equal(g.factions[0].money,money-1000);
 assert.equal(g.reinforceSquad(0,id,cellToPoint(tile),1001).ok,false);
});

test('RTS command menu includes merge, split, reinforce and keyboard groups',()=>{
 const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 for(const name of ['data-merge-selected','data-split-squad','data-reinforce-squad',
   'armyControlGroups.set(slot','armyControlGroups.get(slot)'])
   assert.ok(ui.includes(name),name);
});
