import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {selectionRingRadius,unitRenderAltitude} from '../scripts/webgl-scale.js';
import {createVehicleSelectionRing,createVehicleSelectionRingGeometry,VEHICLE_SELECTION_RING,
 createSegmentedSelectionRing,createSegmentedSelectionRingGeometry,UNIT_SELECTION_RING}
 from '../scripts/webgl-selection-ring.js';
import {visualUnitScale} from '../scripts/webgl-scale.js';

test('selection footprint visibly encloses infantry, heavy armor and aircraft',()=>{
 for(const kind of ['infantry','engineer','heavy','rocket','rover','tank','artillery','scout','bomber']){
  const u=UNITS[kind],oldRadius=u.radius+11,newRadius=selectionRingRadius(u);
  assert.ok(newRadius>=oldRadius*1.30,
   kind+' selection ring should be at least 30% larger than previous');
  assert.ok(newRadius>=u.width*.39,kind+' ring must account for model width');
  const geometry=createSegmentedSelectionRingGeometry(newRadius);
  assert.ok(geometry.getAttribute('position').count>100);
  assert.ok(UNIT_SELECTION_RING.width>5.2,'selection dashes stay clearly visible against sand');
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

test('selection rings have many translucent segments and real empty gaps',()=>{
 const radius=selectionRingRadius(UNITS.artillery);
 const ring=createVehicleSelectionRing(radius);
 assert.equal(ring.name,'VehicleDashedSelectionRing');
 assert.ok(VEHICLE_SELECTION_RING.width>5.2,'vehicle ring is thicker than the original torus');
 assert.ok(VEHICLE_SELECTION_RING.opacity<=.30,'rings are much softer than the old solid outlines');
 assert.equal(VEHICLE_SELECTION_RING.dashes,28,
  'the reference uses many evenly spaced rectangular dashes');
 assert.equal(ring.material.opacity,VEHICLE_SELECTION_RING.opacity);
 assert.equal(ring.material.depthWrite,false);
 assert.ok(VEHICLE_SELECTION_RING.fill<.85,'dash-to-gap ratio leaves distinct negative space');
 const array=ring.geometry.attributes.position.array;
 assert.equal(array.length,VEHICLE_SELECTION_RING.dashes*VEHICLE_SELECTION_RING.stepsPerDash*18);
 const firstAngle=Math.atan2(array[1],array[0]);
 const endOfFirstDash=(VEHICLE_SELECTION_RING.stepsPerDash-1)*18;
 const endAngle=Math.atan2(array[endOfFirstDash+16],array[endOfFirstDash+15]);
 assert.ok(endAngle>firstAngle);
 assert.ok(endAngle<2*Math.PI/VEHICLE_SELECTION_RING.dashes,
  'the last vertex of a dash stops before the next one starts');
 assert.ok(visualUnitScale('artillery')>visualUnitScale('rover'),
  'rocket launcher is a little larger than the Humvee');
 assert.equal(visualUnitScale('artillery'),1.42);
 const infantry=createSegmentedSelectionRing(selectionRingRadius(UNITS.infantry));
 assert.equal(infantry.name,'SegmentedSelectionRing');
 assert.equal(infantry.material.opacity,.27);
 assert.equal(infantry.material.depthWrite,false);
 assert.equal(infantry.material.depthTest,true);
 assert.equal(infantry.geometry.getAttribute('position').count,
  UNIT_SELECTION_RING.dashes*UNIT_SELECTION_RING.stepsPerDash*6);
 infantry.geometry.dispose();infantry.material.dispose();

 ring.geometry.dispose();ring.material.dispose();
 const custom=createVehicleSelectionRingGeometry(55);
 assert.equal(custom.getAttribute('position').count,VEHICLE_SELECTION_RING.dashes*VEHICLE_SELECTION_RING.stepsPerDash*6);
 custom.dispose();
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/ring=createSegmentedSelectionRing\(radius\)/);
 assert.doesNotMatch(source,/unitSpec\(unit\)\.group==='Fahrzeuge'/,
  'all selected units share the same segmented marker, not just vehicles');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/webgl-selection-ring\.js/);
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
