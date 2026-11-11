import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import {createHash} from 'node:crypto';
mkdirSync('dist', { recursive: true });
// RC2: WebGL is the default for all ordinary builds, including Docker.
// Explicit SANDFORGE_RENDERER=classic retains the historical root for
// isolated legacy regression tests; /classic.html is always emitted.
const renderer=process.env.SANDFORGE_RENDERER??'webgl';
if(!['webgl','classic'].includes(renderer))
 throw Error('SANDFORGE_RENDERER must be webgl or classic, got '+renderer);
const webglDefault=renderer==='webgl';
cpSync('index.html','dist/classic.html');
if(webglDefault){
  const landing=readFileSync('webgl-preview.html','utf8')
    .replace('<title>Sandforge: Bastion Wars · WebGL 3D Vorschau</title>',
      '<title>Sandforge: Bastion Wars</title>')
    .replace('SANDFORGE / THREE.JS PREVIEW','SANDFORGE / WEBGL 3D')
    .replace('· <a href="/">KLASSISCHES RTS</a>',
      '· <a href="/classic.html">KLASSISCHE VERSION</a>');
  writeFileSync('dist/index.html',landing);
}else cpSync('index.html','dist/index.html');
cpSync('animation-lab.html','dist/animation-lab.html');
cpSync('model-preview.html','dist/model-preview.html');
cpSync('model-3d.html','dist/model-3d.html');
cpSync('webgl-preview.html','dist/webgl-preview.html');
cpSync('scripts/webgl-preview.js','dist/webgl-preview.js');
cpSync('scripts/webgl-biomes.js','dist/webgl-biomes.js');
cpSync('scripts/webgl-match-result.js','dist/webgl-match-result.js');
cpSync('scripts/webgl-desert-art.js','dist/webgl-desert-art.js');
cpSync('scripts/webgl-rock-materials.js','dist/webgl-rock-materials.js');
for(const module of ['webgl-oases','webgl-oasis-generation','webgl-oasis-materials'])cpSync(`scripts/${module}.js`,`dist/${module}.js`);
cpSync('scripts/webgl-map-edges.js','dist/webgl-map-edges.js');
cpSync('scripts/webgl-title-menu.js','dist/webgl-title-menu.js');
cpSync('scripts/webgl-battlefield.js','dist/webgl-battlefield.js');
cpSync('scripts/webgl-builder-input.js','dist/webgl-builder-input.js');
cpSync('scripts/webgl-strategic-buildings.js','dist/webgl-strategic-buildings.js');
cpSync('scripts/webgl-rocket-infantry.js','dist/webgl-rocket-infantry.js');
cpSync('scripts/webgl-strategic-effects.js','dist/webgl-strategic-effects.js');
cpSync('scripts/webgl-double-click-select.js','dist/webgl-double-click-select.js');
cpSync('scripts/webgl-frame-scheduling.js','dist/webgl-frame-scheduling.js');
cpSync('scripts/webgl-bastion-capture.js','dist/webgl-bastion-capture.js');
cpSync('scripts/webgl-actor-presentation.js','dist/webgl-actor-presentation.js');
cpSync('scripts/webgl-faction-accents.js','dist/webgl-faction-accents.js');
cpSync('scripts/webgl-environment.js','dist/webgl-environment.js');
cpSync('scripts/webgl-atmosphere-3d.js','dist/webgl-atmosphere-3d.js');
cpSync('scripts/webgl-combat-vfx.js','dist/webgl-combat-vfx.js');
cpSync('scripts/webgl-hit-response.js','dist/webgl-hit-response.js');
cpSync('scripts/webgl-wreck-lifecycle.js','dist/webgl-wreck-lifecycle.js');
cpSync('scripts/webgl-aircraft-effects.js','dist/webgl-aircraft-effects.js');
// Keep the optional battle profiler deployable; an unresolved static import
// prevents the entire WebGL preview from booting, even when perf=0.
cpSync('scripts/webgl-perf-watch.js','dist/webgl-perf-watch.js');
cpSync('scripts/webgl-classic-hud.js','dist/webgl-classic-hud.js');
cpSync('scripts/webgl-global-catalog.js','dist/webgl-global-catalog.js');
cpSync('scripts/webgl-portraits.js','dist/webgl-portraits.js');
cpSync('scripts/webgl-research-artworks.js','dist/webgl-research-artworks.js');
cpSync('scripts/webgl-perimeter.js','dist/webgl-perimeter.js');
cpSync('scripts/webgl-edge-cliffs.js','dist/webgl-edge-cliffs.js');
cpSync('scripts/webgl-grounding.js','dist/webgl-grounding.js');
cpSync('scripts/webgl-ground-tracks.js','dist/webgl-ground-tracks.js');
cpSync('scripts/webgl-building-yard.js','dist/webgl-building-yard.js');
cpSync('scripts/webgl-airfield-service.js','dist/webgl-airfield-service.js');
cpSync('scripts/webgl-factory-service.js','dist/webgl-factory-service.js');
cpSync('scripts/webgl-service-materials.js','dist/webgl-service-materials.js');
cpSync('scripts/webgl-maintenance-input.js','dist/webgl-maintenance-input.js');
cpSync('scripts/webgl-service-grounding.js','dist/webgl-service-grounding.js');
cpSync('scripts/webgl-transport-controls.js','dist/webgl-transport-controls.js');
cpSync('scripts/webgl-resource-lifecycle.js','dist/webgl-resource-lifecycle.js');
cpSync('scripts/webgl-construction.js','dist/webgl-construction.js');
cpSync('scripts/webgl-construction-recovery.js','dist/webgl-construction-recovery.js');
cpSync('scripts/webgl-production-gates.js','dist/webgl-production-gates.js');
cpSync('scripts/webgl-wheel-motion.js','dist/webgl-wheel-motion.js');
cpSync('scripts/webgl-barracks-portal.js','dist/webgl-barracks-portal.js');
cpSync('scripts/webgl-scale.js','dist/webgl-scale.js');
cpSync('scripts/webgl-selection-ring.js','dist/webgl-selection-ring.js');
cpSync('scripts/webgl-health.js','dist/webgl-health.js');
cpSync('src/reborn/webgl-classic-hud.css','dist/webgl-classic-hud.css');
cpSync('scripts/animation/model-viewer.js','dist/model-viewer.js');
// WebGL preview and 3D inspector share the same local Three.js modules.
// Three.js assets are required by the 3D game and optional in classic mode.
for(const file of ['build/three.module.js','build/three.core.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/controls/OrbitControls.js','examples/jsm/utils/BufferGeometryUtils.js','examples/jsm/utils/SkeletonUtils.js','examples/jsm/environments/RoomEnvironment.js']){
  const target='dist/vendor/three/'+file.replace('build/','').replace('examples/jsm/','addons/');mkdirSync(target.slice(0,target.lastIndexOf('/')),{recursive:true});cpSync('node_modules/three/'+file,target);
}
cpSync('node_modules/three/LICENSE','dist/vendor/three/LICENSE');
cpSync('src/reborn/style.css', 'dist/style.css');
cpSync('src/reborn/retro-desert.css', 'dist/retro-desert.css');
cpSync('src/reborn/qwen-general.worker.js', 'dist/src/reborn/qwen-general.worker.js');
cpSync('legacy', 'dist/legacy', {recursive:true});
cpSync('src/assets', 'dist/src/assets', {recursive:true});
// Incremental local builds must also discard the retired aircraft assets.
for(const team of [0,1])for(const extension of ['glb','png','json'])rmSync(`dist/src/assets/reborn/animation/gunship-${team}.${extension}`,{force:true});
// A verifiable fingerprint of the *shipped* gameplay pixels, not the source GLB.
const art={revision:'pbr-strong-20261027',files:{}};
for(const kind of ['headquarters','factory','barracks','airfield','generator','turret','bastion']){
 const path='dist/src/assets/reborn/buildings-3d/'+kind+'-0.png';
 const bytes=readFileSync(path);art.files[kind]=createHash('sha256').update(bytes).digest('hex');
}
writeFileSync('dist/building-art-version.json',JSON.stringify(art,null,2)+'\n');
console.log('Built SANDFORGE: BASTION WARS in dist/');
