import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {airfieldPoint,airfieldTaxiPoint,AIRFIELD_REPAIR_HP_PER_CREDIT} from '../dist/src/reborn/airfield-maintenance.js';
import {factoryRepairPoint,FACTORY_REPAIR_HP_PER_CREDIT} from '../dist/src/reborn/factory-maintenance.js';
import {unitRenderAltitude} from '../scripts/webgl-scale.js';

const base=(game,kind,id,x,y,facing=0)=>{
 const b={id,kind,owner:0,x,y,facing,territory:0,hp:kind==='airfield'?1200:1100,
  buildRemaining:0,queue:[],queueTypes:[],production:0,cooldown:0,rally:null,
  radius:kind==='airfield'?116:70};
 game.bases.push(b);return b;
};
function setup(){
 const g=new Simulation(2074,4);
 g.aiClock=1e8;g.tactical.plan=()=>{};
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.credits[0]=10000;
 const airport=base(g,'airfield',31110,2000,2000);
 const garage=base(g,'factory',31111,2700,2000);
 return {g,airport,garage};
}
const advance=(game,seconds)=>{for(let n=0;n<Math.round(seconds/.05);n++)game.step(.05);};

test('two distinct rotated airfield bays and runway/landing points',()=>{
 const b={x:2000,y:2100,facing:2};
 assert.notDeepEqual(airfieldPoint(b,'dock',0),airfieldPoint(b,'dock',1));
 assert.deepEqual(airfieldTaxiPoint(b,0,0),airfieldPoint(b,'touchdown',0));
 assert.deepEqual(airfieldTaxiPoint(b,1,1),airfieldPoint(b,'dock',1));
 assert.deepEqual(factoryRepairPoint(b,0),{x:2172,y:2176});
 assert.deepEqual(factoryRepairPoint(b,1),{x:2172,y:2024});
 assert.equal(unitRenderAltitude('bomber',1),175);
 assert.equal(unitRenderAltitude('bomber',0),0);
});

test('aircraft can reserve exactly two bays and must pay for hangar repair',()=>{
 const {g,airport}=setup(),planes=[0,1,2].map(n=>g.spawn(0,{x:1750+n*14,y:1990},'bomber'));
 for(const p of planes)p.hp=350;
 assert.equal(g.requestAirfieldRepair(planes.map(p=>p.id)),2);
 assert.deepEqual(planes.slice(0,2).map(p=>p.airfieldService.bay),[0,1]);
 assert.equal(planes[2].airfieldService,undefined);
 assert.equal(g.requestAirfieldRepair([planes[0].id]),0,'service cannot be reserved twice');
 const aircraft=planes[0];
 aircraft.airfieldService.phase='repair';
 const dock=airfieldPoint(airport,'dock',0);aircraft.x=dock.x;aircraft.y=dock.y;
 const credits=g.credits[0];advance(g,1);
 assert.ok(aircraft.hp>350,'aircraft health increases in the hangar');
 assert.ok(g.credits[0]<credits,'repair consumes player credits');
 assert.ok(g.credits[0]>=credits-Math.ceil((aircraft.hp-350)/AIRFIELD_REPAIR_HP_PER_CREDIT)-1);
 g.credits[0]=0;const before=aircraft.hp;advance(g,1);
 assert.ok(aircraft.hp>=before,'already-paid fractional HP may be consumed');
 advance(g,2);assert.ok(aircraft.hp-before<=AIRFIELD_REPAIR_HP_PER_CREDIT+.01);
});

test('finished bomber remains docked until an explicit launch, then actually takes off',()=>{
 const {g,airport}=setup(),plane=g.spawn(0,{x:1500,y:2050},'bomber');
 plane.hp=699;assert.equal(g.requestAirfieldRepair([plane.id]),1);
 plane.airfieldService.phase='repair';Object.assign(plane,airfieldPoint(airport,'dock',0));
 advance(g,.5);assert.equal(plane.airfieldService.phase,'ready');
 const stationary={x:plane.x,y:plane.y};advance(g,.5);
 assert.deepEqual({x:plane.x,y:plane.y},stationary);
 assert.equal(g.launchRepairedAircraft([plane.id]),1);
 advance(g,6.1);
 assert.equal(plane.airfieldService,undefined);
 assert.equal(plane.flightHeight,1);
 assert.ok(Math.hypot(plane.x-stationary.x,plane.y-stationary.y)>100);
});

