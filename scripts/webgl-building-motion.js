import * as THREE from 'three';

/** Recover a continuous hatch motion from the two actual authored GLBs.
 * No guessed travel, no reparented supports and no changes to simulation. */
export function prepareSiloHatch(entry){
 if(entry.strategicHatch)return entry.strategicHatch;
 if(entry.kind!=='silo'||!entry.detail||!entry.variantDetail)return null;
 const closed=entry.detail,opened=entry.variantDetail,parts=[],missile=[];
 closed.updateWorldMatrix(true,true);opened.updateWorldMatrix(true,true);
 opened.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(/^missile__/.test(mesh.name)){missile.push(mesh);return;}
  if(!/^blast_door_[LR]__/.test(mesh.name))return;
  const rest=closed.getObjectByName(mesh.name);if(!rest)return;
  const originalCenter=new THREE.Box3().setFromObject(rest).getCenter(new THREE.Vector3());
  const openCenter=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  mesh.parent.worldToLocal(originalCenter);mesh.parent.worldToLocal(openCenter);
  parts.push({mesh,open:mesh.position.clone(),closed:mesh.position.clone().add(originalCenter.sub(openCenter))});
 });
 if(!parts.length)return null;
 entry.strategicHatch={parts,missile,open:0};
 return entry.strategicHatch;
}
export function poseSiloHatch(hatch,fraction){
 if(!hatch)return;
 hatch.open=THREE.MathUtils.clamp(fraction,0,1);
 for(const part of hatch.parts)part.mesh.position.lerpVectors(part.closed,part.open,hatch.open);
 for(const mesh of hatch.missile)mesh.visible=hatch.open>=.97;
}
export function updateSiloHatch(entry,base,dt=0){
 const hatch=prepareSiloHatch(entry);if(!hatch)return;
 const ready=base.buildRemaining<=0&&(base.siloCharge??600)<=0;
 const target=ready?1:0;
 const step=Math.max(0,Math.min(.1,dt))/1.2;
 poseSiloHatch(hatch,THREE.MathUtils.clamp(hatch.open+Math.sign(target-hatch.open)*Math.min(step,Math.abs(target-hatch.open)),0,1));
 const showOpen=base.buildRemaining<=0&&(ready||hatch.open>0);
 entry.detail.visible=!showOpen;entry.variantDetail.visible=showOpen;
}
