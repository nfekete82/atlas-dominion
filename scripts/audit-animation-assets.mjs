import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {unitKinds} from '../dist/src/reborn/catalog.js';
import {unitAtlasPath} from '../dist/src/reborn/asset-paths.js';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const png=walk('src/assets').filter(p=>p.endsWith('.png')).map(file=>{const b=fs.readFileSync(file);return {file,width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:hash(file)};});
const sourceRows=[
 ['soldier.gltf','18UU-iuYMQyrQ3OAMFoRA8DkZ2Uo_2cai','https://quaternius.com/packs/toonshootergamekit.html'],
 ['engineer.gltf','1SRow6CgGJs6mnFihBww3GhfPUYDGnGBz','https://quaternius.com/packs/toonshootergamekit.html'],
 ['heavy.gltf','1CUd25oFj06octIbmyMCwUwCTiHj4mLI3','https://quaternius.com/packs/toonshootergamekit.html'],
 ['tank.fbx','13lbAEkwen5bXY2fSiyo4rVt5q_gxy0Fm','https://quaternius.com/packs/animatedtanks.html'],
 ['artillery.fbx','1VT0Sto8hXARIcanbdv9oJmMAH31a9hGf','https://quaternius.com/packs/animatedtanks.html'],
 ['rover.gltf','1oQqZiRr61zqPOKzKNBvIx4huQ5_xby_o','https://quaternius.com/packs/ultimatespacekit.html'],
 ['bomber.gltf','1YKAanEXyE_9ukxozfoXEUNr2T8ZDX6ZE','https://quaternius.com/packs/ultimatespacekit.html'],
 ['helicopter.glb',null,'https://poly.pizza/m/EQJ2MECUbx'],
];
const sources=sourceRows.map(([file,id,page])=>({file:'tools/animation-sources/'+file,author:file==='helicopter.glb'?'kazuma':'Quaternius',license:'CC0-1.0',page,download:id?'https://drive.usercontent.google.com/download?id='+id+'&export=download&confirm=t':'https://static.poly.pizza/e3dfeb10-5525-4a39-83d8-13a709aaca4b.glb',sha256:hash('tools/animation-sources/'+file)}));
if(!process.argv.includes('--buildings'))fs.writeFileSync('tools/animation-sources/manifest.json',JSON.stringify({license:'CC0-1.0',sources},null,2)+'\n');
const active=new Map();for(const kind of unitKinds)for(const team of [0,1]){const file=unitAtlasPath(kind,team).slice(1)+'.json';if(!active.has(file))active.set(file,[]);active.get(file).push(kind);}
const atlases=[...active].map(([file,roles])=>{const a=JSON.parse(fs.readFileSync(file));return {file,roles,kind:a.kind,team:a.team,directions:a.directions,frameCount:a.frames.length,source:a.source,model:a.model,modelSha256:a.model?hash(path.join(path.dirname(file),a.model)):undefined,design:a.design,clips:Object.fromEntries(Object.entries(a.clips).map(([tag,c])=>[tag,{phases:c.frames[0].length,uniquePhases:c.uniquePhases??[1],source:c.sourceClip}]))};});
const buildings=walk('src/assets/reborn/buildings-3d').filter(p=>p.endsWith('.json')).map(file=>{const a=JSON.parse(fs.readFileSync(file));return {file,kind:a.kind,team:a.team,model:a.model,sha256:hash(path.join(path.dirname(file),a.model)),parts:a.design.parts,triangles:a.design.triangles,pivot:a.body.pivot,bakedShadow:a.bakedShadow,radarFrames:a.activity?.frames.length??0,clips:a.clips};});
let report={png,sources,atlases,buildings};
if(process.argv.includes('--buildings')){
 const previous=JSON.parse(fs.readFileSync('docs/reborn/ANIMATION_ASSETS.json'));
 report={...previous,png:[...previous.png.filter(p=>!p.file.startsWith('src/assets/reborn/buildings-3d/')),...png.filter(p=>p.file.startsWith('src/assets/reborn/buildings-3d/'))].sort((a,b)=>a.file.localeCompare(b.file,'en')),buildings};
}
fs.writeFileSync('docs/reborn/ANIMATION_ASSETS.json',JSON.stringify(report,null,2)+'\n');console.log('Audited',report.png.length,'PNGs,',report.sources.length,'licensed source models,',report.atlases.length,'active unit atlases,',buildings.length,'original building models');
