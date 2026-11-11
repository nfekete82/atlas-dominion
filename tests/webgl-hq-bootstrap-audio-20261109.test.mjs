import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

const read=p=>readFileSync(p,'utf8');

test('dunes bootstrap: a first HQ is buildable with real credits and a pioneer',()=>{
 const g=Simulation.campaign(2074,23,'dunes');
 assert.equal(g.needsHeadquarters(0),true);
 assert.equal(g.hasHeadquarters(0),false);
 const pioneers=g.units.filter(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
 assert.ok(pioneers.length>0);
 assert.ok(g.credits[0]>=BUILDINGS.headquarters.cost);
 const startingCredits=g.credits[0];
 let site=null;
 for(const p of g.headquartersCandidates(0)){
  if(g.buildError(0,'headquarters',p))continue;
  site=g.build(0,'headquarters',p,[pioneers[0].id]);
  if(site)break;
 }
 assert.ok(site,'at least one HQ location must be legal and reachable in the actual 3D campaign');
 assert.equal(site.kind,'headquarters');
 assert.ok(site.buildRemaining>0,'HQ must be constructed, not free or instant');
 assert.equal(g.credits[0],startingCredits-BUILDINGS.headquarters.cost);
 assert.equal(g.needsHeadquarters(0),true,'radar and further construction wait for HQ completion');
 assert.match(g.buildError(0,'barracks',g.startRegions[0].center),/fertiggestelltes Hauptquartier/);
});

test('3D HUD retains the existing pioneer-driven manual HQ construction',()=>{
 const ui=read('scripts/webgl-battlefield.js');
 assert.match(ui,/this\.catalogContext\(\)\.engineer/);
 assert.match(ui,/this\.beginPlacement\(kind\)/);
 assert.match(ui,/submitConstruction\(this\.game,kind,p,this\.selected/);
 assert.match(ui,/this\.placementFacing,event\.shiftKey/);
 assert.doesNotMatch(ui,/data-action="hq-bootstrap"/);
});

test('engines only play when units physically travel, never for clicking infantry or opening a gate',()=>{
 const audio=read('src/reborn/audio.ts');
 const preview=read('scripts/webgl-preview.js');
 const options=read('scripts/webgl-title-menu.js');
 const html=read('webgl-preview.html');
 const gates=read('scripts/webgl-production-gates.js');
 assert.match(audio,/engineSoundsEnabled=true/);
 assert.match(audio,/setEngineSoundsEnabled\(value:boolean\)/);
 assert.match(audio,/ambientSounding&&this\.engineSoundsEnabled\?vehicleSoundMix\(/);
 assert.match(audio,/productionGate\(kind:'barracks'\|'factory'='factory'\)/);
 assert.match(gates,/productionGate\?\.\(gate\.kind\)/);
 assert.match(preview,/bootOptions\.engineSoundsEnabled!==false/);
 assert.match(options,/engineSoundsEnabled:\$\('sf3d-engine-sounds'\)\.checked/);
 assert.match(html,/sf3d-engine-sounds/);
 assert.match(audio,/measuredEngineSpeed\(u\)>=2/);
 assert.match(audio,/short mechanical latch/);
});
