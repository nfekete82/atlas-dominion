import * as THREE from 'three';

// The shipped barracks facade consists of separate textured airlock panels and
// solid hull volumes. Build an actual portal by clipping ONLY the handful of
// hull meshes intersecting the door cavity; preserve their original UV/PBR.
// No second opaque wall is left behind the sliding panels.
const localDoorBox=[
 [new THREE.Vector3( 1,0,0), .57], // x >= -.57
 [new THREE.Vector3(-1,0,0), .20], // x <=  .20
 [new THREE.Vector3(0, 1,0),-.25], // y >=  .25
 [new THREE.Vector3(0,-1,0),1.25], // y <= 1.25
 [new THREE.Vector3(0,0, 1),-.68], // z >=  .68
 [new THREE.Vector3(0,0,-1),1.64]  // z <= 1.64
];
const cutNames=/ArmouredHull|CeramicHull|AirlockHousing|AirlockArmour|EntryRecess/;
const panelNames=/AirlockDoor|DoorCeramic|BarracksBlastDoor|BarracksDoorStiffener/;
const box=new THREE.BoxGeometry(1,1,1);
const dark=new THREE.MeshStandardMaterial({color:'#101716',roughness:1});
const floor=new THREE.MeshStandardMaterial({color:'#666054',roughness:.95});

// The replacement barracks' door is at its actual authored position, not
// necessarily at local X=0. Compute its centre from the closed GLB panels
// so soldiers always emerge at the visible airlock, after every rotation or
// non-gameplay visual scale change.
export function authoredBarracksExitLane(root,left,right){
 const fallback={
  inside:new THREE.Vector3(0,1,-3.8),
  outside:new THREE.Vector3(0,1,-11)
 };
 if(!root||!left||!right)return fallback;
 root.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().expandByObject(left).expandByObject(right);
 if(bounds.isEmpty())return fallback;
 const center=root.worldToLocal(bounds.getCenter(new THREE.Vector3()));
 const floorPoint=root.worldToLocal(new THREE.Vector3(
  bounds.min.x,bounds.min.y,bounds.min.z));
 const y=Math.max(0,floorPoint.y+.08);
 const buildingBounds=new THREE.Box3().setFromObject(root);
 const ground=root.worldToLocal(new THREE.Vector3(0,buildingBounds.min.y,0)).y;
 // The authored Kaserne fronts local -Z. Step from inside the building
 // across its door threshold, then clear the front steps before turning.
 return {
  inside:new THREE.Vector3(center.x,y,center.z+.70),
  threshold:new THREE.Vector3(center.x,y,center.z-.20),
  outside:new THREE.Vector3(center.x,ground+.02,center.z-6.3)
 };
}
export function barracksExitLane(portal){
 return portal?.authored&&portal.lane?
  {inside:portal.lane.inside.clone(),outside:portal.lane.outside.clone(),threshold:portal.lane.threshold?.clone()}:
  {inside:new THREE.Vector3(-.18,.275,.9),
   outside:new THREE.Vector3(-.18,0,2.10)};
}
/** Walk level through the lintel, then descend the actual raised entrance
 * to the ground. A constant threshold Y made troops hover beyond the stairs. */
