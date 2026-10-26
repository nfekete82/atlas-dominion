import * as THREE from 'three';

/**
 * Optional imported Tiger-inspired GLB source for the existing offline atlas renderer.
 * The game itself remains a fast Canvas2D RTS, not a live three.js scene.
 */
export const REFERENCE_TANK_PATH='/src/assets/reborn/animation/tank-reference.glb';

export async function referenceTankAvailable(){
  try { return (await fetch(REFERENCE_TANK_PATH,{method:'HEAD'})).ok; }
  catch { return false; }
}

/**
 * GLB is Y-up, faces +Z and contains named Hull/Tank_Turret/Tank_Gun nodes.
 * Team accents are added here so both sprite atlases are visibly different.
 */
export async function buildReferenceTiger(loader,team){
  const imported=await loader.loadAsync(REFERENCE_TANK_PATH);
  const model=imported.scene;
  model.name='Atlas_tank_reference_127';
  const turret=model.getObjectByName('Tank_Turret');
  const gun=model.getObjectByName('Tank_Gun');
  if(!turret||!gun)throw Error('Tiger GLB requires Tank_Turret and Tank_Gun nodes');
  const faction=new THREE.MeshStandardMaterial({
    name:'Faction accent '+team,
    color:team===0?'#235894':'#a82e29',
    metalness:.32,roughness:.72
  });
  for(const x of [-1,1]){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.10,.035,.72),faction);
    stripe.name='FactionFenderStripe';
    stripe.position.set(x*1.02,1.34,-.18);
    stripe.castShadow=stripe.receiveShadow=true;
    model.add(stripe);
  }
  const marker=new THREE.Object3D();
  marker.name='MuzzleOpeningReference';
  marker.position.set(0,1.92,4.01);
  gun.add(marker);

  // Sub-pixel tread motion at sprite resolution. This is visual-only;
  // no hitboxes, target selection or projectile mechanics are modified.
  const track=model.getObjectByName('Hull_track2');
  const initialTrackZ=track?.position.z??0;
  function animate(tag,phase){
    if(track){
      const moving=tag!=='idle';
      const sign=tag==='turnRight'?-1:1;
      track.position.z=initialTrackZ+(moving?Math.sin(phase*Math.PI*2)*.115*sign:0);
    }
  }
  animate('idle',0);
  let meshes=0,triangles=0;
  model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  model.userData.atlasDesign={
    kind:'tank',team,parts:meshes,triangles:Math.round(triangles),
    geometry:'Tiger-inspired desert tank; independent turret and barrel; 127 identification',
    source:'Atlas Dominion / user reference-inspired procedural GLB'
  };
  return {model,animate,rotor:null};
}
