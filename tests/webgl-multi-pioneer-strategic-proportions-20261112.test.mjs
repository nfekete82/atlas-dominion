import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {STRATEGIC_BUILDING_VISUAL_SCALE,strategicBuildingHeightScale,
 calibratedScale,buildingFacingAngle} from '../scripts/webgl-scale.js';

const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step(.05);};
function fixture(count=1){
 const g=new Simulation(20261112,4);g.aiClock=1e9;g.tactical.plan=()=>{};
 g.credits[0]=15000;g.explored[0].fill(1);g.visible[0].fill(1);
 g.world.blocked.fill(0);g.units=g.units.filter(u=>u.owner!==0);
 let place=null;
 for(let y=250;y<g.world.size-250&&!place;y+=32)
 for(let x=250;x<g.world.size-250&&!place;x+=32)
  if(!g.buildError(0,'barracks',{x,y}))place={x,y};
 assert.ok(place,'valid construction site exists');
 const workers=[];
 for(let i=0;i<count;i++){
  const x=place.x+(i%2===0?1:-1)*(BUILDINGS.barracks.radius+30);
  const y=place.y;
  const p=g.world.nearest({x,y},g.obstacles());
  assert.ok(p,'reachable support point');
  workers.push(g.spawn(0,p,'engineer'));
 }
 return {g,place,workers};
}
test('two pioneers build one foundation at twice the solo rate',()=>{
 const run=count=>{
  const {g,place,workers}=fixture(count);
  const site=g.build(0,'barracks',place,workers.map(u=>u.id));
  assert.ok(site,'actual simulation accepts cooperative build');
  step(g,2.5);
  return BUILDINGS.barracks.buildTime-site.buildRemaining;
 };
 const one=run(1),two=run(2);
 assert.ok(one>.4,'solo progress '+one);
 assert.ok(two>=one*1.75,'two contributors: '+one+' vs '+two);
});
test('building and vehicle repairs add each pioneer contribution',()=>{
 for(const kind of ['building','vehicle']){
  const run=count=>{
   const {g,place,workers}=fixture(count);
   let target;
   if(kind==='building'){
    target=g.build(0,'barracks',place,[workers[0].id]);
    assert.ok(target);target.buildRemaining=0;target.hp=BUILDINGS.barracks.hp-600;
   }else{
    target=g.spawn(0,place,'rover');target.hp=UNITS.rover.hp-80;
   }
   const ids=workers.map(u=>u.id);
   assert.equal(g.command(ids,{kind:'repair',target:target.id,x:target.x,y:target.y}),count);
   const before=target.hp;step(g,1);
   return target.hp-before;
  };
  const one=run(1),two=run(2);
  assert.ok(one>2,kind+' solo repair rate');
  assert.ok(two>=one*1.70,kind+' cooperative repair '+one+' vs '+two);
 }
});
test('research and silo height corrections remain display-only',()=>{
 assert.equal(STRATEGIC_BUILDING_VISUAL_SCALE.research,.88);
 assert.equal(STRATEGIC_BUILDING_VISUAL_SCALE.silo,.9);
 assert.equal(strategicBuildingHeightScale('research'),1.75);
 assert.equal(strategicBuildingHeightScale('silo'),1.60);
 assert.equal(strategicBuildingHeightScale('headquarters'),1);
 assert.equal(buildingFacingAngle(1),Math.PI);
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(source.includes("this.placementFacing=kind==='research'?1:0"));
 assert.ok(source.includes('model.scale.y*=heightScale'));
 assert.ok(source.includes('alternate.scale.y*=altHeightScale'));
 assert.ok(source.includes('this.createWallPreviewGeometry()'));
});
