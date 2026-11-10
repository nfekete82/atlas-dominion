import * as THREE from 'three';
import {unitRenderAltitude,MODEL_HEIGHTS} from './webgl-scale.js';
import {disposeOwnedMeshes,disposeTaggedMaterials} from './webgl-resource-lifecycle.js';

export const aircraftModelKind=kind=>kind==='scout'||kind==='bomber';

export function aircraftAimOffsetY(kind,modelHeight=0){
 const height=Number.isFinite(modelHeight)&&modelHeight>0?modelHeight:(MODEL_HEIGHTS[kind]??48);
 return Math.max(12,Math.min(29,height*.37));
}
/** Rockets are simulated in map X/Z; their rendered endpoint must hit the
 * airborne 3D actor, rather than the sand fifteen units above its ground X/Z.
 * For other missiles/ground targets retain the original visual altitude.
 */
export function guidedRocketAimY(missile,unit,terrainY,modelHeight=0){
 if(missile?.target===undefined||!unit||!aircraftModelKind(unit.kind))return terrainY+15;
 return terrainY+unitRenderAltitude(unit.kind,unit.flightHeight??1)+
  aircraftAimOffsetY(unit.kind,modelHeight);
}

/** Model's authored geometry, UV, texture maps and per-actor camouflage stay
 * intact. Move the EXISTING actor into a cosmetic crash, never clone a gray
 * capsule or dispose a glTF cache asset.
 */
export function adoptAircraftForCrash(entry){
 // A lite-mode fallback has no authored camouflage/albedo maps.
 // Never carry that primitive into a conspicuous airborne crash animation.
 // CombatEffects will instead spawn an explosion and small burnt fragments.
 const model=entry?.detail;
 if(!entry?.node||!model)return null;
 const wasFallback=false;
 if(entry.animation?.mixer){
  entry.animation.mixer.stopAllAction();
  if(entry.detail)entry.animation.mixer.uncacheRoot(entry.detail);
  entry.animation=null;
 }
 const root=new THREE.Group();
 root.name='visual-crashing-'+entry.kind;
 root.userData={visualOnly:true,nonPlayable:true,crashing:true};
 root.position.copy(entry.node.position);
 root.quaternion.copy(entry.node.quaternion);
 root.scale.copy(entry.node.scale);
 root.add(model);
 if(wasFallback)entry.placeholder=null;
 else entry.detail=null;
 model.traverse(child=>{
  if(child.isMesh){child.raycast=()=>{};child.castShadow=false;}
 });
 return {root,model,wasFallback};
}
/** Do not dispose a cached GLB's shared geometry or texture map. */
export function disposeAircraftCrash(c){
 if(!c)return;
 c.mesh.removeFromParent();
 if(c.wasFallback)disposeOwnedMeshes(c.model);
 else disposeTaggedMaterials(c.model,'sandforgeFactionTint');
 c.mesh.clear();
}
