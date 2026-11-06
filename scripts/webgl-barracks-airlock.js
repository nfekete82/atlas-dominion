import * as THREE from 'three';

// The authored barracks GLBs batch the blast door and stiffeners together
// with other service hardware under two PBR materials. Extract their actual
// triangles and preserve their original normals, UVs, paint and geometry.
// This adds no replacement texture and works with the shipped faction GLBs.
const opening=new THREE.Box3(new THREE.Vector3(-.60,.24,-1.05),new THREE.Vector3(.24,1.25,1.79));
const doors=Object.freeze({
 steel:{min:[-.58,.29,1.44],max:[.22,1.25,1.58]},
 sand:{min:[-.59,.43,1.47],max:[.23,1.04,1.68]}
});
const localPlanes=[
 new THREE.Plane(new THREE.Vector3(-1,0,0),opening.min.x),
 new THREE.Plane(new THREE.Vector3(1,0,0),-opening.max.x),
 new THREE.Plane(new THREE.Vector3(0,-1,0),opening.min.y),
 new THREE.Plane(new THREE.Vector3(0,1,0),-opening.max.y),
 new THREE.Plane(new THREE.Vector3(0,0,-1),opening.min.z),
 new THREE.Plane(new THREE.Vector3(0,0,1),-opening.max.z)
];
const hallDark=new THREE.MeshStandardMaterial({color:'#242a29',roughness:.96,side:THREE.DoubleSide});
const hallFloor=new THREE.MeshStandardMaterial({color:'#676459',roughness:.94});
const hallBox=new THREE.BoxGeometry(1,1,1);
function hallPiece(group,name,scale,position,material=hallDark){
 const mesh=new THREE.Mesh(hallBox,material);mesh.name=name;
 mesh.scale.set(...scale);mesh.position.set(...position);
 mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
const intersects=(a,b)=>a.min.x<=b.max.x&&a.max.x>=b.min.x&&
 a.min.y<=b.max.y&&a.max.y>=b.min.y&&a.min.z<=b.max.z&&a.max.z>=b.min.z;
const inside=(point,range)=>range.min.every((limit,i)=>point.getComponent(i)>=limit)&&
 range.max.every((limit,i)=>point.getComponent(i)<=limit);

function partitionBatch(mesh,root,role){
 const geometry=mesh.geometry,positions=geometry?.getAttribute('position');
 if(!positions)return null;
 const index=geometry.getIndex();
 const count=index?index.count:positions.count;
 if(count%3!==0)return null;
 const matrix=root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
 const center=new THREE.Vector3(),point=new THREE.Vector3(),fixed=[],moving=[];
 const range=doors[role];
 for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
  center.set(0,0,0);
  for(const id of ids){
   point.fromBufferAttribute(positions,id).applyMatrix4(matrix);
   center.add(point);
  }
  center.multiplyScalar(1/3);
  (inside(center,range)?moving:fixed).push(...ids);
 }
 if(!moving.length||!fixed.length)return null;
 const subset=ids=>{
  const result=new THREE.BufferGeometry();
  for(const [key,attribute] of Object.entries(geometry.attributes))
   result.setAttribute(key,attribute);
  result.setIndex(ids);
  result.computeBoundingBox();result.computeBoundingSphere();
  return result;
 };
 const staticGeometry=subset(fixed),doorGeometry=subset(moving);
 const doorMesh=new THREE.Mesh(doorGeometry,mesh.material);
 doorMesh.name='BarracksAuthoredDoorSurface_'+role;
 doorMesh.castShadow=mesh.castShadow;doorMesh.receiveShadow=mesh.receiveShadow;
 mesh.parent.add(doorMesh);
 doorMesh.position.copy(mesh.position);
 doorMesh.quaternion.copy(mesh.quaternion);
 doorMesh.scale.copy(mesh.scale);
 mesh.geometry=staticGeometry;
 return {mesh,original:geometry,fixed:staticGeometry,part:doorMesh};
}

/** Runtime extraction makes the genuine batched door panels independently
 * movable. World-space PBR clipping removes only the physical wall through
 * the opening; the door remains uncut and covers it in its closed pose.
 * No GLB texture recompression or independent fake door plate. */