export function barracksDeparturePoint(portal,fraction){
 const lane=barracksExitLane(portal),t=THREE.MathUtils.clamp(fraction,0,1);
 if(!lane.threshold)return lane.inside.lerp(lane.outside,t);
 const split=lane.inside.distanceTo(lane.threshold)/
  (lane.inside.distanceTo(lane.threshold)+lane.threshold.distanceTo(lane.outside));
 return t<=split?lane.inside.lerp(lane.threshold,t/Math.max(.0001,split)):
  lane.threshold.lerp(lane.outside,(t-split)/Math.max(.0001,1-split));
}
function clipAuthoredDoorBacking(root,renderer){
 // Bounds measured at the actual authored aperture. The intersected recess
 // faces span x ±1.94 and the backing spans x ±2.155; clip only the clear
 // central passage, keeping the surrounding frame and original PBR/UVs.
 const box=[
  [new THREE.Vector3(1,0,0),1.14],[new THREE.Vector3(-1,0,0),1.14],
  [new THREE.Vector3(0,1,0),-1.37],[new THREE.Vector3(0,-1,0),3.625],
  [new THREE.Vector3(0,0,1),3.75],[new THREE.Vector3(0,0,-1),-2.8]
 ];
 const planes=box.map(()=>new THREE.Plane()),materials=[],replaced=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh||!/^static__(recess|steel_dark)$/.test(mesh.name))return;
  const original=mesh.material;
  const clip=source=>{
   const material=source.clone();
   material.onBeforeCompile=source.onBeforeCompile;
   material.customProgramCacheKey=source.customProgramCacheKey;
   material.clippingPlanes=planes;material.clipIntersection=true;material.clipShadows=true;
   materials.push(material);return material;
  };
  mesh.material=Array.isArray(original)?original.map(clip):clip(original);
  replaced.push({mesh,original});
 });
 if(renderer)renderer.localClippingEnabled=true;
 return {materials,planes,box,replaced,transform:null};
}
export function prepareBarracksPortal(entry,renderer){
 if(entry?.barracksPortal)return entry.barracksPortal;
 const root=entry?.detail;
 if(!root)return null;
 // Original ready Kaserne contains dedicated door pivots; never carve its facade.
 const left=root.getObjectByName('GATE_LEFT_PIVOT');
 const right=root.getObjectByName('GATE_RIGHT_PIVOT');
 if(left&&right){
  const hall=new THREE.Group();hall.name='BarracksInterior';
  root.add(hall);
  const lane=authoredBarracksExitLane(root,left,right);
  const a=root.worldToLocal(new THREE.Box3().setFromObject(left)
   .getCenter(new THREE.Vector3())).x;
  const b=root.worldToLocal(new THREE.Box3().setFromObject(right)
   .getCenter(new THREE.Vector3())).x;
  // Some imported GLBs bake absolute vertex positions into pivots at 0,0,0.
  // Choose outward travel by visible panel locations, not pivot names.
  const leftSide=a<=b?-1:1;
  const clipped=clipAuthoredDoorBacking(root,renderer);
  const portal={kind:'barracks',authored:true,root,hall,left,right,lane,
   // Ready GLB stores its leaves already 1.1 units OPEN inside each
   // pivot. Recover the closed rest pose from actual panel/pivot offsets.
   leftX:left.position.x+(left.position.x-a),
   rightX:right.position.x+(right.position.x-b),
   leftSide,rightSide:-leftSide,doorPanels:[],
   ...clipped};
  entry.barracksPortal=portal;
  setBarracksDoorOpen(portal,1);
  updateBarracksPortalPlanes(portal,true);
  return portal;
 }
 const doorPanels=[],materials=[];
 const planes=localDoorBox.map(()=>new THREE.Plane());
 root.traverse(obj=>{
  if(!obj.isMesh)return;
  if(panelNames.test(obj.name)){
   doorPanels.push({mesh:obj,y:obj.position.y,scaleY:obj.scale.y});
  }
  if(cutNames.test(obj.name)){
   const original=obj.material;
   const clipMaterial=material=>{
    const m=material.clone();
    m.clippingPlanes=planes;m.clipIntersection=true;m.clipShadows=true;
    materials.push(m);return m;
   };
   obj.material=Array.isArray(original)?original.map(clipMaterial):clipMaterial(original);
  }
 });
 if(!doorPanels.some(p=>/BarracksBlastDoor/.test(p.mesh.name)))return null;
 renderer.localClippingEnabled=true;
 const hall=new THREE.Group();
 hall.name='BarracksInterior';
 function part(name,size,at,material){
  const mesh=new THREE.Mesh(box,material);
  mesh.name=name;mesh.position.set(...at);mesh.scale.set(...size);
  hall.add(mesh);return mesh;
 }
 // Interior is behind the true cavity, not pasted over the closing panels.
 part('BarracksInteriorFloor',[.78,.035,.90],[-.18,.275,.91],floor);
 part('BarracksInteriorRear',[.80,.95,.025],[-.18,.73,.66],dark);
 part('BarracksInteriorCeiling',[.82,.025,.88],[-.18,1.24,1.08],dark);
 const portal={kind:'barracks',root,doorPanels,materials,planes,box:localDoorBox,
  hall,transform:null};
 root.add(hall);entry.barracksPortal=portal;
 updateBarracksPortalPlanes(portal,true);
 return portal;
}
export function updateBarracksPortalPlanes(portal,force=false){
 if(!portal.planes?.length)return;
 portal.root.updateWorldMatrix(true,false);
 const matrix=portal.root.matrixWorld;
 if(!force&&portal.transform?.equals(matrix))return;
 portal.transform=matrix.clone();
 for(let i=0;i<portal.planes.length;i++){
  const [normal,constant]=portal.box[i];
  portal.planes[i].set(normal,constant).applyMatrix4(matrix);
 }
}
export function setBarracksDoorOpen(portal,open){
 if(portal.authored){
  const t=Math.max(0,Math.min(1,open));
  portal.left.position.x=portal.leftX+(1-t)*portal.leftSide*1.1;
  portal.right.position.x=portal.rightX+(1-t)*portal.rightSide*1.1;
  portal.hall.visible=t<.97;
  return;
 }
 for(const panel of portal.doorPanels){
  panel.mesh.position.y=panel.y+open*.66;
  panel.mesh.scale.y=panel.scaleY*(1-open*.97);
 }
 portal.hall.visible=open>.03;
}
export function disposeBarracksPortal(entry){
 const p=entry?.barracksPortal;if(!p)return;
 setBarracksDoorOpen(p,p.authored?1:0);
 for(const {mesh,original} of p.replaced??[])mesh.material=original;
 for(const m of p.materials)m.dispose();
 p.hall.removeFromParent();
 delete entry.barracksPortal;
}
