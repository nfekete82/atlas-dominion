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
  // Charcoal combustion smoke, not the former flat white circles.
  g.addColorStop(0,'rgba(30,33,32,.82)');
  g.addColorStop(.29,'rgba(56,57,53,.79)');
  g.addColorStop(.56,'rgba(83,78,69,.45)');
  g.addColorStop(.82,'rgba(119,104,87,.16)');
  g.addColorStop(1,'rgba(141,119,95,0)');
 }else if(mode==='flame'){
  g.addColorStop(0,'rgba(255,255,242,1)');
  g.addColorStop(.17,'rgba(255,235,140,.98)');
  g.addColorStop(.33,'rgba(255,137,33,.89)');
  g.addColorStop(.56,'rgba(202,48,11,.55)');
  g.addColorStop(.78,'rgba(72,27,15,.19)');
  g.addColorStop(1,'rgba(57,18,11,0)');
 }else if(mode==='spark'){
  // Tiny bright metal impacts, never a flame ball or an explosion plume.
  g.addColorStop(0,'rgba(255,252,228,1)');
  g.addColorStop(.25,'rgba(255,224,123,.97)');
  g.addColorStop(.65,'rgba(255,171,62,.48)');
  g.addColorStop(1,'rgba(255,145,34,0)');
 }else if(mode==='dust'){
  g.addColorStop(0,'rgba(187,147,105,.55)');
  g.addColorStop(.39,'rgba(163,123,83,.41)');
  g.addColorStop(.72,'rgba(137,104,71,.17)');
  g.addColorStop(1,'rgba(120,92,65,0)');
 }else if(mode==='debris'){
  g.addColorStop(0,'rgba(54,50,44,.98)');
  g.addColorStop(.57,'rgba(45,41,35,.96)');
  g.addColorStop(.72,'rgba(32,29,26,.48)');
  g.addColorStop(1,'rgba(25,24,23,0)');
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
 // Stable, generated-once irregular wisps break up the radial-sprite look.
 // Texture-space only; no RNG consumed by gameplay or added frame draws.
 if(mode==='smoke'||mode==='dust'){
  for(let i=0;i<22;i++){
   const angle=i*2.399963229728653;
   const radius=12+Math.sqrt((i+.5)/22)*43;
   const px=64+Math.cos(angle)*radius,py=64+Math.sin(angle)*radius;
   const d=8+(i*7%17);
   const puff=ctx.createRadialGradient(px,py,0,px,py,d);
   puff.addColorStop(0,mode==='smoke'?'rgba(19,23,22,.19)':'rgba(79,60,43,.13)');
   puff.addColorStop(1,'rgba(0,0,0,0)');
   ctx.fillStyle=puff;ctx.fillRect(px-d,py-d,d*2,d*2);
  }
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 return texture;
}
function materialFor(mode,opacity){
 return new THREE.MeshBasicMaterial({
  map:radialTexture({mode}),transparent:true,opacity,depthWrite:false,
  alphaTest:.015,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,
  toneMapped:mode!=='flame'&&mode!=='spark'
 });
}
function makePool(scene,mode,max,opacity){
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),materialFor(mode,opacity),max);
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.frustumCulled=false;mesh.renderOrder=mode==='spark'?18:mode==='flame'?16:mode==='dust'?10:14;mesh.count=0;
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
 mesh.count=0; // zero particles must not draw the full inactive GPU pool
}
export class SandforgeCombatEffects {
 constructor({scene,camera,game,world,heightAt,pos,battlefield=null,lowQuality=false}){
  Object.assign(this,{scene,camera,game,world,heightAt,pos,battlefield,lowQuality});
  this.smoke=makePool(scene,'smoke',lowQuality?70:260,.68);
  this.flames=makePool(scene,'flame',lowQuality?28:120,.94);
  this.dust=makePool(scene,'dust',lowQuality?40:170,.50);
  this.sparks=makePool(scene,'spark',lowQuality?90:300,.96);
  this.debris=makePool(scene,'debris',lowQuality?42:120,.84);
  for(const pool of [this.smoke,this.flames,this.dust,this.sparks,this.debris])clearInstances(pool);
  this.scorch=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),materialFor('scorch',.93),lowQuality?70:210);
  this.scorch.geometry.rotateX(-Math.PI*.5);
  this.scorch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.scorch.count=0;this.scorch.frustumCulled=false;this.scorch.renderOrder=4;
  scene.add(this.scorch);
  this.scorchCount=0;
  // Vehicle grooves are a bounded cosmetic ring, never an unbounded
  // GPU workload that remains after a large battle.
  this.track=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),materialFor('track',.48),lowQuality?350:900);
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
  // Actual 3D torus shockwaves complement the existing GPU smoke and debris.
  this.shockwave=new THREE.InstancedMesh(
   new THREE.TorusGeometry(1,.075,6,42),
   new THREE.MeshBasicMaterial({color:'#f7ddb1',transparent:true,opacity:.63,
    depthWrite:false,depthTest:true,side:THREE.DoubleSide}),
   lowQuality?16:48
  );
  this.shockwave.geometry.rotateX(-Math.PI/2);
  this.shockwave.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.shockwave.frustumCulled=false;this.shockwave.count=0;
  this.shockwave.renderOrder=12;this.shockwave.name='3d-explosion-shockwaves';
  this.shockwave.userData={visualOnly:true,nonPlayable:true};
  scene.add(this.shockwave);this.shocks=[];
  // Real rockets, not instant rifle/MG tracers: each flying missile gets a
  // visible metal body, tapered warhead and luminous exhaust in world space.
  // Bounded instancing keeps draw calls fixed during mass artillery fire.
  const rocketLimit=lowQuality?32:64;
  const rocketMat=new THREE.MeshStandardMaterial({
   color:'#b7afa0',metalness:.57,roughness:.43,emissive:'#b47a32',emissiveIntensity:.17
  });
  const noseMat=new THREE.MeshStandardMaterial({
   color:'#d3caa7',metalness:.64,roughness:.37
  });
  const flameMat=new THREE.MeshBasicMaterial({
   color:'#ffa53a',blending:THREE.AdditiveBlending,transparent:true,
   opacity:.93,depthTest:true,depthWrite:false,toneMapped:false
  });
  this.rockets=new THREE.InstancedMesh(new THREE.CylinderGeometry(2.1,2.3,16,10),
   rocketMat,rocketLimit);
  this.rocketNoses=new THREE.InstancedMesh(new THREE.ConeGeometry(2.1,6,10),
   noseMat,rocketLimit);
  this.rocketExhaust=new THREE.InstancedMesh(new THREE.ConeGeometry(3,14,10),
   flameMat,rocketLimit);
  for(const item of [this.rockets,this.rocketNoses,this.rocketExhaust]){
   item.name='visual-3d-'+(item===this.rockets?'rocket-body':item===this.rocketNoses?'rocket-warhead':'rocket-exhaust');
   item.userData={visualOnly:true,nonPlayable:true,projectile:true};
   item.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   item.count=0;item.frustumCulled=false;scene.add(item);
  }
  this.rocketOrigins=new Map();this.rocketTrailAt=new Map();
  this.statsRocket={launched:0,visible:0};
  this.wreckCount=0;this.emitters=[];this.seenBlasts=new Set();this.seenShots=new WeakSet();
  this.lastUnits=new Map();
  this.seed=game.seed>>>0;this.frame=0;
  this.stats={blasts:0,impacts:0,scorch:0,tracks:0,wrecks:0,rockets:0};
  this.activeParticles=0;
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
 sparkAt(x,z,armored=false){
  if(!this.game.canSee(0,{x,y:z}))return;
  this.stats.impacts++;
  // Rifle, turret and tank MG hits get only a handful of short white-gold
  // pinpricks. Never create shockwaves, flames, prolonged smoke or scorches.
  const count=armored?5:3;
  for(let i=0;i<count;i++){
   const px=x+(this.rand()-.5)*8,pz=z+(this.rand()-.5)*8;
   this.particle(this.sparks,px,pz,this.heightAt(px,pz)+12+this.rand()*13,
    3.5+this.rand()*4.5,.09+this.rand()*.09,
    (this.rand()-.5)*28,(this.rand()-.5)*28,17+this.rand()*35);
  }
 }
 blastAt(x,z,strong=true){
  if(!this.game.canSee(0,{x,y:z}))return;
  this.stats.blasts++;
  const p=this.pos(x,z),width=strong?115:65;
  this.shocks.push({x,z,life:.62,ttl:.62,max:strong?115:64});
  if(this.shocks.length>this.shockwave.instanceMatrix.count)this.shocks.shift();
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
 // The simulation already supplies authoritative missiles and impact times.
 // This renderer interpolates their 3D trajectory without altering damage.
 rocketLaunchWorld(missile){
  const entry=this.battlefield?.units?.get(missile.source);
  const barrel=missile.id%6;
  const muzzle=missile.type==='antiArmor'
   ?entry?.detail?.getObjectByName('AtlasMuzzleTip')
   :entry?.rocketMuzzles?.[barrel]??
    entry?.detail?.getObjectByName('RocketMuzzle_'+barrel);
  if(muzzle&&entry?.node){
   entry.node.updateWorldMatrix(true,true);
   return muzzle.getWorldPosition(new THREE.Vector3());
  }
  const a=missile.angle??Math.atan2(
   missile.to.y-missile.from.y,missile.to.x-missile.from.x);
  const forward=missile.type==='antiArmor'?29:32;
  const x=missile.from.x+Math.cos(a)*forward;
  const z=missile.from.y+Math.sin(a)*forward;
  return this.pos(x,z,this.heightAt(missile.from.x,missile.from.y)+
   (missile.type==='antiArmor'?43:52));
 }
 updateRockets(active=true,subTick=0){
  const live=new Set();
  const up=new THREE.Vector3(0,1,0);
  let count=0;
  for(const missile of this.game.missiles){
   live.add(missile.id);
   if(!this.rocketOrigins.has(missile.id)){
    this.rocketOrigins.set(missile.id,this.rocketLaunchWorld(missile));
    this.statsRocket.launched++;
   }
   const duration=Math.max(.01,missile.impactAt-missile.at);
   const progress=clamp((this.game.time+(active?subTick:0)-missile.at)/duration,0,.999);
   const origin=this.rocketOrigins.get(missile.id);
   const target=this.pos(missile.to.x,missile.to.y,
    this.heightAt(missile.to.x,missile.to.y)+15);
   const displacement=target.clone().sub(origin);
   const arc=Math.min(120,Math.max(35,
    Math.hypot(missile.to.x-missile.from.x,missile.to.y-missile.from.y)*.14));
   const point=origin.clone().addScaledVector(displacement,progress);
   point.y+=Math.sin(progress*Math.PI)*arc;
   // Only render where the projectile itself is currently visible.
   const x=point.x+this.world.size*.5,z=point.z+this.world.size*.5;
   if(!this.game.canSee(0,{x,y:z}))continue;
   if(count>=this.rockets.instanceMatrix.count)break;
   const heading=displacement.clone();
   heading.y+=Math.cos(progress*Math.PI)*Math.PI*arc;
   heading.normalize();
   dummy.position.copy(point);
   dummy.quaternion.setFromUnitVectors(up,heading);
   dummy.scale.set(1,1,1);dummy.updateMatrix();
   this.rockets.setMatrixAt(count,dummy.matrix);
   dummy.position.copy(point).addScaledVector(heading,11);
   dummy.updateMatrix();this.rocketNoses.setMatrixAt(count,dummy.matrix);
   dummy.position.copy(point).addScaledVector(heading,-14);
   dummy.quaternion.setFromUnitVectors(up,heading.clone().negate());
   dummy.updateMatrix();this.rocketExhaust.setMatrixAt(count,dummy.matrix);
   count++;
   if(active&&this.game.time-(this.rocketTrailAt.get(missile.id)??-1)>.075){
    this.rocketTrailAt.set(missile.id,this.game.time);
    const tail=point.clone().addScaledVector(heading,-14);
    this.particle(this.smoke,tail.x+this.world.size*.5,
     tail.z+this.world.size*.5,tail.y,10+this.rand()*6,.65+this.rand()*.45,
     (this.rand()-.5)*8,(this.rand()-.5)*8,4+this.rand()*7);
   }
  }
  for(const mesh of [this.rockets,this.rocketNoses,this.rocketExhaust]){
   mesh.count=count;
   if(count)mesh.instanceMatrix.needsUpdate=true;
  }
  this.stats.rockets=count;this.statsRocket.visible=count;
  for(const id of this.rocketOrigins.keys())if(!live.has(id)){
   this.rocketOrigins.delete(id);this.rocketTrailAt.delete(id);
  }
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
   if(!shot.hit)continue;
   const p=shot.groundTo??shot.to;
   if(['cannon','rocket'].includes(shot.weapon))this.blastAt(p.x,p.y,false);
   else if(['turret','machinegun','rifle','heavy','pistol'].includes(shot.weapon))
    this.sparkAt(p.x,p.y,Boolean(shot.armored));
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
 update(dt,active=true,subTick=0){
  this.pollSimulation();
  this.updateRockets(active,subTick);
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
  this.shocks=this.shocks.filter(s=>(s.life-=dt)>0);
  let shockIndex=0;
  for(const shock of this.shocks){
   const progress=1-shock.life/shock.ttl;
   const radius=Math.max(1,shock.max*(.16+.84*progress));
   dummy.position.set(shock.x-this.world.size*.5,this.heightAt(shock.x,shock.z)+3,
    shock.z-this.world.size*.5);
   dummy.rotation.set(0,0,0);
   dummy.scale.setScalar(radius);
   dummy.updateMatrix();this.shockwave.setMatrixAt(shockIndex++,dummy.matrix);
  }
  this.shockwave.count=shockIndex;
  if(shockIndex)this.shockwave.instanceMatrix.needsUpdate=true;
  for(const pool of [this.smoke,this.flames,this.dust,this.sparks]){
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
   pool.mesh.count=k;
   // Avoid uploading a large instance matrix when nothing is left to draw.
   if(k||pool.mesh.instanceMatrix.needsUpdate)pool.mesh.instanceMatrix.needsUpdate=true;
  }
  this.activeParticles=this.particleCount;
 }
 get particleCount(){return this.smoke.particles.length+this.flames.particles.length+this.dust.particles.length+this.sparks.particles.length;}
}
const worldIndex=(world,x,z)=>world.index({x,y:z});
