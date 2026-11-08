import * as THREE from 'three';

/** Small, unmistakable blue/red painted plates on the actual 3D meshes.
 * Not a team-colored selection ring, a whole-model tint, or a change in
 * collision/visibility: just model-local decorative trim. */
export const FACTION_COLORS=Object.freeze({
  0:'#2e9fc8',
  1:'#cf5e4f'
});
const box=new THREE.BoxGeometry(1,1,1);
const mats={
  0:new THREE.MeshStandardMaterial({
   color:FACTION_COLORS[0],emissive:FACTION_COLORS[0],
   emissiveIntensity:.28,metalness:.27,roughness:.48
  }),
  1:new THREE.MeshStandardMaterial({
   color:FACTION_COLORS[1],emissive:FACTION_COLORS[1],
   emissiveIntensity:.28,metalness:.27,roughness:.48
  })
};
const accent=(root,name,x,y,z,w,h,d,owner)=>{
 const mesh=new THREE.Mesh(box,mats[owner]);
 mesh.name='sf-team-'+name;
 mesh.userData={visualOnly:true,nonPlayable:true,factionAccent:true};
 // Never intercept unit or building raycasts / transport-rightclick picking.
 mesh.raycast=()=>{};
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
 mesh.castShadow=false;mesh.receiveShadow=false;
 root.add(mesh);
 return mesh;
};

/** Normalized fractions are scaled to each imported GLB's measured bounds.
 * All facets are paired front/back or left/right so their identity remains
 * readable after the actor rotates in combat. */
export function makeFactionAccents(kind,owner,type){
 if(owner!==0&&owner!==1)return null;
 const group=new THREE.Group();
 group.name='sandforge-team-accents-'+type+'-'+kind+'-'+owner;
 group.userData={visualOnly:true,nonPlayable:true,factionAccent:true,owner,kind,type};
 if(type==='building'){
  // Structural trim on the lower side columns; keep roofs/camo/doors intact.
  for(const side of [-1,1]){
   for(const front of [-1,1]){
    accent(group,'base-post',side*.34,.13,front*.33,.055,.21,.065,owner);
    accent(group,'base-plate',side*.28,.055,front*.37,.15,.045,.045,owner);
   }
  }
 }else if(['infantry','medic','engineer','heavy'].includes(kind)){
  for(const side of [-1,1]){
   accent(group,'shoulder',side*.24,.72,.02,.20,.095,.23,owner);
  }
  // A small front and rear chest/back identifier remains visible at RTS zoom.
  for(const front of [-1,1])
   accent(group,'chest-mark',0,.60,front*.17,.29,.095,.048,owner);
 }else if(kind==='scout'){
  for(const side of [-1,1]){
   accent(group,'cargo-door',side*.22,.36,.04,.20,.18,.38,owner);
   accent(group,'tail-mark',side*.09,.36,-.33,.13,.11,.10,owner);
  }
 }else if(kind==='bomber'){
  for(const side of [-1,1]){
   accent(group,'wing-stripe',side*.30,.46,.03,.16,.055,.24,owner);
   accent(group,'tail-stripe',side*.10,.54,-.29,.09,.07,.12,owner);
  }
 }else{
  // Tanks, Humvees and rocket trucks: readable painted armor/side plates.
  for(const side of [-1,1]){
   accent(group,'armor-side',side*.37,.43,0,.055,.18,.40,owner);
   accent(group,'roof-stripe',side*.23,.65,.09,.23,.038,.17,owner);
  }
 }
 return group;
}

/** One group per actor: update bounds when a streamed GLB replaces its
 * lightweight placeholder. No geometry/material recreation per frame. */
export function applyFactionAccents(entry,entity,type,footprint,height){
 if(!entry?.node||!entity)return null;
 let group=entry.factionAccents;
 if(!group){
  group=makeFactionAccents(entity.kind,entity.owner,type);
  if(!group)return null;
  entry.node.add(group);entry.factionAccents=group;
 }
 if(!Number.isFinite(footprint)||footprint<=0||
  !Number.isFinite(height)||height<=0)return group;
 group.scale.set(footprint,height,footprint*(type==='building'?.70:1));
 return group;
}
