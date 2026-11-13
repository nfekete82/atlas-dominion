import * as THREE from 'three';

/** Original user-authored GLBs. The meshes, topology and scene hierarchy
 * remain untouched. Only Sandforge's existing PBR materials are recoloured.
 * No 3D replacement primitives or animated meshes are added.
 */
export const STRATEGIC_GLB_MODELS=Object.freeze({
 headquarters:Object.freeze({
  // HQ3 is the single authored building in every construction phase. The
  // legacy Feldkommando GLB stays in assets for older references only.
  inactive:'/src/assets/reborn/buildings-3d/sandforge_funkzentrale_hq3_game_ready.glb',
  active:'/src/assets/reborn/buildings-3d/sandforge_funkzentrale_hq3_game_ready.glb'
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
 // HQ3 is assembled progressively from its single active mesh. Never
 // switch to the obsolete Feldkommando during construction or completion.
 if(kind==='headquarters')return false;
 if(base.buildRemaining>0)return false;
 if(kind==='silo')return (base.siloCharge??600)<=0;
 return (game?.research?.[base.owner]?.active??null)!==null;
}

/** Dusty sand/khaki/olive finish. The authored HQ3 keeps its detailed
 * 1024/1536px baked PBR desert camouflage on desert maps, with snow/jungle
 * procedural repaint only on those biome variants. */
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
  if(list.some(mat=>/^(Desert_Camouflage_PBR|Desert_Camouflage_Weathered)$/.test(mat?.name??'')&&mat.map))
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

/** An independent HQ3 dish rotates around its SUPPORT, not the bowl.
 * Recentring at the dish bounding-box midpoint made the support orbit
 * outside its rooftop plinth and look as if it floated in midair.
 */
function hq3DishSupports(pivot){
 const box=new THREE.Box3();
 pivot?.traverse(part=>{
  if(part.isMesh&&/^Independent_Satellite_Dish_Support_/.test(part.name))
   box.expandByObject(part);
 });
 return box.isEmpty()?null:box;
}
export function centerAuthoredRadarPivot(pivot){
 if(!pivot?.parent||pivot.userData.sandforgeRadarPivotCentered)return pivot;
 pivot.updateWorldMatrix(true,true);
 const support=hq3DishSupports(pivot);
 const box=support??new THREE.Box3().setFromObject(pivot);
 if(box.isEmpty())return pivot;
 const anchor=box.getCenter(new THREE.Vector3());
 if(support)anchor.y=support.min.y;
 const center=pivot.parent.worldToLocal(anchor);
 const delta=center.clone().sub(pivot.position);
 // Preserve every authored glTF vertex in precisely its original world pose.
 for(const child of pivot.children)child.position.sub(delta);
 pivot.position.copy(center);
 // Rebuild the pivot AND descendant world matrices now. Three.js Box3
 // .setFromObject(child) updates only the supplied child, so leaving its
 // parent matrix stale makes the satellite support appear to jump until
 // the next full render/world-matrix update.
 pivot.updateWorldMatrix(true,true);
 pivot.userData.sandforgeRadarPivotCentered=true;
 return pivot;
}

/** Fixed, dark metal roof mount for the genuine rotating HQ3 satellite.
 * The pedestal is a sibling of RADAR_DISH_PIVOT, never its child, so only
 * the dish rotates. It sits directly under the imported support geometry.
 * Generated once per instance; the original authored GLB is unchanged.
 */
export function ensureHeadquartersSatelliteMount(pivot){
 if(!pivot?.parent)return null;
 const parent=pivot.parent;
 const old=parent.getObjectByName('HQ3FixedSatelliteMount');
 if(old)return old;
 pivot.updateWorldMatrix(true,true);
 const support=hq3DishSupports(pivot);
 if(!support)return null;
 // The authored support/hinge meshes were originally children of the
 // rotating dish group. Even with a fixed generated mast, they orbited
 // around it as the dish tracked targets. Detach ONLY the structural
 // support meshes to the static parent, preserving their world transforms.
 // The dish bowl, feed arms and reflector stay on the rotating pivot.
 const staticParts=[];
 pivot.traverse(part=>{
  if(part.isMesh&&/^Independent_Satellite_Dish_Support_/.test(part.name))
   staticParts.push(part);
 });
 for(const part of staticParts)parent.attach(part);
 parent.updateWorldMatrix(true,true);
 const world=support.getCenter(new THREE.Vector3());
 world.y=support.min.y;
 const anchor=parent.worldToLocal(world);
 let floorY=anchor.y-.85;
 // Sample the ACTUAL rooftop below the dish when the authored geometry
 // is available: this avoids a floating foot on differing GLB revisions.
 let roof=parent;
 while(roof?.parent&&roof.name!=='Scene')roof=roof.parent;
 const roofMesh=roof?.getObjectByName?.('Static_Dark_Weathered_Roof')??
  parent.getObjectByName('Static_Dark_Weathered_Roof');
 if(roofMesh?.isMesh){
  const source=support.getCenter(new THREE.Vector3());
  source.y=support.max.y+10;
  const rays=new THREE.Raycaster(source,new THREE.Vector3(0,-1,0),0,100);
  const hit=rays.intersectObject(roofMesh,false)[0];
  if(hit){
   const level=parent.worldToLocal(hit.point.clone()).y;
   if(anchor.y-level>.20&&anchor.y-level<2.4)floorY=level+.02;
  }
 }
 const rise=Math.max(.20,anchor.y-floorY);
 const group=new THREE.Group();
 group.name='HQ3FixedSatelliteMount';
 group.userData={visualOnly:true,nonPlayable:true,fixedSatelliteMount:true};
 group.position.set(anchor.x,floorY,anchor.z);
 const metal=new THREE.MeshStandardMaterial({name:'HQ3SatelliteMountSteel',
  color:'#333b36',roughness:.74,metalness:.57});
 const footing=new THREE.MeshStandardMaterial({name:'HQ3SatelliteMountBase',
  color:'#444943',roughness:.88,metalness:.32});
 function add(geometry,material,name,x,y,z){
  const part=new THREE.Mesh(geometry,material);
  part.name=name;part.position.set(x,y,z);
  part.castShadow=true;part.receiveShadow=true;
  part.raycast=()=>{};
  group.add(part);return part;
 }
 add(new THREE.CylinderGeometry(.32,.40,.13,12),footing,
  'HQ3SatelliteAnchorPlate',0,.07,0);
 add(new THREE.CylinderGeometry(.07,.10,rise,10),metal,
  'HQ3SatelliteFixedMast',0,rise*.5,0);
 add(new THREE.CylinderGeometry(.18,.18,.15,12),footing,
  'HQ3SatelliteBearing',0,rise,0);
 const up=new THREE.Vector3(0,1,0);
 for(const [i,angle] of [0,Math.PI*2/3,Math.PI*4/3].entries()){
  const start=new THREE.Vector3(Math.cos(angle)*.29,.14,Math.sin(angle)*.29);
  const end=new THREE.Vector3(0,rise*.82,0);
  const direction=end.clone().sub(start);
  const brace=add(new THREE.CylinderGeometry(.027,.038,direction.length(),6),
   metal,'HQ3SatelliteBrace'+i,0,0,0);
  brace.position.copy(start.add(end).multiplyScalar(.5));
  brace.quaternion.setFromUnitVectors(up,direction.normalize());
 }
 parent.add(group);
 return group;
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
