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
export const DIMENSIONS_VERSION=2;
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
