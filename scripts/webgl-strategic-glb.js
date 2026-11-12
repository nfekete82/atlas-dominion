import * as THREE from 'three';

/** Original user-authored GLBs. The meshes, topology and scene hierarchy
 * remain untouched. Only Sandforge's existing PBR materials are recoloured.
 * No 3D replacement primitives or animated meshes are added.
 */
export const STRATEGIC_GLB_MODELS=Object.freeze({
 headquarters:Object.freeze({
  inactive:'/src/assets/reborn/buildings-3d/sandforge_feldkommando_offline.glb',
  active:'/src/assets/reborn/buildings-3d/sandforge_feldkommando_textured_plus.glb'
 }),
 barracks:Object.freeze({
  inactive:'/src/assets/reborn/buildings-3d/sandforge_kaserne_geschlossen.glb',
  active:'/src/assets/reborn/buildings-3d/sandforge_kaserne_betriebsbereit.glb'
 }),
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
 if(!isStrategicGlbKind(kind)||!base||base.hp<=0)return false;
 // Primary barracks uses READY model; alternate CLOSED model is shown
 // during construction; the production gates animate pivot nodes.
 if(kind==='barracks')return base.buildRemaining>0;
 // Main HQ mesh is READY; its alternate offline asset is visible
 // only during construction, analogous to the barracks.
 if(kind==='headquarters')return base.buildRemaining>0;
 if(base.buildRemaining>0)return false;
 if(kind==='silo')return (base.siloCharge??600)<=0;
 return (game?.research?.[base.owner]?.active??null)!==null;
}

/** Dusty sand/khaki/olive finish. The new textured-plus headquarters has
 * real 1024/2048 UV-mapped PBR artwork, so preserve its authored camouflage
 * on desert maps; snow and jungle still use the world-specific palette.
 */
const finish=Object.freeze({
 SF_olive:'#ab9872',
 SF_olive_dark:'#474d43',
 SF_olive_light:'#c7b089',
 SF_concrete_high:'#d4c2a2',
 SF_foundation:'#b7a181',
 SF_deck:'#474d43',
 SF_deck_light:'#6f755d',
 SF_steel:'#6f755d',
 SF_steel_dark:'#2f342f',
 SF_steel_light:'#b4ab95',
 SF_missile:'#ab9872',
 SF_missile_dark:'#474d43',
 SF_missile_white:'#c7b089',
 SF_white:'#d4c2a2',
 // User-supplied Bastion MK2 has distinct PBR material names. Only exposed
 // armour/concrete receive desert paint: window glass, warning lights,
 // capture identifiers and the radar feed remain legible.
 SF_Bastion_concrete:'#b7a181',
 SF_Bastion_sandplate:'#c7b089',
 SF_Bastion_armor:'#6f755d',
 SF_Bastion_edge:'#ab9872',
 SF_Bastion_steel:'#474d43',
 SF_Bastion_bolt:'#9f9c83',
 SF_Bastion_frame:'#2f342f',
 SF_Bastion_dish:'#b7a181',
 SF_Bastion_dishshade:'#474d43'
});
const structural=/^SF_(olive|concrete_high|foundation|deck|steel|missile|white|Bastion_(concrete|sandplate|armor|edge|steel|bolt|frame|dish))/;
/** Reuse cloned material per exported GLB material; never mutate cached asset. */
export function applyStrategicGlbFinish(root){
 if(!root)return 0;
 // Unique to the new user's fully textured HQ; do not flatten its real
 // camouflage maps with a 94%-opaque generic desert procedural shader.
 let authoredTexturedHQ=false;
 root.traverse(node=>{
  if(!node.isMesh)return;
  const list=Array.isArray(node.material)?node.material:[node.material];
  if(list.some(mat=>mat?.name==='Desert_Camouflage_PBR'&&mat.map))
   authoredTexturedHQ=true;
 });
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
    material.roughness=Math.max(.78,material.roughness);
    material.metalness=Math.min(.18,material.metalness);
    // Reduce milky building-fill without dimming dedicated blue glow nodes.
    material.emissiveIntensity=Math.min(.08,material.emissiveIntensity);
   }
   material.userData={...material.userData,
    sandforgeOriginalStrategicGLB:true,
    sandforgePreserveHQDesertTextures:authoredTexturedHQ&&Boolean(material.map),
    sandforgePbrFinish:'sandforge-3-biomes-matte-20261112'};
   material.needsUpdate=true;
   materials.set(source,material);return material;
  };
  mesh.material=Array.isArray(mesh.material)?
   mesh.material.map(style):style(mesh.material);
 });
 return changed;
}

// The neutral bastion keeps its idle warning lamps. Only the small authored
// capture beacon changes team, not the wall/floor camouflage or GLB geometry.
// applyStrategicGlbFinish() has already cloned the PBR materials, so the
// cached GLTF template remains immutable across owner changes.
export function tintBastionCaptureSignals(root,owner){
 if(!root)return 0;
 let count=0;
 root.traverse(node=>{
  if(!node.isMesh)return;
  for(const mat of (Array.isArray(node.material)?node.material:[node.material])){
   if(!mat?.isMeshStandardMaterial)continue;
   if(!/^SF_Bastion_(red|light)$/.test(mat.name))continue;
   const tone=owner===0?'#347c9c':owner===1?'#af5449':'#96866e';
   mat.color.set(tone);
   if(mat.emissive)mat.emissive.set(owner===0?'#12405c':owner===1?'#5c201c':'#241e16');
   count++;
  }
 });
 return count;
}

/** Recenter source GLB radar assemblies without altering visual placement.
 * Some user-exported meshes carry coordinates in their vertices, even though
 * their named PIVOT has translation (0,0,0). Rotating that node would otherwise
 * orbit the entire dish around the building origin. This adjustment keeps the
 * initial geometry in precisely the same world-space position.
 */
export function centerAuthoredRadarPivot(pivot){
 if(!pivot?.parent||pivot.userData.sandforgeRadarPivotCentered)return pivot;
 pivot.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(pivot);
 if(box.isEmpty())return pivot;
 const center=pivot.parent.worldToLocal(box.getCenter(new THREE.Vector3()));
 const delta=center.clone().sub(pivot.position);
 for(const child of pivot.children)child.position.sub(delta);
 pivot.position.copy(center);
 pivot.userData.sandforgeRadarPivotCentered=true;
 return pivot;
}

/** Texture-plus exports independent DISH_* nodes without a pivot. Group the
 * original meshes without changing their world transforms, so the radar
 * rotates in place instead of adding a fake dish to the command building.
 */
export function ensureTexturedHqRadarPivot(root){
 if(!root)return null;
 const existing=root.getObjectByName('RADAR_DISH_PIVOT');
 if(existing)return existing;
 const components=[];
 root.traverse(node=>{
  if(node.isMesh&&/^DISH_/.test(node.name))components.push(node);
 });
 if(!components.length)return null;
 const parent=components[0].parent;
 if(!parent||!components.every(node=>node.parent===parent))return null;
 parent.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3();
 for(const component of components)bounds.expandByObject(component);
 const center=parent.worldToLocal(bounds.getCenter(new THREE.Vector3()));
 const pivot=new THREE.Group();
 pivot.name='RADAR_DISH_PIVOT';pivot.position.copy(center);
 parent.add(pivot);pivot.updateWorldMatrix(true,false);
 for(const component of components)pivot.attach(component);
 pivot.userData.sandforgeRadarPivotCentered=true;
 return pivot;
}
