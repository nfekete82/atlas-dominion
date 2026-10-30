import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {propGeometrySignature} from '../scripts/prop-geometry-signature.mjs';
import {decodePNG,OfflineCanvas} from '../scripts/animation/offline-canvas.mjs';
import {CPUBuildingRenderer} from '../scripts/animation/cpu-building-renderer.mjs';
const root='src/assets/reborn/props-3d/';
const baseline=JSON.parse(readFileSync(new URL('./fixtures-prop-pack-v1.json',import.meta.url)));
const meta=JSON.parse(readFileSync(root+'props.json'));

test('prop polish: all eight geometry/normal/UV/index buffers and node transforms equal Prop Pack V1',()=>{
 for(const [kind,original] of Object.entries(baseline.props)){
  assert.equal(propGeometrySignature(readFileSync(root+kind+'.glb')),original.geometrySHA256,kind);
  for(const key of ['parts','triangles','zoom','solidWidth','pivot','frames'])assert.deepEqual(meta.props[kind][key],original[key],kind+' '+key);
  assert.equal(meta.props[kind].surfaceRevision,2);
 }
 assert.deepEqual(meta.camera,baseline.camera);assert.equal(meta.width,baseline.width);assert.equal(meta.height,baseline.height);
 const pixels=decodePNG(readFileSync(root+'props.png')).pixels;
 const alpha=Uint8Array.from({length:pixels.length/4},(_,i)=>pixels[i*4+3]);
 assert.equal(createHash('sha256').update(alpha).digest('hex'),baseline.alphaSHA256,'all silhouettes, ground pivots and shadow coverage stay identical');
});

function glb(bytes){const n=bytes.readUInt32LE(12);return {g:JSON.parse(bytes.subarray(20,20+n)),bin:bytes.subarray(28+n)};}
function embeddedImage(g,bin,index){const v=g.bufferViews[g.images[g.textures[index].source].bufferView];return decodePNG(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));}
function range(image,channel){let min=255,max=0;for(let i=channel;i<image.pixels.length;i+=4){min=Math.min(min,image.pixels[i]);max=Math.max(max,image.pixels[i]);}return max-min;}

test('prop polish: embedded high-resolution physical textures contain correlated wear, roughness and real tangent normals',()=>{
 for(const kind of Object.keys(baseline.props)){
  const {g,bin}=glb(readFileSync(root+kind+'.glb'));
  assert.ok(g.extensionsUsed.includes('KHR_texture_transform'));
  const materials=g.materials.filter(m=>!m.emissiveFactor?.some(v=>v>0));
  assert.ok(materials.length>=2);
  for(const material of materials){
   const p=material.pbrMetallicRoughness,albedo=embeddedImage(g,bin,p.baseColorTexture.index),normal=embeddedImage(g,bin,material.normalTexture.index),orm=embeddedImage(g,bin,p.metallicRoughnessTexture.index);
   assert.ok(albedo.width>=512&&normal.width===albedo.width&&orm.width===albedo.width);
   assert.ok(range(albedo,0)>20,kind+' '+material.name+' has stains/paint variation');
   assert.ok(range(orm,1)>10,kind+' '+material.name+' has differentiated roughness');
   if(!material.name.includes('glass'))assert.ok(range(normal,0)>8||range(normal,1)>8,kind+' '+material.name+' has surface relief');
   const transform=p.baseColorTexture.extensions?.KHR_texture_transform;
   assert.deepEqual(material.normalTexture.extensions?.KHR_texture_transform,transform);
   assert.deepEqual(p.metallicRoughnessTexture.extensions?.KHR_texture_transform,transform);
   assert.deepEqual(material.occlusionTexture.extensions?.KHR_texture_transform,transform);
  }
 }
});

test('CPU PBR baker: material UV transforms sample exactly as equivalent authored UVs; defaults remain unchanged',()=>{
 const image=new OfflineCanvas(16,16);
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)image.pixels.set([x*16,y*16,80,255],(y*16+x)*4);
 const texture=new T.CanvasTexture(image);texture.colorSpace=T.SRGBColorSpace;
 const mesh=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({map:texture,roughness:.8,metalness:.1}));
 const scene=new T.Scene();scene.add(mesh);
 const camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=3;camera.lookAt(0,0,0);
 const renderer=new CPUBuildingRenderer();renderer.setSize(32,32);
 const bake=()=>{renderer.render(scene,camera);return renderer.domElement.pixels.slice();};
 const before=bake();texture.repeat.set(.5,.5);texture.offset.set(.25,.25);texture.updateMatrix();const transformed=bake();
 assert.notDeepEqual(transformed,before);
 const uv=mesh.geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.5+.25,uv.getY(i)*.5+.25);
 texture.repeat.set(1,1);texture.offset.set(0,0);texture.updateMatrix();
 assert.deepEqual(bake(),transformed,'GLB material and atlas share identical texture registration');
});
