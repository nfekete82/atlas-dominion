import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodePNG} from './animation/offline-canvas.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),directory=path.join(root,'src/assets/reborn/buildings-3d');
const kinds=['headquarters','factory','barracks','airfield','generator','turret','bastion'];
const decoded=new Map();
function png(bytes){const hash=createHash('sha256').update(bytes).digest('hex');if(!decoded.has(hash))decoded.set(hash,decodePNG(bytes));return decoded.get(hash);}
function accessor(g,binary,id){
 const a=g.accessors[id],v=g.bufferViews[a.bufferView],sizes={5121:1,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},size=sizes[a.componentType],items=components[a.type],stride=v.byteStride??size*items,start=(v.byteOffset??0)+(a.byteOffset??0),values=[];
 assert.ok(size&&items,'supported building accessor');assert.ok(start+(a.count-1)*stride+size*items<=binary.length,'accessor fits in GLB');
 const read=a.componentType===5126?'readFloatLE':a.componentType===5125?'readUInt32LE':a.componentType===5123?'readUInt16LE':'readUInt8';
 for(let i=0;i<a.count;i++)for(let c=0;c<items;c++){const value=binary[read](start+i*stride+c*size);assert.ok(Number.isFinite(value),'no NaN/Infinity in GLB');values.push(value);}return values;
}
function frameStats(image,f){
 assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=image.width&&f.y+f.h<=image.height,'frame fits PNG');
 let solid=0,white=0,dark=0;
 for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++){
  const i=(y*image.width+x)*4,p=image.pixels;if(p[i+3]<200)continue;solid++;if(p[i]>248&&p[i+1]>248&&p[i+2]>248)white++;if(p[i]+p[i+1]+p[i+2]<60)dark++;
 }
 return {solid,white,dark};
}
export function auditBuildingAssets(){
 const report=[];
 for(const kind of kinds)for(const team of kind==='bastion'?[0,1,-1]:[0,1]){
  const prefix=kind+'-'+team,meta=JSON.parse(fs.readFileSync(path.join(directory,prefix+'.json'))),bytes=fs.readFileSync(path.join(directory,prefix+'.glb'));
  assert.equal(bytes.subarray(0,4).toString(),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonLength=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=bytes.subarray(28+jsonLength);
  assert.equal(g.buffers.length,1);assert.ok(!g.buffers[0].uri,'buffer embedded');assert.ok(binary.length>=g.buffers[0].byteLength);
  assert.equal(meta.design.surfaceRevision,4);assert.ok(meta.design.serviceDetails>0);assert.ok(meta.design.parts<=meta.design.sourceGeometry.parts+6,'new hardware is batched, not one draw call per bolt');
  assert.equal(g.images.length,3,'one shared albedo / normal / ORM atlas');
  const images=g.images.map(image=>{
   assert.ok(!image.uri,'no external image URI');assert.equal(image.mimeType,'image/png');const v=g.bufferViews[image.bufferView];assert.ok(v.byteOffset+v.byteLength<=binary.length);
   const p=png(binary.subarray(v.byteOffset,v.byteOffset+v.byteLength));assert.deepEqual([p.width,p.height],[2048,2048]);return p;
  });
  let painted=0;const mapUsage=new Set();
  for(const m of g.materials){
   const role=m.extras.atlasSurface;assert.ok(role,'every material has an explicit physical surface');if(role==='light')continue;
   const p=m.pbrMetallicRoughness;assert.ok(p.baseColorTexture&&p.metallicRoughnessTexture&&m.normalTexture&&m.occlusionTexture,'complete PBR surface');
   assert.equal(p.metallicRoughnessTexture.index,m.occlusionTexture.index,'shared packed ORM');
   for(const t of [p.baseColorTexture,p.metallicRoughnessTexture,m.normalTexture])mapUsage.add(g.textures[t.index].source);
   painted++;
  }
  assert.equal(mapUsage.size,3);assert.ok(painted>=5);
  let triangles=0;
  for(const node of g.nodes.filter(n=>n.mesh!==undefined))for(const primitive of g.meshes[node.mesh].primitives){
   const p=accessor(g,binary,primitive.attributes.POSITION),normal=accessor(g,binary,primitive.attributes.NORMAL),material=g.materials[primitive.material];
   assert.equal(p.length,normal.length);
   for(let i=0;i<normal.length;i+=3)assert.ok(Math.abs(Math.hypot(normal[i],normal[i+1],normal[i+2])-1)<.015,'unit surface normal');
   if(material.extras.atlasSurface!=='light'){
    assert.ok(primitive.attributes.TEXCOORD_0!==undefined,'every non-emissive surface has UVs');
    const uv=accessor(g,binary,primitive.attributes.TEXCOORD_0);assert.ok(uv.every(v=>v>=0&&v<=1),'UVs stay inside atlas');
    const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(let i=0;i<uv.length;i++){const axis=i%2;min[axis]=Math.min(min[axis],uv[i]);max[axis]=Math.max(max[axis],uv[i]);}
    assert.ok(max[0]-min[0]>1e-6&&max[1]-min[1]>1e-6,'texture coordinates do not collapse to a line or a single blank pixel');
   }
   if(primitive.indices!==undefined){const indices=accessor(g,binary,primitive.indices);assert.ok(indices.every(i=>i<p.length/3),'indices address real vertices');triangles+=indices.length/3;}else triangles+=p.length/9;
  }
  assert.equal(Math.round(triangles),meta.design.triangles);
  for(const clip of g.animations){
   const expected=meta.clips.find(c=>c.name===clip.name);assert.ok(expected,'GLB and sprites have the same clips');
   for(const channel of clip.channels){assert.ok(g.nodes[channel.target.node],'animated pivot exists');const sampler=clip.samplers[channel.sampler],times=accessor(g,binary,sampler.input);assert.ok(times.every((t,i)=>i===0||t>times[i-1]));assert.ok(Math.abs(times.at(-1)-expected.duration)<1e-4);accessor(g,binary,sampler.output);}
  }
  const body=png(fs.readFileSync(path.join(directory,meta.body.image))),stats=frameStats(body,{x:0,y:0,w:512,h:512});
  assert.ok(stats.solid>3000,'body is not empty');assert.ok(stats.white/stats.solid<.01,'no white/untextured building');assert.ok(stats.dark/stats.solid<.45,'building is not crushed to black');
  assert.deepEqual(meta.body.pivot,[256,382]);assert.equal(meta.bakedShadow,true);assert.ok(meta.body.solidBounds.y+meta.body.solidBounds.h<512,'no clipped foundation');
  const layers={};
  for(const key of ['activity','beacon','sweep','turret'])if(meta[key]){
   const layer=meta[key],image=png(fs.readFileSync(path.join(directory,layer.image)));
   assert.deepEqual(layer.pivot,[256-layer.originalBounds.x,382-layer.originalBounds.y]);
   for(const frame of layer.frames)assert.ok(frameStats(image,frame).solid>0,'nonempty '+prefix+' '+key+' frame');
   if(key!=='beacon')assert.equal(layer.frames.length,64);
   if(key==='turret'){assert.equal(layer.muzzles.length,64);assert.ok(layer.muzzles.flat(2).every(Number.isFinite));}
   layers[key]=layer.frames.length;
  }
  // Examine real embedded texture pixels, not merely JSON texture references.
  const albedo=images[g.textures[g.materials.find(m=>m.pbrMetallicRoughness?.baseColorTexture).pbrMetallicRoughness.baseColorTexture.index].source],colors=new Set();
  for(let i=0;i<albedo.pixels.length;i+=4*137){assert.equal(albedo.pixels[i+3],255);colors.add(albedo.pixels[i]+','+albedo.pixels[i+1]+','+albedo.pixels[i+2]);}
  assert.ok(colors.size>500,'textured paint has real color variation');
  const reference=g.materials.find(m=>m.normalTexture),norm=images[g.textures[reference.normalTexture.index].source],packed=images[g.textures[reference.pbrMetallicRoughness.metallicRoughnessTexture.index].source];
  const lo=[255,255,255],hi=[0,0,0];let normalDetail=0;
  for(let i=0;i<norm.pixels.length;i+=4*137){
   const n=[0,1,2].map(k=>norm.pixels[i+k]/127.5-1);assert.ok(Math.abs(Math.hypot(...n)-1)<.025,'normal texture encodes unit tangent vectors');
   if(Math.abs(n[0])>.04||Math.abs(n[1])>.04)normalDetail++;
   for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],packed.pixels[i+k]);hi[k]=Math.max(hi[k],packed.pixels[i+k]);}
  }
  assert.ok(normalDetail>100,'normal map carries actual surface detail');
  assert.ok(lo[0]<235&&hi[0]>250,'AO includes recesses and open surfaces');
  assert.ok(lo[1]<90&&hi[1]>220,'roughness separates glass, steel and dusty paint');
  assert.ok(lo[2]===0&&hi[2]>200,'metalness separates rubber/glass from exposed steel');
  report.push({kind,team,bytes:bytes.length,parts:meta.design.parts,triangles:meta.design.triangles,embeddedMaps:3,textureSize:2048,opaqueBodyPixels:stats.solid,whiteBodyPixels:stats.white,layers,baker:meta.baker});
 }
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const models=auditBuildingAssets(),report={models,modelsValidated:models.length,result:'passed'};
 if(process.argv.includes('--report'))fs.writeFileSync(path.join(root,'docs/buildings-3d/pbr-validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log('Validated',models.length,'GLBs: embedded PBR, UVs, geometry, clips, all teams and every sprite frame.');
}
