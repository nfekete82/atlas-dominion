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

function cloth(width,length){
 const geo=new THREE.PlaneGeometry(width,length,8,12);
 const pos=geo.getAttribute('position'),half=length*.5;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),t=(half-y)/length;
  // A weighted fabric drape and a split lower hem.
  const taper=t>.82?(t-.82)*.48:0;
  pos.setXYZ(i,x*(1-taper),y-(t>.82?(t-.82)*2:0),
   .38*Math.sin(x*.48+t*7)*Math.sin(Math.PI*t));
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
 rod.rotation.z=Math.PI/2;rod.position.y=.85;rod.raycast=()=>{};anchor.add(rod);
 for(const side of [-1,1]){
  const stud=new THREE.Mesh(new THREE.SphereGeometry(1.35,9,7),hardware);
  stud.position.set(side*(style.width*.5+.9),.85,0);stud.raycast=()=>{};anchor.add(stud);
 }
 const seam=new THREE.Mesh(new THREE.BoxGeometry(style.width*.86,1.05,.27),edge);
 seam.position.set(0,-2,.56);seam.raycast=()=>{};anchor.add(seam);
 const crest=new THREE.Group();crest.position.set(0,-style.length*.48,.68);
 const plaque=new THREE.Mesh(new THREE.CircleGeometry(style.width*.22,20),edge);
 plaque.raycast=()=>{};crest.add(plaque);
 // Original Sandforge shield, rather than text labels or floating flagpoles.
 const shape=new THREE.Shape();const w=style.width*.125,h=style.width*.21;
 shape.moveTo(-w,h*.58);shape.lineTo(w,h*.58);
 shape.lineTo(w,-h*.20);shape.lineTo(0,-h);shape.lineTo(-w,-h*.20);
 shape.closePath();
 const shield=new THREE.Mesh(new THREE.ShapeGeometry(shape),hardware);
 shield.position.z=.12;shield.raycast=()=>{};crest.add(shield);
 anchor.add(crest);
 anchor.userData.sfFactionOwner=owner;
 return anchor;
}

export function ensureFactionWallBanners(entry,owner,kind=entry?.kind){
 const style=SANDFORGE_BANNER_STYLE[kind];
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
 group.userData.ownedMaterials=[fabric,seam,hardware];
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
 for(const material of group.userData.ownedMaterials??[])material.dispose();
 group.removeFromParent();
 if(entry)entry.factionBanners=null;
}
