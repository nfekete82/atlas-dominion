import * as THREE from 'three';

/** Strong blue/red unit identification without replacing desert camouflage.
 * One shared procedural emblem texture per team. Render-only; no save changes.
 */
export const TEAM_MARKING_COLORS=Object.freeze({0:'#198fe0',1:'#e34e43'});
const kinds=new Set(['infantry','medic','engineer','heavy','rocket','tank','rover','artillery','scout','bomber']);
const materials=new Map();
const quad=new THREE.PlaneGeometry(1,1);
const poleGeo=new THREE.CylinderGeometry(.72,.72,1,7);
const poleMat=new THREE.MeshBasicMaterial({color:'#7e725f'});
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
/** Attach once when created/model size changes; never allocate each RAF. */
export function attachTeamMarkings(entry,owner,kind,footprint=90,height=44){
 if(!entry?.node||!kinds.has(kind)||(owner!==0&&owner!==1))return null;
 const h=Math.max(16,Number.isFinite(height)?height:44);
 const w=Math.max(20,Number.isFinite(footprint)?footprint:90);
 const signature=[owner,kind,Math.round(h),Math.round(w)].join(':');
 if(entry.teamMarkings?.userData.signature===signature)return entry.teamMarkings;
 detachTeamMarkings(entry);
 const group=new THREE.Group();
 group.name='SandforgeTeamUniformAndFlags';
 group.userData={signature,owner,kind,visualOnly:true,nonPlayable:true,teamMarkings:true};
 if(['infantry','medic','engineer','heavy','rocket'].includes(kind)){
  const shoulder=Math.min(13,h*.23);
  for(const side of [-1,1])
   patch(group,'TeamArmband_'+(side<0?'Left':'Right'),owner,
    side*shoulder,h*.60,0,Math.max(5,h*.16),Math.max(4,h*.11),0,side*Math.PI/2);
  patch(group,'TeamChestPatch',owner,0,h*.66,h*.18,Math.max(6,h*.20),Math.max(5,h*.14));
 }else if(kind==='tank'||kind==='artillery'){
  const x=-w*.29,z=-w*.18;
  const pole=new THREE.Mesh(poleGeo,poleMat);
  pole.name='TeamFlagpole';pole.position.set(x,h*.86+7,z);
  pole.scale.set(1,15,1);pole.castShadow=false;pole.receiveShadow=false;
  pole.raycast=()=>{};pole.userData={visualOnly:true,teamMarking:true,nonPlayable:true};group.add(pole);
  patch(group,'TeamArmourFlag',owner,x+10,h*.86+12,z,Math.max(20,w*.21),12);
  patch(group,'TeamTurretRoofMark',owner,w*.1,h*.88,0,w*.27,Math.max(12,w*.13),-Math.PI/2);
 }else if(kind==='rover'){
  patch(group,'TeamHumveeRoof',owner,0,h*.77,-w*.09,w*.34,w*.24,-Math.PI/2);
  for(const side of [-1,1])
   patch(group,'TeamDoor_'+side,owner,side*w*.30,h*.46,0,w*.21,Math.max(8,h*.24),0,side*Math.PI/2);
 }else{
  for(const side of [-1,1])
   patch(group,'TeamAircraftWing_'+side,owner,side*w*.27,h*.40,0,
    Math.max(14,w*.23),Math.max(11,w*.15),-Math.PI/2);
  patch(group,'TeamAircraftTail',owner,0,h*.6,-w*.23,w*.16,Math.max(9,h*.23),-Math.PI/2);
 }
 entry.node.add(group);entry.teamMarkings=group;return group;
}
export function detachTeamMarkings(entry){
 if(!entry?.teamMarkings)return;
 entry.teamMarkings.removeFromParent();entry.teamMarkings.clear();entry.teamMarkings=null;
}