test('factory maintenance accepts tanks, Humvees and artillery; refuses third slot',()=>{
 const {g,garage}=setup(),roster=['tank','rover','artillery'].map((kind,i)=>g.spawn(0,
   {x:2560+i*10,y:2310},kind));
 for(const u of roster)u.hp=g.maxUnitHp(u)*.4;
 assert.equal(g.requestFactoryRepair(roster.map(u=>u.id)),2);
 assert.deepEqual(roster.slice(0,2).map(u=>u.factoryService.bay),[0,1]);
 assert.equal(roster[2].factoryService,undefined);
 assert.notDeepEqual(factoryRepairPoint(garage,0),factoryRepairPoint(garage,1));
 roster[0].factoryService.phase='repair';
 Object.assign(roster[0],factoryRepairPoint(garage,0));
 const initial=roster[0].hp,credits=g.credits[0];advance(g,1);
 assert.ok(roster[0].hp>initial);
 assert.ok(g.credits[0]<credits);
 assert.ok((roster[0].hp-initial)<=g.maxUnitHp(roster[0])*.012+.01);
 assert.ok(g.credits[0]>=credits-Math.ceil((roster[0].hp-initial)/FACTORY_REPAIR_HP_PER_CREDIT)-1);
 roster[0].hp=g.maxUnitHp(roster[0]);advance(g,.05);
 assert.equal(roster[0].factoryService.phase,'ready');
 assert.equal(g.releaseFactoryRepair([roster[0].id]),1);
 assert.equal(roster[0].factoryService,undefined);
 assert.equal(g.requestFactoryRepair([roster[2].id]),1,'freed bay is reused');
});

test('repair states survive version-2 saves and reject corrupt slot values',()=>{
 const {g}=setup();
 const bomber=g.spawn(0,{x:1850,y:1980},'bomber');bomber.hp=400;
 const tank=g.spawn(0,{x:2600,y:2200},'tank');tank.hp=500;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 assert.equal(g.requestFactoryRepair([tank.id]),1);
 g.setAutoAirfieldRepair([bomber.id],true);g.setAutoFactoryRepair([tank.id],true);
 const stored=g.save(),restored=Simulation.load(stored);
 assert.deepEqual(restored.units.find(u=>u.id===bomber.id).airfieldService,bomber.airfieldService);
 assert.deepEqual(restored.units.find(u=>u.id===tank.id).factoryService,tank.factoryService);
 assert.equal(restored.units.find(u=>u.id===tank.id).autoFactoryRepair,true);
 assert.equal(restored.units.find(u=>u.id===bomber.id).autoAirfieldRepair,true);
 const broken=structuredClone(stored);
 broken.units.find(u=>u.id===tank.id).factoryService.bay=99;
 assert.throws(()=>Simulation.load(broken),/beschädigt/);
});

test('3D maintenance assets are wired into build and battlefield lifecycle',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const build=read('scripts/build.mjs'),battlefield=read('scripts/webgl-battlefield.js');
 const airfield=read('scripts/webgl-airfield-service.js'),factory=read('scripts/webgl-factory-service.js');
 for(const name of ['webgl-airfield-service.js','webgl-factory-service.js'])assert.ok(build.includes(name));
 for(const phrase of ['createAirfieldServiceYard','updateAirfieldServiceYard','disposeAirfieldServiceYard',
   'createFactoryServiceYard','updateFactoryServiceYard','disposeFactoryServiceYard',
   'hangar-repair','factory-repair','hangar-auto','factory-auto'])assert.ok(battlefield.includes(phrase),phrase);
 for(const phrase of ['HangarDoorLeft_','AirfieldExtendedRunway','HangarCamoArch_'])assert.ok(airfield.includes(phrase));
 for(const phrase of ['FactoryVehicleRepairApron','HydraulicVehicleLiftRail_','FactoryServiceWing'])assert.ok(factory.includes(phrase));
});
