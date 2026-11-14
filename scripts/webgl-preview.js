import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Simulation} from '/src/reborn/simulation.js';
import {isTerrainProfile,TERRAIN_LABELS,battlefieldStart,terrainGradingEdge} from '/src/reborn/battlefield-terrain.js';
import {campaignLayout} from '/src/reborn/config.js';
import {randomMapSeed} from '/src/reborn/world-generation.js';
import {rollingHillHeight} from '/src/reborn/rolling-hills.js';
import {canyonGroundSampler,rampAtX,ridgeCenterY} from '/src/reborn/canyon-height.js';
import {SandforgeBattlefield} from '/webgl-battlefield.js';
import {DesertOases} from '/webgl-oases.js';
import {DesertArtPass} from '/webgl-environment.js';
import {BIOME_STYLES,normalizeBiome,createBiomeGroundTexture,addBiomeVegetation} from '/webgl-biomes.js';
import {setWorldCamouflageBiome} from '/webgl-faction-accents.js';
import {addStylizedDesertWorld} from '/webgl-stylized-world.js';
import {SandforgeCombatEffects} from '/webgl-combat-vfx.js';
import {SandforgeStrategicEffects} from '/webgl-strategic-effects.js';
import {SandforgePerformanceWatch} from '/webgl-perf-watch.js';
import {SandforgeAtmosphere3D} from '/webgl-atmosphere-3d.js';
import {addVisualPerimeter} from '/webgl-perimeter.js';
import {addBoundaryCliffs} from '/webgl-edge-cliffs.js';
import {cameraEdgeReach,cameraBlackOverscan} from '/webgl-map-edges.js';
import {groundContactMaterial} from '/webgl-grounding.js';
import {SandforgeConstructionRecovery} from '/webgl-construction-recovery.js';
import {SandforgeGroundTracks} from '/webgl-ground-tracks.js';
import {Soundscape} from '/src/reborn/audio.js';
import {fineSandPattern} from '/src/reborn/fine-sand.js';
import {cinematicSandSample,addDesertWashStones} from '/webgl-desert-art.js';
import {installMatchResultOverlay} from '/webgl-match-result.js';
import {stoneMaterial,sharedStoneMaps,weatheredStoneGeometry} from '/webgl-rock-materials.js';

/** Opt-in WebGL scene using the real authoritative Sandforge map and simulation.
 * This page is isolated from the production Canvas renderer, save format and AI
 * benchmarks. The 3D camera never changes the simulation's map coordinates. */
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const biome=normalizeBiome(query.get('biome'));
setWorldCamouflageBiome(biome);
const biomeStyle=BIOME_STYLES[biome];
// Brand-new 50%-larger WebGL battlefields. Earlier Canyon v15-v18 saves
// remain available via legacy=1 and are never silently migrated.
// Keep pre-generator seeded bookmarks on their historical v19–22 maps.
// The new-game menu always supplies terrain=random (or a chosen profile).
const procedural=query.has('terrain')||query.has('play')||!query.has('seed');
const sizes=query.get('legacy')==='1'?{4:15,8:16,12:17,16:18}:
 query.get('map')==='previous'?{4:23,8:24,12:25,16:26}:
 procedural?{4:27,8:28,12:29,16:30}:{4:19,8:20,12:21,16:22};
const bastions=Object.hasOwn(sizes,query.get('bastions'))?Number(query.get('bastions')):8;
const inputSeed=query.get('seed');
const seed=inputSeed!==null&&inputSeed.trim()!==''&&Number.isSafeInteger(Number(inputSeed))&&Number(inputSeed)>=0&&Number(inputSeed)<=4294967295
  ?Number(inputSeed):randomMapSeed();
$('bastions').value=String(bastions);$('seed').value=String(seed);
const profile=isTerrainProfile(query.get('terrain'))?query.get('terrain'):undefined;
// A saved game chooses its own original geometry, never the current defaults.
const session=query.get('resume')==='1'?(()=>{
 const saved=localStorage.getItem('sandforge:webgl:v1');
 if(!saved)throw Error('Kein gespeichertes Spiel gefunden.');
 const restored=Simulation.load(JSON.parse(saved));
 if(restored.seed!==seed||restored.territories.length!==bastions)throw Error('Spielstand passt nicht zur angeforderten Partie.');
 return restored;
})():null;
const game=session??(profile?Simulation.campaign(seed,sizes[bastions],profile):Simulation.campaign(seed,sizes[bastions]));
// The WebGL renderer stages a single authoritative factory actor while its
// real 3D gate is opening. Classic, tests and old saves keep normal rules.
game.stageWebGLProduction=true;
// Measure moving-bomber sight passes separately from AI and particle rendering.
// Read-only timing; normal sessions have zero instrumentation overhead.
game.profileVision=query.get('perf')==='1';
// Break multi-unit spikes into unit orders, collision separation and A* cost.
// Instrumentation stays off in ordinary gameplay and never enters save data.
game.profileSquadWork=query.get('perf')==='1';
game.world.profilePaths=query.get('perf')==='1';
// Only this WebGL campaign gets a modest vision bonus; classic/headless
// benchmarks retain exactly their original LOS and balance.
// Optional visual comparison; classic gameplay remains unchanged.
const wideView=query.get('view')==='wide';
game.visionScale=wideView?1.35:game.world.mapVersion>=19?1.30:1.12;
game.infantryVisionBonus=1.15; // modest +15% infantry sight in 3D only
game.highGroundEnabled=true; // tactical +20% outgoing / -10% incoming only in 3D
game.updateVision();
const world=game.world,terrain=world.generated,size=world.size,half=size/2;
const gradingHomes=terrain.battlefield?.generatorVersion===2
 ?campaignLayout(world.mapVersion,seed).headquarters.map(i=>battlefieldStart(terrain.sites[i],size))
 :[];
if(terrain.battlefield)document.title='Sandforge · '+biomeStyle.label+' · '+TERRAIN_LABELS[terrain.battlefield.profile]+' · '+seed;
const spacious=world.mapVersion>=19;
const status=$('status'),errorNode=$('error'),stage=$('stage');
$('simulation').textContent=query.get('pause')==='1'?'Simulation starten':'Simulation pausieren';
$('simulation').setAttribute('aria-pressed',String(query.get('pause')!=='1'));
const setStatus=value=>{status.textContent=value;};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const rnd=seed=>{let s=seed>>>0;return ()=>{s=(s+0x6d2b79f5)>>>0;let n=s;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};};
const random=rnd(seed^0xb6aa3371),ridge=terrain.ridges[0];
// Gentle hills follow the same authoritative coordinates used for the
// high-ground combat advantage, without creating any blocking grid cells.
const canyonHeightAt=canyonGroundSampler(seed,terrain.ridges);
const heightAt=terrain.battlefield?(x,z)=>world.terrainHeight(x,z):(x,z)=>canyonHeightAt(x,z)+rollingHillHeight(game.hills,x,z);
const rampAt=x=>ridge?rampAtX(ridge,x):false;
const pos=(x,z,y=heightAt(x,z))=>new THREE.Vector3(x-half,y,z-half);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
// Lower the hot highlights of the preview: original sandstone and buildings
// share one warm daylight exposure instead of glowing in different palettes.
renderer.toneMappingExposure=biome==='desert'?(spacious?.96:1.00):biomeStyle.exposure;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
stage.append(renderer.domElement);
const scene=new THREE.Scene();
// The 3D playable desert ends directly against a completely black map void.
// A beige background would still reveal a bright square beyond the terrain.
scene.background=new THREE.Color('#000000');
scene.fog=new THREE.FogExp2(biomeStyle.fog,.00008);
// A neutral prefiltered IBL makes imported GLB PBR metals readable without
// repainting their material graphs. The battlefield background stays black.
if(query.get('pbrEnv')!=='off'){
 const pmrem=new THREE.PMREMGenerator(renderer);
 const room=new RoomEnvironment();
 const baked=pmrem.fromScene(room,.04);
 scene.environment=baked.texture;
 scene.environmentIntensity=biome==='desert'?.38:.30;
 room.dispose();pmrem.dispose();
}
scene.add(new THREE.HemisphereLight(biomeStyle.sky,biomeStyle.bounce,1.20));
const sun=new THREE.DirectionalLight(biomeStyle.sunlight,spacious?2.85:3.05);
sun.position.set(-700,1100,420);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-1250;sun.shadow.camera.right=1250;
sun.shadow.camera.top=1250;sun.shadow.camera.bottom=-1250;
sun.shadow.camera.near=1;sun.shadow.camera.far=3000;
sun.shadow.bias=-.00006;sun.shadow.normalBias=.038;
sun.target.position.set(0,0,0);scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(biomeStyle.fill,.40);
fill.position.set(650,500,-450);scene.add(fill);
const camera=new THREE.OrthographicCamera(-680,680,410,-410,10,12000);
// Initial framing presents a real ruin and the adjacent ridge in one view,
 // rather than an empty central section of sand.
 // The classic HQ-less campaign begins around its two starting units.
 // Looking at a central ruin would now show an all-black fog-covered screen.
 const own=game.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier);
 const focalX=own.length?own.reduce((sum,u)=>sum+u.x,0)/own.length:half;
 const focalZ=own.length?own.reduce((sum,u)=>sum+u.y,0)/own.length:half;
 const cameraTarget=new THREE.Vector3(focalX-half,heightAt(focalX,focalZ)+42,focalZ-half);
