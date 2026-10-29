import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {unitArtScale} from '../dist/src/reborn/visual-scale.js';
import {unitVisualLift,unitSelectionPoint,AIR_GROUND_SHADOWS} from '../dist/src/reborn/unit-presentation.js';
import {sharpenAtlasOpaqueRGB} from '../dist/src/reborn/sprite-clarity.js';

test('transport appearance: slightly smaller soldiers, larger raised helicopter and separate soft ground shadow',()=>{
 assert.equal(unitArtScale('infantry'),.73);assert.equal(unitArtScale('medic'),.73);
 assert.equal(unitArtScale('engineer'),.73);assert.equal(unitArtScale('heavy'),.74);
 assert.equal(unitArtScale('scout'),1.52);assert.equal(unitArtScale('bomber'),1.4);
 assert.equal(unitVisualLift({kind:'scout'}),82);
 assert.equal(unitVisualLift({kind:'scout',flightHeight:.5}),43.5);
 assert.equal(unitVisualLift({kind:'bomber'}),56);
 assert.deepEqual(unitSelectionPoint({x:1900,y:2100,kind:'scout'}),{x:1900,y:1963});
 const shadow=AIR_GROUND_SHADOWS.scout;
 assert.ok(shadow);assert.ok(shadow.alpha>.1&&shadow.alpha<.35);
 assert.ok(shadow.widthRatio>.6&&shadow.heightRatio<.5);
 assert.ok(UNITS.scout.width*unitArtScale('scout')>UNITS.scout.width*1.34);
});

test('helicopter edge sharpening preserves alpha and excludes transparent boundaries and other frames',()=>{
 const w=12,h=6,cell=6,p=new Uint8ClampedArray(w*h*4);
 const set=(x,y,r,g,b,a=255)=>{const i=(y*w+x)*4;p.set([r,g,b,a],i);};
 for(let y=1;y<5;y++)for(let x=1;x<5;x++)set(x,y,80,90,100);
 set(3,3,180,190,200);
 for(let y=1;y<5;y++)for(let x=7;x<11;x++)set(x,y,170,140,100);
 set(0,0,24,16,8,40); // translucent old ground pixels
 const out=sharpenAtlasOpaqueRGB(p,w,h,cell);
 assert.ok(out[(3*w+3)*4]>p[(3*w+3)*4],'original interior seam becomes crisper');
 assert.equal(out[(0*w+0)*4+3],40);
 assert.equal(out[(0*w+0)*4],24,'transparent shadow color stays identical');
 for(let i=3;i<p.length;i+=4)assert.equal(out[i],p[i],'do not change transparency');
 for(let y=0;y<h;y++){
  for(const x of [5,6]){const i=(y*w+x)*4;assert.deepEqual([...out.slice(i,i+4)],[...p.slice(i,i+4)],'atlas cell borders untouched');}
 }
 const again=sharpenAtlasOpaqueRGB(p,w,h,cell);
 assert.deepEqual(out,again,'image preprocessing is deterministic');
 assert.deepEqual([...p.slice(0,4)],[24,16,8,40],'original asset not mutated');
});

test('helicopter polish never modifies the saved real simulation, world unit dimensions or transport capacity',()=>{
 const g=new Simulation(2026,4),save=g.save();
 const before={width:UNITS.scout.width,hp:UNITS.scout.hp,capacity:g.units.filter(u=>u.kind==='scout').map(u=>u.transport?.capacity)};
 unitVisualLift({kind:'scout'});unitArtScale('scout');
 assert.deepEqual(g.save(),save);
 assert.deepEqual({width:UNITS.scout.width,hp:UNITS.scout.hp,capacity:g.units.filter(u=>u.kind==='scout').map(u=>u.transport?.capacity)},before);
});
