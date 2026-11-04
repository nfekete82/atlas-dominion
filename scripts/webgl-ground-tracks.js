import * as THREE from 'three';

// Ephemeral footsteps and two-track vehicle impressions. All data stays in
// this presentation module: no save schema changes, gameplay colliders,
// visibility leaks or per-footprint mesh allocations.
function stampTexture(type){
 const canvas=document.createElement('canvas');
 canvas.width=64;canvas.height=128;
 const ctx=canvas.getContext('2d');
 if(type==='foot'){
  const print=(x,y,w,h)=>{
   const grad=ctx.createRadialGradient(x,y,2,x,y,h*.72);
   grad.addColorStop(0,'rgba(67,42,21,.83)');
   grad.addColorStop(.65,'rgba(78,48,24,.54)');
   grad.addColorStop(1,'rgba(78,48,24,0)');
   ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fill();
  };
  // A heel, sole and toe in a single small imprint.
  print(32,81,13,22);print(32,52,15,16);
 }else{
  const grad=ctx.createLinearGradient(0,0,64,0);
  grad.addColorStop(0,'rgba(81,53,29,0)');
  grad.addColorStop(.19,'rgba(69,43,25,.60)');
  grad.addColorStop(.5,'rgba(50,33,21,.70)');
  grad.addColorStop(.81,'rgba(69,43,25,.60)');
  grad.addColorStop(1,'rgba(81,53,29,0)');
  ctx.fillStyle=grad;ctx.fillRect(6,4,52,120);
  for(let y=7;y<128;y+=17){
   ctx.fillStyle='rgba(226,180,103,.22)';
   ctx.fillRect(12,y,40,3);
  }
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=THREE.LinearFilter;
 texture.magFilter=THREE.LinearFilter;
 return texture;
}
function markPool(scene,type,capacity,ttl,opacity){
 const geometry=new THREE.PlaneGeometry(1,1);
 geometry.rotateX(-Math.PI/2);
 const fading=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);
 fading.setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('instanceFade',fading);
 const material=new THREE.ShaderMaterial({
  uniforms:{stamp:{value:stampTexture(type)},baseAlpha:{value:opacity}},
  vertexShader:`
   attribute float instanceFade;
   varying vec2 vUv;
   varying float vFade;
   void main(){
    vUv=uv;
    vFade=instanceFade;
    vec4 localPosition=vec4(position,1.0);
    #ifdef USE_INSTANCING
     localPosition=instanceMatrix*localPosition;
    #endif
    gl_Position=projectionMatrix*modelViewMatrix*localPosition;
   }`,
  fragmentShader:`
   uniform sampler2D stamp;
   uniform float baseAlpha;
   varying vec2 vUv;
   varying float vFade;
   void main(){
    vec4 ink=texture2D(stamp,vUv);
    gl_FragColor=vec4(ink.rgb,ink.a*baseAlpha*vFade);
   }`,
  transparent:true,depthWrite:false,depthTest:true,
  side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2
 });
 const mesh=new THREE.InstancedMesh(geometry,material,capacity);
 mesh.name=type==='foot'?'visual-moving-footprints':'visual-moving-vehicle-tracks';
 mesh.userData={visualOnly:true,nonPlayable:true,fadingSandTracks:true};
 mesh.frustumCulled=false;mesh.count=0;mesh.renderOrder=5;
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 scene.add(mesh);
 return {mesh,capacity,ttl,fading,born:new Float32Array(capacity),
   next:0,total:0};
}
export class SandforgeGroundTracks{
 constructor({scene,game,pos,heightAt,lite=false}){
  Object.assign(this,{scene,game,pos,heightAt});
  this.clock=0;this.last=new Map();
  this.foot=markPool(scene,'foot',lite?700:1700,15,.65);
  this.vehicle=markPool(scene,'vehicle',lite?850:2200,24,.64);
  this.pool=[this.foot,this.vehicle];
  this.dummy=new THREE.Object3D();
  this.maxTrailSpan=140;
 }
 put(pool,x,z,heading,width,length){
  const slot=pool.next;
  const dummy=this.dummy;
  dummy.position.copy(this.pos(x,z,this.heightAt(x,z)+.85));
  dummy.rotation.set(0,heading,0);
  dummy.scale.set(width,1,length);
  dummy.updateMatrix();
  pool.mesh.setMatrixAt(slot,dummy.matrix);
  pool.born[slot]=this.clock;
  pool.fading.setX(slot,1);
  pool.next=(slot+1)%pool.capacity;
  pool.total=Math.min(pool.capacity,pool.total+1);
  pool.mesh.count=pool.total;
  pool.mesh.instanceMatrix.needsUpdate=true;
  pool.fading.needsUpdate=true;
 }
 capture(){
  const alive=new Set();
  for(const unit of this.game.units){
   if(unit.hp<=0||unit.carrier||unit.owner!==0||
    unit.kind==='scout'||unit.kind==='bomber')continue;
   alive.add(unit.id);
   const last=this.last.get(unit.id);
   const now={x:unit.x,y:unit.y,carry:last?.carry??0,foot:last?.foot??0};
   this.last.set(unit.id,now);
   if(!last)continue;
   const dx=now.x-last.x,dz=now.y-last.y,d=Math.hypot(dx,dz);
   if(d<.01||d>this.maxTrailSpan)continue; // stationary or teleported
   const vehicle=['rover','tank','artillery'].includes(unit.kind);
   const interval=vehicle?19:11;
   const heading=Math.atan2(dx,dz);
   let distance=interval-last.carry;
   if(distance<.001)distance=interval;
   while(distance<=d){
    const t=distance/d,x=last.x+dx*t,z=last.y+dz*t;
    const sideways={x:Math.cos(heading),z:-Math.sin(heading)};
    if(vehicle){
     const offset=unit.kind==='rover'?17:unit.kind==='tank'?22:23;
     const width=unit.kind==='rover'?5:10;
     for(const side of [-1,1])this.put(this.vehicle,
      x+side*offset*sideways.x,z+side*offset*sideways.z,
      heading,width,interval+3);
    }else{
     const side=now.foot%2===0?-1:1;
     this.put(this.foot,x+side*4*sideways.x,z+side*4*sideways.z,
      heading,6,13);
     now.foot++;
    }
    distance+=interval;
   }
   now.carry=(last.carry+d)%interval;
  }
  for(const id of this.last.keys())if(!alive.has(id))this.last.delete(id);
 }
 update(dt,active=true){
  if(active)this.clock+=Math.max(0,Math.min(dt,.15));
  for(const pool of this.pool){
   if(!pool.total)continue;
   const a=pool.fading.array;
   let changed=false;
   for(let i=0;i<pool.total;i++){
    const t=Math.max(0,1-(this.clock-pool.born[i])/pool.ttl);
    const opacity=t*t;
    if(Math.abs(a[i]-opacity)>.006){a[i]=opacity;changed=true;}
   }
   if(changed)pool.fading.needsUpdate=true;
  }
 }
 dispose(){
  for(const pool of this.pool){
   this.scene.remove(pool.mesh);
   pool.mesh.material.uniforms.stamp.value.dispose();
   pool.mesh.material.dispose();pool.mesh.geometry.dispose();
  }
  this.last.clear();
 }
}
