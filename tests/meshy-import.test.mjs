import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {meshyAsset,meshyEnabled,isMeshyAsset,meshyModelYaw} from '../scripts/webgl-meshy-assets.js';

test('Meshy model replacement is opt-in and cannot surprise existing saves',()=>{
 assert.equal(meshyEnabled(''),false);
 assert.equal(meshyAsset('headquarters',0),null);
 assert.equal(meshyEnabled('?models=meshy'),true);
 assert.equal(meshyEnabled('?meshy=1'),true);
 assert.equal(meshyAsset('headquarters',0,'?models=meshy'),'/src/assets/meshy/headquarters.glb');
 assert.equal(meshyAsset('headquarters',1,'?models=meshy'),'/src/assets/meshy/headquarters.glb');
 assert.equal(meshyAsset('tank',0,'?models=meshy'),'/src/assets/meshy/tank.glb');
 assert.equal(meshyAsset('artillery',1,'?models=meshy'),'/src/assets/meshy/artillery.glb');
 assert.equal(meshyAsset('barracks',0,'?models=meshy'),null);
 assert.equal(isMeshyAsset('/src/assets/meshy/tank.glb'),true);
 assert.equal(isMeshyAsset('/src/assets/stylized/tank-0.glb'),false);
 assert.equal(meshyModelYaw('tank'),Math.PI/2);
 assert.equal(meshyModelYaw('headquarters'),0);
});

test('Do not silently freeze animated soldier / rocket infantry',()=>{
 assert.equal(meshyAsset('infantry',0,'?models=meshy'),null);
 assert.equal(meshyAsset('rocket',0,'?models=meshy'),null);
 assert.equal(meshyAsset('infantry',0,'?models=meshy&meshyStaticSoldier=1'),
  '/src/assets/meshy/infantry.glb');
 assert.equal(meshyAsset('rocket',0,'?models=meshy&meshyStaticSoldier=1'),
  '/src/assets/meshy/rocket.glb');
});

test('Game and build ship the optional model integration with robust fallback',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(battlefield,/meshyAsset\(kind,owner\)/);
 assert.match(battlefield,/entry\.meshyFallback=true/);
 assert.match(battlefield,/&&\!entry\.meshyFallback/);
 assert.match(battlefield,/installTankRig\(entry,model\)/);
 assert.match(portraits,/meshyAsset\(kind,0\)/);
 assert.match(build,/webgl-meshy-assets/);
 assert.ok(existsSync('scripts/install-meshy-assets.mjs'));
});

test('Optional rocket GLB must be independently authored rather than reusing the tank',()=>{
 const rocket='src/assets/meshy/rocket.glb';
 if(!existsSync(rocket))return; // Rocket asset is not provided yet.
 const file=readFileSync(rocket);
 assert.equal(file.subarray(0,4).toString('ascii'),'glTF');
 assert.equal(file.readUInt32LE(4),2);
 const tank='src/assets/meshy/tank.glb';
 if(existsSync(tank))assert.notDeepEqual(file,readFileSync(tank));
});
