import * as THREE from 'three';

/** Long wall-hung faction standards for authored desert headquarters/barracks.
 * World units and building-facing orientation are used only for presentation.
 * Banners are not selectable, never collide, and have no gameplay effect.
 */
export const SANDFORGE_BANNER_STYLE=Object.freeze({
 headquarters:{side:57,height:52,front:77,width:19,length:30},
 barracks:{side:57,height:52,front:77,width:19,length:30}
});
const TEAM_CLOTH=['#284d7b','#973c36'];
const TEAM_TRIM=['#bdc9c2','#d5b39e'];

// Position the fabric against the ACTUAL finished wall, not a constant
// guessed at the smaller old Kaserne. Works after any MK2 scaling or yaw.
export function resolvedFactionBannerStyle(entry,kind=entry?.kind){
 const base=SANDFORGE_BANNER_STYLE[kind];
 if(!base)return null;
 const shell=entry?.detail?.getObjectByName('STAGE_01_Bunker_Shell__camo');
 if(!shell?.isMesh||!entry?.node)return {...base};
 entry.node.updateWorldMatrix(true,true);
 shell.updateWorldMatrix(true,false);
 const bounds=shell.geometry.boundingBox?.clone()??new THREE.Box3().setFromBufferAttribute(
  shell.geometry.getAttribute('position'));
 const toNode=entry.node.matrixWorld.clone().invert().multiply(shell.matrixWorld);
 bounds.applyMatrix4(toNode);
 const width=bounds.max.x-bounds.min.x;
 const height=bounds.max.y-bounds.min.y;
 return {...base,
  side:Math.max(34,width*.32),
  height:bounds.min.y+height*.95,
  front:bounds.max.z+1.1,
  width:Math.min(21,Math.max(16,width*.103)),
  length:Math.min(30,Math.max(23,height*.61)),
  measuredAgainstWall:true
 };
}

function cloth(width,length){
 const geo=new THREE.PlaneGeometry(width,length,8,12);
 const pos=geo.getAttribute('position'),half=length*.5;
 // Taut wall standards: straight sides, small cloth relief, weighted hem.
 // Previous .48 taper and exaggerated waviness made them look detached.
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i);
  const t=(half-y)/length;
  pos.setXYZ(i,x,y,.085*Math.sin(x*.28+t*4.2)*Math.sin(Math.PI*t));
 }
 pos.needsUpdate=true;geo.computeVertexNormals();return geo;
}

function makeBanner(style,owner,index,geometry,paint,edge,hardware){
 const anchor=new THREE.Group();anchor.name='SF_FactionWallStandard_'+index;
 const front=style.front>0?1:-1;
 anchor.position.set((index===0?-1:1)*style.side,style.height,style.front);
 if(front<0)anchor.rotation.y=Math.PI;
 const panel=new THREE.Mesh(geometry,paint);
 panel.name='SF_FactionFabric';panel.position.y=-style.length*.5;
 panel.castShadow=true;panel.receiveShadow=true;panel.raycast=()=>{};
 anchor.add(panel);
 const rod=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,style.width+2,8),hardware);
 rod.rotation.z=Math.PI/2;rod.position.y=.45;rod.raycast=()=>{};anchor.add(rod);
 // Rear brackets connect the hanging rod to the facade, not the air.
 for(const side of [-1,1]){
  const bracket=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,2.4),hardware);
  bracket.position.set(side*style.width*.43,.45,-1.1);
  bracket.raycast=()=>{};anchor.add(bracket);
 }
 for(const side of [-1,1]){
  const stud=new THREE.Mesh(new THREE.SphereGeometry(1.35,9,7),hardware);
  stud.position.set(side*(style.width*.5+.9),.45,0);stud.raycast=()=>{};anchor.add(stud);
 }
 const seam=new THREE.Mesh(new THREE.BoxGeometry(style.width*.86,1.05,.27),edge);
 seam.position.set(0,-2,.56);seam.raycast=()=>{};anchor.add(seam);
 const hem=new THREE.Mesh(new THREE.BoxGeometry(style.width*.96,.62,.23),edge);
 hem.name='SF_FactionWeightedHem';
 hem.position.set(0,-style.length,.15);hem.raycast=()=>{};anchor.add(hem);
 const crest=new THREE.Group();crest.position.set(0,-style.length*.53,.78);
 // Use the actual Sandforge blue flag's white star, rather than a
 // stylized shield that reads as a detached metal badge.
 const starShape=new THREE.Shape();
 const rOuter=style.width*.26,rInner=rOuter*.41;
 for(let i=0;i<10;i++){
  const angle=-Math.PI/2+i*Math.PI/5;
  const rad=i%2?rInner:rOuter;
  const x=Math.cos(angle)*rad,y=-Math.sin(angle)*rad;
  if(!i)starShape.moveTo(x,y);else starShape.lineTo(x,y);
 }
 starShape.closePath();
 const starMat=new THREE.MeshStandardMaterial({
  name:'SF_FactionWhiteStar',color:'#f5f2e8',
  roughness:.95,metalness:0,side:THREE.DoubleSide
 });
 const star=new THREE.Mesh(new THREE.ShapeGeometry(starShape),starMat);
 star.name='SF_FactionStar';star.raycast=()=>{};crest.add(star);
 anchor.userData.ownedEmblemMaterial=starMat;
 anchor.userData.ownedEmblemGeometry=star.geometry;

 anchor.add(crest);
 anchor.userData.sfFactionOwner=owner;
 return anchor;
}

