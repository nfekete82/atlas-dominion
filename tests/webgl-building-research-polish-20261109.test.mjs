import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {INTERCEPTOR_ENABLED,UPGRADE_KINDS} from '../dist/src/reborn/strategic-tech.js';

const source=p=>readFileSync(p,'utf8');

test('missile defense is disabled for new human and AI building orders',()=>{
 assert.equal(INTERCEPTOR_ENABLED,false);
 const game=Simulation.campaign(2074,23,'dunes');
 const point=game.startRegions[0].center;
 assert.match(game.buildError(0,'interceptor',point),/deaktiviert/i);
 assert.match(source('src/reborn/simulation.ts'),/INTERCEPTOR_ENABLED&&!has\('interceptor'\)/);
});

test('WebGL HUD removes the disabled option but retains missile silos and saves',()=>{
 const ui=source('scripts/webgl-battlefield.js');
 assert.match(ui,/buildingKinds\.filter\(kind=>kind!=='interceptor'\|\|INTERCEPTOR_ENABLED\)/);
 assert.match(ui,/action==='missile-target'/);
 assert.match(ui,/action==='interceptor-rearm'/,
  'existing saved interceptors retain backwards-compatible commands');
 assert.match(ui,/hydrateBuildingIcons\(actions,this\.renderer\)/);
});

test('all nine research benefits have icons and immediately visible stat descriptions',()=>{
 const portraits=source('scripts/webgl-portraits.js');
 const effects=portraits.match(/researchEffectLabel=Object\.freeze\(\{([\s\S]*?)\}\)/)?.[1];
 const symbols=portraits.match(/researchPaths=Object\.freeze\(\{([\s\S]*?)\}\)/)?.[1];
 assert.ok(effects&&symbols,'source contains research effects and icons');
 for(const upgrade of UPGRADE_KINDS){
  assert.match(effects,new RegExp('\\b'+upgrade+':'));
  assert.match(symbols,new RegExp('\\b'+upgrade+':'));
 }
 const hud=source('scripts/webgl-battlefield.js');
 assert.match(hud,/researchIconMarkup\(kind\)/);
 assert.match(hud,/sf-tech-effect/);
 assert.match(source('src/reborn/webgl-classic-hud.css'),/\.sf-tech-effect/);
});

test('strategic construction cards derive 3D portraits from the same world meshes',()=>{
 const portraits=source('scripts/webgl-portraits.js');
 assert.match(portraits,/createStrategicBuilding\(kind,0\)/);
 assert.match(portraits,/renderer\.readRenderTargetPixels\(/);
 const meshes=source('scripts/webgl-strategic-buildings.js');
 assert.match(meshes,/new THREE\\.DataTexture\\(/);
 assert.match(meshes,/map:materialGrain/);
 assert.match(portraits,/renderer\.setRenderTarget\(oldTarget\)/);
 assert.match(portraits,/return buildingIconUrl\(kind\)/,
  'SVG placeholder remains a safe fallback');
});
