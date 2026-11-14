import * as THREE from 'three';
import {HQ3_PBR} from './webgl-hq3-reference.js';
import {BARRACKS_ARCHITECTURE} from './webgl-building-profiles.js';
import {desert002Texture} from './webgl-desert002.js';

/** All values/textures come from the unmodified HQ3. Coordinates are baked
 * once in building space, so paint follows doors and all four orientations.
 * Source geometry, UVs and cached GLB materials are never modified. */
export const BUILDING_DESIGN_REVISION='desert-002-master-pbr-v3';
export const HQ3_TEXTURE_ROOT='/src/assets/reborn/buildings-3d/hq3-materials/';
// sqrt(world surface area / UV area), measured by audit-building-design.mjs.
export const HQ3_TILE_SPAN=Object.freeze({camouflage:63.9913072855748,roof:28.852837770972137,concrete:20.402950054633266,metal:6.964335905277821,door:12.045831369252125});
export const BUILDING_MATERIAL_FAMILIES=Object.freeze({
 HQ_Desert_Camouflage:{reference:'Desert_Camouflage_Weathered',map:'camouflage-albedo',normal:'camouflage-normal',span:HQ3_TILE_SPAN.camouflage},
 HQ_Dark_Charcoal_Roof:{reference:'Dark_Weathered_Roof',map:'roof-albedo',normal:'roof-normal',span:HQ3_TILE_SPAN.roof},
 HQ_Military_Concrete:{reference:'Sand_Concrete_PBR',map:'concrete-albedo',span:HQ3_TILE_SPAN.concrete},
 HQ_Weathered_Metal:{reference:'Graphite_Metal',map:'metal-albedo',span:HQ3_TILE_SPAN.metal},
 HQ_Door_Metal:{reference:'Olive_Painted_Steel',map:'door-albedo',span:HQ3_TILE_SPAN.door},
 // HQ3 has dark arrow slits rather than a glass material; retain each model's
 // actual glazing instead of inventing transmission or recolouring windows.
 HQ_Window_Glass:{preserve:true},
 HQ_Outdoor_Equipment:{reference:'Olive_Painted_Steel',map:'door-albedo',span:HQ3_TILE_SPAN.door},
 HQ_Fence_Material:{reference:'Graphite_Metal',map:'metal-albedo',span:HQ3_TILE_SPAN.metal}
});
const textures=new Map(),geometryCache=new WeakMap();
export function buildingTexture(name){
 if(name==='camouflage-albedo')return desert002Texture();
 if(textures.has(name))return textures.get(name);
 const map=typeof document==='undefined'?new THREE.Texture():new THREE.TextureLoader().load(HQ3_TEXTURE_ROOT+name+'.jpg');
 map.name='HQ3_'+name;map.colorSpace=name.endsWith('normal')?THREE.NoColorSpace:THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.flipY=false;
 map.anisotropy=4;textures.set(name,map);return map;
}
export function buildingMaterialFamily(kind,material,meshName=''){
 const name=material?.name??'',both=name+' '+meshName;
 // Draped airfield paving keeps its existing wear/markings and tessellation.
 if(kind==='airfield'&&/apron|runway|taxi|parking|landing|concretejoint|ramp|threshold|shoulder|touchdown|fuelservicepad|fuelconcretejoint|hangarcenterguide/i.test(meshName))return null;
 if(material?.transparent||/glass|window|skylight|canopy|screen|optic|recess|interior|signal|glow|lightbulb|lightstrip|light_strip|floodlight|lamp|beacon|emission|hazard|yellow|copper|insignia|stencil|identity|team|faction enamel|rubber|tire|wheel|track|radar|dish|antenna|core_window|weapon|rocket|missile|barrel|muzzle|gun/i.test(both))return null;
 if(/fence/i.test(both))return 'HQ_Fence_Material';
 if(/blast_door|hatch|cover/i.test(meshName)&&kind==='silo')return 'HQ_Dark_Charcoal_Roof';
 if(/door|gate|shutter|airlock/i.test(both))return 'HQ_Door_Metal';
 if(/roof|hangarcamoarch|crownplate|corecap|coredome|wallcap/i.test(meshName))return 'HQ_Dark_Charcoal_Roof';
 if(/foundation|plinth|floor|paving|apron|runway|ramp|pad|ground|dust/i.test(both))return /runway|marking|guide|edge/i.test(meshName)?null:'HQ_Military_Concrete';
 if(kind==='barracks'&&/^static__/.test(meshName)&&/^SF_(olive(?:_light)?|steel|white|concrete_high|deck(?:_light)?)$/.test(name))return 'HQ_Desert_Camouflage';
 if(/steel_dark|steel_light|metal|steel|frame|rib|support|bolt|band|brace|vent|exhaust/i.test(both))return 'HQ_Weathered_Metal';
 if(/crate|console|cabinet|equipment|pump/i.test(meshName))return 'HQ_Outdoor_Equipment';
 if(/^SF_(olive|concrete|deck|white|missile)|concrete|ceramic|sandplate|camo|camouflage|armou?r|hull|wall|panel|vessel|shaft|fascia|buttress|structure/i.test(both))return 'HQ_Desert_Camouflage';
 return null;
}
function projectionGeometry(mesh,root){
 const original=mesh.geometry;
 if(original.getAttribute('sfBuildingPosition'))return original;
 const relative=new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
 // Include final render scale, exclude actor translation/orientation. One texel
 // density across 1-unit Atlas models and 20-unit authored Kaserne exports.
 relative.premultiply(new THREE.Matrix4().makeScale(root.scale.x,root.scale.y,root.scale.z));
 const key=relative.elements.map(v=>v.toFixed(6)).join(',');
 let cache=geometryCache.get(original);
 if(!cache){cache=new Map();geometryCache.set(original,cache);}
 if(cache.has(key))return cache.get(key);
 const geometry=new THREE.BufferGeometry();geometry.type=original.type;
 // Reuse immutable GPU attributes and indices; only projection coordinates are
 // new. BufferGeometry.clone() would duplicate ALL positions/normals/UVs.
 for(const [name,attribute] of Object.entries(original.attributes))geometry.setAttribute(name,attribute);
 geometry.setIndex(original.index);geometry.groups=original.groups.map(g=>({...g}));
 geometry.drawRange={...original.drawRange};geometry.parameters=original.parameters;geometry.boundingBox=original.boundingBox?.clone()??null;
 geometry.boundingSphere=original.boundingSphere?.clone()??null;
 const positions=original.getAttribute('position'),data=new Float32Array(positions.count*3),v=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(relative);v.toArray(data,i*3);}
 geometry.setAttribute('sfBuildingPosition',new THREE.BufferAttribute(data,3));
 geometry.userData={...original.userData,sandforgeBuildingProjection:true};
 cache.set(key,geometry);return geometry;
}
const tangentFrame=`mat3 sfHqFrame(vec3 eye,vec3 n,vec2 uv){
 vec3 q0=dFdx(eye),q1=dFdy(eye);vec2 s0=dFdx(uv),s1=dFdy(uv);
 vec3 t=cross(q1,n)*s0.x+cross(n,q0)*s1.x;
 vec3 b=cross(q1,n)*s0.y+cross(n,q0)*s1.y;
 float d=max(dot(t,t),dot(b,b));float f=d==0.0?0.0:inversesqrt(d);
 return mat3(t*f,b*f,n);
}`;
function surfaceMaterial(source,family,{roofStart,mixedRoof,kind}){
 const profile=BUILDING_MATERIAL_FAMILIES[family],pbr=HQ3_PBR[profile.reference];
 const mat=source.clone();
 // New PBR coating, not a 98% colour overlay. Original UV AO and geometry
 // remain; albedo, normals and scalar roughness/metalness use the reference.
 mat.color.set(0xffffff);mat.map=null;mat.normalMap=null;mat.bumpMap=null;
 mat.roughnessMap=null;mat.metalnessMap=null;mat.roughness=pbr.roughness;mat.metalness=pbr.metalness;
 mat.emissive.set(0);mat.emissiveMap=null;mat.emissiveIntensity=0;
 // Feldkommando MK2 is the reference for the Kaserne: shared matte
 // olive/sand camouflage, brushed graphite roofing and metallic hardware.
 // Preserve the projected HQ texture/normal detail rather than flat colours.
 if(kind==='barracks'){
  if(family==='HQ_Desert_Camouflage')mat.color.set('#ffffff');
  if(family==='HQ_Dark_Charcoal_Roof'){
   mat.color.set('#626870');mat.roughness=.70;mat.metalness=.62;
  }
  if(family==='HQ_Weathered_Metal'){
   mat.color.set('#89908c');mat.roughness=.64;mat.metalness=.55;
  }
  if(family==='HQ_Door_Metal'){
   mat.color.set('#8a8c82');mat.roughness=.78;mat.metalness=.34;
  }
 }
 mat.userData={...source.userData,sandforgeBuildingDesign:BUILDING_DESIGN_REVISION,
  sandforgeMaterialFamily:family,sandforgeMaterialReference:profile.reference,
  sandforgeProjectedNormal:Boolean(profile.normal),sandforgeFactionTint:true};
 delete mat.userData.sandforgeServiceTexture;
 const roof=BUILDING_MATERIAL_FAMILIES.HQ_Dark_Charcoal_Roof,roofPbr=HQ3_PBR[roof.reference];
 const map=buildingTexture(profile.map),normal=buildingTexture(profile.normal??'camouflage-normal');
 const roofMap=mixedRoof?buildingTexture(roof.map):map;
 const roofNormal=mixedRoof?buildingTexture(roof.normal):normal;
 mat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{sfHqMap:{value:map},sfHqNormalMap:{value:normal},
   sfHqRoofMap:{value:roofMap},sfHqRoofNormal:{value:roofNormal},sfHqSpan:{value:profile.span},
   sfHqRoofSpan:{value:roof.span},sfHqRoofStart:{value:roofStart},
   sfHqRoofRoughness:{value:roofPbr.roughness},sfHqRoofMetalness:{value:roofPbr.metalness}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nattribute vec3 sfBuildingPosition; varying vec3 sfHqPosition;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsfHqPosition=sfBuildingPosition;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 sfHqPosition;
 uniform sampler2D sfHqMap,sfHqNormalMap,sfHqRoofMap,sfHqRoofNormal;
 uniform float sfHqSpan,sfHqRoofSpan,sfHqRoofStart,sfHqRoofRoughness,sfHqRoofMetalness;
 ${tangentFrame}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 sfHqN=normalize(cross(dFdx(sfHqPosition),dFdy(sfHqPosition)));
 vec3 sfHqAxis=abs(sfHqN);
 vec2 sfHqPlane=sfHqAxis.y>=max(sfHqAxis.x,sfHqAxis.z)?sfHqPosition.xz:
  sfHqAxis.x>sfHqAxis.z?sfHqPosition.zy:sfHqPosition.xy;
 float sfHqRoof=${mixedRoof?'smoothstep(.12,.24,sfHqAxis.y)*smoothstep(sfHqRoofStart,sfHqRoofStart+1.0,sfHqPosition.y)':'0.0'};
 vec2 sfHqUv=sfHqPlane/mix(sfHqSpan,sfHqRoofSpan,sfHqRoof);
 vec4 sfHqAlbedo=mix(texture2D(sfHqMap,sfHqUv),texture2D(sfHqRoofMap,sfHqUv),sfHqRoof);
 diffuseColor.rgb*=sfHqAlbedo.rgb;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
   '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,sfHqRoofRoughness,sfHqRoof);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',
   '#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,sfHqRoofMetalness,sfHqRoof);');
  if(profile.normal)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec3 sfHqMapped=mix(texture2D(sfHqNormalMap,sfHqUv).xyz,texture2D(sfHqRoofNormal,sfHqUv).xyz,sfHqRoof)*2.0-1.0;
 normal=normalize(sfHqFrame(-vViewPosition,normal,sfHqUv)*sfHqMapped);`);
 };
 mat.customProgramCacheKey=()=>BUILDING_DESIGN_REVISION+'-'+family+'-'+mixedRoof;
 mat.needsUpdate=true;return mat;
}
export function applyBuildingDesign(root,{kind,biome='desert'}={}){
 // Preserve the entire HQ3, including untextured steel and its PBR constants.
 // Snow/jungle continue to use the established biome pipeline.
 // A Kaserne derived from Feldkommando MK2 already carries the *identical*
 // HQ roof/camouflage maps. Applying the old generic barracks projection
 // replaces its roof with the near-black HQ3 roof atlas, even after
 // polishFeldkommandoMk2 later restores the PBR tint.
 if(!root||kind==='headquarters'||root.userData?.sandforgeMk2Barracks||
    biome!=='desert')return 0;
 root.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().setFromObject(root);
 const materials=new Map();let count=0;
 const height=bounds.max.y-bounds.min.y;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh)return;
  const paint=source=>{
   if(!source?.isMeshStandardMaterial||source.userData?.sandforgeBuildingDesign===BUILDING_DESIGN_REVISION)return source;
   const family=buildingMaterialFamily(kind,source,mesh.name);if(!family)return source;
   const mixedRoof=family==='HQ_Desert_Camouflage';
   // Include the measured lower flat roofs as well as the high gable.
   const roofStart=kind==='barracks'?BARRACKS_ARCHITECTURE.sourceLowestRoof*root.scale.y-1:
    Math.min(height*.45,61*.56*1.10);
   const key=family+'-'+mixedRoof;
   let variants=materials.get(source);if(!variants){variants=new Map();materials.set(source,variants);}
   if(!variants.has(key))variants.set(key,surfaceMaterial(source,family,{roofStart,mixedRoof,kind}));
   mesh.geometry=projectionGeometry(mesh,root);count++;
   return variants.get(key);
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(paint):paint(mesh.material);
 });
 // Replaced faction/fill clones are actor-owned. Preserve any source still
 // referenced by protected glass/doors and never dispose cached GLB assets.
 const retained=new Set();root.traverse(m=>{if(m.isMesh)for(const mat of Array.isArray(m.material)?m.material:[m.material])retained.add(mat);});
 for(const source of materials.keys())if(!retained.has(source)&&
  (source.userData?.sandforgeFactionTint||source.userData?.sandforgeBuildingFill||source.userData?.sandforgeServiceTexture)){
   const ownedMap=source.userData.sandforgeServiceTexture;
   if(ownedMap?.isTexture)ownedMap.dispose();
   source.dispose();
  }
 root.userData.sandforgeMaterialProfile=BUILDING_DESIGN_REVISION;
 return count;
}