camera.position.copy(cameraTarget).add(new THREE.Vector3(1200,1110,1640));
// Anchor the initial sunlight to the player spawn for visible unit shadows.
sun.target.position.copy(cameraTarget);
sun.position.copy(cameraTarget).add(new THREE.Vector3(-700,1100,420));
camera.lookAt(cameraTarget);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.10;
controls.screenSpacePanning=true;
// C&C-style constrained orthographic RTS camera: the map is NOT a tabletop.
// The default tactical view shows ~25% more world area per axis than the
// old .74 zoom. Models are unchanged in the simulation; on-screen footprint
// shrinks to 80%, as requested for better strategic overview.
controls.minZoom=wideView?.42:.46;controls.maxZoom=3.5;
camera.zoom=.59;camera.updateProjectionMatrix();
// A lower camera angle gives rock faces and buildings visible depth.
controls.minPolarAngle=.65;controls.maxPolarAngle=1.30;
controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
controls.target.copy(cameraTarget);
const loader=new GLTFLoader();
const models=new Map(),ruinMeshes=[];
// A player campaign starts LIVE, as in the original Canvas RTS. Orders must
// never appear accepted while an unannounced preview-level pause blocks ticks.
game.paused=false;
let groundMeshes=[],running=query.get('pause')!=='1',accumulator=0,elapsed=0;
// Distinguish a deliberate pause or an ended battle from an animation stall.
// Previously all three looked identical: stationary soldiers on screen.
const simulationBanner=document.createElement('div');
simulationBanner.id='sf3d-simulation-state';
simulationBanner.setAttribute('role','status');
simulationBanner.hidden=true;
simulationBanner.style.cssText='position:fixed;top:71px;left:50%;transform:translateX(-50%);z-index:15;pointer-events:none;background:#111d23ea;border:1px solid #c5a570;color:#f6dfa9;font:800 12px/1.3 system-ui;padding:7px 13px;letter-spacing:.04em;text-align:center;box-shadow:0 5px 18px #0008';
document.body.append(simulationBanner);
const matchResultOverlay=installMatchResultOverlay(document);
function updateSimulationBanner(){
 matchResultOverlay.render(game.status);
 const reason=game.status!=='playing'?'':!running?
  'SIMULATION PAUSIERT · ▶ zum Fortsetzen':
  game.paused?'SIMULATION INTERN PAUSIERT':'';
 simulationBanner.hidden=!reason;
 if(reason&&simulationBanner.textContent!==reason)simulationBanner.textContent=reason;
}
updateSimulationBanner();
let visualPerimeter=null,boundaryCliffs=null;
function sandTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;
 const ctx=c.getContext('2d'),pixels=ctx.createImageData(256,256),r=rnd(seed^0x192cb110);
 for(let i=0;i<256*256;i++){
  const grain=r(),v=208+grain*42,off=i*4;
  pixels.data[off]=v+7;pixels.data[off+1]=v+3;pixels.data[off+2]=v-4;pixels.data[off+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 for(let i=0;i<450;i++){
  const x=r()*256,y=r()*256,rad=.25+r()*1.6;
  ctx.fillStyle=r()>.50?'rgba(79,57,34,.17)':'rgba(255,242,201,.28)';
  ctx.beginPath();ctx.ellipse(x,y,rad,rad*.65,0,0,Math.PI*2);ctx.fill();
 }
 for(let i=0;i<36;i++){
  const x=r()*256,y=r()*256;
  ctx.strokeStyle='rgba(255,240,210,.12)';ctx.lineWidth=.5+r();
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+20,y-3,x+44,y+2,x+75,y-2);ctx.stroke();
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 return t;
}
// Tiny wind-carved ridges are normal-mapped on the true 3D heightfield.
// The micro-relief changes lighting only, never collision or navigation.
function sandMicroNormalTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const ripple=Math.cos(x*.19+y*.048)*.16+
   Math.cos(x*.57-y*.12)*.06+
   Math.cos(y*.41+x*.06)*.04;
  const cross=Math.sin(x*.19+y*.048)*.035+
   Math.sin(y*.41+x*.06)*.018;
  const inv=1/Math.hypot(ripple,1,cross);
  const k=(y*256+x)*4;
  pixels.data[k]=Math.round(127.5*(1-ripple*inv));
  pixels.data[k+1]=Math.round(127.5*(1+cross*inv));
  pixels.data[k+2]=Math.round(127.5*(1+inv));
  pixels.data[k+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 const map=new THREE.CanvasTexture(canvas);
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 return map;
}
function buildTerrain(){
 const texture=biome==='desert'?sandTexture():createBiomeGroundTexture(THREE,biome,seed);
 const normalMap=biome==='desert'?sandMicroNormalTexture():null;
 if(spacious&&normalMap)normalMap.repeat.set(2.2,2.2);
 const material=new THREE.MeshStandardMaterial({
  color:biome==='desert'?(spacious?'#fff0db':'#f5eadb'):biomeStyle.terrain,
  map:texture,normalMap,normalScale:new THREE.Vector2(spacious?.77:.45,spacious?.77:.45),
  vertexColors:true,roughness:.99,metalness:0
 });
 // The buildings-3d/desert-basecolor.png is a *model material atlas*,
 // with hazard stripes, blue and red panels! Tiling it over the world caused
 // the obvious checkerboard terrain. Reuse the original Sandforge 2K sand
 // artwork, edge-blended with the SAME fineSandPattern as the Canvas RTS.
 if(biome==='desert'){
 const source=new Image();
 source.onload=()=>{
  try{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
   const context=canvas.getContext('2d');
   context.fillStyle=fineSandPattern(context,source);
   context.fillRect(0,0,canvas.width,canvas.height);
   if(terrain.battlefield){
    // The historical artwork contains painted dune lighting. Keep its fine
    // grain and palette, but let actual 3D normals describe the new relief.
    context.globalAlpha=.27;context.fillStyle='#e0b57c';
    context.fillRect(0,0,canvas.width,canvas.height);context.globalAlpha=1;
   }
   const sand=new THREE.CanvasTexture(canvas);
   sand.colorSpace=THREE.SRGBColorSpace;
   sand.wrapS=sand.wrapT=THREE.RepeatWrapping;
   sand.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   material.map=sand;
   // A dedicated procedural wind-ripple normal replaces the unsuitable
   // building-model normal atlas; retain it when swapping the base color.
   material.needsUpdate=true;
   texture.dispose();
   console.info('Sandforge 3D terrain: seamless original sand artwork loaded');
  }catch(error){console.warn('Original sand unavailable; keeping procedural sand',error);}
 };
 source.onerror=()=>console.warn('Sand source unavailable; keeping procedural sand');
 source.src='/src/assets/reborn/sand-ripples-v2.png';
 }
 const chunks=4,segments=56,patch=size/chunks;
 // Reuse palette objects across 50k baked vertices: no per-frame cost.
 const sandGold=new THREE.Color('#e8b47b'),sandLight=new THREE.Color('#f3cf9d'),
  sandstone=new THREE.Color('#a97952'),riverSediment=new THREE.Color('#b79470');
 const vertexColor=new THREE.Color();
 const biomeGroundBase=new THREE.Color(biomeStyle.groundBase);
 const biomeGroundLight=new THREE.Color(biomeStyle.groundLight);
 const biomeGroundRock=new THREE.Color(biomeStyle.groundRock);
 for(let cy=0;cy<chunks;cy++)for(let cx=0;cx<chunks;cx++){
  const count=(segments+1)**2,vertices=new Float32Array(count*3),
   colors=new Float32Array(count*3),uv=new Float32Array(count*2),
   normals=new Float32Array(count*3),indices=[];
  for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
   const x=(cx+i/segments)*patch,z=(cy+j/segments)*patch;
   const h=heightAt(x,z),k=j*(segments+1)+i,n=k*3;
   vertices[n]=x-half;vertices[n+1]=h;vertices[n+2]=z-half;
   const slope=terrain.battlefield?world.terrainSlope(x,z):Math.abs(heightAt(x,z-24)-heightAt(x,z+24))/48;
   const rocky=terrain.battlefield?smooth((slope-.10)/.25)*(terrain.battlefield.profile==='rocky'?.7:.3):smooth((slope-.20)/.9);
   const nval=.96+.055*Math.sin(x*.013+z*.009)+.025*Math.cos(x*.071-z*.032);
   if(spacious&&terrain.battlefield){
    const art=cinematicSandSample({x,z,size,seed,profile:terrain.battlefield.profile,slope,height:h});
    vertexColor.copy(sandGold).lerp(sandLight,(art.dune+1)*.28)
      .lerp(sandstone,Math.min(.82,art.strata*.72))
      .lerp(riverSediment,art.wadi*.49).multiplyScalar(art.shade);
   }else{
    const bands=(Math.sin(h*.19+x*.003+z*.002)*.5+.5)*rocky;
    vertexColor.set(spacious?'#e9dcc6':'#faf1e0')
      .lerp(sandstone,rocky*.65+bands*.12).multiplyScalar(nval);
   }
   if(biome!=='desert'){
    const vegetationNoise=Math.sin(x*.007+z*.009)*.5+.5;
    vertexColor.copy(biomeGroundBase).lerp(biomeGroundLight,.16+vegetationNoise*.25)
     .lerp(biomeGroundRock,Math.min(.72,rocky*.58));
   }
   if(terrain.battlefield?.generatorVersion===2){
    // Baked, subtle cut-and-fill earth at graded bastion edges. Same terrain
    // height field, no additional draw call or changing ground mesh.
    const earth=terrainGradingEdge(x,z,terrain.sites,gradingHomes,2,world.mapVersion);
    vertexColor.lerp(sandstone,earth*.16);
   }
   colors[n]=vertexColor.r;colors[n+1]=vertexColor.g;colors[n+2]=vertexColor.b;
   uv[k*2]=x/(spacious?2200:1500);uv[k*2+1]=z/(spacious?2200:1500);
   // Sample normals from the continuous field, not triangle tessellation:
   // border ring and playable terrain now have identical lighting at seams.
   const eps=1.6,dx=(heightAt(x+eps,z)-heightAt(x-eps,z))/(2*eps);
   const dz=(heightAt(x,z+eps)-heightAt(x,z-eps))/(2*eps);
   const inv=1/Math.hypot(dx,1,dz);
   normals[n]=-dx*inv;normals[n+1]=inv;normals[n+2]=-dz*inv;
  }
  for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){
   const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;
   indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.receiveShadow=true;mesh.userData.terrain=true;
  scene.add(mesh);groundMeshes.push(mesh);
 }
 // No decorative terrain, apron, cliff, or fade outside the modern playable
 // boundary. The 16 real tiles end at the black scene background exactly.
 // Legacy maps preserve their old visual perimeter.
 visualPerimeter=addVisualPerimeter({scene,size,heightAt,material,
  ringTiles:query.get('lite')==='1'?2:3,segments:22,
  textureScale:spacious?2200:1500,hardVoid:spacious});
 return chunks*chunks;
}
/** One merged rock mesh, built from the exact physical footprints. Basal
 * skirts fill the complete solid hull: no blocked ground under empty air. */
