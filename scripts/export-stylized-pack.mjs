import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {installOfflineCanvas} from './animation/offline-canvas.mjs';
import {canonicalizeGlb} from './animation/canonical-glb.mjs';
import {buildRover} from './art/stylized-rover.mjs';
import {buildBarracks} from './art/stylized-barracks.mjs';
import {buildSoldier} from './art/stylized-soldier.mjs';
import {ART_VERSION,PALETTE,METRES_TO_WORLD} from './art/stylized-kit.mjs';

installOfflineCanvas();
const directory=new URL('../src/assets/stylized/',import.meta.url);await mkdir(directory,{recursive:true});
const check=process.argv.includes('--check'),models=[];
for(const [kind,build] of [['rover',buildRover],['barracks',buildBarracks],['infantry',buildSoldier]])for(const owner of [0,1]){
 const model=build(owner);model.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());
 let triangles=0,primitives=0;model.traverse(n=>{if(n.isMesh){triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;primitives++;}});
 const bytes=canonicalizeGlb(Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true,animations:model.animations,onlyVisible:true})));
 const file=kind+'-'+owner+'.glb';
 if(check){if(!bytes.equals(await readFile(new URL(file,directory))))throw Error('Not reproducible: '+file);}
 else await writeFile(new URL(file,directory),bytes);
 const row={kind,owner,file,bytes:bytes.length,triangles,primitives,sizeMetres:size.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  clips:model.animations.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length})),sha256:createHash('sha256').update(bytes).digest('hex')};
 models.push(row);console.log(file,triangles+' triangles',primitives+' primitives',Math.round(bytes.length/1024)+' KiB',size.toArray().map(n=>n.toFixed(2)).join(' × '));
}
const manifest={version:ART_VERSION,originalArtwork:true,authoring:'Original scripted polygon geometry; Three.js GLTFExporter',
 metresToWorld:METRES_TO_WORLD,axes:'Y up; +Z forward; barracks exit -Z',palette:PALETTE,models};
const metadata=JSON.stringify(manifest,null,2)+'\n';
if(check){if(metadata!==await readFile(new URL('manifest.json',directory),'utf8'))throw Error('Manifest drift');}
else await writeFile(new URL('manifest.json',directory),metadata);
