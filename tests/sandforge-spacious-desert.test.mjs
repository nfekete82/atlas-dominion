import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapWorldSize,mapLayout} from '../dist/src/reborn/config.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';
import {visualUnitScale,turretAimLocalYaw,turretMuzzleOffset,buildingFacingAngle} from '../dist/webgl-scale.js';
import {buildingProps} from '../dist/src/reborn/building-decor.js';

const versions=[[15,19,4],[16,20,8],[17,21,12],[18,22,16]];

test('new WebGL desert map IDs are 50% wider and taller without touching classic map versions',()=>{
 for(const [oldVersion,newVersion] of versions){
  assert.equal(mapWorldSize(newVersion),Math.round(mapWorldSize(oldVersion)*1.5));
  assert.equal(mapLayout(newVersion).columns,mapLayout(oldVersion).columns);
  assert.equal(mapLayout(newVersion).rows,mapLayout(oldVersion).rows);
  assert.equal(mapLayout(newVersion).spacing,Math.round(mapLayout(oldVersion).spacing*1.5));
 }
});

test('large desert generation stays deterministic, spacious and navigable for all bastion counts',()=>{
 for(const [oldVersion,version,count] of versions){
  const world=new World(2074,version),map=world.generated;
  assert.equal(world.size,mapWorldSize(version));
  assert.equal(map.sites.length,count);
  assert.ok(map.ruins.length>=4,'ruins missing on map '+version);
  assert.ok(map.ruins.every(ruin=>ruin.width>=108 && ruin.depth>=89),
   'all roomy desert ruins must be physically upscaled on '+version);
  assert.ok(map.ruins.every(ruin=>!world.walkable({x:ruin.x,y:ruin.y})),
   'enlarged ruin collision footprints must be solid on '+version);
  assert.ok(map.mesas.length<=Math.round(13+count*.75),'too many mesas on '+version);
  assert.deepEqual(map,generateMap(2074,version),'generation must be deterministic');
  for(const p of map.sites)assert.ok(world.walkable(p),'unwalkable bastion '+version);
  for(let i=0;i<map.sites.length;i++)for(let j=i+1;j<map.sites.length;j++){
   const a=map.sites[i],b=map.sites[j];
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=mapLayout(version).spacing-.1,
    'bastions are overcrowded on '+version);
  }
  const route=world.path(map.sites[0],map.sites.at(-1));
  assert.ok(route.length>0,'world must remain traversable on '+version);
  const old=new World(2074,oldVersion);
  assert.equal(old.size,mapWorldSize(oldVersion));
 }
});

test('visual scaling keeps infantry smaller than vehicles with current render-only ratios',()=>{
 // Current deliberately smaller infantry and larger tanks/bombers.
 // These constants are renderer presentation values, not gameplay radii.
 const expected={
  infantry:0.56,medic:0.56,engineer:0.56,
  heavy:0.58,rover:1.34,
  artillery:1.42,tank:1.44,bomber:1.03
 };
 for(const [kind,scale] of Object.entries(expected))
  assert.equal(visualUnitScale(kind),scale,kind+' visual scale changed');
 for(const soldier of ['infantry','medic','engineer','heavy'])
  for(const vehicle of ['rover','artillery','tank'])
   assert.ok(visualUnitScale(soldier)<visualUnitScale(vehicle),
    soldier+' must stay visually smaller than '+vehicle);
 assert.ok(visualUnitScale('bomber')>0,'bomber must render at nonzero size');
});

test('v19-v22 games can build HQ, save and reload with original simulation state',()=>{
 for(const [,version] of versions){
  const game=Simulation.campaign(2074,version);
  const site=game.headquartersCandidates(0).find(p=>
   game.buildError(0,'headquarters',p)===null);
  assert.ok(site,'no usable HQ location on '+version);
  const save=game.save(),restored=Simulation.load(save);
  assert.equal(restored.world.mapVersion,version);
  assert.equal(restored.world.size,game.world.size);
  assert.deepEqual(restored.territories.map(t=>t.point),game.territories.map(t=>t.point));
  assert.equal(restored.units.length,game.units.length);
 }
});

