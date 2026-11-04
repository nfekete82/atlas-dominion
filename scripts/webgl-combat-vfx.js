import * as THREE from 'three';

const vehicleKinds=new Set(['tank','rover','artillery']);
const trackedKinds=new Set(['tank','artillery']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// Static canvas-generated textures are copied to the GPU once, not rebuilt
// during battle. No gameplay RNG, navigation cells or saved state are touched.
function radialTexture({inner='#ffffff',outer='#ffffff',mode='smoke'}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d');
 const g=ctx.createRadialGradient(64,64,0,64,64,63);
 if(mode==='smoke'){
  g.addColorStop(0,'rgba(244,241,229,.94)');
  g.addColorStop(.34,'rgba(242,238,224,.86)');
  g.addColorStop(.66,'rgba(230,226,211,.39)');
  g.addColorStop(1,'rgba(210,205,190,0)');
 }else if(mode==='flame'){
  g.addColorStop(0,'rgba(255,255,219,1)');
  g.addColorStop(.27,'rgba(255,211,76,.96)');
  g.addColorStop(.51,'rgba(248,91,25,.68)');
  g.addColorStop(.78,'rgba(122,32,12,.2)');
  g.addColorStop(1,'rgba(80,19,8,0)');
 }else if(mode==='dust'){
  g.addColorStop(0,'rgba(229,198,152,.62)');
  g.addColorStop(.38,'rgba(212,177,136,.40)');
  g.addColorStop(1,'rgba(205,168,131,0)');
 }else if(mode==='scorch'){
  g.addColorStop(0,'rgba(48,36,28,.85)');
  g.addColorStop(.25,'rgba(58,40,29,.76)');
  g.addColorStop(.56,'rgba(73,47,31,.40)');
  g.addColorStop(.85,'rgba(98,64,40,.13)');
  g.addColorStop(1,'rgba(112,75,46,0)');
 }else{
  g.addColorStop(0,'rgba(69,48,33,.85)');
  g.addColorStop(.5,'rgba(80,55,37,.5)');
  g.addColorStop(1,'rgba(104,73,44,0)');
 }
 ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 return texture;
}
function materialFor(mode,opacity){
 return new THREE.MeshBasicMaterial({
  map:radialTexture({mode}),transparent:true,opacity,depthWrite:false,
  alphaTest:.015,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,
  toneMapped:mode!=='flame'
 });
}
function makePool(scene,mode,max,opacity){
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),materialFor(mode,opacity),max);
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.frustumCulled=false;mesh.renderOrder=mode==='flame'?16:mode==='dust'?10:14;mesh.count=0;
 scene.add(mesh);
 return {mesh,particles:[],max,mode};
}
const dummy=new THREE.Object3D();
const emptyMatrix=(()=>{
 const d=new THREE.Object3D();d.scale.setScalar(.00001);d.updateMatrix();return d.matrix;
})();
function clearInstances(pool){
 const {mesh}=pool;mesh.count=pool.max;
 for(let i=0;i<pool.max;i++)mesh.setMatrixAt(i,emptyMatrix);
 mesh.instanceMatrix.needsUpdate=true;
}
export class SandforgeCombatEffects {
 constructor({scene,camera,game,world,heightAt,pos,lowQuality=false}){
  Object.assign(this,{scene,camera,game,world,heightAt,pos,lowQuality});
  this.smoke=makePool(scene,'smoke',lowQuality?70:260,.68);
  this.flames=makePool(scene,'flame',lowQuality?28:120,.94);
  this.dust=makePool(scene,'dust',lowQuality?40:170,.50);
  for(const pool of [this.smoke,this.flames,this.dust])clearInstances(pool);
  this.scorch=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),materialFor('scorch',.93),lowQuality?70:210);
  this.scorch.geometry.rotateX(-Math.PI*.5);
  this.scorch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.scorch.count=0;this.scorch.frustumCulled=false;this.scorch.renderOrder=4;
  scene.add(this.scorch);
  this.scorchCount=0;
  this.track=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),materialFor('track',.48),lowQuality?450:2400);
  this.track.geometry.rotateX(-Math.PI*.5);
  this.track.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.track.count=0;this.track.frustumCulled=false;this.track.renderOrder=3;
  scene.add(this.track);
  this.trackCount=0;
  const wreckMat=new THREE.MeshStandardMaterial({color:'#3d3d39',roughness:.92,metalness:.38});
  this.wreckHull=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),wreckMat,90);
  this.wreckTurret=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),wreckMat,90);
  for(const mesh of [this.wreckHull,this.wreckTurret]){
   mesh.count=0;mesh.castShadow=false;mesh.receiveShadow=true;scene.add(mesh);
  }
  this.wreckCount=0;this.emitters=[];this.seenBlasts=new Set();this.seenShots=new WeakSet();
  this.lastUnits=new Map();
  this.seed=game.seed>>>0;this.frame=0;
  this.stats={blasts:0,scorch:0,tracks:0,wrecks:0};
  for(const u of game.units)if(u.hp>0&&!u.carrier)this.lastUnits.set(u.id,{x:u.x,y:u.y,kind:u.kind,owner:u.owner,angle:u.angle});
 }
 rand(){
  let n=this.seed=(this.seed+0x6d2b79f5)>>>0;
  n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
  return ((n^(n>>>14))>>>0)/4294967296;
 }
 particle(pool,x,z,y,size,life,vx=0,vz=0,vy=0){
  if(pool.particles.length>=pool.max)pool.particles.shift();
  pool.particles.push({x,z,y,size,life,ttl:life,vx,vz,vy,angle:(this.rand()-.5)*.45});
 }
 blastAt(x,z,strong=true){
  if(!this.game.canSee(0,{x,y:z}))return;
  this.stats.blasts++;
  const p=this.pos(x,z),width=strong?115:65;
  this.placeScorch(x,z,width);
  const fires=strong?13:6,smokes=strong?19:9;
  for(let i=0;i<fires;i++){
   const angle=this.rand()*6.283,radius=this.rand()*(strong?36:18);
   const fx=x+Math.cos(angle)*radius,fz=z+Math.sin(angle)*radius;
   this.particle(this.flames,fx,fz,this.heightAt(fx,fz)+8,18+this.rand()*33,.35+this.rand()*.7,
    (this.rand()-.5)*12,(this.rand()-.5)*12,28+this.rand()*45);
  }
  for(let i=0;i<smokes;i++){
   const angle=this.rand()*6.283,radius=this.rand()*(strong?40:22);
   const fx=x+Math.cos(angle)*radius,fz=z+Math.sin(angle)*radius;
   this.particle(this.smoke,fx,fz,this.heightAt(fx,fz)+20,20+this.rand()*37,1.9+this.rand()*3.2,
    (this.rand()-.5)*15,(this.rand()-.5)*15,18+this.rand()*30);
  }
  this.emitters.push({x,z,life:strong?6:3.5,frequency:strong?.22:.35,clock:0});
  if(this.emitters.length>24)this.emitters.shift();
 }
 placeScorch(x,z,size){
  const at=this.scorchCount++%this.scorch.instanceMatrix.count;
  dummy.position.set(x-this.world.size*.5,this.heightAt(x,z)+1.25,z-this.world.size*.5);
  dummy.rotation.set(0,(this.rand()-.5)*.7,0);dummy.scale.set(size,size,1);
  dummy.updateMatrix();this.scorch.setMatrixAt(at,dummy.matrix);
  this.scorch.count=Math.min(this.scorch.instanceMatrix.count,Math.max(this.scorch.count,at+1));
  this.scorch.instanceMatrix.needsUpdate=true;this.stats.scorch++;
 }
 tracksFor(u,old){
  if(!vehicleKinds.has(u.kind)||!u.moving||!this.game.canSee(0,u))return;
  const len=distance(u,old);
  if(len<18||len>210)return;
  const angle=Math.atan2(u.x-old.x,u.y-old.y);
  const offset=trackedKinds.has(u.kind)?16:13;
  for(const side of [-1,1]){
   const x=u.x+Math.cos(angle)*offset*side,z=u.y-Math.sin(angle)*offset*side;
   const i=worldIndex(this.world,x,z);
   if(i<0||this.world.blocked[i])continue;
   const at=this.trackCount++%this.track.instanceMatrix.count;
   dummy.position.set(x-this.world.size*.5,this.heightAt(x,z)+1.15,z-this.world.size*.5);
   dummy.rotation.set(0,angle,0);dummy.scale.set(5.5,22,1);dummy.updateMatrix();
   this.track.setMatrixAt(at,dummy.matrix);
   this.track.count=Math.min(this.track.instanceMatrix.count,Math.max(this.track.count,at+1));
   this.track.instanceMatrix.needsUpdate=true;this.stats.tracks++;
  }
  if(this.dust.particles.length<this.dust.max-8&&this.rand()>.55){
   const x=u.x,z=u.y;this.particle(this.dust,x,z,this.heightAt(x,z)+9,18+this.rand()*20,
    .65+this.rand()*.65,(this.rand()-.5)*9,(this.rand()-.5)*9,7+this.rand()*13);
  }
 }
 addWreck(u){
  if(!vehicleKinds.has(u.kind))return;
  if(this.wreckCount>=this.wreckHull.instanceMatrix.count)return;
  const at=this.wreckCount++,p=this.pos(u.x,u.y),yaw=u.angle||0;
  dummy.position.copy(p);dummy.position.y+=6;dummy.rotation.set(0,yaw,.06);
  dummy.scale.set(45,13,u.kind==='rover'?56:76);dummy.updateMatrix();
  this.wreckHull.setMatrixAt(at,dummy.matrix);
  dummy.position.copy(p);dummy.position.y+=16;dummy.rotation.set(0,yaw+.17,.19);
  dummy.scale.set(25,9,25);dummy.updateMatrix();
  this.wreckTurret.setMatrixAt(at,dummy.matrix);
  for(const mesh of [this.wreckHull,this.wreckTurret]){mesh.count=at+1;mesh.instanceMatrix.needsUpdate=true;}
  this.stats.wrecks++;
  this.blastAt(u.x,u.y,true);
 }
 pollSimulation(){
  for(const blast of this.game.blasts){
   const key=String(blast.id)+'@'+String(blast.at);
   if(this.seenBlasts.has(key))continue;
   this.seenBlasts.add(key);
   if(this.seenBlasts.size>1500)this.seenBlasts.clear();
   this.blastAt(blast.x,blast.y,true);
  }
  for(const shot of this.game.shots){
   if(this.seenShots.has(shot))continue;
   this.seenShots.add(shot);
   if(!shot.hit||!['cannon','rocket','turret'].includes(shot.weapon))continue;
   const p=shot.groundTo??shot.to;
   this.blastAt(p.x,p.y,false);
  }
  const next=new Map();
  for(const u of this.game.units){
   if(u.hp<=0||u.carrier)continue;
   const old=this.lastUnits.get(u.id),current={x:u.x,y:u.y,angle:u.angle,kind:u.kind,owner:u.owner};
   if(old)this.tracksFor(u,old);
   next.set(u.id,current);
  }
  for(const [id,old] of this.lastUnits){
   if(next.has(id))continue;
   const found=this.game.units.find(u=>u.id===id);
   if(found?.carrier)continue; // boarding a transport is not a death
   if(this.game.canSee(0,{x:old.x,y:old.y}))this.addWreck(old);
  }
  this.lastUnits=next;
 }
 update(dt,active=true){
  this.pollSimulation();
  if(!active)return;
  this.frame++;
  for(const emitter of this.emitters){
   emitter.life-=dt;emitter.clock+=dt;
   while(emitter.clock>=emitter.frequency&&emitter.life>0){
    emitter.clock-=emitter.frequency;
    const x=emitter.x+(this.rand()-.5)*28,z=emitter.z+(this.rand()-.5)*28;
    this.particle(this.smoke,x,z,this.heightAt(x,z)+18,28+this.rand()*30,2+this.rand()*2,
      (this.rand()-.5)*14,(this.rand()-.5)*14,26+this.rand()*36);
    if(this.rand()>.74)this.particle(this.flames,x,z,this.heightAt(x,z)+7,15+this.rand()*21,.35+this.rand()*.55,0,0,15);
   }
  }
  this.emitters=this.emitters.filter(e=>e.life>0);
  for(const pool of [this.smoke,this.flames,this.dust]){
   const alive=[];let k=0;
   for(const p of pool.particles){
    p.life-=dt;
    if(p.life<=0)continue;
    p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
    const progress=clamp(p.life/p.ttl,0,1);
    const scale=p.size*(.65+(1-progress)*1.25)*Math.min(1,progress*4);
    dummy.position.set(p.x-this.world.size*.5,p.y,p.z-this.world.size*.5);
    dummy.quaternion.copy(this.camera.quaternion);
    dummy.scale.set(scale,scale,1);dummy.updateMatrix();
    pool.mesh.setMatrixAt(k++,dummy.matrix);alive.push(p);
   }
   pool.particles=alive;
   pool.mesh.count=k;pool.mesh.instanceMatrix.needsUpdate=true;
  }
 }
 get particleCount(){return this.smoke.particles.length+this.flames.particles.length+this.dust.particles.length;}
}
const worldIndex=(world,x,z)=>world.index({x,y:z});
