/** Render-only dimensions calibrated against the original 2D unit widths.
 * Gameplay radius, map collision, selection and saved game values stay intact.
 *
 * GLB model dimensions vary significantly because their authored transforms
 * include weapons and equipment. Normalize infantry by standing height, not
 * rifle/helmet width, so all four roles occupy the same apparent human scale.
 */
export const MODEL_HEIGHTS=Object.freeze({
 infantry:61,medic:61,engineer:61,heavy:65,
 rover:42,tank:46,artillery:51,scout:48,bomber:51,
 headquarters:158,barracks:119,factory:125,airfield:137,generator:92,turret:95
});
export const DIMENSIONS_VERSION=3;

// Historically facing=1 meant 180 degrees. Preserve that meaning in old
// saves while allowing all four cardinal orientations in the WebGL builder:
// R cycles 0 -> 90 -> 180 -> 270 -> 0 degrees (stored as 0,2,1,3).
export const buildingFacingAngle=facing=>
 [0,Math.PI,Math.PI/2,Math.PI*1.5][facing??0]??0;
export const nextBuildingFacing=facing=>
 [2,3,1,0][facing??0]??0;
export const buildingFacingDegrees=facing=>
 [0,180,90,270][facing??0]??0;

// Simulation uses atan2(worldZ,worldX). The ACTUAL imported TurretHead
// points down local +Z (see TurretMuzzleL/R in atlas-buildings.js), NOT +X.
// Three.js Y+ turns +Z toward +X. Subtract the building's own facing to
// keep a rotating head independent from 0/90/180/270 degree placements.
// Only the old procedural fallback points toward local -Z.
export function turretAimLocalYaw(angle,facing=0,procedural=false){
 return (procedural?-Math.PI/2:Math.PI/2)-angle-buildingFacingAngle(facing);
}

// Two independent world-space muzzle positions. Gameplay still owns the
// authoritative source and barrel indices; this is a presentation offset.
export function turretMuzzleOffset(angle,barrel){
 const reach=37,side=(barrel===1?1:-1)*5.5;
 return {
  x:Math.cos(angle)*reach-Math.sin(angle)*side,
  z:Math.sin(angle)*reach+Math.cos(angle)*side
 };
}
// Presentation-only scale: keep gameplay collision, reach, selection,
// spacing and saved dimensions unchanged. Infantry read as humans beside
// larger real structures, rather than as toy-sized buildings.
export function visualUnitScale(kind){
 // Align all four foot soldiers with larger rocket artillery and Humvee.
 // This is a render-only factor: no change to move, weapon or capture radius.
 if(['infantry','medic','engineer'].includes(kind))return .56;
 if(kind==='heavy')return .58;
 // Humvee needs a substantial visual presence beside full-scale buildings.
 // Only the rendered mesh changes; navigation/collision/save width stays 76.
 if(kind==='rover')return 1.34;
 if(kind==='artillery')return 1.32;
 if(kind==='tank')return 1.44;
 if(kind==='scout')return .89;
 return .94;
}

/** The imported bomber GLB faces the opposite local longitudinal axis.
 * Flip only its visual node; world movement, heading, combat and saves remain untouched. */
export function unitVisualYaw(kind,heading){
 return Math.PI*.5-heading+(kind==='bomber'?Math.PI:0);
}
const infantry=new Set(['infantry','medic','engineer','heavy']);
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>.00001;
export function calibratedScale(kind,type,bounds,targetWidth){
 const width=Math.max(bounds?.x??0,bounds?.z??0);
 const height=bounds?.y??0;
 if(!valid(width)||!valid(height)||!valid(targetWidth))return 1;
 const byWidth=targetWidth/width;
 if(type==='unit'&&infantry.has(kind)){
  const humanHeight=MODEL_HEIGHTS[kind]??55;
  // Outstretched guns and equipment must not shrink the soldier itself.
  // The gameplay footprint is still provided by the original World object.
  return humanHeight/height;
 }
 if(type==='unit')return Math.min(byWidth,(MODEL_HEIGHTS[kind]??50)/height);
 // Footprint stays aligned with the original building collision width;
 // huge roofs, towers and dish antennas must not dwarf nearby units.
 return Math.min(byWidth,(MODEL_HEIGHTS[kind]??135)/height);
}
