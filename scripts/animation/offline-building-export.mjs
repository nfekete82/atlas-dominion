import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installOfflineCanvas} from './offline-canvas.mjs';
import {CPUBuildingRenderer} from './cpu-building-renderer.mjs';
import {createBuildingExporter} from './building-export.js';
import {loadRefinedHeadquarters} from './refined-headquarters.js';
import {loadRefinedBastion} from './refined-bastion.js';

export async function loadGeometryGLB(url){
 const bytes=await readFile(url),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length));
 // Imported paint is deliberately replaced by the new atlas. Skip image decode
 // when loading source geometry in Node; keep every mesh, material and clip.
 const removeTextures=value=>{for(const key of Object.keys(value)){if(key.endsWith('Texture'))delete value[key];else if(value[key]&&typeof value[key]==='object')removeTextures(value[key]);}};
 for(const material of gltf.materials)removeTextures(material);
 delete gltf.images;delete gltf.textures;delete gltf.samplers;
 const json=Buffer.from(JSON.stringify(gltf)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.write('JSON',16);
 const out=Buffer.concat([header,padded,binary]);return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}
export async function exportOfflineBuildings(options,kinds){
 installOfflineCanvas();
 const sourceGeometry=kind=>loadGeometryGLB(new URL('../../tools/building-sources/'+kind+'-refined.glb',import.meta.url));
 const bake=createBuildingExporter({...options,renderer:new CPUBuildingRenderer(),loadHeadquarters:async team=>loadRefinedHeadquarters(team,await sourceGeometry('headquarters')),loadBastion:async team=>loadRefinedBastion(team,await sourceGeometry('bastion'))});
 await bake(kinds);
}
