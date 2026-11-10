import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weatheredStoneGeometry,sharedStoneMaps}
 from '../scripts/webgl-rock-materials.js';

test('sedimentary rocks have real faceted ledges at both quality levels',()=>{
 const high=weatheredStoneGeometry(false);
 const lite=weatheredStoneGeometry(true);
 assert.equal(high.userData.sedimentaryLedges,true);
 assert.ok(high.userData.strata>lite.userData.strata);
 assert.ok(high.userData.segments>lite.userData.segments);
 assert.ok(high.getAttribute('position').count>lite.getAttribute('position').count);
 for(const geom of [high,lite]){
  assert.equal(geom.getAttribute('uv').count,geom.getAttribute('position').count);
  assert.equal(geom.getAttribute('normal').count,geom.getAttribute('position').count);
  assert.ok(geom.boundingSphere.radius>.9);
  assert.ok(geom.boundingSphere.radius<1.8);
  geom.dispose();
 }
 const repeat=weatheredStoneGeometry(false);
 const same=weatheredStoneGeometry(false);
 assert.deepEqual(Array.from(repeat.getAttribute('position').array),
  Array.from(same.getAttribute('position').array),'same seeded geometry per boot');
 repeat.dispose();same.dispose();
 assert.strictEqual(sharedStoneMaps(false),sharedStoneMaps(false),
  'rock palettes must keep sharing the same PBR maps');
});

test('desert crater decals use irregular procedural erosion, not the old yellow texture',()=>{
 const decor=readFileSync('scripts/webgl-environment.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const craters=decor.slice(decor.indexOf(' makeCraterTexture(){'),
  decor.indexOf(' addDebris(){'));
 assert.match(craters,/const size=256/);
 assert.match(craters,/Math\.sin\(angle\*7/);
 assert.match(craters,/depression=Math\.exp/);
 assert.match(craters,/this\.biome==='snow'/);
 assert.match(craters,/new THREE\.CanvasTexture\(canvas\)/);
 assert.match(craters,/makeCraterLipGeometry\(\)/);
 assert.match(craters,/visual-crater-eroded-rims/);
 assert.match(craters,/craterRims:true/);
 assert.match(craters,/lip\.raycast=\(\)=>\{\}/);
 assert.doesNotMatch(craters,/new THREE\.TextureLoader\(\)\.load\(/,
  'an old crater bitmap must not overwrite the procedural texture');
 assert.match(preview,/contactDummy\.scale\.set\(wide\*1\.82,1,depth\*1\.75\)/);
});
