import * as THREE from 'three';

// Only visual treatment: maps, save games, pathing and the 20 Hz terrain
// heightfield remain completely untouched by this module.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{const x=clamp(t);return x*x*(3-2*x);};
const hash=(x,y,seed)=>{let n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,2246822519))|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};

/** Deterministic winding DRY wash, not a water body or a collider.
 * Its sediment colours are continuous between the 16 terrain chunks.
 */
export function desertWadiCenter(x,size,seed){
 const offset=seed%997;
 return size*(.74-.45*x/size)+Math.sin(x*.0035+offset*.007)*size*.024+
  Math.sin(x*.0091-offset*.015)*size*.009;
}
export function desertWadiSample(x,z,size,seed,profile='mixed'){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(size)||size<=0)
  return {strength:0,width:0,center:0};
 const center=desertWadiCenter(x,size,seed);
 const width=size*(profile==='rocky'?.027:.032)*(1+.19*Math.sin(x*.0081+seed*.002));
 const dist=Math.abs(z-center);
 return {center,width,strength:1-smooth((dist-width*.25)/(width*.90))};
}

/** Art-directed sand palettes and irregular dune highlights evaluated once
 * per terrain vertex. Wadi is purely a texture/colour effect: no holes,
 * rivers, water, collision changes, fog leaks or extra ground surfaces.
 */
export function cinematicSandSample({x,z,size,seed,profile='mixed',slope=0,height=0}){
 const wadi=desertWadiSample(x,z,size,seed,profile);
 const dune=Math.sin(x*.009+Math.sin(z*.0045+seed*.001)*1.3+height*.04);
 const wind=Math.sin(x*.037+z*.012+seed*.0003)*Math.sin(z*.024-x*.011);
 const ridge=Math.sin(height*.14+x*.012+z*.006);
 const rock=smooth((slope-.12)/.24)*(profile==='rocky'?1:.66);
 const strata=rock*(.65+.35*ridge);
 // Slight natural height variation while leaving silhouette/pathing intact.
 const shade=.92+.078*dune+.025*wind;
 const sediment=wadi.strength*(.59+.09*Math.sin(x*.045-z*.071));
 return {dune,shade,rock,strata,wadi:clamp(sediment),wind};
}

/** Low, embedded stony debris along a visually dried riverbed.
 * One instanced mesh, one draw call, deterministic and click-through.
 * Entirely INSIDE the playable field and off tactical/starting pads.
 */
export function addDesertWashStones({scene,world,size,seed,heightAt,sites=[],lowQuality=false}){
 if(!world?.generated?.battlefield)return null;
 const target=lowQuality?140:480;
 const palette=['#c8a47a','#917454','#d7b48b','#7f674d'];
 const geometry=new THREE.DodecahedronGeometry(1,0);
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0});
 const mesh=new THREE.InstancedMesh(geometry,material,target);
 mesh.name='visual-desert-dry-wash-pebbles';
 mesh.userData={visualOnly:true,nonPlayable:true,dryWash:true};
 mesh.raycast=()=>{};
 mesh.castShadow=false;mesh.receiveShadow=true;
 const dummy=new THREE.Object3D();
 let state=(seed^0x519d362b)>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 let count=0;
 for(let attempt=0;attempt<target*5&&count<target;attempt++){
  const x=110+random()*(size-220);
  const zc=desertWadiCenter(x,size,seed);
  const {center,width}=desertWadiSample(x,zc,size,seed,world.generated.battlefield.profile);
  const z=center+(random()-.5)*width*2.0;
  if(z<100||z>size-100)continue;
  const point={x,y:z};
  const index=world.index(point);
  if(index<0||world.blocked[index])continue;
  if(sites.some(p=>Math.hypot(p.x-x,p.y-z)<190))continue;
  const scale=1.6+Math.pow(random(),1.9)*(lowQuality?7:10);
  dummy.position.set(x-size/2,heightAt(x,z)+scale*.10,z-size/2);
  dummy.rotation.set((random()-.5)*.25,random()*Math.PI*2,(random()-.5)*.25);
  dummy.scale.set(scale*(.65+random()),scale*(.10+random()*.18),scale*(.8+random()));
  dummy.updateMatrix();mesh.setMatrixAt(count,dummy.matrix);
  mesh.setColorAt(count,new THREE.Color(palette[Math.floor(random()*palette.length)]));
  count++;
 }
 mesh.count=count;
 mesh.instanceMatrix.needsUpdate=true;
 if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 scene.add(mesh);
 return mesh;
}
