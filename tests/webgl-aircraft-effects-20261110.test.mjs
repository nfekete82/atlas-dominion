import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {adoptAircraftForCrash,disposeAircraftCrash,guidedRocketAimY,aircraftAimOffsetY}
 from '../scripts/webgl-aircraft-effects.js';
test('guided shoulder rocket climbs to the airborne helicopter and bomber fuselage, not the sand',()=>{
 const launch={target:44},ground=21;
 assert.ok(Math.abs(guidedRocketAimY(launch,{id:44,kind:'scout',flightHeight:1},ground,48)-(ground+175+17.76))<1e-8);
 assert.ok(Math.abs(guidedRocketAimY(launch,{id:44,kind:'bomber',flightHeight:1},ground,51)-(ground+175+18.87))<1e-8);
 assert.ok(Math.abs(guidedRocketAimY(launch,{id:44,kind:'scout',flightHeight:0},ground,48)-(ground+3+17.76))<1e-8);
 assert.equal(guidedRocketAimY({},{id:44,kind:'scout'},ground,48),ground+15,
  'non-guided rockets still target their original ground endpoint');
 assert.equal(guidedRocketAimY(launch,{kind:'tank'},ground,48),ground+15);
 assert.equal(aircraftAimOffsetY('scout',48),17.76);
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 assert.match(vfx,/const targetUnit=missile.target===undefined/);
 assert.match(vfx,/targetEntry.node.position.y/);
 assert.match(vfx,/guidedRocketAimY\(missile,targetUnit/);
 assert.doesNotMatch(vfx,/this\.heightAt\(missile.to.x,missile.to.y\)\+15\)/);
});
for(const kind of ['scout','bomber'])test(kind+' crash keeps actual textured 3D mesh/UVs and releases only owned materials',()=>{
 const scene=new THREE.Scene(),node=new THREE.Group();
 node.position.set(120,197,-90);
 node.rotation.y=.42;scene.add(node);
 const model=new THREE.Group();model.name='AuthoredAircraft';
 const texture=new THREE.Texture();texture.name='desert-aircraft-albedo';
 const material=new THREE.MeshStandardMaterial({map:texture,color:0xcabb8a});
 material.userData.sandforgeFactionTint=true;
 let disposed=0;material.dispose=()=>disposed++;
 const geometry=new THREE.BoxGeometry(12,3,28);
 const body=new THREE.Mesh(geometry,material);body.name='TexturedAircraftBody';
 model.add(body);node.add(model);
 const entry={kind,node,detail:model};
 const captured=adoptAircraftForCrash(entry);
 assert.ok(captured);
 assert.equal(entry.detail,null);
 assert.equal(captured.root.position.y,197);
 assert.equal(captured.root.rotation.y,node.rotation.y);
 assert.equal(captured.root.getObjectByName('TexturedAircraftBody'),body);
 assert.equal(body.material.map,texture,'albedo and author UVs remain attached');
 assert.equal(body.geometry,geometry,'shared GLB geometry is not recreated');
 scene.add(captured.root);
 const crash={...captured,mesh:captured.root};
 disposeAircraftCrash(crash);
 assert.equal(disposed,1);
 assert.ok(!captured.root.parent);
 assert.equal(geometry.attributes.position.count,24,'original GLB geometry untouched');
 texture.dispose();geometry.dispose();
});
test('crash path never constructs gray aircraft proxies or consumes gameplay assets',()=>{
 const vfx=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.doesNotMatch(vfx,/crashFuselage|crashWing|crashMast|spawnAircraftCrash/);
 assert.match(vfx,/captureAircraftCrash\(entry,u\)/);
 assert.match(vfx,/this\.capturedAircraftIds\.delete\(id\)/);
 assert.match(battlefield,/this\.effects\?\.captureAircraftCrash\?\.\(e,removal\)/);
 assert.match(readFileSync('scripts/build.mjs','utf8'),/webgl-aircraft-effects\.js/);
});
