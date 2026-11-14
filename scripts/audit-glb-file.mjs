import {readFileSync} from 'node:fs';

export function auditGlbBuffer(bytes){
 if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF')
  throw Error('Kein gültiger GLB-Header');
 if(bytes.readUInt32LE(4)!==2)throw Error('Nur glTF 2.0 wird unterstützt');
 if(bytes.readUInt32LE(8)!==bytes.length)
  throw Error('GLB-Länge stimmt nicht mit dem Header überein');
 const chunkLength=bytes.readUInt32LE(12);
 if(bytes.toString('ascii',16,20)!=='JSON'||20+chunkLength>bytes.length)
  throw Error('GLB-JSON-Chunk fehlt oder ist beschädigt');
 const json=JSON.parse(bytes.subarray(20,20+chunkLength).toString('utf8'));
 const materials=json.materials??[],textures=json.textures??[],meshes=json.meshes??[],
  accessors=json.accessors??[],nodes=json.nodes??[];
 let triangles=0,primitives=0,textured=0,missingUV=0;
 for(const mesh of meshes)for(const p of mesh.primitives??[]){
  primitives++;
  if(p.mode===undefined||p.mode===4)triangles+=Math.floor((p.indices!==undefined?
   accessors[p.indices]?.count:accessors[p.attributes?.POSITION]?.count??0)/3);
  const m=materials[p.material];
  if(!m)continue;
  const mr=m.pbrMetallicRoughness??{};
  const hasTexture=[mr.baseColorTexture,mr.metallicRoughnessTexture,
   m.normalTexture,m.occlusionTexture,m.emissiveTexture].some(Boolean);
  if(hasTexture){textured++;if(p.attributes?.TEXCOORD_0===undefined)missingUV++;}
 }
 const report={
  bytes:bytes.length,meshes:meshes.length,primitives,triangles,
  materials:materials.length,textures:textures.length,images:(json.images??[]).length,
  skins:(json.skins??[]).length,animations:(json.animations??[]).map(a=>a.name??'Unnamed'),
  nodes:nodes.length,extensionsUsed:json.extensionsUsed??[],
  compressedGeometry:(json.extensionsUsed??[]).includes('EXT_meshopt_compression'),
  compressedTextures:(json.extensionsUsed??[]).includes('KHR_texture_basisu'),
  primitivesWithTextures:textured,primitivesMissingTexcoords:missingUV,warnings:[]
 };
 if(missingUV)report.warnings.push(missingUV+' texturierte Primitive ohne TEXCOORD_0');
 if(!textures.length)report.warnings.push('Keine eingebetteten glTF-Texturen vorhanden');
 if(!report.animations.length)report.warnings.push('Keine Animationen im GLB (bei Soldaten prüfen)');
 if(triangles>100000)report.warnings.push('Mehr als 100.000 Dreiecke: LOD für RTS prüfen');
 if(report.images>12)report.warnings.push('Viele Einzeltexturen: GPU-Speicher/Drawcalls prüfen');
 if((json.images??[]).some(image=>image.uri&&!image.uri.startsWith('data:')))
  report.warnings.push('Externe Textur-URI: GLB eventuell nicht vollständig selbstenthaltend');
 return report;
}
if(process.argv[1]?.endsWith('/audit-glb-file.mjs')){
 const filename=process.argv[2];
 if(!filename){console.error('Nutzung: node scripts/audit-glb-file.mjs modell.glb');process.exitCode=2;}
 else try{
  console.log(JSON.stringify({file:filename,...auditGlbBuffer(readFileSync(filename))},null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
