import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {stylizedAsset} from '../scripts/webgl-stylized-pack.js';
import {strategicGlbUrl} from '../scripts/webgl-strategic-glb.js';

test('the previous HQ3 Feldkommando is restored without altering branding',()=>{
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.ok(strategicGlbUrl('headquarters','active').endsWith('sandforge_funkzentrale_hq3_game_ready.glb'));
 assert.ok(battle.includes("return strategicGlbUrl('headquarters','active')"));
 assert.ok(!battle.includes('return SANDFORGE_DEFAULT_FELDKOMMANDO_URL'));
 assert.ok(!battle.includes('sandforgeMeshyHeadquarters=true'));
 assert.ok(portraits.includes('renderStrategicPortrait(kind,renderer)'));
 assert.equal(existsSync('src/assets/reborn/buildings-3d/sandforge_feldkommando_meshy.glb'),false);
 assert.ok(existsSync('src/assets/reborn/sandforge-bastion-logo.webp'));
 assert.ok(existsSync('src/assets/reborn/sandforge-start-background.png'));
});
test('both teams use their previous animated infantry and engineer GLBs',()=>{
 for(const kind of ['infantry','engineer'])for(const owner of [0,1]){
  assert.equal(stylizedAsset(kind,owner),null);
  assert.ok(existsSync('src/assets/reborn/prototype/'+kind+'-'+owner+'.glb'));
 }
 assert.equal(stylizedAsset('infantry',0,true),'/src/assets/stylized/infantry-0.glb');
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(battle.includes("kind+'-'+owner+'.glb'"));
 assert.ok(battle.includes("entity.kind!=='infantry'&&entity.kind!=='engineer'"));
});
