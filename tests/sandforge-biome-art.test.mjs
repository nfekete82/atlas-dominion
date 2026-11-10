import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {BIOME_STYLES,normalizeBiome,addBiomeVegetation} from '../scripts/webgl-biomes.js';

test('all three biomes have distinct, validated visual palettes',()=>{
 assert.deepEqual(Object.keys(BIOME_STYLES),['desert','snow','jungle']);
 for(const [key,style] of Object.entries(BIOME_STYLES)){
  assert.ok(style.label);
  for(const color of ['fog','terrain','groundBase','groundLight','groundRock','sunlight'])
   assert.match(style[color],/^#[0-9a-f]{6}$/i,key+': '+color);
  assert.equal(style.rocks.length,3);
 }
 for(const name of ['desert','snow','jungle'])assert.equal(normalizeBiome(name),name);
 for(const name of [null,'','Jungle','../../secret','volcano'])assert.equal(normalizeBiome(name),'desert');
});

test('WebGL build packages biome renderer and menu selection',()=>{
 assert.ok(existsSync('dist/webgl-biomes.js'));
 const html=readFileSync('dist/webgl-preview.html','utf8');
 const preview=readFileSync('dist/webgl-preview.js','utf8');
 const menu=readFileSync('dist/webgl-title-menu.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(html,/id="sf3d-biome"/);
 assert.match(html,/<option value="snow">/);
 assert.match(html,/<option value="jungle">/);
 assert.match(preview,/addBiomeVegetation\(/);
 assert.match(preview,/biome==='desert'\?sandTexture\(\)/);
 assert.match(preview,/new SandforgeCombatEffects\(\{[^}]*biome/);
 assert.match(menu,/savedBiomeKey/);
 assert.match(build,/cpSync\('scripts\/webgl-biomes\.js','dist\/webgl-biomes\.js'\)/);
});

test('instanced biome vegetation is deterministic, cosmetic and bounded',()=>{
 const meshes=[];
 class Vector{
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 }
 class Object3D{
  constructor(){this.position=new Vector();this.rotation=new Vector();this.scale=new Vector();this.matrix={};}
  updateMatrix(){this.matrix={position:{...this.position},scale:{...this.scale}};}
 }
 class InstancedMesh{
  constructor(geometry,material,max){
   this.geometry=geometry;this.material=material;this.max=max;
   this.instanceMatrix={needsUpdate:false};this.matrices=[];
  }
  setMatrixAt(i,matrix){assert.ok(i<this.max);this.matrices[i]=structuredClone(matrix);}
 }
 const Three={
  ConeGeometry:class{},IcosahedronGeometry:class{},CylinderGeometry:class{},
  MeshStandardMaterial:class{},InstancedMesh,Object3D
 };
 const blocked=new Uint8Array(16);
 const world={
  size:3000,blocked,
  walkable:({x,y})=>x>0&&y>0&&x<3000&&y<3000
 };
 const options={
  THREE:Three,scene:{add:mesh=>meshes.push(mesh)},world,
  terrain:{sites:[{x:1500,y:1500}],ruins:[]},game:{units:[{x:300,y:300}]},
  heightAt:()=>0,seed:2074,biome:'snow'
 };
 const first=addBiomeVegetation(options);
 assert.ok(first.count>0&&first.count<=210);
 assert.equal(meshes.length,3);
 assert.ok(meshes.every(mesh=>mesh.count===first.count&&mesh.userData.visualOnly&&mesh.userData.nonPlayable));
 for(const mesh of meshes)for(const instance of mesh.matrices)
  assert.ok(Math.abs(instance.position.x)<1500&&Math.abs(instance.position.z)<1500);
 const second=addBiomeVegetation({...options,scene:{add:()=>{}}});
 assert.equal(first.count,second.count);
 assert.deepEqual(first.meshes.map(m=>m.matrices),second.meshes.map(m=>m.matrices));
 assert.deepEqual(world.blocked,blocked);
 assert.equal(addBiomeVegetation({...options,biome:'desert'}).count,0);
});
