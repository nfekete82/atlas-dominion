import {test} from 'node:test';
import assert from 'node:assert/strict';
import {palmGroup,PALM_ART_SCALE} from '../dist/src/reborn/palm-grove.js';
import {ProductionGates,PRODUCTION_GATE_APERTURES} from '../dist/src/reborn/production-gates.js';
import {VEHICLE_CONTACT_SHADOWS,groundVehiclePose} from '../dist/src/reborn/unit-presentation.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const at={kind:'palm',x:650,y:670,radius:34,variant:.27,rotation:0};
test('desert: same map seed and tree coordinates always create exactly the same grove',()=>{
 const a=palmGroup(at,2026,3500),b=palmGroup(at,2026,3500);
 assert.deepEqual(a,b);
 assert.equal(palmGroup({...at,kind:'rock'},2026,3500).length,0);
 assert.ok(PALM_ART_SCALE>=1);
 assert.ok(a.every(tree=>tree.kind==='palm'));
});
test('desert: naturally spaced single, double and triple palms with mixed scale and mirroring',()=>{
 const groups=Array.from({length:160},(_,i)=>palmGroup({...at,x:650+i*5},2026,4000));
 const sizes=new Set(groups.map(group=>group.length));
 assert.deepEqual([...sizes].sort(),[1,2,3]);
 assert.ok(groups.flat().some(tree=>tree.mirrored));
 assert.ok(groups.flat().some(tree=>!tree.mirrored));
 for(const group of groups)for(const tree of group.slice(1)){
  assert.ok(tree.radius<group[0].radius,'grove companion is smaller than the main palm');
  assert.ok(Math.hypot(tree.x-group[0].x,tree.y-group[0].y)>20,'trees must not share exactly the same trunk');
 }
});
test('desert: extra palms never escape the playable map',()=>{
 const nearBorder={...at,x:28,y:29};
 const group=palmGroup(nearBorder,17,130);
 assert.ok(group.length>=1);
 for(const tree of group.slice(1))
  assert.ok(tree.x>0&&tree.x<130&&tree.y>0&&tree.y<130);
});
test('desert: groves do not touch saved simulation state or collision paths',()=>{
 const g=new Simulation(2026,4),before=g.save(),details=Array.from({length:12},(_,i)=>({...at,x:650+i*90}));
 const palms=details.flatMap(d=>palmGroup(d,g.seed,g.world.size));
 assert.ok(palms.length>=details.length);
 assert.deepEqual(g.save(),before);
});

const base={id:10,kind:'factory',hp:1100,buildRemaining:0,queue:[12],production:0};
test('gate: only a producing intact building gets a smooth opening',()=>{
 const gates=new ProductionGates();
 assert.equal(gates.sample(base,0),0);
 assert.equal(gates.sample({...base,production:8},8),0);
 const opening=gates.sample({...base,production:10.8},10.8);
 assert.ok(opening>0&&opening<1,'gate starts lifting before output');
 assert.ok(gates.sample({...base,production:12},12)>0.99);
 assert.equal(gates.sample({...base,hp:0},13),0);
 assert.equal(gates.sample({...base,buildRemaining:5},14),0);
});
test('gate: remains open through actual spawn and closes afterwards',()=>{
 const gates=new ProductionGates();
 gates.sample({...base,production:11.5},11.5);
 const released=gates.sample({...base,queue:[],production:0},12);
 assert.ok(released>.9,'shutter remains open while the unit emerges');
 assert.ok(gates.sample({...base,queue:[],production:0},12.7)>0);
 assert.equal(gates.sample({...base,queue:[],production:0},14),0);
});
test('gate: queue progress reset from two jobs triggers opening without changing production',()=>{
 const gates=new ProductionGates(),b={...base,queue:[12,12],production:11.8};
 gates.sample(b,11.8);
 assert.ok(gates.sample({...b,queue:[12],production:.2},12.0)>.9);
});
test('gate: HQ barracks factory and airfield have bounded atlas-space shutters',()=>{
 assert.equal(Object.keys(PRODUCTION_GATE_APERTURES).length,4);
 for(const a of Object.values(PRODUCTION_GATE_APERTURES)){
  assert.ok(a.x>0&&a.y>0&&a.width>15&&a.height>15);
  assert.ok(a.x+a.width<512&&a.y+a.height<512);
 }
});
test('vehicle finish: three tracked or wheeled models get subtle world-anchored contact shadows',()=>{
 for(const kind of ['tank','rover','artillery']){
  const s=VEHICLE_CONTACT_SHADOWS[kind];
  assert.ok(s&&s.alpha>0&&s.alpha<.20);
  assert.ok(s.widthRatio>.7&&s.heightRatio<.35);
 }
});
test('vehicle finish: tanks sway less than Humvees without an idle driving wobble',()=>{
 const common=[135,true,.8,.3,.4,10,3];
 const tank=groundVehiclePose('tank',...common),rover=groundVehiclePose('rover',...common);
 assert.ok(Math.abs(tank.heave)<Math.abs(rover.heave));
 assert.ok(Math.abs(tank.roll)<Math.abs(rover.roll));
 const idle=groundVehiclePose('tank',135,false,0,0,0,10,0);
 assert.ok(Math.abs(idle.heave)<.06);
 assert.equal(idle.roll,0);
 assert.equal(idle.pitch,0);
});
