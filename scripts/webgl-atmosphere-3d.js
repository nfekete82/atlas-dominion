import * as THREE from 'three';

// A GPU-only visual layer. The authoritative Simulation still decides which
// tiles are visible, which units can be targeted, and the real weather rules.
function cloudTexture(biome='desert'){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d');
 const gradient=ctx.createRadialGradient(64,64,8,64,64,63);
 const colors=biome==='snow'
  ?['rgba(247,251,255,.70)','rgba(209,226,241,.40)','rgba(170,193,211,.10)','rgba(161,181,197,0)']
  :biome==='jungle'
   ?['rgba(199,207,177,.65)','rgba(139,160,127,.40)','rgba(83,111,85,.10)','rgba(74,103,81,0)']
   :['rgba(247,219,172,.70)','rgba(223,191,149,.40)','rgba(179,146,110,.10)','rgba(179,146,110,0)'];
 gradient.addColorStop(0,colors[0]);gradient.addColorStop(.35,colors[1]);
 gradient.addColorStop(.72,colors[2]);gradient.addColorStop(1,colors[3]);
 ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
const dummy=new THREE.Object3D();
function createCloudMesh(scene,texture,max,opacity,order,name){
 const material=new THREE.MeshBasicMaterial({
  map:texture,transparent:true,opacity,depthTest:true,depthWrite:false,
  side:THREE.DoubleSide,toneMapped:false,alphaTest:.008
 });
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,max);
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.frustumCulled=false;
 mesh.renderOrder=order;
 mesh.count=0;
 mesh.name=name;
 mesh.userData={visualOnly:true,nonPlayable:true,atmospheric:true};
 scene.add(mesh);
 return mesh;
}
export class SandforgeAtmosphere3D {
 constructor({scene,game,world,heightAt,camera,controls,lowQuality=false,biome='desert'}){
  Object.assign(this,{scene,game,world,heightAt,camera,controls,lowQuality});
  this.texture=cloudTexture(biome);
  this.fogMax=lowQuality?100:300;
  this.dustMax=lowQuality?48:170;
  this.fogMesh=createCloudMesh(scene,this.texture,this.fogMax,.46,16,'fow-3d-frontier');
  this.dustMesh=createCloudMesh(scene,this.texture,this.dustMax,.24,15,'sandstorm-3d-dust');
  this.frontier=[];this.enabled=true;this.previewStorm=false;
  this.time=0;this.lastAngle=NaN;
  this.metrics={frontier:0,dust:0,weatherIntensity:0};
  this.initialFogDensity=scene.fog?.density??0;
  let state=(game.seed^0x0fe81da9)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  this.clouds=Array.from({length:this.dustMax},()=>({
   x:random()*2-1,z:random()*2-1,
   h:26+random()*150,size:75+random()*145,
   speed:.48+random()*1.4,phase:random()*Math.PI*2
  }));
 }
 refreshVisibility(){
  if(!this.enabled){
   this.frontier=[];this.fogMesh.count=0;this.metrics.frontier=0;
   return;
  }
  const seen=this.game.visible?.[0],blocks=this.world.blocked;
  if(!seen||!blocks)return;
  const grid=Math.round(Math.sqrt(blocks.length));
  const stride=this.lowQuality?7:5;
  const sample=(x,y)=>x>=0&&y>=0&&x<grid&&y<grid&&Boolean(seen[y*grid+x]);
  const border=[];
  for(let y=stride;y<grid-stride;y+=stride)for(let x=stride;x<grid-stride;x+=stride){
   if(!sample(x,y))continue;
   const exposed=!sample(x-stride,y)||!sample(x+stride,y)||!sample(x,y-stride)||!sample(x,y+stride);
   if(!exposed)continue;
   const hash=(Math.imul(x+1,73856093)^Math.imul(y+1,19349663)^this.game.seed)>>>0;
   if(hash%7===0)continue;
   const wx=(x+.5)/grid*this.world.size,wz=(y+.5)/grid*this.world.size;
   border.push({x:wx,z:wz,size:85+(hash%77),height:57+(hash%49)});
  }
  // Stable sampling keeps the draw count bounded even with many units.
  const step=Math.max(1,Math.ceil(border.length/this.fogMax));
  this.frontier=border.filter((_,i)=>i%step===0).slice(0,this.fogMax);
  this.metrics.frontier=this.frontier.length;
  this.updateMatrices(0);
 }
 setFogEnabled(enabled){
  this.enabled=Boolean(enabled);
  this.refreshVisibility();
 }
 setStormPreview(enabled){this.previewStorm=Boolean(enabled);}
 get stormPreview(){return this.previewStorm;}
 updateMatrices(dt){
  const half=this.world.size*.5;
  const cameraRotation=this.camera.quaternion;
  let i=0;
  for(const p of this.frontier){
   const h=this.heightAt(p.x,p.z);
   dummy.position.set(p.x-half,h+p.height*.72,p.z-half);
   dummy.quaternion.copy(cameraRotation);
   dummy.scale.set(p.size,p.height*1.6,1);
   dummy.updateMatrix();this.fogMesh.setMatrixAt(i++,dummy.matrix);
  }
  this.fogMesh.count=this.enabled?i:0;
  if(i)this.fogMesh.instanceMatrix.needsUpdate=true;
  const weatherIntensity=Math.max(this.previewStorm?1:0,this.game.weather?.intensity??0);
  this.metrics.weatherIntensity=weatherIntensity;
  const count=weatherIntensity>.01?Math.max(0,Math.floor(this.dustMax*weatherIntensity)):0;
  const centerX=this.controls.target.x+half,centerZ=this.controls.target.z+half;
  for(let j=0;j<count;j++){
   const p=this.clouds[j],period=1150;
   const x=centerX+(((p.x*period+this.time*48*p.speed+period*4)%(period*2))-period);
   const z=centerZ+(((p.z*period+this.time*14*p.speed+period*4)%(period*2))-period);
   dummy.position.set(x-half,this.heightAt(x,z)+p.h+Math.sin(this.time*.8+p.phase)*8,z-half);
   dummy.quaternion.copy(cameraRotation);
   dummy.scale.set(p.size*(1+.8*weatherIntensity),p.size*.63,1);
   dummy.updateMatrix();this.dustMesh.setMatrixAt(j,dummy.matrix);
  }
  this.dustMesh.count=count;
  if(count)this.dustMesh.instanceMatrix.needsUpdate=true;
  this.metrics.dust=count;
  this.dustMesh.material.opacity=.15+.25*weatherIntensity;
  // Low-cost aerial haze only when storm weather really requires it.
  if(this.scene.fog?.isFogExp2){
   this.scene.fog.density=this.initialFogDensity+weatherIntensity*.00025;
  }
 }
 update(dt){
  this.time+=Math.max(0,Math.min(dt,.08));
  this.updateMatrices(dt);
 }
 dispose(){
  for(const mesh of [this.fogMesh,this.dustMesh]){
   mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
  }
  this.texture.dispose();
  if(this.scene.fog?.isFogExp2)this.scene.fog.density=this.initialFogDensity;
 }
}
