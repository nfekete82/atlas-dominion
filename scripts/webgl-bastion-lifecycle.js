import {disposeOwnedMeshes,disposeTaggedMaterials} from './webgl-resource-lifecycle.js';

/** A bastion changes faction repeatedly during a long RTS match.
 * The GLB loader caches source geometry and textures, but *per-instance*
 * emissive/owner materials and fallback mechanical rotor meshes are owned
 * by this particular bastion revision and must be explicitly released.
 * Scene.remove() alone does NOT return those resources to WebGL.
 */
export function releaseBastionRevision(entry){
 if(!entry?.node)return {materials:0,rotors:0};
 if(entry.bastionController){entry.bastionController.dispose();entry.bastionController=null;}\n const motion=entry.motion;
 if(motion?.mixer){
  motion.mixer.stopAllAction();
  if(entry.detail)motion.mixer.uncacheRoot(entry.detail);
 }
 let rotors=0;
 if(motion?.rotor){
  motion.rotor.removeFromParent();
  disposeOwnedMeshes(motion.rotor);rotors++;
 }
 let materials=0;
 if(entry.detail){
  entry.detail.removeFromParent();
  materials+=disposeTaggedMaterials(entry.detail,'sandforgeBuildingFill');
  materials+=disposeTaggedMaterials(entry.detail,'sandforgeFactionTint');
  materials+=disposeTaggedMaterials(entry.detail,'sandforgeOriginalStrategicGLB');
  entry.detail=null;
 }
 entry.motion=null;
 return {materials,rotors};
}
