// Standalone, render-only biomes. Never changes Simulation, collision, terrain
// generation, saves, AI, combat outcomes, or the hard-black playable border.
// Distinct art direction without shipping third-party game assets.
export const BIOME_STYLES = Object.freeze({
 desert: Object.freeze({
  label:'Wüste', fog:'#080605', sky:'#fff1dd', bounce:'#675246',
  sunlight:'#fff0d4', fill:'#c2d7df', exposure:.96,
  terrain:'#fff0db', groundBase:'#e8b47b', groundLight:'#f3cf9d',
  groundRock:'#a97952', rocks:['#ccb091','#9e8267','#e1c19c'],
  dust:'#b59779'
 }),
 snow: Object.freeze({
  label:'Schneeland', fog:'#101925', sky:'#e8f2ff', bounce:'#71869b',
  sunlight:'#f7f9ff', fill:'#b4d5f2', exposure:.88,
  terrain:'#f4f8fc', groundBase:'#d4e2ec', groundLight:'#f5f8f9',
  groundRock:'#8795a2', rocks:['#a6aeb8','#73828e','#d7dfe5'],
  dust:'#e0e6eb'
 }),
 jungle: Object.freeze({
  label:'Dschungel', fog:'#091a14', sky:'#d6e8c9', bounce:'#384b34',
  sunlight:'#f2e6c2', fill:'#92b7aa', exposure:.89,
  terrain:'#d9d7b0', groundBase:'#6c8156', groundLight:'#95a26d',
  groundRock:'#565c47', rocks:['#777966','#454e41','#92937a'],
  dust:'#9b9972'
 })
});
export const normalizeBiome = value => Object.hasOwn(BIOME_STYLES,value)?value:'desert';

function seededRandom(seed){
 let state=(seed>>>0)^0x9e3779b9;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
// Textured color variation is generated once, not per frame. World-space
// baked vertex colors add broad geographic variation on top of this tile.
export function createBiomeGroundTexture(THREE,biome,seed){
 const selected=normalizeBiome(biome);
 if(selected==='desert')return null;
 const random=seededRandom(seed^0x55ba710b);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d');
 const image=ctx.createImageData(256,256);
 const base=selected==='snow'?[242,246,248]:[167,186,146];
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const i=(y*256+x)*4;
  const macro=10*Math.sin(x*.049+y*.034)+7*Math.cos(x*.07-y*.027);
  const grain=(random()-.5)*(selected==='snow'?25:41);
  const value=macro*.45+grain;
  for(let channel=0;channel<3;channel++)
   image.data[i+channel]=Math.max(0,Math.min(255,Math.round(base[channel]+value)));
  image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 return texture;
}
// A small, bounded number of instanced meshes creates an actual 3D tree
// silhouette. All placements stay inside the playable bounds and avoid
// strategic sites, ruins and initial units. Trees are scenery, not cover.
export function addBiomeVegetation({THREE,scene,world,terrain,game,heightAt,seed,biome,lowQuality=false}){
 const selected=normalizeBiome(biome);
 if(selected==='desert')return {count:0,meshes:[]};
 const random=seededRandom(seed^0x8ad0310f);
 const half=world.size*.5, margin=140, size=world.size;
 const max=selected==='snow'?(lowQuality?95:210):(lowQuality?120:290);
 const canopyGeo=selected==='snow'
  ?new THREE.ConeGeometry(1,1,8):new THREE.IcosahedronGeometry(1,1);
 const trunkGeo=new THREE.CylinderGeometry(.65,1,1,7);
 const canopyMat=new THREE.MeshStandardMaterial({
  color:selected==='snow'?'#425f57':'#356342',roughness:1,metalness:0
 });
 const highlightMat=new THREE.MeshStandardMaterial({
  color:selected==='snow'?'#d9e4e5':'#4d7b44',roughness:1,metalness:0
 });
 const barkMat=new THREE.MeshStandardMaterial({color:selected==='snow'?'#554e48':'#554d3b',roughness:1});
 const trunk=new THREE.InstancedMesh(trunkGeo,barkMat,max);
 const foliage=new THREE.InstancedMesh(canopyGeo,canopyMat,max);
 const accents=new THREE.InstancedMesh(canopyGeo,highlightMat,max);
 const dummy=new THREE.Object3D();
 const avoid=[...(terrain.sites??[]),...(terrain.ruins??[])];
 let count=0;
 for(let attempt=0;attempt<max*16&&count<max;attempt++){
  const x=margin+random()*(size-2*margin),z=margin+random()*(size-2*margin);
  if(avoid.some(site=>Math.hypot(site.x-x,site.y-z)<185))continue;
  if((game?.units??[]).some(unit=>Math.hypot(unit.x-x,unit.y-z)<150))continue;
  if(!world.walkable({x,y:z}))continue;
  const span=selected==='snow'?24+random()*24:28+random()*35;
  const height=selected==='snow'?60+random()*36:65+random()*48;
  const y=heightAt(x,z),rotation=random()*Math.PI*2;
  dummy.rotation.set(0,rotation,0);
  dummy.position.set(x-half,y+height*.26,z-half);
  dummy.scale.set(span*.11,height*.52,span*.11);
  dummy.updateMatrix();trunk.setMatrixAt(count,dummy.matrix);
  if(selected==='snow'){
   dummy.position.y=y+height*.68;
   dummy.scale.set(span,height*.71,span);
  }else{
   dummy.position.y=y+height*.90;
   dummy.scale.set(span*1.22,span*.75,span);
  }
  dummy.updateMatrix();foliage.setMatrixAt(count,dummy.matrix);
  if(selected==='snow'){
   dummy.position.y=y+height*.89;
   dummy.scale.set(span*.58,height*.36,span*.58);
  }else{
   dummy.position.set(x-half+span*.3,y+height*.85,z-half-span*.22);
   dummy.scale.set(span*.79,span*.64,span*.87);
  }
  dummy.updateMatrix();accents.setMatrixAt(count,dummy.matrix);
  count++;
 }
 const meshes=[trunk,foliage,accents];
 for(const mesh of meshes){
  mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
  mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;
  mesh.name='visual-biome-'+selected+'-'+(mesh===trunk?'trunks':mesh===foliage?'canopies':'accents');
  mesh.userData={visualOnly:true,nonPlayable:true,biome:selected,scenery:true};
  // No tree hitboxes: clicking near a decorative canopy still reaches ground.
  mesh.raycast=()=>{};
  scene.add(mesh);
 }
 return {count,meshes};
}
