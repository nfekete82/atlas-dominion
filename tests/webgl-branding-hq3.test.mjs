import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
test('Bastion title, pause and in-game logo all use the final paths',()=>{
 const html=read('webgl-preview.html'),hud=read('scripts/webgl-classic-hud.js'),
  menu=read('scripts/webgl-title-menu.js');
 assert.ok(html.includes('sandforge-start-background.png'));
 assert.ok(html.includes('sandforge-bastion-logo.webp'));
 assert.ok(hud.includes('sandforge-bastion-logo.webp'));
 assert.ok(menu.includes('sandforge-bastion-logo.webp'));
 assert.match(html,/sf-bastion-bg-ready/);
 assert.match(html,/sf3d-main-stats/);
});
test('HQ3 Funkzentrale is the default, with matching construction-card portrait',()=>{
 const battlefield=read('scripts/webgl-battlefield.js');
 const portraits=read('scripts/webgl-portraits.js');
 const strategic=read('scripts/webgl-strategic-glb.js');
 assert.ok(battlefield.includes("kind==='headquarters'&&"));
 assert.ok(battlefield.includes("return strategicGlbUrl('headquarters','active')"));
 assert.ok(portraits.includes("if(kind==='headquarters'&&!meshyAsset(kind,0)"));
 assert.ok(portraits.includes('renderStrategicPortrait(kind,renderer)'));
 assert.ok(strategic.includes('sandforge_funkzentrale_hq3_game_ready.glb'));
 const glb=readFileSync('src/assets/reborn/buildings-3d/sandforge_funkzentrale_hq3_game_ready.glb');
 assert.equal(glb.toString('ascii',0,4),'glTF');
 assert.equal(glb.readUInt32LE(4),2);
});
test('Uploaded original logo and landscape remain unmodified if installed',()=>{
 const expected=[
  ['src/assets/reborn/sandforge-bastion-logo.webp','1ca72dc86a5498dbe84e6e7bc48feb921f25e25fd681c0fa32c59b30a3573fed'],
  ['src/assets/reborn/sandforge-start-background.png','3b5e44516773816fb8a8f983ea707863cd4d2e607051726d36a1cc4852b40dd8']
 ];
 for(const [path,hash] of expected){
  if(!existsSync(path))continue; // ZIP is installed by the developer before release.
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash);
 }
});
