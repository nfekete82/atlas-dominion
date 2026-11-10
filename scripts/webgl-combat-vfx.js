import * as THREE from 'three';
import {UNITS} from '/src/reborn/catalog.js';
import {hitResponseFor,impactHeight,damagedVehicleIntensity} from '/webgl-hit-response.js';
import {addWreckRecord,advanceWreckRecords,wreckSink,WRECK_CAP,
 WRECK_CAP_LITE,CRASH_CAP,CRASH_LIFETIME_SECONDS,isWreckableUnit,
 isAircraftWreck} from '/webgl-wreck-lifecycle.js';
import {guidedRocketAimY,aircraftAimOffsetY,adoptAircraftForCrash,disposeAircraftCrash} from '/webgl-aircraft-effects.js';

const vehicleKinds=new Set(['tank','rover','artillery']);
const trackedKinds=new Set(['tank','artillery']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// Static canvas-generated textures are copied to the GPU once, not rebuilt
// during battle. No gameplay RNG, navigation cells or saved state are touched.
function radialTexture({inner='#ffffff',outer='#ffffff',mode='smoke',biome='desert'}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d');
 const g=ctx.createRadialGradient(64,64,0,64,64,63);
 if(mode==='flash'){
  // The blinding detonation core is deliberately brief; smoke and terrain
  // dust supply the long-lived shape, rather than one oversized fireball.
  g.addColorStop(0,'rgba(255,255,246,1)');
  g.addColorStop(.19,'rgba(255,250,205,.98)');
  g.addColorStop(.40,'rgba(255,197,91,.78)');
  g.addColorStop(.68,'rgba(251,106,28,.29)');
  g.addColorStop(1,'rgba(255,101,27,0)');
 }else if(mode==='smoke'){
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
  // Impact dust is snow powder or humid dark soil, not desert sand.
  const tones=biome==='snow'
   ?['rgba(243,249,253,.60)','rgba(211,226,238,.44)','rgba(172,190,205,.17)','rgba(156,171,184,0)']
   :biome==='jungle'
    ?['rgba(158,149,103,.60)','rgba(121,116,80,.44)','rgba(89,93,66,.17)','rgba(74,83,59,0)']
    :['rgba(187,147,105,.55)','rgba(163,123,83,.41)','rgba(137,104,71,.17)','rgba(120,92,65,0)'];
  g.addColorStop(0,tones[0]);g.addColorStop(.39,tones[1]);
  g.addColorStop(.72,tones[2]);g.addColorStop(1,tones[3]);
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
 if(mode==='scorch'){
  // Eroded char and displaced sand should never read as a perfectly round
  // black sticker. This deterministic alpha relief is generated only once.
  const pixels=ctx.getImageData(0,0,128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const dx=x-64,dy=y-64,theta=Math.atan2(dy,dx);
   const radius=Math.hypot(dx,dy);
   const edge=52+4*Math.sin(theta*7+.6)+3*Math.sin(theta*13-1.3);
   const erosion=Math.max(0,Math.min(1,(edge-radius)/7));
   const grit=.78+.12*Math.sin(x*.83+y*.39)+.10*Math.cos(x*.47-y*.62);
   const a=(y*128+x)*4+3;
   pixels.data[a]=Math.round(pixels.data[a]*erosion*Math.max(.35,grit));
  }
  ctx.putImageData(pixels,0,0);
 }
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
function materialFor(mode,opacity,biome='desert'){
 return new THREE.MeshBasicMaterial({
  map:radialTexture({mode,biome}),transparent:true,opacity,depthWrite:false,
  alphaTest:.015,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,
  toneMapped:mode!=='flame'&&mode!=='spark'&&mode!=='flash'
 });
}
function makePool(scene,mode,max,opacity,biome='desert'){
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),materialFor(mode,opacity,biome),max);
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.frustumCulled=false;mesh.renderOrder=mode==='flash'?19:mode==='spark'?18:mode==='flame'?16:mode==='dust'?10:14;mesh.count=0;
 mesh.name='visual-combat-'+mode;
 mesh.userData={visualOnly:true,nonPlayable:true,combatParticles:true,mode};
 mesh.raycast=()=>{};
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
 constructor({scene,camera,game,world,heightAt,pos,battlefield=null,lowQuality=false,biome='desert'}){
  Object.assign(this,{scene,camera,game,world,heightAt,pos,battlefield,lowQuality});
  this.smoke=makePool(scene,'smoke',lowQuality?70:260,.68);
  this.flash=makePool(scene,'flash',lowQuality?16:48,.86);
  this.flames=makePool(scene,'flame',lowQuality?28:120,.94);
  this.dust=makePool(scene,'dust',lowQuality?40:170,.50,biome);
  this.sparks=makePool(scene,'spark',lowQuality?90:300,.96);
  this.debris=makePool(scene,'debris',lowQuality?42:120,.84);
  for(const pool of [this.smoke,this.flash,this.flames,this.dust,this.sparks,this.debris])clearInstances(pool);
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
  // The former black rectangular "wrecks" were permanently retained
  // BoxGeometry slabs with no clean-up. Build identifiable charred hulls,
  // turrets and broken barrels from a capped instanced 3D pool instead.
  const wreckLimit=lowQuality?WRECK_CAP_LITE:WRECK_CAP;
  this.wreckMat=new THREE.MeshStandardMaterial({
   color:'#85745d',roughness:.94,metalness:.17,flatShading:true
  });
  this.wreckMetal=new THREE.MeshStandardMaterial({
   color:'#494b42',roughness:.88,metalness:.30,flatShading:true
  });
  this.wreckHull=new THREE.InstancedMesh(
   new THREE.CylinderGeometry(.86,1,1,10,1),this.wreckMat,wreckLimit);
  this.wreckTurret=new THREE.InstancedMesh(
   new THREE.DodecahedronGeometry(1,0),this.wreckMetal,wreckLimit);
  this.wreckBarrel=new THREE.InstancedMesh(
   new THREE.CylinderGeometry(1,1,1,7),this.wreckMetal,wreckLimit);
  for(const mesh of [this.wreckHull,this.wreckTurret,this.wreckBarrel]){
   mesh.name='visual-burned-vehicle-'+
    (mesh===this.wreckHull?'hull':mesh===this.wreckTurret?'turret':'barrel');
   mesh.userData={visualOnly:true,nonPlayable:true,wreck:true};
   mesh.raycast=()=>{};
   mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=false;
   mesh.receiveShadow=true;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   scene.add(mesh);
  }
  this.wrecks=[];
  this.wreckSync=0;
  this.crashes=[];
  // Crashes reuse the real textured aircraft actor; no gray proxy meshes.
  this.capturedAircraftIds=new Set();
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
  // One cheap pooled mesh per simultaneously falling bomb: the authoritative
  // simulation missile supplies trajectory, timing, ground impact and damage.
  this.bombBodies=new THREE.InstancedMesh(
   new THREE.CylinderGeometry(4.2,4.4,16,12),
   new THREE.MeshStandardMaterial({color:'#373d3c',metalness:.58,roughness:.51}),24
  );
  this.bombBodies.name='visual-3d-falling-bombs';
  this.bombBodies.userData={visualOnly:true,nonPlayable:true,projectile:true};
  this.bombBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.bombBodies.count=0;this.bombBodies.frustumCulled=false;
  scene.add(this.bombBodies);
  this.rocketOrigins=new Map();this.rocketTrailAt=new Map();
  this.statsRocket={launched:0,visible:0};
  this.wreckCount=0;this.emitters=[];this.seenBlasts=new Set();this.seenShots=new WeakSet();
  this.lastUnits=new Map();
  this.seed=game.seed>>>0;this.frame=0;
  this.stats={blasts:0,impacts:0,scorch:0,tracks:0,wrecks:0,rockets:0};
  this.lastUnitPollTime=NaN;
  this.lastDamageSmoke=new Map();this.lastDamageSmokeSweep=0;
  this.activeParticles=0;
  for(const u of game.units)if(u.hp>0&&!u.carrier)this.lastUnits.set(u.id,{x:u.x,y:u.y,kind:u.kind,owner:u.owner,angle:u.angle,flightHeight:u.flightHeight??1});
 }
 rand(){
  let n=this.seed=(this.seed+0x6d2b79f5)>>>0;
  n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
  return ((n^(n>>>14))>>>0)/4294967296;
 }
 particle(pool,x,z,y,size,life,vx=0,vz=0,vy=0){
  if(pool.particles.length>=pool.max)pool.particles.shift();
  pool.particles.push({x,z,y,size,life,ttl:life,vx,vz,vy,
   floor:pool.mode==='debris'?y-7:undefined,angle:(this.rand()-.5)*.45});
 }
 impactAt(shot){
  const p=shot.groundTo??shot.to;
  if(!this.game.canSee(0,{x:p.x,y:p.y}))return;
  const response=hitResponseFor(shot);
  if(response.kind==='explosion'){
   this.blastAt(p.x,p.y,false);
   return;
  }
  this.stats.impacts++;
  const impactGround=this.heightAt(p.x,p.y);
  const from=shot.groundFrom??shot.from;
  const dirX=p.x-from.x,dirZ=p.y-from.y,len=Math.max(1,Math.hypot(dirX,dirZ));
  const nx=dirX/len,nz=dirZ/len;
  const armored=response.kind==='armor';
  const height=impactGround+(armored?impactHeight(shot):7);
  // Metal makes sharp bright ricochets and flying chips. Sand kicks up
  // low ochre dust. Infantry hits never create a giant fireball or splat.
  for(let i=0;i<response.sparkCount;i++){
   const a=this.rand()*Math.PI*2;
   const side=armored?22:8;
   const vx=Math.cos(a)*(18+this.rand()*side)+nx*(armored?17:5);
   const vz=Math.sin(a)*(18+this.rand()*side)+nz*(armored?17:5);
   this.particle(this.sparks,p.x+(this.rand()-.5)*7,
    p.y+(this.rand()-.5)*7,height+this.rand()*6,
    armored?2.9+this.rand()*4:2.4+this.rand()*2.3,
    .08+this.rand()*(armored?.17:.07),vx,vz,armored?27+this.rand()*46:15);
  }
  for(let i=0;i<response.chipCount;i++){
   const a=this.rand()*Math.PI*2;
   this.particle(this.debris,p.x,p.y,height+2,
    2+this.rand()*3,.23+this.rand()*.27,
    Math.cos(a)*(23+this.rand()*38)+nx*17,
    Math.sin(a)*(23+this.rand()*38)+nz*17,25+this.rand()*40);
  }
  for(let i=0;i<response.dustCount;i++){
   const a=this.rand()*Math.PI*2;
   this.particle(this.dust,p.x+(this.rand()-.5)*9,p.y+(this.rand()-.5)*9,
    impactGround+3,armored?8+this.rand()*7:11+this.rand()*15,
    .20+this.rand()*.20,Math.cos(a)*18,Math.sin(a)*18,4+this.rand()*9);
  }
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
  // A single precise terrain sample is sufficient for a 25-unit visual
  // particle burst. Previously a bombing run triggered 50+ expensive
  // procedural terrain samples synchronously on the impact frame.
  const impactGround=this.heightAt(x,z);
  const size=strong?115:65;
  // Real blast stages: short hot core, outward dirt ring, dark buoyant
  // combustion clouds, and thrown fragments. Everything is pooled,
  // visual-only and disappears; it cannot grow per simulated minute.
  // Cache the impact's ground height: the shockwave must not re-sample
  // procedural terrain every animation frame during a bomber carpet strike.
  this.shocks.push({x,z,y:impactGround+3,life:.49,ttl:.49,max:strong?110:59});
  if(this.shocks.length>this.shockwave.instanceMatrix.count)this.shocks.shift();
  this.placeScorch(x,z,size);
  // First 120 ms: bright ignition front. Subsequent frames are dust,
  // airborne fragments and rolling dark combustion smoke.
  this.particle(this.flash,x,z,impactGround+(strong?31:21),
   strong?96:58,.12,0,0,0);
  const fires=strong?11:6,smokes=strong?16:9,dust=strong?15:8;
  for(let i=0;i<fires;i++){
   const a=this.rand()*Math.PI*2,r=Math.sqrt(this.rand())*(strong?25:13);
   const fx=x+Math.cos(a)*r,fz=z+Math.sin(a)*r;
   this.particle(this.flames,fx,fz,impactGround+5,
    12+this.rand()*22,.19+this.rand()*.38,
    Math.cos(a)*(8+this.rand()*16),Math.sin(a)*(8+this.rand()*16),
    26+this.rand()*35);
  }
  for(let i=0;i<smokes;i++){
   const a=this.rand()*Math.PI*2,r=this.rand()*(strong?27:15);
   const fx=x+Math.cos(a)*r,fz=z+Math.sin(a)*r;
   this.particle(this.smoke,fx,fz,impactGround+14,
    14+this.rand()*28,1.45+this.rand()*2.15,
    Math.cos(a)*(5+this.rand()*18),Math.sin(a)*(5+this.rand()*18),
    21+this.rand()*33);
  }
  for(let i=0;i<dust;i++){
   const a=i*Math.PI*2/dust+(this.rand()-.5)*.25;
   const speed=strong?90:55,fx=x+Math.cos(a)*6,fz=z+Math.sin(a)*6;
   this.particle(this.dust,fx,fz,impactGround+5,
    10+this.rand()*23,.48+this.rand()*.55,
    Math.cos(a)*(speed+this.rand()*35),
    Math.sin(a)*(speed+this.rand()*35),4+this.rand()*9);
  }
  const fragments=strong?12:6;
  for(let i=0;i<fragments;i++){
   const a=this.rand()*Math.PI*2,speed=38+this.rand()*80;
   this.particle(this.debris,x,z,impactGround+7,
    3+this.rand()*5,.35+this.rand()*.55,
    Math.cos(a)*speed,Math.sin(a)*speed,32+this.rand()*95);
  }
  // Sparse lingering smoke columns, not a continuous wall of flame sprites.
  this.emitters.push({x,z,life:strong?4.1:2.0,
   frequency:strong?.37:.5,clock:0});
  if(this.emitters.length>16)this.emitters.shift();
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
  if(!addWreckRecord(this.wrecks,u,this.wreckHull.instanceMatrix.count))return;
  this.wreckCount=this.wrecks.length;
  this.stats.wrecks++;
  this.blastAt(u.x,u.y,true);
  this.drawWrecks();
 }
 drawWrecks(){
  let i=0;
  for(const w of this.wrecks){
   const ground=this.pos(w.x,w.y),yaw=w.yaw;
   const sink=wreckSink(w);
   // Three small sparse parts, not a full fake vehicle silhouette.
   const scale=w.kind==='bomber'?1.30:w.kind==='scout'?.95:
    w.kind==='rover'?.85:1;
   const forwardX=Math.sin(yaw),forwardZ=Math.cos(yaw);
   const sideX=Math.cos(yaw),sideZ=-Math.sin(yaw);
   const offset=(forward,side,height)=>{
    dummy.position.copy(ground);
    dummy.position.x+=forwardX*forward+sideX*side;
    dummy.position.z+=forwardZ*forward+sideZ*side;
    dummy.position.y+=height-sink;
   };
   // One battered armor plate partly buried in the sand.
   offset(-8*scale,-6*scale,2.3*scale);
   dummy.rotation.set(.29,yaw+.26,.41);
   dummy.scale.set(8*scale,2.5*scale,10*scale);
   dummy.updateMatrix();this.wreckHull.setMatrixAt(i,dummy.matrix);
   // One loose metal machinery chunk / wheel assembly.
   offset(8*scale,8*scale,3.3*scale);
   dummy.rotation.set(.52,yaw-.7,.66);
   dummy.scale.set(4.4*scale,3.3*scale,5.3*scale);
   dummy.updateMatrix();this.wreckTurret.setMatrixAt(i,dummy.matrix);
   // One short broken axle, gun barrel or wing spar.
   offset(0,-12*scale,1.7*scale);
   dummy.rotation.set(Math.PI/2-.19,yaw+.84,.11);
   dummy.scale.set(1.1*scale,10*scale,1.2*scale);
   dummy.updateMatrix();this.wreckBarrel.setMatrixAt(i,dummy.matrix);
   i++;
  }
  for(const mesh of [this.wreckHull,this.wreckTurret,this.wreckBarrel]){
   mesh.count=i;
   if(i)mesh.instanceMatrix.needsUpdate=true;
  }
 }
 captureAircraftCrash(entry,u){
  if(!entry?.node?.visible||!isAircraftWreck(u.kind))return false;
  const captured=adoptAircraftForCrash(entry);
  if(!captured)return false;
  if(this.crashes.length>=CRASH_CAP)this.releaseAircraftCrash(this.crashes.shift());
  // The Simulation removes dead units before sync(); the provided death
  // record may therefore contain only id/kind/hp. Recover the last 20-Hz
  // position captured by CombatEffects, never animate NaN world coordinates.
  const snapshot=this.lastUnits.get(u.id);
  const x=Number.isFinite(snapshot?.x)?snapshot.x:
   captured.root.position.x+this.world.size*.5;
  const y=Number.isFinite(snapshot?.y)?snapshot.y:
   captured.root.position.z+this.world.size*.5;
  const ground=this.pos(x,y);
  const start=Math.max(0,captured.root.position.y-ground.y);
  this.scene.add(captured.root);
  this.crashes.push({...captured,mesh:captured.root,id:u.id,
   x,y,angle:snapshot?.angle??u.angle??0,age:0,start,
   duration:CRASH_LIFETIME_SECONDS,kind:u.kind});
  this.capturedAircraftIds.add(u.id);
  return true;
 }
 releaseAircraftCrash(record){
  disposeAircraftCrash(record);
 }
 updateAircraftCrashes(dt){
  if(!dt)return;
  for(let i=this.crashes.length-1;i>=0;i--){
   const c=this.crashes[i];
   c.age+=dt;
   const t=Math.min(1,c.age/c.duration);
   const travel=(c.kind==='bomber'?105:63)*t;
   const x=clamp(c.x+Math.cos(c.angle)*travel,8,this.world.size-8);
   const z=clamp(c.y+Math.sin(c.angle)*travel,8,this.world.size-8);
   const point=this.pos(x,z);
   c.mesh.position.copy(point);
   c.mesh.position.y+=c.start*Math.pow(1-t,1.25);
   c.mesh.rotation.z=-t*.77;
   c.mesh.rotation.x=t*.47;
   if(t<1&&this.frame%10===0)
    this.particle(this.smoke,x,z,c.mesh.position.y,17+this.rand()*12,.9);
   if(t>=1){
    this.crashes.splice(i,1);
    this.releaseAircraftCrash(c);
    this.addWreck({...c,x,y:z});
   }
  }
 }
 // The simulation already supplies authoritative missiles and impact times.
 // This renderer interpolates their 3D trajectory without altering damage.
 rocketLaunchWorld(missile){
  const entry=this.battlefield?.units?.get(missile.source);
  const barrel=missile.id%6;
  // The procedural camouflaged shoulder launcher has its own real muzzle
  // node. Never fall back to the tank's offset for a human-sized rocket.
  const muzzle=entry?.kind==='rocket'
   ?entry?.placeholder?.getObjectByName('RocketMuzzle_0')??entry?.detail?.getObjectByName('RocketMuzzle_0')
   :missile.type==='antiArmor'
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
   if(missile.type==='bomb')continue;
   live.add(missile.id);
   if(!this.rocketOrigins.has(missile.id)){
    this.rocketOrigins.set(missile.id,this.rocketLaunchWorld(missile));
    this.statsRocket.launched++;
   }
   const duration=Math.max(.01,missile.impactAt-missile.at);
   const progress=clamp((this.game.time+(active?subTick:0)-missile.at)/duration,0,.999);
   const origin=this.rocketOrigins.get(missile.id);
   const targetUnit=missile.target===undefined?null:
    this.game.units.find(u=>u.id===missile.target&&u.hp>0);
   const targetEntry=targetUnit?this.battlefield?.units?.get(targetUnit.id):null;
   const terrainY=this.heightAt(missile.to.x,missile.to.y);
   const actualY=targetUnit&&targetEntry?.node?.visible&&
    (targetUnit.kind==='scout'||targetUnit.kind==='bomber')
    ?targetEntry.node.position.y+aircraftAimOffsetY(targetUnit.kind,targetEntry.modelHeight)
    :guidedRocketAimY(missile,targetUnit,terrainY,targetEntry?.modelHeight);
   const target=this.pos(missile.to.x,missile.to.y,actualY);
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
 updateFallingBombs(active=true,subTick=0){
  let count=0;
  for(const missile of this.game.missiles){
   if(missile.type!=='bomb')continue;
   const duration=Math.max(.01,missile.impactAt-missile.at);
   const progress=clamp((this.game.time+(active?subTick:0)-missile.at)/duration,0,.999);
   const x=missile.from.x+(missile.to.x-missile.from.x)*progress;
   const z=missile.from.y+(missile.to.y-missile.from.y)*progress;
   if(!this.game.canSee(0,{x,y:z}))continue;
   if(count>=this.bombBodies.instanceMatrix.count)break;
   const from=this.pos(missile.from.x,missile.from.y,
    this.heightAt(missile.from.x,missile.from.y)+170);
   const to=this.pos(missile.to.x,missile.to.y,
    this.heightAt(missile.to.x,missile.to.y)+8);
   dummy.position.copy(from).lerp(to,progress);
   const fall=to.clone().sub(from).normalize();
   dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),fall);
   dummy.scale.setScalar(1);dummy.updateMatrix();
   this.bombBodies.setMatrixAt(count++,dummy.matrix);
  }
  this.bombBodies.count=count;
  if(count)this.bombBodies.instanceMatrix.needsUpdate=true;
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
   if(['cannon','rocket','turret','machinegun','rifle','heavy','pistol'].includes(shot.weapon))
    this.impactAt(shot);
  }
  // Expensive per-unit visual history only changes on a fixed simulation
  // tick (20 Hz), not every 60–120 FPS rendering frame.
  if(this.lastUnitPollTime===this.game.time)return;
  this.lastUnitPollTime=this.game.time;
  const next=new Map();
  for(const u of this.game.units){
   if(u.hp<=0||u.carrier)continue;
   const old=this.lastUnits.get(u.id),current={x:u.x,y:u.y,angle:u.angle,kind:u.kind,owner:u.owner,flightHeight:u.flightHeight??1};
   if(old)this.tracksFor(u,old);
   next.set(u.id,current);
  }
  for(const [id,old] of this.lastUnits){
   if(next.has(id))continue;
   const found=this.game.units.find(u=>u.id===id);
   if(found?.carrier)continue; // boarding a transport is not a death
   if(!this.game.canSee(0,{x:old.x,y:old.y}))continue;
   if(this.capturedAircraftIds.delete(id))continue; // already flying as its authored textured GLB
   if(isAircraftWreck(old.kind))this.addWreck(old); // no model loaded: explode, never show a gray dummy
   else if(isWreckableUnit(old.kind))this.addWreck(old);
  }
  this.lastUnits=next;
  this.damagedVehicleSmoke(this.game.units);
 }
 damagedVehicleSmoke(units){
  let emitted=0;
  const live=new Set();
  for(const u of units){
   if(!u.hp||u.carrier)continue;
   live.add(u.id);
   const intensity=damagedVehicleIntensity(u,UNITS[u.kind]?.hp);
   if(intensity<=0||!this.game.canSee(0,u))continue;
   const last=this.lastDamageSmoke.get(u.id)??-Infinity;
   if(this.game.time-last<(.76-intensity*.36))continue;
   this.lastDamageSmoke.set(u.id,this.game.time);
   this.particle(this.smoke,u.x,u.y,this.heightAt(u.x,u.y)+34,
    13+intensity*22,1.1+intensity*1.6,
    (this.rand()-.5)*8,(this.rand()-.5)*8,12+intensity*20);
   if(intensity>.91&&this.rand()>.75)
    this.particle(this.flames,u.x,u.y,this.heightAt(u.x,u.y)+27,
     8+this.rand()*8,.18+this.rand()*.22,0,0,16);
   if(++emitted>=6)break;
  }
  // Remove dead vehicles from the small cooldown table every ~1.5 s;
  // rebuilding once per frame would create more work than these effects.
  if(this.game.time-this.lastDamageSmokeSweep>=1.5){
   this.lastDamageSmokeSweep=this.game.time;
   for(const id of this.lastDamageSmoke.keys())
    if(!units.some(u=>u.id===id&&u.hp>0&&!u.carrier))this.lastDamageSmoke.delete(id);
  }
 }
 update(dt,active=true,subTick=0){
  this.pollSimulation();
  this.updateRockets(active,subTick);
  this.updateFallingBombs(active,subTick);
  if(!active)return;
  this.frame++;
  this.updateAircraftCrashes(dt);
  this.wreckSync+=dt;
  if(advanceWreckRecords(this.wrecks,dt)){
   this.wreckCount=this.wrecks.length;
   if(this.wreckSync>=.20){
    this.wreckSync=0;
    this.drawWrecks();
   }
  }
  for(const emitter of this.emitters){
   emitter.life-=dt;emitter.clock+=dt;
   while(emitter.clock>=emitter.frequency&&emitter.life>0){
    emitter.clock-=emitter.frequency;
    const x=emitter.x+(this.rand()-.5)*28,z=emitter.z+(this.rand()-.5)*28;
    this.particle(this.smoke,x,z,this.heightAt(x,z)+18,28+this.rand()*30,2+this.rand()*2,
      (this.rand()-.5)*14,(this.rand()-.5)*14,26+this.rand()*36);
    if(this.rand()>.90)this.particle(this.flames,x,z,this.heightAt(x,z)+7,9+this.rand()*12,.2+this.rand()*.28,0,0,15);
   }
  }
  this.emitters=this.emitters.filter(e=>e.life>0);
  this.shocks=this.shocks.filter(s=>(s.life-=dt)>0);
  let shockIndex=0;
  for(const shock of this.shocks){
   const progress=1-shock.life/shock.ttl;
   const radius=Math.max(1,shock.max*(.16+.84*progress));
   dummy.position.set(shock.x-this.world.size*.5,shock.y,
    shock.z-this.world.size*.5);
   dummy.rotation.set(0,0,0);
   dummy.scale.setScalar(radius);
   dummy.updateMatrix();this.shockwave.setMatrixAt(shockIndex++,dummy.matrix);
  }
  this.shockwave.count=shockIndex;
  if(shockIndex)this.shockwave.instanceMatrix.needsUpdate=true;
  for(const pool of [this.smoke,this.flash,this.flames,this.dust,this.sparks,this.debris]){
   const alive=[];let k=0;
   for(const p of pool.particles){
    p.life-=dt;
    if(p.life<=0)continue;
    p.x+=p.vx*dt;p.z+=p.vz*dt;
    if(pool.mode==='debris')p.vy-=230*dt;
    p.y+=p.vy*dt;
    if(pool.mode==='debris')p.y=Math.max(p.floor,p.y);
    // Slow irregular smoke advection avoids a stationary stack of identical
    // circular sprites; deterministic elapsed time, no frame RNG or gameplay.
    if(pool.mode==='smoke'){
     const age=p.ttl-p.life;
     p.x+=Math.sin(age*2.2+p.angle*15)*dt*5;
     p.z+=Math.cos(age*1.7+p.angle*13)*dt*4;
    }
    const progress=clamp(p.life/p.ttl,0,1);
    const scale=p.size*(.65+(1-progress)*1.25)*Math.min(1,progress*4);
    dummy.position.set(p.x-this.world.size*.5,p.y,p.z-this.world.size*.5);
    dummy.quaternion.copy(this.camera.quaternion);
    const width=scale*(pool.mode==='spark'?.45:pool.mode==='smoke'?1.13:1);
    const height=scale*(pool.mode==='dust'?.57:pool.mode==='flame'?1.27:pool.mode==='debris'?.66:1);
    dummy.scale.set(width,height,1);dummy.updateMatrix();
    pool.mesh.setMatrixAt(k++,dummy.matrix);alive.push(p);
   }
   pool.particles=alive;
   pool.mesh.count=k;
   // Avoid uploading a large instance matrix when nothing is left to draw.
   if(k||pool.mesh.instanceMatrix.needsUpdate)pool.mesh.instanceMatrix.needsUpdate=true;
  }
  this.activeParticles=this.particleCount;
 }
 get particleCount(){return this.smoke.particles.length+this.flash.particles.length+this.flames.particles.length+this.dust.particles.length+this.sparks.particles.length+this.debris.particles.length;}
}
const worldIndex=(world,x,z)=>world.index({x,y:z});
