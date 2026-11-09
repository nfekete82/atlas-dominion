import * as THREE from 'three';

/** Original, deterministic 3D research miniatures for the Zero-Hour HUD.
 * Actual meshes (not emoji or font icons). Created only when a card image is
 * rasterized; no animation frame allocations and no image/network dependency.
 */
export const RESEARCH_ARTWORK_KINDS=Object.freeze([
 'armor1','armor2','precision','engines','infantryTraining',
 'rocketDevelopment','radar','tankArmor','tankMobility'
]);

export function createResearchArtwork(kind){
 if(!RESEARCH_ARTWORK_KINDS.includes(kind))return null;
 const root=new THREE.Group();
 root.name='SF_ResearchArtwork_'+kind;
 root.userData={visualOnly:true,nonPlayable:true,researchArtwork:true};
 const mat={
  frame:new THREE.MeshStandardMaterial({color:'#273431',roughness:.79,metalness:.42}),
  steel:new THREE.MeshStandardMaterial({color:'#7b8885',roughness:.45,metalness:.63}),
  black:new THREE.MeshStandardMaterial({color:'#273036',roughness:.48,metalness:.57}),
  armor:new THREE.MeshStandardMaterial({color:'#b7ad94',roughness:.74,metalness:.28}),
  light:new THREE.MeshStandardMaterial({color:'#d5c4a0',roughness:.67,metalness:.27}),
  bronze:new THREE.MeshStandardMaterial({color:'#b48c52',roughness:.48,metalness:.69}),
  rubber:new THREE.MeshStandardMaterial({color:'#171f20',roughness:.94,metalness:.04}),
  blue:new THREE.MeshStandardMaterial({color:'#478ca0',emissive:'#16799a',emissiveIntensity:.44,roughness:.38,metalness:.34}),
  red:new THREE.MeshStandardMaterial({color:'#98554a',roughness:.49,metalness:.35})
 };
 const add=(geometry,m,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
  const mesh=new THREE.Mesh(geometry,mat[m]??m);
  mesh.position.set(x,y,z);
  mesh.rotation.set(rx,ry,rz);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  return mesh;
 };
 const box=(w,h,d,m,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>
  add(new THREE.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);
 const cyl=(top,bottom,h,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,segments=20)=>
  add(new THREE.CylinderGeometry(top,bottom,h,segments),m,x,y,z,rx,ry,rz);
 const ball=(r,m,x=0,y=0,z=0)=>add(new THREE.SphereGeometry(r,16,10),m,x,y,z);
 const bolt=(x,y,z)=>ball(.43,'bronze',x,y,z);
 const rod=(a,b,r,m)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
  const delta=end.clone().sub(start);
  const piece=add(new THREE.CylinderGeometry(r,r,delta.length(),10),m,
   (start.x+end.x)/2,(start.y+end.y)/2,(start.z+end.z)/2);
  piece.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  return piece;
 };
 // Common miniature mounting plinth: warm sandstone + dark structural metal.
 box(24,1.5,19,'frame',0,.75,0);
 box(22.4,.55,17.3,'bronze',0,1.75,0);
 box(21.4,.65,16.4,'black',0,2.27,0);
 for(const x of [-10,10])for(const z of [-7,7])bolt(x,2.75,z);

 if(kind==='armor1'||kind==='armor2'){
  // Layered sloped ballistic armor, exposed fasteners and welded ribs.
  box(17,1.5,9,'steel',0,4.4,0);
  const plates=kind==='armor2'?[[-4,-1.4],[0,.4],[4,2.2]]:[[0,.5]];
  for(const [x,z] of plates){
   box(kind==='armor2'?8:15,14,2.1,'armor',x,12,z,-.13,0,x*.012);
   box(kind==='armor2'?7.2:13,2.0,2.7,'steel',x,15,z+1.4,-.13);
   box(kind==='armor2'?1.0:1.7,10,2.4,'frame',x,11,z+1.1,-.13);
   for(const dx of kind==='armor2'?[-3,3]:[-6.4,6.4])
    for(const dy of [7.8,14.4])bolt(x+dx,dy,z+1.25);
  }
  if(kind==='armor2'){
   box(19,2,2,'bronze',0,7.8,4.2);
   box(19,2,2,'steel',0,17.9,1.2);
  }else{
   box(11,1.7,1,'blue',0,11.5,2.5);
   box(6,2.1,1,'steel',0,5.1,2);
  }
 }else if(kind==='precision'){
  // Realistic remote weapon/sight kit: long barrel, muzzle brake, mounted optic.
  box(16,3.7,7,'armor',0,8.1,0);
  box(12,2.1,8,'black',0,11.1,-.2);
  rod([0,10,0],[0,10,17],1.9,'steel');
  rod([0,10,10],[0,10,18],2.5,'black');
  for(const z of [12.5,15.5])box(5.1,1.7,1,'steel',0,10,z);
  cyl(2.7,2.7,5.2,'black',0,15,0,Math.PI/2);
  cyl(3.1,3.1,.9,'blue',0,15,3.2,Math.PI/2);
  rod([0,11,0],[0,14,0],1,'bronze');
  const sight=add(new THREE.TorusGeometry(5.9,.6,9,32),'bronze',0,15,5.5);
  sight.rotation.y=.16;
  rod([-4,15,5.5],[4,15,5.5],.38,'blue');
  rod([0,11,5.5],[0,19,5.5],.38,'blue');
 }else if(kind==='engines'){
  // Exposed diesel turbine/gearbox assembly with visible rotor blades.
  box(17,8,12,'armor',0,8.2,0);
  for(const z of [-5.5,5.5])box(18,1.5,1.2,'steel',0,8.2,z);
  cyl(6.7,6.7,10,'black',0,11.2,1,Math.PI/2);
  const front=add(new THREE.TorusGeometry(6.6,1.25,12,32),'bronze',0,11.2,6.6);
  front.rotation.z=.1;
  cyl(1.7,1.7,2,'blue',0,11.2,7.1,Math.PI/2);
  for(let i=0;i<9;i++){
   const a=i*Math.PI*2/9;
   box(1.3,5.2,.8,'steel',Math.cos(a)*3.3,11.2+Math.sin(a)*3.3,6.9,0,0,a+.4);
  }
  for(const x of [-5,0,5])box(2.3,2.4,10,'frame',x,13.5,-1.5);
  rod([-9,6,-2],[-9,11,3],.85,'bronze');
 }else if(kind==='infantryTraining'){
  // Tactical helmet with detailed band, cheek guards, antenna and chest rig.
  box(13,6,8,'armor',0,5.7,0);
  box(15,1.1,9,'black',0,9,0);
  const helmet=add(new THREE.SphereGeometry(7.8,28,16,0,Math.PI*2,0,Math.PI*.60),
   'armor',0,12.3,0);
  helmet.rotation.y=.1;
  box(15.3,1.7,11.9,'black',0,12.8,0);
  box(13.2,1.2,1.4,'bronze',0,13.1,6.3);
  box(6.6,1.5,1.8,'blue',0,13.4,7.1);
  for(const x of [-5.6,5.6]){
   box(2.5,8,3,'frame',x,7.8,0);
   box(2.4,4,1.2,'black',x,10,5.8);
  }
  rod([7,10,-2],[8.5,22,-2],.45,'steel');
  ball(1.3,'blue',8.5,22,-2);
 }else if(kind==='rocketDevelopment'){
  // Complete ballistic rocket with fin set, nozzle, propellant bands and cradle.
  box(11,2.1,12,'steel',0,4,0);
  cyl(4.3,4.3,14,'armor',0,13,0);
  cyl(4.8,4.8,2,'bronze',0,9,0);
  cyl(4.8,4.8,1.4,'blue',0,16.5,0);
  cyl(4.5,4.5,3.2,'black',0,6.5,0);
  add(new THREE.ConeGeometry(4.3,10,24),'armor',0,25,0);
  cyl(2.2,2.2,1,'red',0,30.7,0);
  for(let i=0;i<4;i++){
   const angle=i*Math.PI/2;
   const fin=box(2.3,6.5,8.2,'steel',0,9,6.4,0,0,0);
   fin.rotation.y=angle;
   fin.position.set(Math.sin(angle)*6.4,9,Math.cos(angle)*6.4);
  }
  for(const x of [-8,8])box(2.8,7,2.8,'frame',x,6,0);
 }else if(kind==='radar'){
  // Real radar array: tilted parabolic reflector, mast and blue receiver.
  box(15,4.5,11,'armor',0,5.1,0);
  cyl(2,3.5,12,'steel',0,12,0);
  const dish=add(new THREE.SphereGeometry(9,28,16,0,Math.PI*2,0,Math.PI*.48),
   'steel',0,19,0,-.55,0,0);
  dish.material.side=THREE.DoubleSide;
  const rim=add(new THREE.TorusGeometry(8.4,.6,10,36),'bronze',0,22,3,-.55);
  rim.rotation.z=.2;
  rod([0,20.2,0],[0,25,7],.6,'black');
  ball(1.6,'blue',0,25,7);
  for(const x of [-5,5])box(2.4,3.5,5,'black',x,7,0);
  box(8,1.4,2,'blue',0,5.8,5.8);
 }else if(kind==='tankArmor'){
  // Low profile armored turret, reactive side tiles and rifled steel cannon.
  box(20,3.2,14,'black',0,4.3,0);
  cyl(8,9.4,6.2,'armor',0,9.4,0,0,0,0,8);
  cyl(6.4,6.7,1.5,'steel',0,13.1,0,0,0,0,8);
  rod([0,10,1],[0,10,17],1.7,'steel');
  cyl(2.3,2.3,3,'black',0,10,17,Math.PI/2);
  for(const side of [-1,1])for(const z of [-4.2,0,4.2])
   box(2.1,3.4,3.3,'bronze',side*8,8.6,z);
  box(7,1.3,1.1,'blue',0,10,7.6);
  for(const x of [-6,6])ball(.7,'black',x,12,3);
 }else if(kind==='tankMobility'){
  // Full tracked drive segment: continuous rubber belt with road wheels.
  box(19,4.7,8,'armor',0,12.7,0);
  box(21,1.4,9,'bronze',0,15.6,0);
  for(const z of [-4.8,4.8]){
   const belt=add(new THREE.TorusGeometry(8,1.35,12,40),'rubber',0,8,z);
   belt.scale.y=.64;
   for(const x of [-6.1,-2.1,2.1,6.1]){
    cyl(2.6,2.6,1.7,'steel',x,7.5,z,Math.PI/2);
    cyl(1.0,1.0,1.9,'blue',x,7.5,z,Math.PI/2);
   }
   for(const x of [-8,-4,0,4,8])box(1.4,1.7,2.9,'bronze',x,3.9,z);
  }
  box(5.8,2.4,4,'black',0,17.1,0);
 }
 return root;
}
