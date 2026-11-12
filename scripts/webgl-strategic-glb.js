import * as THREE from 'three';

/** Original user-authored GLBs. The meshes, topology and scene hierarchy
 * remain untouched. Only Sandforge's existing PBR materials are recoloured.
 * No 3D replacement primitives or animated meshes are added.
 */
export const STRATEGIC_GLB_MODELS=Object.freeze({
 silo:Object.freeze({
  inactive:'/src/assets/reborn/buildings-3d/silo-closed.glb',
  active:'/src/assets/reborn/buildings-3d/silo-open.glb'
 }),
 research:Object.freeze({
  inactive:'/src/assets/reborn/buildings-3d/research-offline.glb',
  active:'/src/assets/reborn/buildings-3d/research-active.glb'
 })
});
export const isStrategicGlbKind=kind=>Object.hasOwn(STRATEGIC_GLB_MODELS,kind);
export const strategicGlbUrl=(kind,variant='inactive')=>
 STRATEGIC_GLB_MODELS[kind]?.[variant]??null;

/** Entirely visual; simulation still controls missile charge and research. */
export function strategicGlbActive(kind,base,game){
 if(!isStrategicGlbKind(kind)||!base||base.buildRemaining>0||base.hp<=0)
  return false;
 if(kind==='silo')return (base.siloCharge??600)<=0;
 return (game?.research?.[base.owner]?.active??null)!==null;
}

/** Dusty sand, khaki and olive paint on the real GLB PBR surfaces.
 * The source files contain per-part colours but no texture UVs. Sandforge's
 * existing building-shader adds the subtle procedural camouflage pattern
 * to these surfaces after the material colours are prepared.
 */
const finish=Object.freeze({
 SF_olive:'#787d5b',
 SF_olive_dark:'#505841',
 SF_olive_light:'#a8a487',
 SF_concrete_high:'#c2b28f',
 SF_foundation:'#ae9a76',
 SF_deck:'#5f6254',
 SF_deck_light:'#848574',
 SF_steel:'#81887c',
 SF_steel_dark:'#343c37',
 SF_steel_light:'#bbbca8',
 SF_missile:'#b3b1a0',
 SF_missile_dark:'#424b44',
 SF_missile_white:'#d6cfb7',
 SF_white:'#ded3b9'
});
const structural=/^SF_(olive|concrete_high|foundation|deck|steel|missile|white)/;
/** Reuse cloned material per exported GLB material; never mutate cached asset. */
export function applyStrategicGlbFinish(root){
 if(!root)return 0;
 const materials=new Map();let changed=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  // The supplied models export POSITION-only primitives. Generate missing
  // vertex normals once so physically lit faces receive proper sunlight.
  if(mesh.geometry&&!mesh.geometry.getAttribute('normal'))
   mesh.geometry.computeVertexNormals();
  const style=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   if(materials.has(source))return materials.get(source);
   const material=source.clone(),hex=finish[material.name];
   if(hex){material.color.set(hex);changed++;}
   if(structural.test(material.name)){
    material.roughness=Math.max(.68,material.roughness);
    material.metalness=Math.min(.42,material.metalness);
   }
   material.userData={...material.userData,
    sandforgeOriginalStrategicGLB:true,
    sandforgePbrFinish:'khaki-sand-olive-20261112'};
   material.needsUpdate=true;
   materials.set(source,material);return material;
  };
  mesh.material=Array.isArray(mesh.material)?
   mesh.material.map(style):style(mesh.material);
 });
 return changed;
}