export function prepareBarracksAirlock(entry,renderer){
 if(!entry?.detail||entry.gate)return entry?.gate??null;
 const root=entry.detail;
 root.updateWorldMatrix(true,true);
 const batches=[];
 root.traverse(obj=>{
  if(!obj.isMesh)return;
  const role=obj.name.match(/AtlasUpgrade_barracks_(steel|sand)$/)?.[1];
  if(role)batches.push({obj,role});
 });
 const splits=[];
 for(const {obj,role} of batches){
  const split=partitionBatch(obj,root,role);
  if(split)splits.push(split);
 }
 // Do not invent an unrelated door if the shipped GLB has changed.
 if(!splits.length)return null;
 const door=new THREE.Group();door.name='BarracksPersonnelDoor';
 root.add(door);root.updateWorldMatrix(true,true);
 for(const {part} of splits)door.attach(part);

 // The airlock is a real visual opening through the painted core, not an
 // animated plate over a second intact opaque wall. The six-plane intersection
 // clips away just the original doorway cuboid from affected PBR meshes.
 const planes=localPlanes.map(p=>p.clone()),changed=[];
 root.updateWorldMatrix(true,true);
 const inv=root.matrixWorld.clone().invert();
 root.traverse(mesh=>{
  if(!mesh.isMesh||splits.some(s=>s.part===mesh))return;
  const geo=mesh.geometry;if(!geo?.attributes?.position)return;
  if(!geo.boundingBox)geo.computeBoundingBox();
  const bounds=geo.boundingBox.clone().applyMatrix4(inv.clone().multiply(mesh.matrixWorld));
  if(!intersects(bounds,opening))return;
  const originalMaterial=mesh.material;
  const copy=mat=>{
   const material=mat.clone();
   material.clippingPlanes=planes;
   material.clipIntersection=true;
   material.clipShadows=true;
   material.needsUpdate=true;
   return material;
  };
  mesh.material=Array.isArray(originalMaterial)?originalMaterial.map(copy):copy(originalMaterial);
  changed.push({mesh,originalMaterial});
 });
 renderer.localClippingEnabled=true;
 const hall=new THREE.Group();hall.name='BarracksPersonnelAirlock';root.add(hall);
 hallPiece(hall,'AirlockGround',[.80,.035,2.28],[-.18,.255,.36],hallFloor);
 hallPiece(hall,'AirlockBack',[.80,1.0,.055],[-.18,.75,-.83]);
 hallPiece(hall,'AirlockLeft',[.045,1.0,2.18],[-.59,.75,.36]);
 hallPiece(hall,'AirlockRight',[.045,1.0,2.18],[.23,.75,.36]);
 const lampMaterial=new THREE.MeshStandardMaterial({
  color:'#6d3510',emissive:'#ff8d32',emissiveIntensity:0
 });
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),lampMaterial);
 lamp.position.set(-.18,1.30,1.60);root.add(lamp);
 lamp.visible=false;hall.visible=false;
 const gate={kind:'barracks',door,hall,lamp,
  dust:{visible:false,scale:new THREE.Vector3(1,1,1)},ramp:null,
  root,planes,changed,splits};
 gate.updateClip=()=>{
  root.updateWorldMatrix(true,true);
  for(let i=0;i<planes.length;i++)planes[i].copy(localPlanes[i]).applyMatrix4(root.matrixWorld);
 };
 gate.cleanup=()=>{
  for(const {mesh,originalMaterial} of changed){
   const current=mesh.material;
   for(const material of Array.isArray(current)?current:[current])material.dispose();
   mesh.material=originalMaterial;
  }
  for(const {mesh,original,fixed,part} of splits){
   mesh.geometry=original;
   fixed.dispose();part.geometry.dispose();part.removeFromParent();
  }
  door.removeFromParent();hall.removeFromParent();lamp.removeFromParent();
  lampMaterial.dispose();lamp.geometry.dispose();
 };
 gate.updateClip();entry.gate=gate;return gate;
}
