import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weatheredStoneGeometry,sharedStoneMaps}
 from '../scripts/webgl-rock-materials.js';
import {createConformingCraterGeometry,renderGroundHeightSampler}
 from '../scripts/webgl-environment.js';
import * as THREE from 'three';

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
 assert.match(craters,/createConformingCraterGeometry\(crater,/);
 assert.match(craters,/groundConforming:true/);
 assert.match(craters,/mesh\.raycast=\(\)=>\{\}/);
 assert.doesNotMatch(craters,/makeCraterLipGeometry|visual-crater-eroded-rims/,
  'floating polygonal tire rings must never return');
 assert.doesNotMatch(craters,/new THREE\.TextureLoader\(\)\.load\(/,
  'an old crater bitmap must not overwrite the procedural texture');
 assert.match(preview,/contactDummy\.scale\.set\(wide\*1\.82,1,depth\*1\.75\)/);
});


test('solid sandstone caps face outward, with no hollow donut hole from above',()=>{
 for(const lite of [false,true]){
  const geometry=weatheredStoneGeometry(lite);
  const {strata,segments}=geometry.userData;
  const p=geometry.getAttribute('position');
  const faceNormalY=(firstTriangle)=>{
   const a=new THREE.Vector3().fromBufferAttribute(p,firstTriangle*3);
   const b=new THREE.Vector3().fromBufferAttribute(p,firstTriangle*3+1);
   const c=new THREE.Vector3().fromBufferAttribute(p,firstTriangle*3+2);
   return b.sub(a).cross(c.sub(a)).y;
  };
  const sideFaces=(strata-1)*segments*2;
  assert.ok(faceNormalY(sideFaces)>0,'top cap must face the RTS camera');
  assert.ok(faceNormalY(sideFaces+segments)<0,
   'underside must face downwards without exposing a hole');
  geometry.dispose();
 }
});

test('crater decals follow sampled dunes and use one geometry with no raised ring',()=>{
 const details=[
  {x:850,y:1250,radius:29,rotation:.34},
  {x:1780,y:790,radius:35,rotation:1.4}
 ];
 const sampler=(x,z)=>new THREE.Vector3(
  x-2000,7+.009*x+.006*z+2*Math.sin(x*.015),z-2000);
 const original=JSON.stringify(details);
 const g=createConformingCraterGeometry(details,{pos:sampler,spacious:true});
 assert.equal(g.userData.craterCount,2);
 assert.equal(g.userData.groundConforming,true);
 const p=g.getAttribute('position');
 const uv=g.getAttribute('uv');
 assert.equal(p.count,uv.count);
 assert.ok(p.count>150&&g.index.count>700);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)+2000,z=p.getZ(i)+2000;
  assert.ok(Math.abs(p.getY(i)-(sampler(x,z).y+.24))<.001,
   'every vertex must follow ground height, with a tiny decal offset');
 }
 const first=new THREE.Vector3().fromBufferAttribute(p,g.index.getX(0));
 const next=new THREE.Vector3().fromBufferAttribute(p,g.index.getX(1));
 const last=new THREE.Vector3().fromBufferAttribute(p,g.index.getX(2));
 assert.ok(next.sub(first).cross(last.sub(first)).y>0,
  'crater triangles must face the camera, not disappear under back-face culling');
 const g2=createConformingCraterGeometry(details,{pos:sampler,spacious:true});
 assert.deepEqual([...g.getAttribute('position').array],
  [...g2.getAttribute('position').array],'terrain conforming decals deterministic');
 const lite=createConformingCraterGeometry(details,{pos:sampler,spacious:true,lowQuality:true});
 assert.ok(lite.getAttribute('position').count<p.count);
 assert.equal(JSON.stringify(details),original,'visuals must not mutate map');
 g.dispose();g2.dispose();lite.dispose();
});


test('decal sampler matches the exact triangulated 4x4 terrain height, not a curved heightfield',()=>{
 const size=4160,segments=224,step=size/segments;
 const heightAt=(x,z)=>11+Math.sin(x*.031)*5+
  Math.cos(z*.049)*3+.00001*x*z;
 const sample=renderGroundHeightSampler(heightAt,size,segments);
 for(const [cx,cz,tx,tz] of [[14,32,.24,.42],[52,41,.79,.65],[120,155,.4,.6]]){
  const x=(cx+tx)*step,z=(cz+tz)*step;
  const a=heightAt(cx*step,cz*step);
  const b=heightAt((cx+1)*step,cz*step);
  const c=heightAt(cx*step,(cz+1)*step);
  const d=heightAt((cx+1)*step,(cz+1)*step);
  const expected=tx+tz<=1?
   a*(1-tx-tz)+b*tx+c*tz:
   b*(1-tz)+c*(1-tx)+d*(tx+tz-1);
  assert.ok(Math.abs(sample(x,z)-expected)<1e-8);
 }
 const craters=[{x:1250,y:1550,radius:43,rotation:.71}];
 const pos=(x,z)=>new THREE.Vector3(x-size/2,heightAt(x,z),z-size/2);
 const geo=createConformingCraterGeometry(craters,{
  pos,heightAt,worldSize:size,spacious:true
 });
 const positions=geo.getAttribute('position');
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i)+size/2,z=positions.getZ(i)+size/2;
  assert.ok(Math.abs(positions.getY(i)-(sample(x,z)+.24))<1e-3,
   'crater decal rests just above the rendered triangle, never inside the dune');
 }
 geo.dispose();
});
