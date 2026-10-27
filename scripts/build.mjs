import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('animation-lab.html','dist/animation-lab.html');
cpSync('model-preview.html','dist/model-preview.html');
cpSync('model-3d.html','dist/model-3d.html');
cpSync('scripts/animation/model-viewer.js','dist/model-viewer.js');
// The isolated 3D model inspector uses these local modules; the game stays Canvas 2D.
for(const file of ['build/three.module.js','build/three.core.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/controls/OrbitControls.js','examples/jsm/utils/BufferGeometryUtils.js','examples/jsm/environments/RoomEnvironment.js']){
  const target='dist/vendor/three/'+file.replace('build/','').replace('examples/jsm/','addons/');mkdirSync(target.slice(0,target.lastIndexOf('/')),{recursive:true});cpSync('node_modules/three/'+file,target);
}
cpSync('node_modules/three/LICENSE','dist/vendor/three/LICENSE');
cpSync('src/reborn/style.css', 'dist/style.css');
cpSync('src/reborn/retro-desert.css', 'dist/retro-desert.css');
cpSync('src/reborn/qwen-general.worker.js', 'dist/src/reborn/qwen-general.worker.js');
cpSync('legacy', 'dist/legacy', {recursive:true});
cpSync('src/assets', 'dist/src/assets', {recursive:true});
// A verifiable fingerprint of the *shipped* gameplay pixels, not the source GLB.
const art={revision:'pbr-strong-20261027',files:{}};
for(const kind of ['headquarters','factory','barracks','airfield','generator','turret','bastion']){
 const path='dist/src/assets/reborn/buildings-3d/'+kind+'-0.png';
 const bytes=readFileSync(path);art.files[kind]=createHash('sha256').update(bytes).digest('hex');
}
writeFileSync('dist/building-art-version.json',JSON.stringify(art,null,2)+'\n');
console.log('Built SANDFORGE: BASTION WARS in dist/');
