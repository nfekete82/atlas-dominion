/** Reproducible HQ3 extraction and geometry/UV audit. Never writes source GLBs. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {simplifyBarracksSilhouette} from './webgl-barracks-silhouette.js';
import {renderedBuildingBounds} from './webgl-building-bounds.js';
import {calibratedScale,strategicBuildingHeightScale} from './webgl-scale.js';
const base='src/assets/reborn/buildings-3d/';
export function readGlb(path){
 const bytes=readFileSync(path),length=bytes.readUInt32LE(12);
 if(bytes.toString('ascii',0,4)!=='glTF')throw Error('Not glTF: '+path);
 return {bytes,json:JSON.parse(bytes.toString('utf8',20,20+length)),bin:bytes.subarray(28+length)};
}
export async function geometryScene(path){
 const {json,bin}=readGlb(path);
 // Keep geometry, rigs, transforms and exact scalar PBR values; avoid DOM image
 // decoding for the Node audit. The original assets stay byte-for-byte intact.
 delete json.images;delete json.textures;
 for(const material of json.materials??[]){
  for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];
  for(const key of ['baseColorTexture','metallicRoughnessTexture'])delete material.pbrMetallicRoughness?.[key];
 }
 const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(padded);
 const binary=Buffer.alloc(12+8+padded.length+8+bin.length);
 binary.write('glTF');binary.writeUInt32LE(2,4);binary.writeUInt32LE(binary.length,8);
 binary.writeUInt32LE(padded.length,12);binary.writeUInt32LE(0x4e4f534a,16);padded.copy(binary,20);
 binary.writeUInt32LE(bin.length,20+padded.length);binary.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(binary,28+padded.length);
 return new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
}
const widths={headquarters:225,barracks:158,factory:200,airfield:218,research:145,silo:185,generator:112,turret:72,bastion:116};
const files={headquarters:'sandforge_funkzentrale_hq3_game_ready.glb',barracks:'sandforge_kaserne_betriebsbereit.glb',factory:'factory-0.glb',airfield:'airfield-0.glb',research:'research-offline.glb',silo:'silo-closed.glb',generator:'generator-0.glb',turret:'turret-0.glb',bastion:'sandforge_bastion_mk2_offline.glb'};
async function main(){
 mkdirSync(base+'hq3-materials',{recursive:true});mkdirSync('docs/building-design-system',{recursive:true});
 const {json,bytes,bin}=readGlb(base+files.headquarters);
 const imageNames=['concrete-albedo','camouflage-albedo','camouflage-normal','metal-albedo','roof-albedo','roof-normal','door-albedo'];
 const images=imageNames.map((name,i)=>{
  const view=json.bufferViews[json.images[i].bufferView],raw=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  writeFileSync(base+'hq3-materials/'+name+'.jpg',raw);
  return {name,sourceImage:i,file:name+'.jpg',bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
 });
 const buildings={};
 for(const [kind,file] of Object.entries(files)){
  const {scene,animations}=await geometryScene(base+file);
  const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
  const scale=kind==='bastion'?widths[kind]/Math.max(size.x,size.z):calibratedScale(kind,'building',size,widths[kind]);
  const heightScale=strategicBuildingHeightScale(kind);
  let meshes=0,triangles=0,vertices=0;
  const surfaces={};
  scene.updateWorldMatrix(true,true);
  scene.traverse(mesh=>{
   if(!mesh.isMesh)return;meshes++;
   const g=mesh.geometry,p=g.getAttribute('position'),uv=g.getAttribute('uv'),indices=g.index;
   const count=indices?.count??p.count;triangles+=count/3;vertices+=p.count;
   const material=mesh.material.name,info=surfaces[material]??={area:0,uvArea:0};
   const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
   for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(j=>indices?indices.getX(i+j):i+j);
    a.fromBufferAttribute(p,ids[0]).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,ids[1]).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,ids[2]).applyMatrix4(mesh.matrixWorld);
    info.area+=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()/2;
    if(uv){const [ia,ib,ic]=ids;info.uvArea+=Math.abs((uv.getX(ib)-uv.getX(ia))*(uv.getY(ic)-uv.getY(ia))-(uv.getY(ib)-uv.getY(ia))*(uv.getX(ic)-uv.getX(ia)))/2;}
   }
   surfaces[material]=info;
  });
  const visible=scene.clone(true);if(kind==='barracks')simplifyBarracksSilhouette(visible);
  visible.scale.set(scale,scale*heightScale,scale);
  const visibleRenderSize=renderedBuildingBounds(visible).getSize(new THREE.Vector3()).toArray();
  buildings[kind]={file,visibleRenderSize,sourceMin:bounds.min.toArray(),sourceMax:bounds.max.toArray(),sourceSize:size.toArray(),scale,heightScale,renderSize:[size.x*scale,size.y*scale*heightScale,size.z*scale],meshes,vertices,triangles,clips:animations.map(a=>a.name),surfaces};
 }
 const report={reference:files.headquarters,sha256:createHash('sha256').update(bytes).digest('hex'),materials:json.materials,images,buildings,infantryRenderHeight:61*.56};
 writeFileSync('docs/building-design-system/asset-audit.json',JSON.stringify(report,null,2)+'\n');
 const profiles=Object.fromEntries(Object.entries(json.materials).map(([,m])=>[m.name,{roughness:m.pbrMetallicRoughness.roughnessFactor,metalness:m.pbrMetallicRoughness.metallicFactor,color:m.pbrMetallicRoughness.baseColorFactor?.slice(0,3)}]));
 writeFileSync('scripts/webgl-hq3-reference.js','// Generated by node scripts/audit-building-design.mjs from the unmodified HQ3 GLB.\nexport const HQ3_REFERENCE_SHA256='+JSON.stringify(report.sha256)+';\nexport const HQ3_PBR='+JSON.stringify(profiles,null,2)+';\nexport const BUILDING_MEASUREMENTS='+JSON.stringify(Object.fromEntries(Object.entries(buildings).map(([k,v])=>[k,{file:v.file,sourceSize:v.sourceSize,renderSize:v.renderSize,scale:v.scale,heightScale:v.heightScale}])),null,2)+';\n');
 console.log(JSON.stringify({reference:report.sha256,buildings:Object.fromEntries(Object.entries(buildings).map(([k,v])=>[k,v.renderSize.map(n=>+n.toFixed(2))])),extractedBytes:images.reduce((n,i)=>n+i.bytes,0)},null,2));
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file://'+process.cwd()+'/').href)await main();
