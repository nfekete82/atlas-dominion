import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
test('the exact user-supplied Meshy HQ is the default art path with HQ3 fallback',async()=>{
 const {SANDFORGE_DEFAULT_FELDKOMMANDO_URL,isDefaultFeldkommandoAsset}=
  await import('../scripts/webgl-meshy-assets.js');
 assert.equal(SANDFORGE_DEFAULT_FELDKOMMANDO_URL,
  '/src/assets/reborn/buildings-3d/sandforge_feldkommando_meshy.glb');
 assert.ok(isDefaultFeldkommandoAsset(SANDFORGE_DEFAULT_FELDKOMMANDO_URL));
 const game=read('scripts/webgl-battlefield.js');
 assert.ok(game.includes('return SANDFORGE_DEFAULT_FELDKOMMANDO_URL'));
 assert.ok(game.includes("strategicGlbUrl('headquarters','active')"));
 assert.ok(game.includes('sandforgeMeshyHeadquarters=true'));
 assert.ok(game.includes('isDefaultFeldkommandoAsset(task.url)'));
 assert.ok(game.includes("if(kind!=='headquarters')throw error"));
 const portraits=read('scripts/webgl-portraits.js');
 assert.ok(portraits.includes('urlOverride:SANDFORGE_DEFAULT_FELDKOMMANDO_URL'));
 const gates=read('scripts/webgl-production-gates.js');
 assert.ok(gates.includes('MeshyHQ_AnimatedEntrance'));
 assert.ok(gates.includes('root.userData.portal'));
 assert.ok(gates.includes("entry.node.add(root)"));
});
test('actual Meshy asset, if installed, retains exactly the uploaded original bytes',()=>{
 const path='src/assets/reborn/buildings-3d/sandforge_feldkommando_meshy.glb';
 if(!existsSync(path))return; // The ZIP is installed in the local checkout.
 const bytes=readFileSync(path);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(bytes.length,7258044);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
 '3cd32f7845dcf64707d71c682a0a3985e929ab18a42d76684ba5937153f63bf3');
});
