import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {selectionRingRadius,unitRenderAltitude} from '../scripts/webgl-scale.js';

test('selection footprint visibly encloses infantry, heavy armor and aircraft',()=>{
 for(const kind of ['infantry','engineer','heavy','rocket','rover','tank','artillery','scout','bomber']){
  const u=UNITS[kind],oldRadius=u.radius+11,newRadius=selectionRingRadius(u);
  assert.ok(newRadius>=oldRadius*1.30,
   kind+' selection ring should be at least 30% larger than previous');
  assert.ok(newRadius>=u.width*.39,kind+' ring must account for model width');
  const geometry=new THREE.TorusGeometry(newRadius,2.6,6,56);
  assert.equal(geometry.parameters.radius,newRadius);
  assert.ok(geometry.parameters.tube>1.8,'selection line remains readable against sand');
  geometry.dispose();
 }
});
test('aircraft selection projects to its ground (or service floor) height',()=>{
 assert.equal(unitRenderAltitude('bomber',1),175);
 assert.equal(unitRenderAltitude('bomber',0),0);
 assert.ok(unitRenderAltitude('scout',1)>100);
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/selectionRingRadius\(unitSpec\(unit\)\)/);
 assert.match(source,/ring\.position\.y\+=3-unitRenderAltitude\(unit\.kind,unit\.flightHeight\?\?1\)/);
 assert.match(source,/ring\.geometry\.dispose\(\)/,'released selection rings free GPU memory');
});
test('HUD logo is centered within the resource header across breakpoints',()=>{
 const css=readFileSync('src/reborn/webgl-classic-hud.css','utf8');
 const start=css.indexOf('#sf-classic-root .top .wordmark{');
 const end=css.indexOf('@media(max-width:620px)',start);
 const rules=css.slice(start,end);
 assert.ok(start>0);
 assert.match(rules,/align-self:center/);
 assert.match(rules,/justify-content:center/);
 assert.match(rules,/padding:2px 7px/);
 assert.match(rules,/object-position:50% 50%/);
 assert.match(rules,/margin-inline:auto/);
});