test('production WebGL preview ships all root-relative modules in its static imports',()=>{
 const entry=readFileSync('dist/webgl-preview.js','utf8');
 const modules=[...entry.matchAll(/from\s*['"]\/([^'"]+\.js)['"]/g)].map(m=>m[1]);
 assert.ok(modules.includes('webgl-perf-watch.js'),
  'combat profiler import must be included in deployment smoke test');
 for(const modulePath of modules){
  assert.ok(existsSync('dist/'+modulePath),
   'Missing WebGL static import /'+modulePath+' in dist; preview would stall at loading');
 }
});

test('all four 3D building facings survive saves, and legacy facing=1 remains valid',()=>{
 for(const facing of [0,2,1,3]){
  const game=Simulation.campaign(2074,19);
  const site=game.headquartersCandidates(0)
   .find(p=>game.buildError(0,'headquarters',p)===null);
  assert.ok(site,'no clear HQ site');
  const base=game.build(0,'headquarters',site,undefined,facing);
  assert.ok(base,'engineer cannot create HQ fixture');
  assert.equal(base.facing??0,facing);
  const save=game.save();
  const restored=Simulation.load(save);
  assert.equal(restored.bases.find(b=>b.id===base.id)?.facing??0,facing);
  if(facing===3){
   const invalid=structuredClone(save);
   const building=invalid.bases.find(b=>b.id===base.id);
   building.facing=4;
   assert.throws(()=>Simulation.load(invalid),/beschädigt/);
  }
 }
});

test('building props preserve classic facings and rotate consistently for 90 and 270 degrees',()=>{
 const anchor={x:1200,y:1400},radius=65,seed=2074;
 for(const kind of ['headquarters','barracks','factory','airfield','generator','turret','bastion']){
  const standard=buildingProps(kind,anchor,radius,1000,seed,0);
  assert.ok(standard.length>0,kind+' needs at least one service prop');
  for(const facing of [1,2,3]){
   const oriented=buildingProps(kind,anchor,radius,1000,seed,facing);
   assert.equal(oriented.length,standard.length);
   for(let i=0;i<standard.length;i++){
    const a=standard[i],actual=oriented[i],dx=a.x-anchor.x,dy=a.y-anchor.y;
    const expected=facing===1?{x:-dx,y:dy}:
     facing===2?{x:dy,y:-dx}:{x:-dy,y:dx};
    assert.equal(actual.kind,a.kind);
    assert.equal(actual.variant,a.variant);
    assert.ok(Math.abs(actual.x-anchor.x-expected.x)<1e-8,
     kind+' facing '+facing+' X prop drift');
    assert.ok(Math.abs(actual.y-anchor.y-expected.y)<1e-8,
     kind+' facing '+facing+' Y prop drift');
   }
  }
 }
});

test('3D turret points at the simulation target for every map angle and placed facing',()=>{
 const pi=Math.PI;
 // In Three.js: R_y(theta) projects local X,Z to
 // (cos(theta)*X+sin(theta)*Z, -sin(theta)*X+cos(theta)*Z).
 const rotate=(x,z,theta)=>({
  x:Math.cos(theta)*x+Math.sin(theta)*z,
  z:-Math.sin(theta)*x+Math.cos(theta)*z
 });
 for(const facing of [0,1,2,3]){
  for(const angle of [0,pi/2,pi,pi*1.5,-pi/4]){
   const buildingYaw=buildingFacingAngle(facing);
   const authored=rotate(0,1,buildingYaw+turretAimLocalYaw(angle,facing));
   const procedural=rotate(0,-1,buildingYaw+turretAimLocalYaw(angle,facing,true));
   for(const [kind,dir] of [['authored',authored],['fallback',procedural]]){
    assert.ok(Math.abs(dir.x-Math.cos(angle))<1e-10,
     kind+' facing='+facing+' angle='+angle+' X is reversed');
    assert.ok(Math.abs(dir.z-Math.sin(angle))<1e-10,
     kind+' facing='+facing+' angle='+angle+' Z is reversed');
   }
   const left=turretMuzzleOffset(angle,0),right=turretMuzzleOffset(angle,1);
   const midpoint={x:(left.x+right.x)/2,z:(left.z+right.z)/2};
   assert.ok(Math.abs(midpoint.x-Math.cos(angle)*37)<1e-10);
   assert.ok(Math.abs(midpoint.z-Math.sin(angle)*37)<1e-10);
   assert.ok(Math.abs(Math.hypot(left.x-right.x,left.z-right.z)-11)<1e-10,
    'twin cannon muzzle separation must stay constant');
   const lateral={x:right.x-left.x,z:right.z-left.z};
   assert.ok(Math.abs(lateral.x*Math.cos(angle)+lateral.z*Math.sin(angle))<1e-10,
    'cannon separation must stay perpendicular to target');
  }
 }
});


