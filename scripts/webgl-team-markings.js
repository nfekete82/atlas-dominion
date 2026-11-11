import * as THREE from 'three';

/** Strong blue/red unit identification without replacing desert camouflage.
 * One shared procedural emblem texture per team. Render-only; no save changes.
 */
export const TEAM_MARKING_COLORS=Object.freeze({0:'#198fe0',1:'#e34e43'});
const kinds=new Set(['infantry','medic','engineer','heavy','rocket','tank','rover','artillery','scout','bomber']);
const materials=new Map();
const quad=new THREE.PlaneGeometry(1,1);
// Grounded model-space decals replace the old floating flagpoles.
function mat(owner){
 if(materials.has(owner))return materials.get(owner);
 const n=64,rgba=new Uint8Array(n*n*4),color=new THREE.Color(TEAM_MARKING_COLORS[owner]);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const at=(y*n+x)*4,border=x<3||y<3||x>60||y>60;
  const emblem=Math.abs(x-32)<4&&y>13&&y<49||y>27&&y<34&&Math.abs(x-32)<17;
  const rgb=border?[.8,.72,.52]:emblem?[.96,.95,.87]:[color.r,color.g,color.b];
  for(let k=0;k<3;k++)rgba[at+k]=Math.round(rgb[k]*255);
  rgba[at+3]=255;
 }
 const texture=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
 texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
 texture.needsUpdate=true;
 const m=new THREE.MeshBasicMaterial({map:texture,depthTest:true,depthWrite:false,
  side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
 materials.set(owner,m);return m;
}
function patch(group,name,owner,x,y,z,w,h,rx=0,ry=0){
 const mesh=new THREE.Mesh(quad,mat(owner));
 mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,0);
 mesh.scale.set(w,h,1);mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.raycast=()=>{};mesh.userData={visualOnly:true,teamMarking:true,nonPlayable:true};
 group.add(mesh);
}
/** Place a real textured marking on the model surface at construction time.
 * Top-down raycasts find the actual GLB wing/turret/roof elevation; no
 * floating signboards or oversized pole meshes. Decals rotate with the unit.
 */
function surfacePatch(group,meshes,root,owner,name,u,v,width,height,side=null){
 if(!meshes.length)return false;
 root.updateMatrixWorld(true);
 const bounds=new THREE.Box3();
 for(const mesh of meshes)bounds.expandByObject(mesh);
 if(bounds.isEmpty())return false;
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const origin=center.clone(),direction=new THREE.Vector3(0,-1,0);
 if(side===-1||side===1){
  origin.set(side<0?bounds.min.x-30:bounds.max.x+30,
   center.y+size.y*u,center.z+size.z*v);
  direction.set(side<0?1:-1,0,0);
 }else{
  origin.set(center.x+size.x*u,bounds.max.y+Math.max(25,size.y*.65),
   center.z+size.z*v);
 }
 const ray=new THREE.Raycaster(origin,direction,0,Math.max(100,size.y*3));
 const hits=ray.intersectObjects(meshes,false);
 const hit=hits.find(h=>h.face&&h.object.isMesh);
 if(!hit)return false;
 const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
 // Surface normal is used for real planes with sloped armor or wings.
 const quat=root.getWorldQuaternion(new THREE.Quaternion()).invert();
 const localNormal=normal.clone().applyQuaternion(quat).normalize();
 const p=hit.point.clone().addScaledVector(normal,.55);
 root.worldToLocal(p);
 const mesh=new THREE.Mesh(quad,mat(owner));
 mesh.name=name;
 mesh.position.copy(p);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),localNormal);
 mesh.scale.set(width,height,1);
 mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};
 mesh.renderOrder=4;
 mesh.userData={visualOnly:true,teamMarking:true,nonPlayable:true,
  attachedToSurface:true,owner,sourceMesh:hit.object.name};
 group.add(mesh);
 return true;
}
/** Allocated only on model creation/change, never in a render-frame callback. */
export function attachTeamMarkings(entry,owner,kind,footprint=90,height=44){
 if(!entry?.node||!kinds.has(kind)||(owner!==0&&owner!==1))return null;
 const h=Math.max(16,Number.isFinite(height)?height:44);
 const w=Math.max(20,Number.isFinite(footprint)?footprint:90);
 const model=entry.detail??entry.placeholder;
 const signature=[owner,kind,Math.round(h),Math.round(w),
  entry.detail?'authored':'placeholder'].join(':');
 if(entry.teamMarkings?.userData.signature===signature)return entry.teamMarkings;
 detachTeamMarkings(entry);
 const group=new THREE.Group();
 group.name='SandforgeTeamSurfaceMarkings';
 group.userData={signature,owner,kind,visualOnly:true,nonPlayable:true,teamMarkings:true};
 entry.node.add(group);
 if(['infantry','medic','engineer','heavy','rocket'].includes(kind)){
  const shoulder=Math.min(13,h*.23);
  for(const side of [-1,1])
   patch(group,'TeamArmband_'+(side<0?'Left':'Right'),owner,
    side*shoulder,h*.60,0,Math.max(5,h*.16),Math.max(4,h*.11),0,side*Math.PI/2);
  patch(group,'TeamChestPatch',owner,0,h*.66,h*.18,Math.max(6,h*.20),Math.max(5,h*.14));
 }else if(model){
  // Project the colored faction emblems onto the REAL outer model surface.
  // A hit is required: no fallback floating geometry when a wing is narrow.
  const meshes=[];model.traverse(o=>{
   if(o.isMesh&&o.geometry&&!o.userData.teamMarking)meshes.push(o);
  });
  if(kind==='tank'||kind==='artillery'){
   surfacePatch(group,meshes,entry.node,owner,'TeamTurretRoofMark',.0,-.12,
    w*.24,w*.15);
   surfacePatch(group,meshes,entry.node,owner,'TeamArmourSideMark',.16,0,
    w*.20,Math.max(7,h*.23),-1);
  }else if(kind==='rover'){
   surfacePatch(group,meshes,entry.node,owner,'TeamHumveeRoof',0,-.12,
    w*.28,w*.20);
   surfacePatch(group,meshes,entry.node,owner,'TeamDoor_1',.10,0,
    w*.18,h*.23,1);
   surfacePatch(group,meshes,entry.node,owner,'TeamDoor_-1',.10,0,
    w*.18,h*.23,-1);
  }else if(kind==='bomber'){
   // Wings get two flush color-texture decals, one on each side.
   surfacePatch(group,meshes,entry.node,owner,'TeamAircraftWing_-1',-.31,0,
    w*.19,w*.14);
   surfacePatch(group,meshes,entry.node,owner,'TeamAircraftWing_1',.31,0,
    w*.19,w*.14);
  }else if(kind==='scout'){
   // The helicopter uses its solid upper cabin and sides, never its rotor.
   surfacePatch(group,meshes,entry.node,owner,'TeamHelicopterRoof',0,.08,
    w*.23,w*.18);
   surfacePatch(group,meshes,entry.node,owner,'TeamHelicopterSide_-1',.08,-.03,
    w*.18,Math.max(7,h*.21),-1);
   surfacePatch(group,meshes,entry.node,owner,'TeamHelicopterSide_1',.08,-.03,
    w*.18,Math.max(7,h*.21),1);
  }
 }
 entry.teamMarkings=group;return group;
}
export function detachTeamMarkings(entry){
 if(!entry?.teamMarkings)return;
 entry.teamMarkings.removeFromParent();
 // Shared emblem material and shared quad belong to this module, not actor.
 entry.teamMarkings.clear();entry.teamMarkings=null;
}
