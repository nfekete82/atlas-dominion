import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePNG} from '../scripts/animation/offline-canvas.mjs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {createGroundDetails} from '../dist/src/reborn/battlefield-atmosphere.js';
import {environmentPropVisible,propSiteClear} from '../dist/src/reborn/prop-placement.js';

const root='src/assets/reborn/props-3d/',meta=JSON.parse(readFileSync(root+'props.json','utf8'));
const kinds=['military-crate','military-crate-stack','service-lamp','service-terminal','fuel-barrels','sandbags','desert-skull','palm-tree'];
const hash=b=>createHash('sha256').update(b).digest('hex');
test('prop masters: eight self-contained GLBs with real geometry and embedded PBR surfaces',()=>{
 assert.deepEqual(Object.keys(meta.props),kinds);
 for(const kind of kinds){
  const bytes=readFileSync(root+kind+'.glb'),n=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+n)),binary=bytes.subarray(28+n);
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(hash(bytes),meta.props[kind].sha256);
  assert.ok(g.meshes.length>=10&&meta.props[kind].triangles>4000,kind+' must contain authored meshes');
  assert.ok(!g.buffers.some(b=>b.uri)&&!g.images.some(i=>i.uri),'GLB must embed every resource');
  for(const image of g.images){
   const v=g.bufferViews[image.bufferView],png=decodePNG(binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));
   assert.ok(png.width>=256&&png.height>=256);
  }
  for(const mat of g.materials){
   assert.ok(mat.pbrMetallicRoughness);
   if(!mat.emissiveFactor?.some(v=>v>0)){
    assert.ok(mat.pbrMetallicRoughness.baseColorTexture,kind+' albedo');
    assert.ok(mat.pbrMetallicRoughness.metallicRoughnessTexture,kind+' ORM');
    assert.ok(mat.normalTexture,kind+' tangent normals');
   }
  }
  for(const mesh of g.meshes)for(const p of mesh.primitives){
   assert.ok(p.attributes.POSITION!==undefined&&p.attributes.NORMAL!==undefined&&p.attributes.TEXCOORD_0!==undefined);
   const positions=g.accessors[p.attributes.POSITION],normals=g.accessors[p.attributes.NORMAL];
   assert.ok(positions.count>=3&&positions.count===normals.count);
   assert.ok(positions.min.every(Number.isFinite)&&positions.max.every(Number.isFinite));
   assert.ok(!p.extensions?.KHR_draco_mesh_compression,'plain glTF remains inspectable');
  }
 }
});
test('prop sprites: registered, detailed, transparent, distinct mesh views with baked contact/cast shadows',()=>{
 const bytes=readFileSync(root+'props.png'),img=decodePNG(bytes);
 assert.equal(hash(bytes),meta.atlasSHA256);assert.equal(img.width,meta.width);assert.equal(img.height,meta.height);
 assert.equal(meta.baker,'cpu-pbr');assert.equal(meta.supersampling,2);assert.equal(meta.bakedShadow,true);
 assert.deepEqual(meta.camera.position,[0,8,12]);assert.equal(meta.camera.turn,Math.PI/4);
 for(const p of Object.values(meta.props)){
  assert.equal(p.frames.length,4);assert.ok(p.solidWidth>50);
  const hashes=[];
  for(const f of p.frames){
   assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=img.width&&f.y+f.h<=img.height);
   assert.ok(p.pivot[0]>0&&p.pivot[0]<f.w&&p.pivot[1]>0&&p.pivot[1]<f.h);
   let solid=0,shadow=0;const pixels=[];
   for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++){
    const at=(y*img.width+x)*4,a=img.pixels[at+3];if(a>200)solid++;else if(a>10&&a<150)shadow++;
    pixels.push(...img.pixels.subarray(at,at+4));
   }
   assert.ok(solid>1500&&shadow>100,'not empty, not a UI icon, actual shadow receiver');
   hashes.push(hash(new Uint8Array(pixels)));
  }
  assert.equal(new Set(hashes).size,4,'bake four genuine rotated 3D views');
 }
});
test('environment props: sparse deterministic slots avoid starts and bastions in legacy and current maps',()=>{
 for(const seed of [1,2026,75310])for(const version of [0,11,14]){
  const g=new Simulation(seed,version),save=g.save(),blocked=g.world.blocked.slice();
  const sites=[...g.territories.map(t=>t.point),...g.bases.filter(b=>b.kind==='headquarters')];
  const a=createGroundDetails(g.world,sites),b=createGroundDetails(g.world,sites);
  assert.deepEqual(a,b);
  for(const kind of ['palm','skull']){
   const slots=a.filter(p=>p.kind===kind);assert.ok(slots.length>0&&slots.length<a.length*.075,'rare '+kind);
   for(const p of slots){
    assert.equal(g.world.blocked[g.world.index(p)],0);
    assert.ok(sites.every(s=>Math.hypot(s.x-p.x,s.y-p.y)>=(kind==='palm'?125:92)+p.radius));
    if(kind==='skull')assert.ok(p.radius<=9,'bone props are deliberately small');
   }
  }
  a.filter(p=>p.kind==='palm'||p.kind==='skull').forEach(p=>environmentPropVisible(p,g));
  assert.deepEqual(g.world.blocked,blocked);assert.deepEqual(g.save(),save);
  const restored=Simulation.load(save);
  assert.deepEqual(createGroundDetails(restored.world,sites),a,'old saves regenerate identical visual slots');
  assert.ok(!Object.keys(save).some(k=>/prop|decor|palm|skull/i.test(k)));
 }
});
test('environment and base props: moving units do not hide scenery; permanent structures still take priority',()=>{
 const g=new Simulation(2026,11);g.world.blocked.fill(0);g.bases=[];g.territories=[];g.units=[];
 const p={x:1000,y:1000,radius:30,kind:'palm',rotation:0,variant:.5};
 assert.ok(environmentPropVisible(p,g));
 const u=g.spawn(0,p,'rover'),save=g.save();
 assert.equal(environmentPropVisible(p,g),true,'rover passing through tree must not erase it');
 assert.equal(propSiteClear(p,30,g),true,'crates and lamps must stay drawn next to moving units');
 assert.deepEqual(g.save(),save);u.x+=250;
 assert.ok(environmentPropVisible(p,g));
 g.bases.push({id:1001,kind:'factory',x:p.x,y:p.y,radius:70,buildRemaining:10});
 assert.equal(environmentPropVisible(p,g),false,'unfinished building also has priority');
 assert.equal(environmentPropVisible({...p,kind:'skull',radius:7},g),false);
 assert.ok(propSiteClear(p,30,g,{base:1001}),'host filtering for base service slots');
 g.bases=[];g.territories.push({id:3,point:{x:1000,y:1000}});
 assert.equal(environmentPropVisible(p,g),false,'bastion footprint');
 g.territories=[];g.world.blocked[g.world.index(p)]=1;assert.equal(environmentPropVisible(p,g),false);
});
