import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BuildingDecor,buildingProps,DECOR_PROP_COUNTS} from '../dist/src/reborn/building-decor.js';
import {decodePNG} from '../scripts/animation/offline-canvas.mjs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtWidth} from '../dist/src/reborn/visual-scale.js';

const kinds=['headquarters','barracks','factory','airfield','generator','turret','bastion'];
const center={x:1850,y:2000};
test('3D base props: restrained, fixed service yards for every building',()=>{
 assert.deepEqual(DECOR_PROP_COUNTS,{headquarters:5,barracks:3,factory:4,airfield:3,generator:1,turret:1,bastion:1});
 const propKinds=new Set();
 for(const kind of kinds){
  const r=kind==='bastion'?42:BUILDINGS[kind].radius,props=buildingProps(kind,center,r,1003,2026);
  assert.equal(props.length,DECOR_PROP_COUNTS[kind]);
  assert.ok(props.every(p=>p.size>20&&p.size<45&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
  props.forEach(p=>propKinds.add(p.kind));
 }
 assert.deepEqual([...propKinds].sort(),['military-crate','military-crate-stack','service-lamp','service-terminal','fuel-barrels','sandbags'].sort());
 const hq=buildingProps('headquarters',center,83,1003,2026);
 assert.equal(hq.filter(p=>p.kind==='service-lamp').length,2);
 assert.equal(hq.filter(p=>p.kind==='service-terminal').length,1);
});
test('3D base props: deterministic by seed/id; no DOM, gameplay or save mutations',()=>{
 const g=new Simulation(2026,14),original=g.save();
 const b=g.bases.find(b=>b.kind==='headquarters'&&b.owner===0),r=BUILDINGS.headquarters.radius;
 const a=buildingProps(b.kind,b,r,b.id,g.seed);
 assert.deepEqual(a,buildingProps(b.kind,b,r,b.id,g.seed));
 assert.notDeepEqual(a,buildingProps(b.kind,b,r,b.id+123,g.seed));
 assert.notDeepEqual(a,buildingProps(b.kind,b,r,b.id,g.seed+1));
 assert.deepEqual(g.save(),original);
 assert.equal(new BuildingDecor().spriteCount,0);
 for(const file of ['simulation.ts','world.ts','tactical-ai.ts','input.ts'])assert.doesNotMatch(readFileSync('src/reborn/'+file,'utf8'),/building-decor|prop-placement|prop-atlas|buildingProps\(/);
 assert.deepEqual(buildingProps('barracks',center,0,1,0),[]);
 assert.deepEqual(buildingProps('barracks',center,NaN,1,0),[]);
});
test('3D base props: full facades, center doors and front-right exits are clear for both facings across seeds',()=>{
 for(const seed of [0,1,2026,75310,0xffffffff])for(const kind of kinds)for(const facing of [0,1]){
  const r=kind==='bastion'?42:BUILDINGS[kind].radius;
  const halfFacade=kind==='bastion'?55:buildingArtWidth(kind,BUILDINGS[kind].width)*.5;
  const props=buildingProps(kind,center,r,1003,seed,facing),normal=buildingProps(kind,center,r,1003,seed,0);
  for(const [i,p] of props.entries()){
   const x=(p.x-center.x)*(facing===1?-1:1),y=p.y-center.y,extent=p.size*.55;
   assert.ok(Math.abs(x)-extent>halfFacade,kind+' prop must stay outside the whole facade');
   assert.ok(!(x+extent>r*.5&&y+extent>-r*.2),kind+' prop intersects front-right exit');
   assert.equal(p.y,normal[i].y);
   assert.equal(p.size,normal[i].size);
   assert.equal(p.variant,normal[i].variant);
   assert.ok(Math.abs(p.x-(facing?2*center.x-normal[i].x:normal[i].x))<1e-9);
  }
 }
});
test('3D base props: runtime only draws the mesh atlas; unfinished sites and preview remain separate',()=>{
 const code=readFileSync('src/reborn/building-decor.ts','utf8');
 assert.doesNotMatch(code,/createElement|createLinearGradient|createRadialGradient|fillRect|beginPath|\.paint\(/);
 assert.match(code,/this\.atlas\.draw\(/);
 const renderer=readFileSync('src/reborn/renderer.ts','utf8');
 assert.match(renderer,/this\.decor\.draw\(c,b\.kind,anchor.*'behind'.*b\.facing,visible/);
 assert.match(renderer,/this\.decor\.draw\(c,b\.kind,anchor.*'front'.*b\.facing,visible/);
 assert.ok(renderer.indexOf('this.decor.draw(c,b.kind,anchor')>renderer.indexOf('if(b.buildRemaining>0)'));
 assert.match(renderer,/entities\.sort\(\(a,b\)=>a\.y-b\.y\)/);
 // Slot mirroring is explicit, so the prop's baked sunlight never flips.
 const drawn=[],art=new BuildingDecor({get spriteCount(){return 32;},draw(_c,kind,p,size,variant){drawn.push({kind,...p,size,variant});}});
 const ctx={save(){},restore(){}};
 art.draw(ctx,'headquarters',center,83,1003,2026,0,'front',0,false,1,1);
 assert.deepEqual(drawn,buildingProps('headquarters',center,83,1003,2026,1).filter(p=>p.layer==='front'));
});

test('3D base props: actual opaque atlas pixels never cover either mirrored entrance',()=>{
 const metadata=JSON.parse(readFileSync('src/assets/reborn/props-3d/props.json','utf8'));
 const atlas=decodePNG(readFileSync('src/assets/reborn/props-3d/props.png'));
 for(const seed of [0,2026,75310])for(const kind of kinds)for(const facing of [0,1]){
  const r=kind==='bastion'?42:BUILDINGS[kind].radius;
  for(const p of buildingProps(kind,center,r,1003,seed,facing)){
   const d=metadata.props[p.kind],f=d.frames[p.variant],scale=p.size/d.solidWidth;
   for(let y=0;y<f.h;y+=3)for(let x=0;x<f.w;x+=3){
    if(atlas.pixels[((f.y+y)*atlas.width+f.x+x)*4+3]<=200)continue;
    const worldX=(p.x-center.x+(x-d.pivot[0])*scale)*(facing===1?-1:1);
    const worldY=p.y-center.y+(y-d.pivot[1])*scale;
    assert.ok(!(worldX>r*.5&&worldY>-r*.2),kind+' sprite pixel covers the vehicle exit');
    assert.ok(Math.abs(worldX)>r*.70,kind+' sprite pixel covers the central door');
   }
  }
 }
});