export function ensureFactionWallBanners(entry,owner,kind=entry?.kind){
 const style=resolvedFactionBannerStyle(entry,kind);
 if(!entry?.node||!entry.detail||!style)return null;
 let group=entry.node.getObjectByName('SF_FactionWallStandards');
 if(group){
  setFactionWallBannerOwner(entry,owner);
  return group;
 }
 group=new THREE.Group();group.name='SF_FactionWallStandards';
 group.userData.visualOnly=true;group.userData.nonPlayable=true;
 // Construction finishes before the standards are ceremonially mounted.
 // Stay hidden at creation: even asynchronously loaded GLBs must not flash
 // completed flags onto a building still under construction.
 group.visible=false;
 const fabric=new THREE.MeshStandardMaterial({
  name:'SF_FactionBannerFabric',color:TEAM_CLOTH[owner]??TEAM_CLOTH[0],
  roughness:.93,metalness:0,side:THREE.DoubleSide
 });
 const seam=new THREE.MeshStandardMaterial({
  name:'SF_FactionBannerTrim',color:TEAM_TRIM[owner]??TEAM_TRIM[0],
  roughness:.82,metalness:.08,side:THREE.DoubleSide
 });
 const hardware=new THREE.MeshStandardMaterial({
  name:'SF_FactionBannerHardware',color:'#ab935f',roughness:.45,metalness:.65,
  side:THREE.DoubleSide
 });
 const geometry=cloth(style.width,style.length);
 for(const i of [0,1])group.add(makeBanner(style,owner,i,geometry,fabric,seam,hardware));
 group.userData.ownedMaterials=[fabric,seam,hardware,...group.children.map(x=>x.userData.ownedEmblemMaterial).filter(Boolean)];
 group.userData.ownedEmblemGeometries=group.children.map(x=>x.userData.ownedEmblemGeometry).filter(Boolean);
 group.userData.ownedGeometry=geometry;
 group.userData.owner=owner;
 entry.node.add(group);
 entry.factionBanners=group;
 return group;
}

/** Construction-only presentation. Installation is the final building step.
 * Reuses the existing banners; no reallocation and no game-state mutation. */
export function setFactionWallBannerConstruction(entry,finished){
 const group=entry?.factionBanners??entry?.node?.getObjectByName('SF_FactionWallStandards');
 if(!group)return false;
 group.visible=Boolean(finished);
 return group.visible;
}

export function setFactionWallBannerOwner(entry,owner){
 const group=entry?.factionBanners??entry?.node?.getObjectByName('SF_FactionWallStandards');
 if(!group||group.userData.owner===owner)return false;
 const materials=group.userData.ownedMaterials;
 if(!materials?.length)return false;
 materials[0].color.set(TEAM_CLOTH[owner]??TEAM_CLOTH[0]);
 materials[1].color.set(TEAM_TRIM[owner]??TEAM_TRIM[0]);
 group.userData.owner=owner;
 return true;
}

export function disposeFactionWallBanners(entry){
 const group=entry?.factionBanners??entry?.node?.getObjectByName('SF_FactionWallStandards');
 if(!group)return;
 group.userData.ownedGeometry?.dispose();
 for(const geometry of group.userData.ownedEmblemGeometries??[])geometry.dispose();
 for(const material of group.userData.ownedMaterials??[])material.dispose();
 group.removeFromParent();
 if(entry)entry.factionBanners=null;
}
