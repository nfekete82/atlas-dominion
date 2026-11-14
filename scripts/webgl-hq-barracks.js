import * as THREE from 'three';
import {calibratedScale} from './webgl-scale.js';
import {isFeldkommandoMk2,polishFeldkommandoMk2,hideMk2DuplicateFence}
 from './webgl-feldkommando-mk2-polish.js';

/** Sandforge Kaserne from the *same* source mesh as Feldkommando MK2.
 * This runs on a clone, never modifies the cached GLB or HQ.
 * Original Y-up scene wraps a Z-up source: STAGE_03 Z is vertical.
 */
export const MK2_BARRACKS_REVISION='mk2-barracks-shared-hq-v2';
export const MK2_BARRACKS_WIDTH_FACTOR=1.17;
export const MK2_BARRACKS_DEPTH_FACTOR=1.08;
export const MK2_BARRACKS_HEIGHT_FACTOR=1.03;

const MAST_MESH=/^STAGE_03_Radar_Utilities_and_Details__/;
const MAST_APERTURE={xmin:.55,xmax:2.75,ymin:.32,ymax:1.79,minHeight:6.18};

export function isMk2Barracks(model){
 return Boolean(model?.userData?.sandforgeMk2Barracks===MK2_BARRACKS_REVISION);
}

function removeFunkmast(model){
 let removed=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||!MAST_MESH.test(mesh.name))return;
  if(mesh.name.endsWith('__beacon')){
   // An invisible beacon STILL expands Box3.setFromObject() in Three.js.
   // Detach its high vertices on this clone; leave the original HQ pristine.
   const old=mesh.geometry;
   mesh.geometry=new THREE.BufferGeometry();
   mesh.geometry.userData.sfMk2PolishOwned=true;
   if(old?.userData?.sfMk2PolishOwned)old.dispose();
   mesh.visible=false;removed++;return;
  }
  const source=mesh.geometry,positions=source?.getAttribute('position');
  if(!positions)return;
  const indices=source.index?.array??Array.from({length:positions.count},(_,i)=>i);
  const kept=[];
  let deleted=0;
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i],b=indices[i+1],c=indices[i+2];
   const x=(positions.getX(a)+positions.getX(b)+positions.getX(c))/3;
   const y=(positions.getY(a)+positions.getY(b)+positions.getY(c))/3;
   const top=Math.max(positions.getZ(a),positions.getZ(b),positions.getZ(c));
   const mast=top>MAST_APERTURE.minHeight&&
    x>MAST_APERTURE.xmin&&x<MAST_APERTURE.xmax&&
    y>MAST_APERTURE.ymin&&y<MAST_APERTURE.ymax;
   if(mast){deleted++;continue;}
   kept.push(a,b,c);
  }
  if(!deleted)return;
  removed+=deleted;
  if(!kept.length){
   // Hiding a tall mesh does not remove it from Three's object bounds.
   // Empty geometry prevents a phantom mast height from shrinking the
   // normalized MK2 Kaserne.
   const empty=new THREE.BufferGeometry();
   empty.userData.sfMk2PolishOwned=true;
   mesh.geometry=empty;mesh.visible=false;
   if(source.userData?.sfMk2PolishOwned)source.dispose();
   return;
  }
  const geometry=source.clone();
  geometry.clearGroups();
  geometry.setIndex(kept);
  // THREE's computeBoundingBox counts UNUSED vertices left by setIndex().
  // Otherwise the deleted 11-m antenna still determines the box height,
  // shrinking the building despite a visually absent mast.
  const used=new THREE.Box3();
  const xyz=new THREE.Vector3();
  for(const index of kept){
   xyz.fromBufferAttribute(positions,index);
   used.expandByPoint(xyz);
  }
  geometry.boundingBox=used;
  const centre=used.getCenter(new THREE.Vector3());
  let radiusSquared=0;
  for(const index of kept){
   xyz.fromBufferAttribute(positions,index);
   radiusSquared=Math.max(radiusSquared,xyz.distanceToSquared(centre));
  }
  geometry.boundingSphere=new THREE.Sphere(centre,Math.sqrt(radiusSquared));
  geometry.userData={...geometry.userData,sfMk2PolishOwned:true,
   sandforgeBarracksMastRemoved:true};
  mesh.geometry=geometry;
  if(source.userData?.sfMk2PolishOwned)source.dispose();
 });
 return removed;
}

