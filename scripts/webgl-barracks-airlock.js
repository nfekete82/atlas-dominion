import * as THREE from 'three';

// Authored barracks GLBs contain a solid ceramic core behind the armoured
// doorway. Clip the existing PBR meshes at the physical portal (instead of
// putting a fake moving door over an uncut wall). The original GLBs/UVs remain
// intact, and only geometry intersecting this narrow airlock pays clipping cost.
const opening=new THREE.Box3(
 new THREE.Vector3(-.60,.24,-1.05),
 new THREE.Vector3(.24,1.25,1.79)
);
const localPlanes=[
 new THREE.Plane(new THREE.Vector3(-1,0,0),opening.min.x),
 new THREE.Plane(new THREE.Vector3(1,0,0),-opening.max.x),
 new THREE.Plane(new THREE.Vector3(0,-1,0),opening.min.y),
 new THREE.Plane(new THREE.Vector3(0,1,0),-opening.max.y),
 new THREE.Plane(new THREE.Vector3(0,0,-1),opening.min.z),
 new THREE.Plane(new THREE.Vector3(0,0,1),-opening.max.z)
];
const hallDark=new THREE.MeshStandardMaterial({color:'#252b29',roughness:.98,side:THREE.DoubleSide});
const hallFloor=new THREE.MeshStandardMaterial({color:'#605e52',roughness:.94});
const hallBox=new THREE.BoxGeometry(1,1,1);
function hallPiece(group,name,scale,position,material=hallDark){
 const mesh=new THREE.Mesh(hallBox,material);mesh.name=name;
 mesh.scale.set(...scale);mesh.position.set(...position);
 mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
const intersects=(a,b)=>a.min.x<=b.max.x&&a.max.x>=b.min.x&&
 a.min.y<=b.max.y&&a.max.y>=b.min.y&&a.min.z<=b.max.z&&a.max.z>=b.min.z;

/** Prepare one barracks' original two-faction PBR geometry, with a real
 * rendered opening through its core wall while retaining the authored door
 * plate and reinforcing slats as the visible moving shutter. */
export function prepareBarracksAirlock(entry,renderer){
 if(!entry?.detail||entry.gate)return entry?.gate??null;
 const root=entry.detail;
 const panels=[];
 root.traverse(o=>{
  if(o.isMesh&&/BarracksBlastDoor|BarracksDoorStiffener/.test(o.name))
   panels.push(o);
 });
 if(!panels.length)return null;
 root.updateWorldMatrix(true,true);
 const door=new THREE.Group();door.name='BarracksPersonnelDoor';
 root.add(door);root.updateWorldMatrix(true,true);
 for(const panel of panels)door.attach(panel);

 // The cuboid is expressed in original GLB coordinates. Six intersection
 // clipping planes discard only the airlock volume in otherwise solid meshes.
 // Each barracks rotates its own planes with its model, preserving 4 facings.
 const planes=localPlanes.map(p=>p.clone());
 const changed=[];
 root.updateWorldMatrix(true,true);
 const inv=root.matrixWorld.clone().invert();
 root.traverse(mesh=>{
  if(!mesh.isMesh||panels.includes(mesh))return;
  const geo=mesh.geometry;if(!geo?.attributes?.position)return;
  if(!geo.boundingBox)geo.computeBoundingBox();
  const matrix=inv.clone().multiply(mesh.matrixWorld);
  const bounds=geo.boundingBox.clone().applyMatrix4(matrix);
  if(!intersects(bounds,opening))return;
  const previous=mesh.material;
  const copy=mat=>{
   const clone=mat.clone();
   clone.clippingPlanes=planes;
   clone.clipIntersection=true;
   clone.clipShadows=true;
   clone.needsUpdate=true;
   return clone;
  };
  mesh.material=Array.isArray(previous)?previous.map(copy):copy(previous);
  changed.push({mesh,previous});
 });
 if(!changed.length){
  for(const panel of panels)root.attach(panel);
  door.removeFromParent();return null;
 }
 renderer.localClippingEnabled=true;
 const hall=new THREE.Group();hall.name='BarracksPersonnelAirlock';
 root.add(hall);
 hallPiece(hall,'AirlockGround',[.80,.035,2.28],[-.18,.255,.36],hallFloor);
 hallPiece(hall,'AirlockBack',[.80,1.0,.055],[-.18,.75,-.83]);
 hallPiece(hall,'AirlockLeft',[.045,1.0,2.18],[-.59,.75,.36]);
 hallPiece(hall,'AirlockRight',[.045,1.0,2.18],[.23,.75,.36]);
 const warningMaterial=new THREE.MeshStandardMaterial({
  color:'#6d3510',emissive:'#ff8d32',emissiveIntensity:0
 });
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),warningMaterial);
 lamp.position.set(-.18,1.30,1.60);root.add(lamp);
 lamp.visible=false;hall.visible=false;
 const gate={kind:'barracks',door,hall,lamp,dust:{visible:false,scale:new THREE.Vector3(1,1,1)},ramp:null,
  planes,changed,root,panelRest:new Map(panels.map(p=>[p,p.parent]))};
 gate.updateClip=()=>{
  root.updateWorldMatrix(true,true);
  for(let i=0;i<planes.length;i++)planes[i].copy(localPlanes[i]).applyMatrix4(root.matrixWorld);
 };
 gate.cleanup=()=>{
  for(const {mesh,previous} of changed){
   const current=mesh.material;
   for(const mat of Array.isArray(current)?current:[current])mat.dispose();
   mesh.material=previous;
  }
  door.removeFromParent();hall.removeFromParent();lamp.removeFromParent();
  warningMaterial.dispose();
 };
 gate.updateClip();
 entry.gate=gate;
 return gate;
}
