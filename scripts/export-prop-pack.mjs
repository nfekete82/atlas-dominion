import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildProp,PROP_KINDS} from './animation/prop-pack.js';
import {installOfflineCanvas,OfflineCanvas,encodePNG} from './animation/offline-canvas.mjs';
import {CPUBuildingRenderer} from './animation/cpu-building-renderer.mjs';
import {canonicalizeGlb} from './animation/canonical-glb.mjs';
import {isometricStage} from './animation/isometric-stage.js';

// Extend the existing building CPU-PBR path: same GGX, SSAA, camera and shadows.
installOfflineCanvas();
const out=new URL('../src/assets/reborn/props-3d/',import.meta.url);await mkdir(out,{recursive:true});
const zooms={'military-crate':3.1,'military-crate-stack':2.4,'service-lamp':1.65,'service-terminal':3,'fuel-barrels':2.9,sandbags:2.8,'desert-skull':3.1,'palm-tree':1.02};
const renderer=new CPUBuildingRenderer();renderer.setSize(512,512);
const rows=[],definitions={};
const check=process.argv.includes('--check');
async function emit(name,data){
 const bytes=Buffer.from(data),target=new URL(name,out);
 if(check){if(!bytes.equals(await readFile(target)))throw Error('Non-reproducible prop asset: '+name);}
 else await writeFile(target,bytes);
}
function bounds(pixels,threshold){
 let left=512,top=512,right=0,bottom=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>threshold){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 if(left>right)throw Error('Empty prop frame');return {x:left,y:top,w:right-left+1,h:bottom-top+1};
}
for(const kind of PROP_KINDS){
 const model=buildProp(kind),glb=canonicalizeGlb(Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true,maxTextureSize:2048})));
 await emit(kind+'.glb',glb);
 const {scene,camera}=isometricStage(512,[256,382],zooms[kind]),turn=new T.Group();turn.add(model);scene.add(turn);
 const frames=[],solids=[];
 for(let view=0;view<4;view++){
  turn.rotation.y=Math.PI/4+view*Math.PI/2;
  renderer.render(scene,camera);
  const pixels=renderer.domElement.pixels.slice();frames.push(pixels);solids.push(bounds(pixels,200));
 }
 const boxes=frames.map(p=>bounds(p,4)),left=Math.max(0,Math.min(...boxes.map(b=>b.x))-3),top=Math.max(0,Math.min(...boxes.map(b=>b.y))-3),right=Math.min(512,Math.max(...boxes.map(b=>b.x+b.w))+3),bottom=Math.min(512,Math.max(...boxes.map(b=>b.y+b.h))+3);
 const row={kind,frames,left,top,w:right-left,h:bottom-top};rows.push(row);
 definitions[kind]={model:kind+'.glb',sha256:createHash('sha256').update(glb).digest('hex'),...model.userData.propPack,zoom:zooms[kind],solidWidth:Math.max(...solids.map(b=>b.w)),pivot:[256-left,382-top],frames:[]};
 console.log(kind,model.userData.propPack.parts+' meshes',model.userData.propPack.triangles+' triangles',row.w+'x'+row.h);
}
const width=Math.max(...rows.map(r=>r.w*4)),height=rows.reduce((sum,r)=>sum+r.h,0),atlas=new OfflineCanvas(width,height);
let y=0;
for(const row of rows){
 for(let i=0;i<4;i++){
  const source={width:512,height:512,pixels:row.frames[i]};atlas.getContext('2d').drawImage(source,row.left,row.top,row.w,row.h,i*row.w,y,row.w,row.h);
  definitions[row.kind].frames.push({x:i*row.w,y,w:row.w,h:row.h});
 }
 y+=row.h;
}
const bytes=encodePNG(width,height,atlas.pixels);await emit('props.png',bytes);
const metadata={version:1,image:'props.png',width,height,baker:'cpu-pbr',supersampling:2,bakedShadow:true,camera:{position:[0,8,12],turn:Math.PI/4,pivot:[256,382],frustum:6.8},atlasSHA256:createHash('sha256').update(bytes).digest('hex'),props:definitions};
await emit('props.json',JSON.stringify(metadata,null,2)+'\n');
console.log('Prop atlas:',width+'x'+height,(bytes.length/1024).toFixed(0)+' KiB');