test('tank moves only after turning the independent gun, then the slower hull',()=>{
 const game=Simulation.campaign(2074,19);
 const unit=game.spawn(0,{x:game.world.size*.5,y:game.world.size*.5},'tank');
 const start={x:unit.x,y:unit.y};
 const goal={x:start.x,y:start.y+175};
 // Isolate motor timing from route-finding; this one-way unobstructed
 // lane fixture still uses the real simulation's private move() method.
 game.world.walkable=()=>true;
 game.obstacles=()=>[];
 game.bastionColliders=()=>[];
 game.vehicleDecorObstacles=()=>[];
 unit.angle=0;
 unit.hullAngle=0;
 unit.path=[goal];
 unit.repath=999;
 const frames=[];
 for(let tick=0;tick<155;tick++){
  game.move(unit,goal,.05);
  frames.push({gun:unit.angle,hull:unit.hullAngle,
   traveled:Math.hypot(unit.x-start.x,unit.y-start.y),
   moving:unit.moving===true,speed:unit.driveSpeed??0});
 }
 const firstGun=frames.findIndex(v=>v.gun>.005);
 const firstHull=frames.findIndex(v=>v.hull>.005);
 const firstDrive=frames.findIndex(v=>v.traveled>.005);
 assert.ok(firstGun>=0&&firstHull>firstGun&&firstDrive>firstHull,
  'startup sequence must be gun -> tracked hull -> forward movement');
 assert.equal(frames[firstHull].traveled,0,'tank may not slide as hull begins rotating');
 assert.ok(frames.slice(0,firstDrive).every(v=>v.traveled<.005),
  'no lateral vehicle teleport before aim and hull match');
 assert.ok(frames[firstDrive].hull>1.4,
  'hull should finish most of the turn before acceleration');
 assert.ok(frames[154].traveled>75,'tank eventually advances after steering');
 assert.ok(frames[154].traveled<=175+.01,'tank must not overshoot destination');
 const maxHullStep=Math.max(...frames.slice(1).map((v,i)=>
  Math.abs(Math.atan2(Math.sin(v.hull-frames[i].hull),Math.cos(v.hull-frames[i].hull)))));
 assert.ok(maxHullStep<=1.05*.05+.00001,'hull pivots at the promised slower rate');
 // Already-aimed departures should not impose another artificial fixed delay.
 const aligned=game.spawn(0,{x:start.x+350,y:start.y},'tank');
 aligned.angle=Math.PI/2;aligned.hullAngle=Math.PI/2;
 aligned.path=[{x:aligned.x,y:aligned.y+175}];aligned.repath=999;
 game.move(aligned,aligned.path[0],.05);
 assert.ok(aligned.y>start.y,'aligned tank may accelerate immediately');
 // While already rolling, subsequent waypoints must steer the cannon
 // gradually instead of instantaneously snapping at a path corner.
 const previousGun=unit.angle;
 unit.driveSpeed=45;unit.path=[{x:unit.x+140,y:unit.y}];unit.repath=999;
 game.move(unit,unit.path[0],.05);
 const gunStep=Math.abs(Math.atan2(
  Math.sin(unit.angle-previousGun),Math.cos(unit.angle-previousGun)));
 assert.ok(gunStep<=2.05*.05+.00001,'moving cannon must not snap to new waypoint');
 // Stopping clears the motor; the next command must start from rest.
 game.stop([unit.id]);
 assert.equal(unit.driveSpeed,0,'stop command resets tank acceleration');
});
