import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
import {airfieldPoint,airfieldTaxiPoint,AIRFIELD_TAXI_SECONDS,
 AIRFIELD_TAKEOFF_SECONDS} from '../dist/src/reborn/airfield-maintenance.js';
import {bastionCaptureOrbit,approachBastionCaptureOrbit,BOMBER_ORBIT_RADII,
 isOnBomberOrbit} from '../dist/src/reborn/bomber-orbit.js';
import {createAirfieldServiceYard,updateAirfieldServiceYard,
 disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';

const local=(base,world)=>{
 const a=[0,Math.PI,Math.PI/2,Math.PI*1.5][base.facing??0];
 const dx=world.x-base.x,dy=world.y-base.y;
 return {x:dx*Math.cos(a)-dy*Math.sin(a),
  z:dx*Math.sin(a)+dy*Math.cos(a)};
};

test('all four rotations use open apron before aligning along hangar entrance',()=>{
 assert.equal(AIRFIELD_TAXI_SECONDS,8);
 assert.equal(AIRFIELD_TAKEOFF_SECONDS,8);
 for(let facing=0;facing<4;facing++){
  const base={x:2500,y:2600,facing};
  for(const bay of [0]){
   const cx=42-151*.90;
   const lineup=local(base,airfieldPoint(base,'lineup',bay));
   const door=local(base,airfieldPoint(base,'door',bay));
   const dock=local(base,airfieldPoint(base,'dock',bay));
   assert.ok(Math.abs(lineup.x-cx)<1e-6);
   assert.ok(Math.abs(lineup.z-95*.82)<1e-6,'turn 77 units outside the front wall at z=18');
   assert.ok(Math.abs(door.z-20*.82)<1e-6);
   assert.ok(dock.z<=-95,'service stop must be deep in the building');
   assert.ok(dock.z>-140,'parked fuselage must not intersect the back wall');
   assert.ok(Math.abs(door.x-lineup.x)<1e-6,'straight-in approach must have no wall-side turn');
   assert.ok(Math.abs(dock.x-door.x)<1e-6);
   for(let i=0;i<=200;i++){
    const p=local(base,airfieldTaxiPoint(base,bay,i/200));
    // A full-size bomber's fuselage projects ~50 units beyond its centre:
    // the aircraft MUST turn BEFORE entering the 18-unit front wall.
    if(p.z<=69*.82)assert.ok(Math.abs(p.x-cx)<1e-6,
      'near hangar wall the bomber may only move on its bay centerline');
    if(p.z<18*.82)assert.ok(p.z>=-118*.82,
      'taxi remains within physical hangar floor and back bulkhead');
   }
   assert.deepEqual(airfieldTaxiPoint(base,bay,0),
    airfieldPoint(base,'touchdown',bay));
   assert.deepEqual(airfieldTaxiPoint(base,bay,1),
    airfieldPoint(base,'dock',bay));
   assert.deepEqual(airfieldTaxiPoint(base,bay,0,true),
    airfieldPoint(base,'dock',bay));
   assert.deepEqual(airfieldTaxiPoint(base,bay,1,true),
    airfieldPoint(base,'departure',bay));
   // Departure follows exact reverse centerline, not a shortcut through wall.
   for(let i=0;i<=200;i++){
    const p=local(base,airfieldTaxiPoint(base,bay,i/200,true));
    if(p.z<=69*.82)assert.ok(Math.abs(p.x-cx)<1e-6);
   }
  }
 }
});

test('single hangar shutters open DURING landing and retract above wing clearance',()=>{
 const yard=createAirfieldServiceYard(),entry={airfieldServiceYard:yard},base={id:909};
 try{
  const planes=[0].map(bay=>({id:100+bay,hp:400,
   airfieldService:{baseId:909,bay,phase:'landing'}}));
  for(let i=0;i<90;i++)updateAirfieldServiceYard(entry,base,planes,i*.05,.05);
  for(const bay of [0]){
   const gate=yard.userData['bay'+bay];
   assert.ok(gate.open>.99,
    'both bays must open before the bomber starts ground taxi');
   const doorBottom=gate.left.position.y-32*gate.left.scale.y;
   assert.ok(doorBottom>74,
    'rolled shutters must not block the 107-unit bomber wing span');
   assert.equal(gate.right.position.y,gate.left.position.y);
  }
 }finally{disposeAirfieldServiceYard(entry);}
});

test('centered bastion capture orbit uses largest safe circle, not tiny tangent loops',()=>{
 const center={x:1900,y:2050};
 const bomber={id:12,x:center.x+27,y:center.y,angle:.1,hullAngle:.1};
 const orbit=bastionCaptureOrbit(bomber,center,RULES.captureRadius,4000);
 assert.ok(orbit);
 assert.ok(BOMBER_ORBIT_RADII.includes(orbit.radius));
 assert.equal(orbit.radius,78,'wide ring uses the available 95-unit capture radius');
 assert.deepEqual({x:orbit.cx,y:orbit.cy},center);
 assert.equal(bastionCaptureOrbit({...bomber,x:center.x+96},center,95,4000),null);
 let u={...bomber},travel=0;
 for(let i=0;i<110;i++){
  if(Math.abs(distance(u,center)-orbit.radius)<=.01)break;
  const next=approachBastionCaptureOrbit(u,orbit,.05);
  const step=Math.hypot(next.x-u.x,next.y-u.y);
  assert.ok(step>0&&step<145*.05+1e-8,
   'physical spiral must never teleport or outrun the true bomber');
  u={...u,x:next.x,y:next.y,angle:next.heading,hullAngle:next.heading};
  assert.ok(distance(u,center)<RULES.captureRadius,
   'approach may never abandon capturing sector');
  travel+=step;
 }
 assert.ok(isOnBomberOrbit(u,orbit),'spiral actually reaches centered patrol');
 assert.ok(travel>60,'approach uses genuine world-space movement');
});

test('REAL bomber physically captures neutral bastion while flying larger circles',()=>{
 const g=new Simulation(2074,4);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 const sector=g.territories.find(t=>t.owner===-1);
 assert.ok(sector);
 const bomber=g.spawn(0,{x:sector.point.x+25,y:sector.point.y},'bomber');
 bomber.angle=0;bomber.hullAngle=0;bomber.hold=false;
 let orbited=false,min=Infinity,max=0,advanced=0;
 for(let i=0;i<300&&g.status==='playing';i++){
  const old={x:bomber.x,y:bomber.y};
  g.step(.05);
  const d=distance(bomber,sector.point);
  min=Math.min(min,d);max=Math.max(max,d);
  advanced+=distance(old,bomber);
  assert.ok(d<=RULES.captureRadius+.01,
   'bomber may not exit the REAL sector capture radius');
  if(bomber.idleOrbit&&bomber.idleOrbit.cx===sector.point.x&&
      bomber.idleOrbit.cy===sector.point.y&&bomber.idleOrbit.radius===78)
    orbited=true;
 }
 assert.ok(orbited,'bomber uses large sector-centered orbit');
 assert.ok(max>=77,'orbit substantially wider than old 8-20-unit loops');
 assert.ok(advanced>300,'real bomber keeps flying while capturing');
 assert.equal(sector.owner,0,'ordinary physical capture completes without a rule change');
});
