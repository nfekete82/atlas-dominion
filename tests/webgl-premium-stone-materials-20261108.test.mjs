import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {sharedStoneMaps,stoneMaterial,weatheredStoneGeometry}
 from '../scripts/webgl-rock-materials.js';

test('rock PBR textures are deterministic, shared, mipmapped and have real relief',()=>{
 const a=sharedStoneMaps(false),b=sharedStoneMaps(false);
 assert.strictEqual(a,b,'create one shared texture atlas, not per individual rock');
 assert.equal(a.resolution,512);
 assert.ok(a.map.isDataTexture&&a.normalMap.isDataTexture&&a.roughnessMap.isDataTexture);
 assert.equal(a.map.image.data.length,512*512*4);
 const pixels=a.map.image.data;
 const seen=new Set();
 for(let i=0;i<pixels.length;i+=64*4)seen.add(pixels[i]);
 assert.ok(seen.size>15,'sandstone has mineral grain, not a uniform tan patch');
 const n=a.normalMap.image.data,normalSet=new Set();
 for(let i=0;i<n.length;i+=128*4)normalSet.add(n[i]+':'+n[i+1]);
 assert.ok(normalSet.size>15,'fine pits and fracture normals must vary');
 const lite=sharedStoneMaps(true);
 assert.equal(lite.resolution,128);
 assert.notStrictEqual(lite,a);
 assert.strictEqual(sharedStoneMaps(true),lite);
});

test('batched rock materials preserve real mineral PBR and low memory pressure',()=>{
 const a=stoneMaterial('#c8a88c'),b=stoneMaterial('#af9275');
 assert.notStrictEqual(a,b);
 assert.strictEqual(a.map,b.map);
 assert.strictEqual(a.normalMap,b.normalMap);
 assert.strictEqual(a.roughnessMap,b.roughnessMap);
 assert.equal(a.metalness,0);
 assert.ok(a.normalScale.x>.4);
 const g=weatheredStoneGeometry(false),tiny=weatheredStoneGeometry(true);
 assert.ok(g.getAttribute('position').count>tiny.getAttribute('position').count);
 assert.ok(g.boundingSphere.radius>0);
 a.dispose();b.dispose();g.dispose();tiny.dispose();
 assert.strictEqual(stoneMaterial('#a99b77').map,sharedStoneMaps(false).map);
});

test('all map-ground stone and rubble types reuse the atlas without new draw calls',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const art=readFileSync('scripts/webgl-desert-art.js','utf8');
 const decor=readFileSync('scripts/webgl-environment.js','utf8');
 const oasis=readFileSync('scripts/webgl-oases.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(preview,/const geometry=weatheredStoneGeometry\(query\.get\('lite'\)==='1'\)/);
 assert.match(preview,/\.map\(color=>stoneMaterial\(color/);
 assert.match(preview,/rockMaps\.normalMap/);
 assert.match(art,/stoneMaterial\('#ead5b9'/);
 // Three biomes still use the shared PBR stone atlas; default desert hues
 // are preserved while snow and jungle choose their own material tints.
 assert.match(decor,/stoneMaterial\(this\.biome==='snow'\?'#a1abb4':this\.biome==='jungle'\?'#6f7662':'#b69a7c'/);
 assert.match(decor,/stoneMaterial\(this\.biome==='snow'\?'#c7d0d7':this\.biome==='jungle'\?'#94947e':'#debe98'/);
 assert.match(decor,/stoneMaterial\(this\.biome==='snow'\?'#83919d':this\.biome==='jungle'\?'#5d6656':'#aa8e70'/);
 assert.match(oasis,/stoneMaterial\('#b8a184'/);
 assert.match(preview,/new THREE\.InstancedMesh\(geometry,mat,1750\)/);
 assert.match(decor,/new THREE\.InstancedMesh\(geometry,dust,/);
 assert.match(art,/new THREE\.InstancedMesh\(geometry,material,target\)/);
 assert.match(build,/cpSync\('scripts\/webgl-rock-materials\.js','dist\/webgl-rock-materials\.js'\)/);
 assert.ok(existsSync('dist/webgl-rock-materials.js'));
});


test('oasis stone construction uses its scoped lite parameter in both quality modes',()=>{
 const source=readFileSync('scripts/webgl-oases.js','utf8');
 const start=source.indexOf(' build(lite){');
 const end=source.indexOf('\n update(time){',start);
 assert.ok(start>=0&&end>start,'expected oasis build(lite) method');
 const body=source.slice(start,end);
 assert.match(body,/weatheredStoneGeometry\(lite\)/);
 assert.match(body,/stoneMaterial\('#b8a184',\{lowQuality:lite,normalScale:\.56\}\)/);
 assert.doesNotMatch(body,/weatheredStoneGeometry\(lowQuality\)/);
 assert.doesNotMatch(body,/\{lowQuality,normalScale:/);
});
