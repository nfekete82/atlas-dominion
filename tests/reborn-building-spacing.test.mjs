import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtWidth} from '../dist/src/reborn/visual-scale.js';
import {buildingPlacementRadius,requiredBuildingDistance,MAJOR_BUILDING_GAP,STANDARD_BUILDING_GAP} from '../dist/src/reborn/building-spacing.js';

const major=['headquarters','barracks','factory','airfield'];

test('construction: enlarged production structures reserve their rendered width, plus a visible gap',()=>{
  for(const kind of major){
    const spec=BUILDINGS[kind];
    assert.equal(buildingPlacementRadius(kind),Math.max(spec.radius,buildingArtWidth(kind,spec.width)/2));
  }
  for(const a of major)for(const b of major){
    const distance=requiredBuildingDistance(a,b);
    assert.equal(distance,requiredBuildingDistance(b,a),'distance must be symmetric');
    assert.equal(distance,buildingPlacementRadius(a)+buildingPlacementRadius(b)+MAJOR_BUILDING_GAP);
    assert.ok(distance>=BUILDINGS[a].radius+BUILDINGS[b].radius+24);
  }
});

test('construction: towers and generators retain their existing compact spacing',()=>{
  for(const kind of ['turret','generator'])assert.equal(buildingPlacementRadius(kind),BUILDINGS[kind].radius);
  assert.equal(requiredBuildingDistance('turret','generator'),BUILDINGS.turret.radius+BUILDINGS.generator.radius+STANDARD_BUILDING_GAP);
  assert.equal(requiredBuildingDistance('headquarters','turret'),buildingPlacementRadius('headquarters')+BUILDINGS.turret.radius+STANDARD_BUILDING_GAP);
});

test('construction: player and AI calls reject touching major buildings at the boundary',()=>{
  const g=new Simulation(2026,3);
  const headquarters=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
  assert.ok(headquarters);
  // Keep this test about the building gap, independently of terrain, fog and credits.
  g.bases=[headquarters];
  g.units=[];
  g.territories=[];
  g.credits[0]=1_000_000;
  g.world.walkable=()=>true;
  g.hasExplored=()=>true;
  for(const kind of ['barracks','factory','airfield','generator','turret']){
    const limit=requiredBuildingDistance('headquarters',kind);
    const near={x:headquarters.x+limit-1,y:headquarters.y};
    const clear={x:headquarters.x+limit+1,y:headquarters.y};
    assert.equal(g.buildError(0,kind,near),'Zu nah an einem anderen Gebäude.',kind);
    assert.equal(g.buildError(0,kind,clear),null,kind+' should be allowed beyond the clearance');
  }
});
