import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {installOfflineCanvas} from '../scripts/animation/offline-canvas.mjs';
import {buildAtlasBuilding} from '../scripts/animation/atlas-buildings.js';

test('expanded airfield has an actual longer 3D footprint, arched hangar, ATC and runway',()=>{
 installOfflineCanvas();
 for(const team of [0,1]){
  const {model,clips}=buildAtlasBuilding('airfield',team);
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  assert.ok(bounds.max.x-bounds.min.x>4.5,'the apron is genuinely wider');
  assert.ok(bounds.max.z-bounds.min.z>4.5,'the runway and hangar lengthen the site');
  assert.ok(bounds.max.y>3.4,'the ATC is taller than the hangar');
  const names=[];
  model.traverse(node=>{if(node.isMesh)names.push(node.name);});
  for(const feature of ['HangarCurvedRoofPanel','HangarInteriorDarkness','ParkedJetFuselage','AirfieldRunway','RunwayThresholdBars','ControlTowerMainShaft','TowerPanoramicWindows','FuelStorageTank','SecurityPerimeterPost']){
   assert.ok(names.some(name=>name.includes(feature)),feature+' is missing');
  }
  assert.ok(clips.some(clip=>clip.name==='BeaconPulse'));
 }
});

test('enlarged airfield graphics are baked and the simulation footprint matches',()=>{
 const source=fs.readFileSync(new URL('../src/reborn/catalog.ts',import.meta.url),'utf8');
 assert.match(source,/airfield:\{name:'Flugfeld'.*radius:116,width:320,/);
 for(const team of [0,1]){
  const meta=JSON.parse(fs.readFileSync(new URL('../src/assets/reborn/buildings-3d/airfield-'+team+'.json',import.meta.url)));
  assert.ok(meta.design.sourceGeometry.parts>100,'airfield GLB must be rebuilt from expanded source');
  assert.ok(meta.design.serviceFeatures.includes('HangarHeavySill'));
  assert.ok(meta.body.solidBounds.w>320,'sprite must cover enlarged building');
 }
});
