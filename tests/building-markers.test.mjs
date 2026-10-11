import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_CODES } from '../dist/src/engine/economy.js';
import {buildingMarkerFor,showBuildingMarker,buildingMarkerFontSize} from '../dist/src/render/building-markers.js';

test('all five actual constructed building types have legible marker glyphs without background shapes',()=>{
  for(const [type,code] of Object.entries(BUILDING_CODES)){
    const marker=buildingMarkerFor(code);
    assert.ok(marker,'missing symbol for '+type);
    assert.ok(marker.symbol.length>0);
    assert.match(marker.color,/^#[0-9a-f]{6}$/i);
    assert.ok(marker.label.length>0);
    assert.equal('background' in marker,false);
  }
  assert.equal(buildingMarkerFor(0),null);
  assert.equal(buildingMarkerFor(255),null);
});

test('own buildings remain visible at normal starting zoom; other nations fade in when zoomed closer',()=>{
  assert.equal(showBuildingMarker(0,1.8),true);
  assert.equal(showBuildingMarker(2,1.8),true);
  assert.equal(showBuildingMarker(2,1.3),false);
  assert.equal(showBuildingMarker(0,1.3),true);
  assert.equal(showBuildingMarker(0,1),false);
  assert.equal(showBuildingMarker(-1,4),false);
});

test('markers retain a small display size when the camera zoom changes',()=>{
  for(const scale of [0.8,1.2,1.7,2,3]){
    const screenSize=buildingMarkerFontSize(scale)*scale;
    assert.ok(screenSize>=6 && screenSize<=14);
  }
});
