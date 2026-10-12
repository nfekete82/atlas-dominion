import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_CODES } from '../dist/src/engine/economy.js';
import {buildingMarkerFor,showBuildingMarker,CITY_MARKER_SIZE,CITY_BADGE_FONT_SIZE,cityMarkerBounds,cityLevelStyle,rectanglesOverlap,ScreenOccupancy} from '../dist/src/render/building-markers.js';

test('constructed cities have named symbols without enclosing backgrounds',()=>{
  assert.deepEqual(BUILDING_CODES,{city:1});
  const marker=buildingMarkerFor(1);
  assert.ok(marker.symbol.length>0);
  assert.match(marker.color,/^#[0-9a-f]{6}$/i);
  assert.ok(marker.label.length>0);
  assert.equal('background' in marker,false);
  assert.equal(buildingMarkerFor(0),null);
  assert.equal(buildingMarkerFor(255),null);
});

test('own and AI cities are visible at every supported map zoom including overview',()=>{
  for(const owner of [0,2,49])for(const zoom of [.8,1,1.5,2,4])assert.equal(showBuildingMarker(owner,zoom),true);
  for(const owner of [-1,-2])assert.equal(showBuildingMarker(owner,4),false);
  for(const zoom of [NaN,Infinity,0,-1])assert.equal(showBuildingMarker(0,zoom),false);
});

test('city bounds stay 30 CSS pixels at every scale and have a readable small badge',()=>{
  assert.ok(CITY_MARKER_SIZE>=26&&CITY_MARKER_SIZE<=30);
  assert.equal(CITY_BADGE_FONT_SIZE,10);
  for(const scale of [.25,.8,1,1.5,2,4])for(const dpr of [1,2,3]){
    const bounds=cityMarkerBounds(123*scale,54*scale);
    assert.equal(bounds.width,30);assert.equal(bounds.height,30);
    assert.equal(bounds.width*dpr,30*dpr);
    assert.equal(bounds.x+bounds.width/2,123*scale);
  }
});

test('all six levels use the required bronze, silver and gold tiers; invalid levels clamp',()=>{
  assert.deepEqual(cityLevelStyle(0),cityLevelStyle(1));
  assert.deepEqual(cityLevelStyle(1),cityLevelStyle(2));
  assert.deepEqual(cityLevelStyle(3),cityLevelStyle(4));
  assert.notDeepEqual(cityLevelStyle(2),cityLevelStyle(3));
  assert.notDeepEqual(cityLevelStyle(4),cityLevelStyle(5));
  assert.deepEqual(cityLevelStyle(NaN),cityLevelStyle(0));
  assert.deepEqual(cityLevelStyle(-5),cityLevelStyle(0));
  assert.deepEqual(cityLevelStyle(99),cityLevelStyle(5));
});

test('spatial collision lookup matches a brute-force oracle across bucket edges and large HUD blocks',()=>{
  const occupancy=new ScreenOccupancy();
  const reserved=[{x:-65,y:63,width:140,height:30},{x:0,y:0,width:520,height:100}];
  for(let i=0;i<100;i++)reserved.push(cityMarkerBounds((i*83)%900,(i*47)%650));
  for(const bounds of reserved)occupancy.reserve(bounds);
  for(let x=-100;x<1000;x+=17)for(let y=-40;y<750;y+=19){
    const bounds=cityMarkerBounds(x,y);
    assert.equal(occupancy.intersects(bounds),reserved.some(other=>rectanglesOverlap(bounds,other,3)),`${x},${y}`);
  }
  occupancy.clear();assert.equal(occupancy.intersects(cityMarkerBounds(0,0)),false);
});

test('diagonally adjacent large badges cannot overlap and disjoint markers fit',()=>{
  const occupancy=new ScreenOccupancy();occupancy.reserve(cityMarkerBounds(50,50));
  assert.equal(occupancy.intersects(cityMarkerBounds(72,72)),true);
  assert.equal(occupancy.intersects(cityMarkerBounds(84,50)),false);
});