/** Reuse the MK2 roof, armour, sliding doors and chain-link perimeter.
 * Radar, tall antenna, and front fence leaves are explicitly excluded.
 * The open fence passage is intentional for soldiers, while the building
 * sliding shutters remain animated by the regular production presenter.
 */
export function deriveMk2Barracks(model,{deferPolish=false}={}){
 if(!isFeldkommandoMk2(model))return false;
 if(isMk2Barracks(model)){
  if(!deferPolish)polishFeldkommandoMk2(model);
  return true;
 }
 if(!deferPolish)polishFeldkommandoMk2(model);
 const dish=model.getObjectByName('Radar_Dish_Pivot');
 if(dish)dish.visible=false;
 const removed=removeFunkmast(model);
 // A permanently open gap directly in front of the infantry exit.
 for(const name of ['Fence_Gate_Left_Pivot','Fence_Gate_Right_Pivot']){
  const part=model.getObjectByName(name);
  if(part)part.visible=false;
 }
 model.userData.sandforgeMk2Barracks=MK2_BARRACKS_REVISION;
 model.userData.sandforgeMk2BarracksMastTrianglesRemoved=removed;
 // A single shared model transform is applied AFTER this derivation by
 // the battle, builder preview and gallery: see applyMk2BarracksVisualTransform.
 // Never globally scale one animation pivot independently.
 return true;
}

/** Site lamps and supply props belong to the yard, not the source GLB. */
export function arrangeMk2BarracksSupplies(yard){
 if(!yard||yard.userData.sandforgeMk2BarracksSupplies)return false;
 hideMk2DuplicateFence(yard);
 const supplies=yard.getObjectByName('BaseSupplyCache');
 if(supplies){
  supplies.position.x*=-.81;
  supplies.position.z=-Math.abs(supplies.position.z)*.78;
  supplies.rotation.y=.18;
 }
 const equipment=yard.getObjectByName('InfantryEquipment');
 if(equipment){
  equipment.position.x*=.85;
  equipment.position.z=-Math.abs(equipment.position.z)*.62;
  equipment.rotation.y=-.26;
 }
 yard.userData.sandforgeMk2BarracksSupplies=true;
 return true;
}

// Match the Feldkommando's ACTUAL visual scale; the previous code used
// calibratedScale('barracks', width=158, height=119) for identical HQ geometry.
// This was why the sister Kaserne was small and squat. Call the *same helper*
// in the game, builder ghost and model gallery.
export function applyMk2BarracksVisualTransform(model,bounds,hqReferenceWidth=225){
 if(!isMk2Barracks(model))return null;
 if(model.userData.mk2BarracksVisualTransformApplied)
  return model.userData.mk2BarracksVisualTransformApplied;
 const size=bounds.getSize(new THREE.Vector3());
 const center=bounds.getCenter(new THREE.Vector3());
 const scale=calibratedScale('headquarters','building',size,hqReferenceWidth);
 model.scale.multiplyScalar(scale);
 model.scale.x*=MK2_BARRACKS_WIDTH_FACTOR;
 model.scale.y*=MK2_BARRACKS_HEIGHT_FACTOR;
 model.scale.z*=MK2_BARRACKS_DEPTH_FACTOR;
 model.position.set(
  -center.x*scale*MK2_BARRACKS_WIDTH_FACTOR,
  -bounds.min.y*scale*MK2_BARRACKS_HEIGHT_FACTOR,
  -center.z*scale*MK2_BARRACKS_DEPTH_FACTOR
 );
 const transform={
  scale,modelHeight:size.y*scale*MK2_BARRACKS_HEIGHT_FACTOR,
  modelFootprint:Math.max(
   size.x*scale*MK2_BARRACKS_WIDTH_FACTOR,
   size.z*scale*MK2_BARRACKS_DEPTH_FACTOR
  )
 };
 model.userData.mk2BarracksVisualTransformApplied=transform;
 return transform;
}

// The HQ finishes its original PBR materials BEFORE the final MK2 roof and
// Desert-002 polish. Make the sister Kaserne follow exactly that order.
export function finishMk2Barracks(model,yard=null){
 if(!isMk2Barracks(model))return false;
 polishFeldkommandoMk2(model,yard);
 arrangeMk2BarracksSupplies(yard);
 return true;
}