function addBattlefieldRocks(material){
 const vertices=[],colors=[],uv=[];
 const baseColor=new THREE.Color(biome==='desert'?'#c9ae8b':biomeStyle.rocks[0]);
 const dark=new THREE.Color(biome==='desert'?'#80664f':biomeStyle.rocks[1]);
 for(const [id,mesa] of terrain.mesas.entries()){
  const poly=mesa.outline,cx=poly.reduce((n,p)=>n+p.x,0)/poly.length,cz=poly.reduce((n,p)=>n+p.y,0)/poly.length;
  const peak=mesa.columns.reduce((n,c)=>n+c.height,0)/mesa.columns.length*(terrain.battlefield.profile==='rocky'?1.55:1.05);
  const r=rnd((seed^id*0x9e3779b9^0x536fa1)>>>0),rotation=r()*6.28;
  // Fine stepped strata and weathered shelves avoid monolithic orange boulders.
  // Still one merged visual mesh over the authoritative collision polygon.
  const rings=[1.02,.985,.94,.88,.82,.75,.67,.56,.41],
   levels=[-.8,.13,.23,.37,.54,.70,.84,.94,1],points=[];
  for(let k=0;k<rings.length;k++){
   points[k]=poly.map((p,i)=>{
    const erosion=k===0?1:1+Math.sin(i*2.37+rotation+k*.7)*.12+
     Math.sin(i*4.13+k*.53+rotation)*.035;
    const x=cx+(p.x-cx)*rings[k]*erosion,z=cz+(p.y-cz)*rings[k]*erosion;
    return [x-half,heightAt(x,z)+peak*levels[k]*(k===0?1:1+Math.sin(i*1.9+rotation)*.12),z-half];
   });
  }
  const tri=(a,b,c,band)=>{
   for(const p of [a,b,c]){
    vertices.push(...p);
    const s=Math.sin(p[1]*.165+(p[0]+half)*.009)*.09;
    const color=baseColor.clone().lerp(dark,Math.max(0,Math.min(.85,band+s)));
    colors.push(color.r,color.g,color.b);uv.push((p[0]+half)/150,p[1]/120);
   }
  };
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<poly.length;i++){
   const j=(i+1)%poly.length,a=points[k][i],b=points[k][j],c=points[k+1][i],d=points[k+1][j];
   tri(a,c,b,.08+(k%2)*.15+r()*.07);tri(b,c,d,.08+(k%2)*.15+r()*.07);
  }
  const top=[cx-half+Math.sin(rotation)*peak*.09,
   heightAt(cx,cz)+peak*1.02,cz-half+Math.cos(rotation)*peak*.08];
  for(let i=0;i<poly.length;i++)tri(points.at(-1)[i],top,points.at(-1)[(i+1)%poly.length],.02+r()*.06);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();
 // Do not project sandy dune artwork onto vertical cliffs. Use the
 // existing authored sandstone stratum atlas with world-space UV mapping.
 const rockMaps=sharedStoneMaps(query.get('lite')==='1');
 const mat=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,
  roughness:.96,roughnessMap:rockMaps.roughnessMap,
  normalMap:rockMaps.normalMap,normalScale:new THREE.Vector2(.34,.34),
  metalness:0,side:THREE.DoubleSide,flatShading:true});
 new THREE.TextureLoader().load('/src/assets/reborn/sandstone-strata-v1.png',map=>{
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  mat.map=map;mat.needsUpdate=true;
 },undefined,error=>console.warn('Sandstone strata unavailable; vertex colors retained',error));
 const mesh=new THREE.Mesh(geometry,mat);mesh.name='physical-battlefield-rocks';
 mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 return mesh;
}
const pbr=(color,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
function instancedStone(){
 // More irregular weathered sandstone, fewer identical round orange pebbles.
 const geometry=weatheredStoneGeometry(query.get('lite')==='1');
 // PBR albedo, sculpted normal and mineral roughness are shared with the
 // riverbed, ruins and oasis rocks. Three instanced palette groups remain
 // three draw calls; never create a material for each stone.
 const materials=(biome==='desert'?(spacious?
  ['#ccb091','#9e8267','#e1c19c']:['#bfa889','#a18c73','#d3bca0']):biomeStyle.rocks)
  .map(color=>stoneMaterial(color,{lowQuality:query.get('lite')==='1'}));
 const dummy=new THREE.Object3D(),groups=materials.map(mat=>new THREE.InstancedMesh(geometry,mat,1750));
 const contactGeometry=new THREE.PlaneGeometry(1,1);contactGeometry.rotateX(-Math.PI/2);
 const contacts=new THREE.InstancedMesh(contactGeometry,groundContactMaterial(),5250);
 const contactDummy=new THREE.Object3D();let contactCount=0;
 const counts=[0,0,0],r=rnd(seed^0x73c02f4b);
 const put=(x,z,wide,tall,depth)=>{
  // No decorative stones overhanging the black void or touching its edge.
  // Real collision rocks on playable terrain are independent of this pass.
  if(spacious&&(x<90||z<90||x>size-90||z>size-90))return;
  const k=Math.floor(r()*3);if(counts[k]>=1750)return;
  const y=heightAt(x,z);
  // Bury the lower half of the rock instead of standing it on the terrain.
  dummy.position.set(x-half,y+tall*.24,z-half);
  dummy.scale.set(wide,tall,depth);
  dummy.rotation.set((r()-.5)*.18,r()*6.28,(r()-.5)*.20);
  dummy.updateMatrix();groups[k].setMatrixAt(counts[k]++,dummy.matrix);
  if(contactCount<contacts.instanceMatrix.count){
   // A tight, faint contact patch grounds faceted sandstone without
   // leaving a giant round dark "sticker" around every small rock.
   contactDummy.position.set(x-half,y+.35,z-half);
   contactDummy.rotation.set(0,0,0);
   contactDummy.scale.set(wide*1.82,1,depth*1.75);
   contactDummy.updateMatrix();contacts.setMatrixAt(contactCount++,contactDummy.matrix);
  }
 };
 // Rough cliff faces and weathered sandstone ledges, skipping real ramps.
 for(const ridge of terrain.ridges)for(let i=1;i<ridge.spine.length;i++){
  const a=ridge.spine[i-1],b=ridge.spine[i],length=Math.hypot(b.x-a.x,b.y-a.y);
  for(let k=0;k<Math.ceil(length/(spacious?43:26));k++){
   const t=(k+r()*.7)/Math.ceil(length/(spacious?43:26)),x=a.x+(b.x-a.x)*t,z=a.y+(b.y-a.y)*t;
   if(rampAt(x))continue;
   for(let j=0;j<(spacious?1:2);j++){
    const dz=(r()-.5)*68,wide=spacious?7+r()*14:9+r()*22,
     tall=spacious?10+r()*22:16+r()*26;
    put(x+(r()-.5)*17,z+dz,wide,tall,11+r()*20);
   }
  }
 }
 if(terrain.battlefield)addBattlefieldRocks(materials[0]);
 for(const mesa of terrain.battlefield?[]:terrain.mesas)for(const col of mesa.columns){
  const x=col.base.reduce((n,p)=>n+p.x,0)/col.base.length;
  const z=col.base.reduce((n,p)=>n+p.y,0)/col.base.length;
  put(x,z,spacious?23+r()*29:20+r()*28,
   spacious?18+r()*34:30+r()*55,
   spacious?24+r()*27:18+r()*25);
  for(let i=0;i<(spacious?1:2);i++)
   put(x+(r()-.5)*55,z+(r()-.5)*55,8+r()*16,
    spacious?7+r()*16:8+r()*26,8+r()*15);
 }
 for(let i=0;i<(spacious?420:1600);i++){
  const x=75+r()*(size-150),z=75+r()*(size-150),index=world.index({x,y:z});
  if(index<0||world.blocked[index]||terrain.sites.some(p=>Math.hypot(x-p.x,z-p.y)<160)||
   (world.mapVersion>=27&&gradingHomes.some(p=>Math.hypot(x-p.x,z-p.y)<1190)))continue;
  put(x,z,spacious?1.4+r()*3.6:2+r()*5,
   spacious?.8+r()*2.7:1+r()*4,
   spacious?1.5+r()*4.2:2+r()*6);
 }
 // Continue weathered stones across the *visual* perimeter. This scatter
 // uses a different RNG stream so existing battlefield stones stay unchanged.
 const extra=rnd(seed^0xb487c7e1),margin=visualPerimeter?.margin??size*.5;
 for(let i=0;i<(spacious?0:2100);i++){
  // Only legacy maps retain the decorative exterior scatter. Scatter
  // only in the first narrow erosion apron adjacent to the playfield.
  const x=spacious?-95+extra()*(size+190):-margin+extra()*(size+2*margin);
  const z=spacious?-95+extra()*(size+190):-margin+extra()*(size+2*margin);
  if(x>=0&&x<=size&&z>=0&&z<=size)continue;
  // Decorative stones only on the visible first apron. Never populate
  // the solid black exterior beyond the edge fade.
  if(spacious&&Math.max(-x,x-size,-z,z-size)>8)continue;
  const cluster=extra()>(spacious?.96:.93);
  if(cluster){
   put(x,z,spacious?7+extra()*13:9+extra()*20,
    spacious?9+extra()*16:14+extra()*28,
    spacious?6+extra()*14:8+extra()*20);
   for(let k=0;k<3;k++)
    put(x+(extra()-.5)*55,z+(extra()-.5)*55,4+extra()*9,5+extra()*17,5+extra()*9);
  }else put(x,z,spacious?1.2+extra()*3.5:1.7+extra()*5.4,
   spacious?.8+extra()*2.8:1+extra()*3.8,
   spacious?1.5+extra()*4:2+extra()*6);
 }
 for(let i=0;i<groups.length;i++){
  groups[i].count=counts[i];groups[i].instanceMatrix.needsUpdate=true;
  groups[i].castShadow=false;groups[i].receiveShadow=true;scene.add(groups[i]);
 }
 contacts.count=contactCount;contacts.instanceMatrix.needsUpdate=true;
 contacts.userData={nonPlayable:true,groundContact:true};contacts.renderOrder=3;
 contacts.frustumCulled=false;scene.add(contacts);
 return counts.reduce((a,b)=>a+b,0);
}
function sandRoads(){
 // Discontinuous sandy tire marks share one GPU draw call, not thousands of
 // individual meshes. Gaps and imperfect widths imply old worn tracks.
 // Per-pixel alpha softens the old rectangular sticker appearance.
 const canvas=document.createElement('canvas');
 canvas.width=32;canvas.height=128;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(32,128);
 for(let y=0;y<128;y++)for(let x=0;x<32;x++){
  const edge=Math.sin(Math.PI*x/31)**1.7*Math.sin(Math.PI*y/127)**1.25;
  const noise=.8+.2*Math.sin(y*.73+x*1.91);
  const k=(y*32+x)*4;
  pixels.data[k]=89;pixels.data[k+1]=69;pixels.data[k+2]=47;
  pixels.data[k+3]=Math.round(172*edge*noise);
 }
 ctx.putImageData(pixels,0,0);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshBasicMaterial({
  map:texture,transparent:true,opacity:.62,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide
 });
 const geometry=new THREE.PlaneGeometry(1,1);
 geometry.rotateX(-Math.PI/2);
 const r=rnd(seed^0x2023cb47),dummy=new THREE.Object3D();
 const tracks=new THREE.InstancedMesh(geometry,material,5000);
 let count=0;
 for(const [a,b] of terrain.corridors){
  if(r()>.7)continue;
  const dx=b.x-a.x,dz=b.y-a.y,d=Math.hypot(dx,dz),steps=Math.floor(d/36);
  const heading=Math.atan2(dx,dz);
  for(let i=0;i<steps;i++){
   if(i%9===0||r()>.72||count>=4998)continue;
   const t=(i+.5)/steps,x=a.x+dx*t,z=a.y+dz*t;
   const index=world.index({x,y:z});
   if(index<0||world.blocked[index])continue;
   for(const offset of [-14,14]){
    const px=x+offset*Math.cos(heading),pz=z-offset*Math.sin(heading);
    dummy.position.set(px-half,heightAt(px,pz)+.46,pz-half);
    dummy.scale.set(4+r()*3,1,16+r()*7);
    dummy.rotation.set(0,heading,0);dummy.updateMatrix();
    tracks.setMatrixAt(count++,dummy.matrix);
   }
  }
 }
 tracks.count=count;
 tracks.instanceMatrix.needsUpdate=true;
 tracks.frustumCulled=false;
 scene.add(tracks);
}
function marker(position,color,radius=37){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,2.3,6,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.86}));
 ring.rotation.x=-Math.PI/2;ring.position.copy(position);ring.position.y+=2.1;
 scene.add(ring);return ring;
}
function primitiveBase(base){
 const group=new THREE.Group();const owner=base.owner;
 const wall=pbr(owner===0?'#5c91a8':'#a57753',.75,.33),roof=pbr('#bda884'),detail=pbr('#41494a',.62,.54);
 const add=(geo,mat,x,y,z)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);};
 add(new THREE.CylinderGeometry(89,98,7,8),pbr('#665d4a'),0,3,0);
 add(new THREE.BoxGeometry(128,55,110),wall,0,34,0);
 add(new THREE.BoxGeometry(138,12,118),roof,0,67,0);
 add(new THREE.BoxGeometry(52,28,48),detail,0,84,-12);
 for(const x of [-48,48])add(new THREE.CylinderGeometry(7,11,59,8),detail,x,104,-22);
 group.position.copy(pos(base.x,base.y));scene.add(group);return group;
}
function normalized(node,width){
 node.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(node),extent=box.getSize(new THREE.Vector3());
 if(extent.x<.0001||extent.z<.0001)return node;
 const factor=width/Math.max(extent.x,extent.z);
 node.scale.multiplyScalar(factor);
 node.position.set(-box.getCenter(new THREE.Vector3()).x*factor,-box.min.y*factor,-box.getCenter(new THREE.Vector3()).z*factor);
 node.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
 return node;
}
async function tryModel(url){
 if(!models.has(url))models.set(url,loader.loadAsync(url).catch(err=>{models.delete(url);throw err;}));
 return models.get(url);
}
// Rough plaster material and cracks are shared across every imported real
// ruin mesh. Original glTF triangles have normals but no UVs, so assign
// face-oriented UV coordinates before adding textured masonry weathering.
function makeRuinGrit(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const c=canvas.getContext('2d'),image=c.createImageData(512,512),random=rnd(seed^0x8174c2aa);
 for(let i=0;i<512*512;i++){
  const j=i*4,noise=(random()-.5)*31,shade=226+noise;
  image.data[j]=shade+7;image.data[j+1]=shade+2;image.data[j+2]=shade-5;image.data[j+3]=255;
 }
 c.putImageData(image,0,0);
 for(let i=0;i<130;i++){
  const x=random()*512,y=random()*512,size=3+random()*44;
  c.fillStyle='rgba(72,54,38,'+(.015+random()*.085)+')';
  c.beginPath();c.ellipse(x,y,size*.95,size*.4,random()*Math.PI,0,Math.PI*2);c.fill();
 }
 for(let i=0;i<35;i++){
  const x=random()*512,y=random()*512;
  c.strokeStyle='rgba(87,69,53,'+(.07+random()*.11)+')';c.lineWidth=.5+random()*1.3;
  c.beginPath();c.moveTo(x,y);
  c.lineTo(x+(random()-.5)*48,y+random()*70);
  c.lineTo(x+(random()-.5)*100,y+random()*96);c.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 return texture;
}
const ruinGrit=makeRuinGrit();
let ruinStrata=null;
const ruinStrataLoad=new Promise(resolve=>{
 new THREE.TextureLoader().load('/src/assets/reborn/sandstone-strata-v1.png',
  texture=>{
   texture.colorSpace=THREE.SRGBColorSpace;
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
   texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
   ruinStrata=texture;resolve(true);
  },undefined,()=>{
   console.warn('Ruin sandstone fallback: using procedural weathering');
   resolve(false);
  });
});
function weatherRuinMeshes(node){
 node.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const geometry=mesh.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  if(positions&&!geometry.getAttribute('uv')){
   const uv=new Float32Array(positions.count*2);
   for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const nx=Math.abs(normals?.getX(i)??0),ny=Math.abs(normals?.getY(i)??0),nz=Math.abs(normals?.getZ(i)??0);
    const u=ny>nx&&ny>nz?x:nx>nz?z:x;
    const v=ny>nx&&ny>nz?z:y;
    uv[i*2]=u*.9;uv[i*2+1]=v*.9;
   }
   geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  const upgrade=m=>{
   const value=m.clone();
   if(/plaster|sandstone|concrete|roof|rubble|dust/i.test(value.name||'')){
    // Sandstone keeps its native stratified PBR grain, while plaster, roof
    // and concrete share the fine procedural dirt/crack map.
    const naturalStone=/sandstone|rubble/i.test(value.name||'');
    const detail=naturalStone?(ruinStrata??ruinGrit):ruinGrit;
    value.map=detail;value.bumpMap=detail;
    value.bumpScale=naturalStone?.17:.09;
    value.roughness=1;value.metalness=0;value.needsUpdate=true;
   }
   return value;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(upgrade):upgrade(mesh.material);
  mesh.castShadow=mesh.receiveShadow=true;
 });
}
// Dust-buried remnants of a service road by each ruined settlement.
// Deterministic, non-collidable and instanced: two draw calls per ruin,
// no shadows, no per-frame updates and most of each slab hidden under sand.
function addBuriedRuinRoad(anchor,ruin,index){
 const random=rnd((seed^(index*0x51f15e5d)^0x927acdef)>>>0);
 const spot=[],drift=[];
 const c=Math.cos(ruin.rotation),sn=Math.sin(ruin.rotation);
 const baseHeight=heightAt(ruin.x,ruin.y);
 const offset=(x,z)=>heightAt(ruin.x+c*x+sn*z,ruin.y-sn*x+c*z)-baseHeight;
 for(let i=0;i<4;i++){
  const x=ruin.width*(.54+i*.18);
  const z=ruin.depth*(.29+(random()-.5)*.18);
  const w=ruin.width*(.13+random()*.04);
  const d=ruin.depth*(.13+random()*.05);
  const rotation=(random()-.5)*.23;
  const y=offset(x,z)+.08;
  spot.push({x,y,z,w,h:.25,d,rotation});
  drift.push({x:x+1.7+random()*4,y:y+.23,z:z+(random()-.5)*4,
   w:w*(.63+random()*.13),h:.30,d:d*(.66+random()*.12),
   rotation:rotation+.04});
 }
 for(const [parts,color,opacity,name] of [
  [spot,'#968676',.46,'BuriedRuinRoad'],
  [drift,'#ba8d57',.90,'WindblownRoadSand']
 ]){
  const material=new THREE.MeshStandardMaterial({
   color,roughness:1,metalness:0,transparent:true,
   opacity,depthWrite:false
  });
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),
   material,parts.length);
  mesh.name=name;mesh.userData={visualOnly:true,nonPlayable:true,roadFragment:true};
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};
  const dummy=new THREE.Object3D();
  parts.forEach((part,i)=>{
   dummy.position.set(part.x,part.y,part.z);
   dummy.rotation.set(0,part.rotation,0);
   dummy.scale.set(part.w,part.h,part.d);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();
  anchor.add(mesh);
 }
}
// A few hand-shaped, collapsed remnants make the two real ruin GLBs
// appear differently destroyed across the map. They are separate VISUAL-ONLY
// child meshes, never additional World obstacles or save fields.
function dressRuinDamage(anchor,ruin,index){
 const random=rnd((seed^(index*0x9e3779b9)^0x476fac13)>>>0);
 const group=new THREE.Group();
 group.name='visual-ruin-collapse-'+index;
 group.userData={visualOnly:true,nonPlayable:true,ruinCollapse:true};
 const masonry=new THREE.MeshStandardMaterial({color:'#967f66',roughness:1,metalness:.05,flatShading:true});
 const charred=new THREE.MeshStandardMaterial({color:'#4b463e',roughness:.96,metalness:.18});
 const palette=[masonry,charred];
 const fragments=4+index%4;
 for(let part=0;part<fragments;part++){
  const ang=random()*Math.PI*2,rx=Math.cos(ang)*ruin.width*(.16+random()*.24);
  const rz=Math.sin(ang)*ruin.depth*(.16+random()*.25);
  const scale=7+random()*12,broken=part%3===0;
  const geo=broken
   ?new THREE.TetrahedronGeometry(scale*(.85+random()*.45),0)
   :new THREE.BoxGeometry(scale*(1+random()),2.4+random()*4,scale*(.6+random()));
  const mesh=new THREE.Mesh(geo,palette[(part+index)%2]);
  mesh.position.set(rx,2+random()*6,rz);
  mesh.rotation.set((random()-.5)*.9,ang,(random()-.5)*.7);
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 // Torn roof sections/leaning beams: different configurations per ruin,
 // not a pristine square rooftop cloned identically at every site.
 for(let beam=0;beam<2+index%2;beam++){
  const length=ruin.width*(.18+random()*.17);
  const iron=new THREE.Mesh(new THREE.BoxGeometry(2.4+random()*2.5,length,2.8),charred);
  const side=beam%2?-1:1;
  iron.position.set(side*ruin.width*.27,10+random()*ruin.height*.32,
   (random()-.5)*ruin.depth*.46);
  iron.rotation.set((random()-.5)*.35,random()*Math.PI,side*(.48+random()*.44));
  iron.castShadow=true;iron.receiveShadow=true;group.add(iron);
 }
 anchor.add(group);
 return group;
}
async function addRuins(){
 // Every ruin instance is a real glTF triangle mesh with PBR materials.
 // Wait for the authored rock texture so instances are textured on first paint.
 await ruinStrataLoad;
 const data=await Promise.all([
  tryModel('/src/assets/reborn/canyon-3d/ruin-house.gltf'),
  tryModel('/src/assets/reborn/canyon-3d/ruin-depot.gltf')]);
 for(const [i,ruin] of terrain.ruins.entries()){
  const source=data[ruin.variant===1?1:0].scene.clone(true);
  weatherRuinMeshes(source);
  normalized(source,ruin.width*.98);
  const anchor=new THREE.Group();
  anchor.position.copy(pos(ruin.x,ruin.y));
  anchor.rotation.y=ruin.rotation;
  anchor.add(source);
  if(spacious){dressRuinDamage(anchor,ruin,i);addBuriedRuinRoad(anchor,ruin,i);}
  scene.add(anchor);ruinMeshes.push(anchor);
 }
 return ruinMeshes.length;
}
$('simulation').onclick=()=>{
 running=!running;$('simulation').textContent=running?'Simulation pausieren':'Simulation starten';
 if(!running)sound.pause();
 $('simulation').setAttribute('aria-pressed',String(running));
 updateSimulationBanner();
};
$('rotate-left').onclick=()=>spin(-Math.PI/4);
$('rotate-right').onclick=()=>spin(Math.PI/4);
function spin(angle){
 const offset=camera.position.clone().sub(controls.target);
 offset.applyAxisAngle(new THREE.Vector3(0,1,0),angle);
 camera.position.copy(controls.target).add(offset);
 camera.lookAt(controls.target);controls.update();
}
$('home').onclick=()=>{
 controls.target.copy(cameraTarget);camera.position.copy(cameraTarget).add(new THREE.Vector3(1200,1110,1640));
 camera.zoom=.59;camera.updateProjectionMatrix();controls.update();
};
$('load').onclick=()=>{
 const text=$('seed').value.trim();
 const q=new URLSearchParams({bastions:$('bastions').value,seed:String(text===''?randomMapSeed():Number(text)>>>0),terrain:terrain.battlefield?.profile??'random',biome});
 location.href=(window.Sandforge3DMenu?.gameRoute?.()??'/webgl-preview.html')+'?'+q;
};
// Camera navigation is independent of the simulation. WASD and cursor keys
// work during pause; F becomes attack-move so A remains free for panning.
const panKeys=new Set();
const panControls=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
const forward=new THREE.Vector3(),right=new THREE.Vector3(),deltaPan=new THREE.Vector3();
const cameraRay=new THREE.Raycaster(),cameraHit=new THREE.Vector3();
const cameraGroundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const cameraCorners=[new THREE.Vector2(-1,-1),new THREE.Vector2(-1,1),
 new THREE.Vector2(1,-1),new THREE.Vector2(1,1)];
const typing=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||
 document.activeElement?.isContentEditable===true;
addEventListener('keydown',event=>{
 if(typing()||event.ctrlKey||event.metaKey||event.altKey)return;
 if(panControls.has(event.code)){
  event.preventDefault();panKeys.add(event.code);return;
 }
 if(event.repeat)return;
 // Perf diagnostic without DevTools focus (which swallows WASD and R).
 // Only available during ?perf=1, never a gameplay production hotkey.
 if(query.get('perf')==='1'&&event.shiftKey&&event.code==='KeyB'){
  event.preventDefault();
  const enabled=!battlefield.siteDecorEnabled;
  const affected=battlefield.setSiteDecorEnabled(enabled);
  battlefield.message('Basis-Dekoration '+(enabled?'eingeblendet':'ausgeblendet')+
   ' · '+affected+' Gebäude (Performancevergleich)');
  return;
 }
 // Download bounded numeric diagnostics without stealing keyboard focus.
 // Shift+P is active only in explicit ?perf=1 review sessions.
 if(query.get('perf')==='1'&&event.shiftKey&&event.code==='KeyP'){
  event.preventDefault();
  const report={
   version:'sandforge-webgl-performance-v1',
   gameTime:game.time,
   units:game.units.filter(u=>u.hp>0&&!u.carrier).length,
   scene:performanceWatch.snapshot(),
   hitches:performanceWatch.spikeHistory(),
   checkpoints:performanceWatch.history()
  };
  const objectUrl=URL.createObjectURL(new Blob(
   [JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=objectUrl;
  link.download='sandforge-performance-'+Math.floor(game.time)+'s.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  battlefield.message('Performancebericht gespeichert · '+report.hitches.length+' Hänger');
  return;
 }
 if(event.code==='KeyQ'){event.preventDefault();spin(-Math.PI/8);}
 if(event.code==='KeyE'){event.preventDefault();spin(Math.PI/8);}
 if(event.code==='Space'){event.preventDefault();$('simulation').click();}
});
addEventListener('keyup',event=>panKeys.delete(event.code));
addEventListener('blur',()=>panKeys.clear());
function stepCamera(dt){
 let horizontal=Number(panKeys.has('KeyD')||panKeys.has('ArrowRight'))-
  Number(panKeys.has('KeyA')||panKeys.has('ArrowLeft'));
 let vertical=Number(panKeys.has('KeyW')||panKeys.has('ArrowUp'))-
  Number(panKeys.has('KeyS')||panKeys.has('ArrowDown'));
 const magnitude=Math.hypot(horizontal,vertical);
 if(magnitude){
  camera.updateMatrixWorld();
  right.setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const speed=(770/Math.max(.25,camera.zoom))*Math.min(.08,dt)/magnitude;
  deltaPan.copy(right).multiplyScalar(horizontal*speed).addScaledVector(forward,vertical*speed);
  camera.position.add(deltaPan);controls.target.add(deltaPan);
 }
 // Screen-corner ground intersections, not a guessed radius, determine
 // exactly what this tilted/isometric orthographic camera can reveal.
 // Decorative landscape ends far outside the actual 4160+ unit world; keep
 // the viewing footprint within the cliff/fog transition so no beige void
 // or mesh edge appears, including on wide screens and after camera rotation.
// Permit a small overscan beyond the playable border. The frustum clamp
 // below still keeps decorative mesh endings out of view.
 const focusLimit=half+(spacious?cameraBlackOverscan(size):cameraEdgeReach(size));
 const nx=Math.max(-focusLimit,Math.min(focusLimit,controls.target.x));
 const nz=Math.max(-focusLimit,Math.min(focusLimit,controls.target.z));
 if(nx!==controls.target.x||nz!==controls.target.z){
  camera.position.x+=nx-controls.target.x;camera.position.z+=nz-controls.target.z;
  controls.target.x=nx;controls.target.z=nz;
 }
 // Modern maps intentionally have NO geometry outside the boundary.
 // Allow the frustum to show clean black there, instead of pushing the
 // camera back into the playable map or zooming in unexpectedly.
 if(spacious)return;
 // Legacy maps retain the old apron/corner protection unchanged.
 // Keep the visible corners inside the textured erosion apron, not at
 // the far outer mesh edge where the black scene background is exposed.
 // The authored perimeter stays decorative; no playable bounds change.
 // The exterior ring already fades to solid black within 18 world units.
 // Its far mesh boundary is much further out than the old 320-unit camera
 // cutoff, which prevented reaching the last playable edge on tilted views.
 // Leave 280 world units of black ring beyond the viewport as a safety margin.
 const perimeterMargin=visualPerimeter?.margin??size*.5;
 const border=half+Math.max(320,Math.min(2000,perimeterMargin-280)),
  groundY=heightAt(controls.target.x+half,controls.target.z+half);
 cameraGroundPlane.constant=-groundY;
 camera.updateMatrixWorld(true);
 const scanCorners=()=>{
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const c of cameraCorners){
   cameraRay.setFromCamera(c,camera);
   if(!cameraRay.ray.intersectPlane(cameraGroundPlane,cameraHit))continue;
   minX=Math.min(minX,cameraHit.x);maxX=Math.max(maxX,cameraHit.x);
   minZ=Math.min(minZ,cameraHit.z);maxZ=Math.max(maxZ,cameraHit.z);
  }
  return {minX,maxX,minZ,maxZ};
 };
 let view=scanCorners();
 const span=Math.max((view.maxX-view.minX)/(border*2),(view.maxZ-view.minZ)/(border*2));
 if(span>1.001&&Number.isFinite(span)){
  // Preserve the map framing on ultrawide displays instead of permitting a
  // zoom level at which the complete visual edge becomes visible.
  camera.zoom=Math.min(controls.maxZoom,camera.zoom*span*1.035);
  camera.updateProjectionMatrix();
  view=scanCorners();
 }
 const correction=(low,high)=>low < -border ? -border-low : high>border ? border-high : 0;
 const fixX=correction(view.minX,view.maxX);
 const fixZ=correction(view.minZ,view.maxZ);
 if(fixX||fixZ){
  camera.position.x+=fixX;camera.position.z+=fixZ;
  controls.target.x+=fixX;controls.target.z+=fixZ;
 }
}
function resize(){
 const w=Math.max(320,stage.clientWidth),h=Math.max(280,stage.clientHeight);
 camera.left=-w/h*480;camera.right=w/h*480;camera.top=480;camera.bottom=-480;
 camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
new ResizeObserver(resize).observe(stage);resize();
const chunks=buildTerrain();
boundaryCliffs=addBoundaryCliffs({scene,size,heightAt,seed,lowQuality:query.get('lite')==='1',softRim:spacious,hardVoid:spacious});
const stones=instancedStone();
if(biome==='desert')sandRoads();
const biomeVegetation=addBiomeVegetation({THREE,scene,world,terrain,game,heightAt,seed,biome,
 lowQuality:query.get('lite')==='1'});
const stylizedScenery=biome==='desert'&&query.get('art')!=='legacy'
 ?addStylizedDesertWorld({scene,world,terrain,game,heightAt,seed,
  lowQuality:query.get('lite')==='1'}):null;
// Small ground-level stones accent the winding dry wash from the reference.
// One visual-only instanced draw call; no gameplay pathing or collision edits.
const washStones=spacious&&biome==='desert'?addDesertWashStones({scene,world,size,seed,heightAt,
 sites:terrain.sites,lowQuality:query.get('lite')==='1'}):null;
const battlefield=new SandforgeBattlefield({
 game,world,terrain,scene,renderer,camera,controls,loader,groundMeshes,heightAt,pos,biome,
 lite:query.get('lite')==='1'
});
const groundTracks=new SandforgeGroundTracks({
 scene,game,pos,heightAt,lite:query.get('lite')==='1'
});
groundTracks.capture();
const atmosphere=new SandforgeAtmosphere3D({
 scene,game,world,heightAt,camera,controls,biome,lowQuality:query.get('lite')==='1'
});
battlefield.fogAtmosphere=atmosphere;
atmosphere.setFogEnabled(battlefield.fogEnabled);
// Fog of War is the default for the actual 3D game. Older preview links
// used fog=0 to make screenshots of bare terrain; don't let those links
// silently turn the player's war map into an omniscient desert.
// Developers can still explicitly disable the visual overlay via fog=off,
// and players retain the NEBEL AN/AUS HUD button.
if(query.get('fog')==='off'){
 battlefield.fogEnabled=false;
 battlefield.updateFog();
}
// Visual verification tool: a stationary close 3D view with an XYZ reference.
// Never changes game state, saves, unit collision, AI, or production.
let showcaseActive=false,showcasePrevious=null;
const showcaseFocus=new THREE.Vector3(focalX-half,heightAt(focalX,focalZ)+42,focalZ-half);
const showcaseAxes=new THREE.AxesHelper(125);
showcaseAxes.name='visual-only-3d-reference-axes';
showcaseAxes.position.copy(showcaseFocus);
showcaseAxes.userData={visualOnly:true,nonPlayable:true};
showcaseAxes.visible=false;
scene.add(showcaseAxes);
const showcaseButton=document.createElement('button');
showcaseButton.id='sf3d-showcase';
showcaseButton.type='button';
showcaseButton.className='sf-tool-button';
showcaseButton.textContent='3D';
showcaseButton.setAttribute('aria-label','3D-Kamerademo ein- oder ausschalten');
showcaseButton.title='3D-Nahansicht: ruhige Kamera, Kriegsnebel bleibt erhalten';
battlefield.panel.querySelector('#sf-tools').prepend(showcaseButton);
const showcaseHint=document.createElement('div');
showcaseHint.id='sf3d-showcase-hint';
showcaseHint.setAttribute('role','status');
showcaseHint.textContent='3D-NAHANSICHT · Ruhige Kamera · Kriegsnebel aktiv · Q/E: drehen · 3D: zurück';
showcaseHint.hidden=true;
document.body.append(showcaseHint);
// The same authoritative Fog-of-War works in both camera modes.
// Label the existing toggle clearly instead of hiding the fog in showcase.
const fogToggle=battlefield.panel.querySelector('button[data-action="fog"]');
function syncFogIndicator(){
 const enabled=battlefield.fogEnabled;
 if(fogToggle){
  fogToggle.textContent=enabled?'NEBEL AN':'NEBEL AUS';
  fogToggle.title=enabled?'Kriegsnebel ausschalten':'Kriegsnebel einschalten';
  fogToggle.setAttribute('aria-pressed',String(enabled));
 }
 showcaseHint.textContent='3D-NAHANSICHT · Ruhige Kamera · Kriegsnebel '+(enabled?'AN':'AUS')+' · Q/E: drehen · 3D: zurück';
}
battlefield.panel.addEventListener('click',event=>{
 if(event.target.closest('button[data-action="fog"]'))syncFogIndicator();
});
syncFogIndicator();
function setShowcase(enabled){
 if(showcaseActive===enabled)return;
 showcaseActive=enabled;
 if(enabled){
  showcasePrevious={
   position:camera.position.clone(),target:controls.target.clone(),
   zoom:camera.zoom,autoRotate:controls.autoRotate
  };
  controls.autoRotate=false;
  controls.target.copy(showcaseFocus);
  // Close, low-angle view makes rock and soldier volume obvious.
  camera.position.copy(showcaseFocus).add(new THREE.Vector3(420,350,620));
  camera.lookAt(showcaseFocus);
  camera.zoom=1.55;
  camera.updateProjectionMatrix();
  // Never auto-rotate or reveal hidden map sectors. Camera control stays manual.
  showcaseAxes.visible=true;
 }else{
  controls.autoRotate=false;
  if(showcasePrevious){
   camera.position.copy(showcasePrevious.position);
   controls.target.copy(showcasePrevious.target);
   camera.zoom=showcasePrevious.zoom;
   camera.updateProjectionMatrix();
   controls.autoRotate=showcasePrevious.autoRotate;
  }
  showcaseAxes.visible=false;
  showcasePrevious=null;
 }
 controls.update();
 showcaseButton.setAttribute('aria-pressed',String(enabled));
 showcaseButton.textContent=enabled?'3D ✓':'3D';
 showcaseHint.hidden=!enabled;
}
showcaseButton.onclick=()=>setShowcase(!showcaseActive);
if(query.get('showcase')==='1')setShowcase(true);
const desertArt=new DesertArtPass({scene,world,terrain,heightAt,pos,loader,biome,lowQuality:query.get('lite')==='1'});
const oases=new DesertOases({scene,game,heightAt,groundMeshes,lowQuality:query.get('lite')==='1',enabled:biome==='desert'&&query.get('oases')!=='off'});
battlefield.oases=oases;
const oasisFocus=oases.layout.find(o=>o.type===query.get('oasis'));
if(oasisFocus){
 const target=pos(oasisFocus.x,oasisFocus.y);target.y+=24;
 camera.position.add(target.clone().sub(controls.target));controls.target.copy(target);
 camera.zoom=1.55;camera.updateProjectionMatrix();controls.update();
}
window.addEventListener('pagehide',event=>{if(!event.persisted){oases.dispose();battlefield.productionGates.dispose();}});
let desertArtReady=false;
const effects=new SandforgeCombatEffects({scene,camera,game,world,heightAt,pos,battlefield,biome,lowQuality:query.get('lite')==='1',vehicleDust:query.get('dust')!=='off'});
// Renderer-only weather preview: weather rules in Simulation are unchanged.
const stormButton=document.createElement('button');
stormButton.id='sf3d-storm';
stormButton.type='button';
stormButton.className='sf-tool-button';
const stormLabel=biome==='snow'?'SCHNEESTURM':biome==='jungle'?'REGENNEBEL':'SANDSTURM';
stormButton.setAttribute('aria-label','Dreidimensionalen '+stormLabel+' zu Testzwecken umschalten');
stormButton.title='GPU-'+stormLabel+' demonstrieren (ändert keine Spielregeln)';
battlefield.panel.querySelector('#sf-tools').prepend(stormButton);
function setStormPreview(enabled){
 atmosphere.setStormPreview(enabled);
 stormButton.textContent=enabled?stormLabel+' AN':stormLabel;
 stormButton.setAttribute('aria-pressed',String(Boolean(enabled)));
}
stormButton.onclick=()=>setStormPreview(!atmosphere.stormPreview);
setStormPreview(query.get('storm')==='1');
const constructionRecovery=new SandforgeConstructionRecovery(game);
const sound=new Soundscape();
// The user's original cinematic MP3 is streamed quietly through its own
// music gain bus, with ducking for local German alerts and weapon effects.
// Unlike the old 4-oscillator ambient synth it needs no continuous voices.
const bootOptions=window.Sandforge3DMenu?.readOptions?.()??{};
const savedVolume=(field,fallback)=>Number.isFinite(Number(bootOptions[field]))&&
 bootOptions[field]!==null&&bootOptions[field]!==undefined?
 Math.max(0,Math.min(1,Number(bootOptions[field])/100)):fallback;
sound.setVolume(savedVolume('masterVolume',.85));
sound.setEffectsVolume(savedVolume('effectsVolume',.85));
sound.setEngineSoundsEnabled(bootOptions.engineSoundsEnabled!==false);
sound.setMusicVolume(savedVolume('musicVolume',.22));
sound.setMusicEnabled(bootOptions.musicEnabled!==false);
sound.setEnabled(bootOptions.sound!==false);
sound.bindGame(game);
battlefield.effects=effects;
const strategicEffects=new SandforgeStrategicEffects({
 scene,game,heightAt,pos,battlefield,sound
});
window.addEventListener('pagehide',event=>{
 if(!event.persisted)strategicEffects.dispose();
});
const soundButton=$('sound');
function updateSoundButton(){
 soundButton.textContent=sound.enabled?'Sound ausschalten':'Sound einschalten';
 soundButton.setAttribute('aria-pressed',String(sound.enabled));
 soundButton.title=sound.enabled?(sound.context?.state==='running'?'Audio aktiv':'Beim nächsten Klick aktivieren'):'Sound aktivieren';
}
updateSoundButton();
let audioUnlockPending=false;
function unlockGameAudio(){
 if(!sound.enabled||sound.context?.state==='running'||audioUnlockPending)return;
 audioUnlockPending=true;
 void sound.unlock().then(()=>{
  sound.select();updateSoundButton();
 }).catch(error=>console.warn('WebAudio freischalten fehlgeschlagen',error))
 .finally(()=>{audioUnlockPending=false;});
}
window.addEventListener('pointerdown',unlockGameAudio,{capture:true});
window.addEventListener('keydown',unlockGameAudio,{capture:true});
// WebAudio may be suspended by Safari/Chromium after tab switches, display
// sleep or device changes. The gesture listeners above remain the fallback
// when a focus/visibility event has no audio-unlock permission.
window.addEventListener('focus',()=>{
 if(!document.hidden)unlockGameAudio();
});
window.addEventListener('pageshow',()=>{
 if(!document.hidden)unlockGameAudio();
});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)unlockGameAudio();
});
const soundView={
 get width(){return renderer.domElement.clientWidth;},
 get height(){return renderer.domElement.clientHeight;},
 get camera(){return {x:controls.target.x+half,y:controls.target.z+half,zoom:camera.zoom};},
 screen(p){
  const v=new THREE.Vector3(p.x-half,heightAt(p.x,p.y)+22,p.y-half).project(camera);
  return {x:(v.x*.5+.5)*renderer.domElement.clientWidth,
          y:(.5-v.y*.5)*renderer.domElement.clientHeight};
 }
};
battlefield.sound=sound;
soundButton.onclick=async()=>{
 const enabled=!sound.enabled;
 sound.setEnabled(enabled);
 if(enabled){
  try{await sound.unlock();sound.select();}
  catch(error){console.warn('WebAudio unavailable',error);}
 }else sound.silenceScene();
 updateSoundButton();
};

const performanceWatch=new SandforgePerformanceWatch({game,renderer,effects,groundTracks,battlefield});
// The 3D preview reuses the authoritative, player-only classic attack alerts.
let lastAttackSequence=game.attackAlerts.sequence;
let lastAttackBannerUntil=-Infinity;
function updateAttackWarning(){
 const sequence=game.attackAlerts.sequence;
 const notice=battlefield.panel.querySelector('#sf-message');
 if(running&&game.status==='playing'&&sequence>lastAttackSequence){
  lastAttackSequence=sequence;
  battlefield.message('Captain, wir werden angegriffen!');
  notice.dataset.attackAlert='true';
  notice.style.color='#ff6b60';
  lastAttackBannerUntil=game.time+5.5;
  sound.announceAttack();
  // Do not delay the red minimap beacon until the next 700ms refresh.
  battlefield.drawMinimap();
 }
 if(game.time>=lastAttackBannerUntil&&notice.dataset.attackAlert==='true'){
  delete notice.dataset.attackAlert;
  notice.style.removeProperty('color');
 }
}
let lastFrame=performance.now(),frames=0,lastOutcome=game.status;
function animate(now){
 performanceWatch.begin(now);
 const dt=Math.min(.08,(now-lastFrame)/1000);lastFrame=now;
 const beforeSteps=performanceWatch.enabled?performance.now():0;
 if(running){
  accumulator=Math.min(accumulator+dt,.20);
  let steps=0;while(accumulator>=.05&&steps<4){game.step(.05);constructionRecovery.tick();accumulator-=.05;steps++;}
 }
 // Losses are tracked independently of the mute state. A disembarking
 // passenger stays in Simulation.units and is never reported as killed.
 // Short local voice + radio fallback; visible HUD notice even when muted.
 const lost=running?sound.reportUnitLosses(game):0;
 if(lost)battlefield.message(lost===1?'Einheit verloren':
  'Einheit verloren · '+lost+' Einheiten');
 // Show the end-of-match banner on the same frame that the final unit or
 // building falls, instead of waiting for the twice-a-second HUD refresh.
 if(game.status!==lastOutcome){lastOutcome=game.status;updateSimulationBanner();}
 // Measure simulation and 3D/DOM presentation separately. The former
 // monitor reported their *sum* as 'simulation' and hid late-game UI costs.
 updateAttackWarning();
 if(performanceWatch.enabled)performanceWatch.simulation(performance.now()-beforeSteps);
 const beforeSync=performanceWatch.enabled?performance.now():0;
 if(running){
  // Render between the last two authoritative 20-Hz snapshots.
  battlefield.sync(false,dt,true,Math.min(1,Math.max(0,accumulator/.05)));
 }else{
  battlefield.sync(false,0,false,1); // freeze clips during tactical pause
 }
 if(performanceWatch.enabled)performanceWatch.presentation(performance.now()-beforeSync);
 const beforeAux=performanceWatch.enabled?performance.now():0;
 if(running)groundTracks.capture();
 groundTracks.update(dt,running);
 battlefield.updateCommandPulse(dt);
 const beforeEffects=performanceWatch.enabled?performance.now():0;
 effects.update(dt,running,accumulator);
 strategicEffects.update(running);
 if(performanceWatch.enabled)performanceWatch.effectsCost(performance.now()-beforeEffects);
 if(running&&sound.enabled)sound.update(game,soundView);
 controls.update();
 stepCamera(dt);
 controls.update();
 // Keep the shadow-map volume centered on the active camera area.
 const shift=controls.target.clone().sub(sun.target.position);
 sun.position.add(shift);sun.target.position.add(shift);
 atmosphere.update(dt);
 oases.update(now*.001);
 if(performanceWatch.enabled)performanceWatch.auxiliary(performance.now()-beforeAux);
 const beforeRender=performanceWatch.enabled?performance.now():0;
 renderer.render(scene,camera);
 // The wall-line ghost deliberately hides the single-building hologram. A
 // separate instanced ghost still needs the overlay render pass while dragging.
 if(battlefield.buildPreview?.visible||battlefield.wallLinePreview?.visible){
  // A second render pass guarantees the translucent construction silhouette
  // is always visible even behind rocks, soldiers, the black fog or buildings.
  // The first pass already cleared the frame. Clear only depth for the overlay.
  const autoClear=renderer.autoClear;
  renderer.autoClear=false;
  renderer.clearDepth();
  renderer.render(battlefield.buildPreviewScene,camera);
  renderer.autoClear=autoClear;
 }
 if(performanceWatch.enabled)performanceWatch.render(performance.now()-beforeRender);
 performanceWatch.end(now);
 frames++;elapsed+=dt;
 if(elapsed>=.5){
  updateSimulationBanner();
  $('fps').textContent=String(Math.round(frames/elapsed));frames=0;elapsed=0;
  $('clock').textContent=Math.floor(game.time)+' s';
 }
}
renderer.setAnimationLoop(animate);
window.__sandforgeWebGL={renderer,scene,camera,controls,game,terrain,heightAt,battlefield,effects,atmosphere,sound,constructionRecovery,visualPerimeter,boundaryCliffs,panKeys,groundTracks,oases,biome,biomeVegetation,
 performance:performanceWatch,
 // Console diagnostic: compare FPS/draw calls with site props on/off live.
 setSiteDecorEnabled:enabled=>battlefield.setSiteDecorEnabled(enabled),
 setStormPreview,
 get showcaseActive(){return showcaseActive;},
 setShowcase,
 get ruinsLoaded(){return ruinMeshes.length;},
 get desertArtReady(){return desertArtReady;},
 get loaded(){return status.dataset.ready==='true';},
 get simulationRunning(){return running;},
 sampleGround:(x,z)=>heightAt(x,z)};
async function main(){
 try{
  setStatus('Lade echte 3D-Ruinen …');
  const ruins=await addRuins();
  desertArt.load().then(count=>{
   console.info('3D environment props',count);
  }).catch(error=>console.warn('Desert detail fallback',error))
   .finally(()=>{desertArtReady=true;});
  // The 3D battlefield is live immediately; heavyweight PBR assets stream in.
  battlefield.sync(true);
  status.dataset.ready='true';
  setStatus((terrain.battlefield?TERRAIN_LABELS[terrain.battlefield.profile]+' · Seed '+seed+' · ':'')+'WebGL2 aktiv · '+chunks+' Terrain-Chunks · '+stones+' Felsen · '+ruins+' glTF-Ruinen · 3D-Spielmechanik aktiv.');
 }catch(error){
  console.error(error);errorNode.textContent='3D-Assets konnten nicht geladen werden: '+String(error);
  status.dataset.ready='false';setStatus('WebGL-Szene verfügbar; Asset-Ladevorgang fehlgeschlagen');
 }
}
main();
