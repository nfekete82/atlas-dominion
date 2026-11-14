import * as THREE from 'three';
import {isFeldkommandoMk2,polishFeldkommandoMk2,hideMk2DuplicateFence}
 from './webgl-feldkommando-mk2-polish.js';

/** Sandforge Kaserne from the *same* source mesh as Feldkommando MK2.
 * This runs on a clone, never modifies the cached GLB or HQ.
 * Original Y-up scene wraps a Z-up source: STAGE_03 Z is vertical.
 */
export const MK2_BARRACKS_REVISION='mk2-barracks-shared-hq-v1';
export const MK2_BARRACKS_WIDTH_FACTOR=1.14;
const MAST_MESH=/^STAGE_03_Radar_Utilities_and_Details__/;
const MAST_APERTURE={xmin:.55,xmax:2.75,ymin:.32,ymax:1.79,minHeight:6.18};

export function isMk2Barracks(model){
 return Boolean(model?.userData?.sandforgeMk2Barracks===MK2_BARRACKS_REVISION);
}

function removeFunkmast(model){
 let removed=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||!MAST_MESH.test(mesh.name))return;
  if(mesh.name.endsWith('__beacon')){mesh.visible=false;removed++;return;}
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
  if(!kept.length){mesh.visible=false;return;}
  const geometry=source.clone();
  geometry.clearGroups();
  geometry.setIndex(kept);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
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
export function deriveMk2Barracks(model){
 if(!isFeldkommandoMk2(model))return false;
 if(isMk2Barracks(model))return true;
 polishFeldkommandoMk2(model);
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
 // Do not squeeze or enlarge the animated door leaves separately.
 // The renderer adds +14% width to the already-normalized model once.
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
