import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {airfieldPoint,airfieldTaxiPoint,AIRFIELD_REPAIR_HP_PER_CREDIT} from '../dist/src/reborn/airfield-maintenance.js';
import {factoryRepairPoint,FACTORY_REPAIR_HP_PER_CREDIT} from '../dist/src/reborn/factory-maintenance.js';
import {unitRenderAltitude} from '../scripts/webgl-scale.js';
import {createAirfieldServiceYard,updateAirfieldServiceYard,disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';
import {createFactoryServiceYard,updateFactoryServiceYard,disposeFactoryServiceYard} from '../scripts/webgl-factory-service.js';
import {serviceVisualGround,approachGroundHeight,AIRFIELD_HANGAR_FLOOR_HEIGHT,FACTORY_LIFT_HEIGHT} from '../scripts/webgl-service-grounding.js';
import {selectedMaintenanceKind,serviceFootprintContains} from '../scripts/webgl-maintenance-input.js';

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

test('Three.js service yards create, animate and dispose with no DOM or WebGL context',()=>{
 const airfield=createAirfieldServiceYard();
 assert.ok(airfield.getObjectByName('AirfieldExtendedRunway'));
 assert.ok(airfield.getObjectByName('HangarDoorLeft_0'));
 assert.ok(airfield.getObjectByName('HangarDoorRight_1'));
 const aircraft={id:80,hp:200,airfieldService:{baseId:900,bay:0,phase:'repair'}};
 const airEntry={airfieldServiceYard:airfield};
 updateAirfieldServiceYard(airEntry,{id:900},[aircraft],2,.2);
 assert.equal(airfield.userData.bay0.sparks.visible,true);
 assert.ok(airfield.userData.bay0.open>0);
 updateAirfieldServiceYard(airEntry,{id:900},[],3,.2);
 assert.equal(airfield.userData.bay0.sparks.visible,false);
 disposeAirfieldServiceYard(airEntry);
 assert.equal(airEntry.airfieldServiceYard,null);

 const factory=createFactoryServiceYard();
 assert.ok(factory.getObjectByName('FactoryServiceWing'));
 assert.ok(factory.getObjectByName('VehicleRepairBaySurface_0'));
 assert.ok(factory.getObjectByName('VehicleRepairBaySurface_1'));
 const truck={id:81,hp:100,factoryService:{baseId:901,bay:1,phase:'repair'}};
 const garageEntry={factoryServiceYard:factory};
 updateFactoryServiceYard(garageEntry,{id:901},[truck],Math.PI/2);
 assert.equal(factory.userData.bay1.indicator.visible,true);
 updateFactoryServiceYard(garageEntry,{id:901},[],0);
 assert.equal(factory.userData.bay1.indicator.visible,false);
 disposeFactoryServiceYard(garageEntry);
 assert.equal(garageEntry.factoryServiceYard,null);
});

test('end-to-end: real bomber lands and taxis into its assigned hangar',()=>{
 const {g,airport}=setup();
 const bomber=g.spawn(0,{x:1680,y:1900},'bomber');
 bomber.hp=600;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 let touchedDown=false,enteredTaxi=false,repaired=false;
 for(let i=0;i<1000;i++){
  g.step(.05);
  if(!bomber.airfieldService)break;
  if(bomber.airfieldService.phase==='landing')touchedDown=true;
  if(bomber.airfieldService.phase==='taxi')enteredTaxi=true;
  if(bomber.airfieldService.phase==='repair'){repaired=true;break;}
 }
 assert.ok(touchedDown,'bomber must reach approach waypoint without teleport');
 assert.ok(enteredTaxi,'real bomber must land, not switch straight to repair');
 assert.ok(repaired,'real bomber must drive to hangar');
 assert.ok(Math.hypot(bomber.x-airfieldPoint(airport,'dock',0).x,
  bomber.y-airfieldPoint(airport,'dock',0).y)<3,'hangar station must be at actual final taxi position');
 assert.equal(bomber.flightHeight,0,'bomber must actually touch ground');
});

test('end-to-end: ground tank drives to factory apron and enters service',()=>{
 const {g,garage}=setup(),tank=g.spawn(0,{x:2740,y:2510},'tank');
 tank.hp=700;
 assert.equal(g.requestFactoryRepair([tank.id]),1);
 let startedParking=false,servicing=false;
 for(let i=0;i<2200;i++){
  g.step(.05);
  if(!tank.factoryService)break;
  if(tank.factoryService.phase==='parking')startedParking=true;
  if(tank.factoryService.phase==='repair'){servicing=true;break;}
 }
 assert.equal(startedParking,true,'tank must reach the approach lane');
 assert.equal(servicing,true,'tank must actually park at workshop bay');
 const dock=factoryRepairPoint(garage,0);
 assert.ok(Math.hypot(dock.x-tank.x,dock.y-tank.y)<15);
});

test('orders cancel vehicle maintenance but aircraft take off rather than teleporting',()=>{
 const {g,garage,airport}=setup();
 const rover=g.spawn(0,{x:2680,y:2390},'rover');rover.hp=180;
 assert.equal(g.requestFactoryRepair([rover.id]),1);
 g.setAutoFactoryRepair([rover.id],true);
 rover.factoryService.phase='repair';Object.assign(rover,factoryRepairPoint(garage,0));
 const before={x:rover.x,y:rover.y};
 assert.equal(g.command([rover.id],{x:2590,y:2370,kind:'move'}),1);
 assert.equal(rover.factoryService,undefined);
 assert.equal(rover.autoFactoryRepair,false,'manual order must suppress immediate automatic return');
 assert.deepEqual({x:rover.x,y:rover.y},before,'no garage teleport when redirected');
 assert.equal(rover.orders[0]?.kind,'move');

 const bomber=g.spawn(0,{x:1640,y:2050},'bomber');bomber.hp=500;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 g.setAutoAirfieldRepair([bomber.id],true);
 bomber.airfieldService.phase='repair';Object.assign(bomber,airfieldPoint(airport,'dock',0));
 bomber.flightHeight=0;
 const dock={x:bomber.x,y:bomber.y};
 assert.equal(g.command([bomber.id],{x:2300,y:2380,kind:'move'}),1);
 assert.equal(bomber.airfieldService.phase,'takeoff');
 assert.equal(bomber.autoAirfieldRepair,false);
 assert.deepEqual({x:bomber.x,y:bomber.y},dock);
 assert.equal(bomber.flightHeight,0,'manual override cannot jump straight to flight altitude');
 assert.equal(bomber.orders[0]?.kind,'move');
 advance(g,6.05);
 assert.equal(bomber.airfieldService,undefined);
 assert.equal(bomber.flightHeight,1);
});

test('aircraft diverted before landing can change orders immediately and release the bay',()=>{
 const {g}=setup(),bomber=g.spawn(0,{x:1800,y:2000},'bomber');bomber.hp=400;
 assert.equal(g.requestAirfieldRepair([bomber.id]),1);
 assert.equal(bomber.airfieldService?.phase,'approach');
 assert.equal(g.command([bomber.id],{x:1600,y:1900,kind:'move'}),1);
 assert.equal(bomber.airfieldService,undefined);
 assert.equal(bomber.orders[0]?.kind,'move');
 assert.equal(bomber.flightHeight,1);
 assert.equal(g.requestAirfieldRepair([bomber.id]),1,'slot is no longer occupied');
});

test('finished vehicle in a workshop stays at the exact saved 3D platform position',()=>{
 const {g,garage}=setup(),vehicle=g.spawn(0,{x:2690,y:2360},'tank');
 vehicle.hp=600;assert.equal(g.requestFactoryRepair([vehicle.id]),1);
 vehicle.factoryService.phase='repair';Object.assign(vehicle,factoryRepairPoint(garage,0));
 const saved=g.save(),restored=Simulation.load(saved);
 const restoredVehicle=restored.units.find(u=>u.id===vehicle.id);
 assert.equal(restoredVehicle.x,vehicle.x);
 assert.equal(restoredVehicle.y,vehicle.y);
 assert.deepEqual(restoredVehicle.factoryService,vehicle.factoryService);
});

test('uneven terrain: maintenance altitude meets flat workshop floors without visual popping',()=>{
 const ground=24,building=12;
 const plane={flightHeight:1,airfieldService:{phase:'approach'}};
 assert.equal(serviceVisualGround(plane,ground,building),ground);
 plane.airfieldService.phase='landing';plane.flightHeight=.5;
 assert.equal(serviceVisualGround(plane,ground,building),
  (ground+building+AIRFIELD_HANGAR_FLOOR_HEIGHT)/2);
 plane.airfieldService.phase='repair';plane.flightHeight=0;
 assert.equal(serviceVisualGround(plane,ground,building),
  building+AIRFIELD_HANGAR_FLOOR_HEIGHT);
 plane.airfieldService.phase='takeoff';plane.flightHeight=1;
 assert.equal(serviceVisualGround(plane,ground,building),ground);

 const tank={factoryService:{phase:'approach'}};
 assert.equal(serviceVisualGround(tank,ground,building),ground);
 tank.factoryService.phase='parking';
 assert.equal(serviceVisualGround(tank,ground,building,85),ground);
 assert.equal(serviceVisualGround(tank,ground,building,42.5),
  (ground+building+FACTORY_LIFT_HEIGHT)/2);
 tank.factoryService.phase='repair';
 assert.equal(serviceVisualGround(tank,ground,building),
  building+FACTORY_LIFT_HEIGHT);
 assert.equal(approachGroundHeight(24,12,.1),20.4);
 assert.equal(approachGroundHeight(24,12,0),24);
});

test('workshop provides actual raised hydraulic service decks and ramps',()=>{
 const factory=createFactoryServiceYard();
 for(const bay of [0,1]){
  assert.ok(factory.getObjectByName('VehicleLiftPlatform_'+bay));
  assert.ok(factory.getObjectByName('VehicleDriveOnRamp_'+bay));
 }
 const mesh=factory.getObjectByName('VehicleLiftPlatform_0');
 assert.equal(mesh.position.y+mesh.geometry.parameters.height/2,FACTORY_LIFT_HEIGHT);
 const entry={factoryServiceYard:factory};
 disposeFactoryServiceYard(entry);
});

test('garage and airfield selected-building HUD can recover unclickable parked aircraft',()=>{
 const source=readFileSync(new URL('../scripts/webgl-battlefield.js',import.meta.url),'utf8');
 for(const command of ['hangar-repair-all','hangar-launch-ready',
  'factory-repair-all','factory-release-ready']){
  assert.match(source,new RegExp(command));
 }
 assert.match(source,/WARTUNGSPLÄTZE/);
 assert.match(source,/ALLE ZURÜCK/);
});

test('manual right-click routes a tank and bomber to the clicked, not another, service building',()=>{
 const {g,airport,garage}=setup();
 const tank=g.spawn(0,{x:2530,y:2110},'tank');
 const bomber=g.spawn(0,{x:1850,y:2020},'bomber');
 tank.hp=600;bomber.hp=400;
 assert.equal(g.requestFactoryRepair([tank.id],airport.id),0);
 assert.equal(g.requestAirfieldRepair([bomber.id],garage.id),0);
 assert.equal(g.requestFactoryRepair([tank.id],garage.id),1);
 assert.equal(g.requestAirfieldRepair([bomber.id],airport.id),1);
 assert.equal(tank.factoryService.baseId,garage.id);
 assert.equal(bomber.airfieldService.baseId,airport.id);
 assert.equal(tank.factoryService.phase,'approach');
 assert.equal(bomber.airfieldService.phase,'approach');
});
test('repair right-click detects angled roofs, pads and runway without hijacking soldiers',()=>{
 const units=[{id:1,kind:'tank',owner:0,hp:300},
  {id:2,kind:'scout',owner:0,hp:100},{id:3,kind:'infantry',owner:0,hp:50}];
 assert.equal(selectedMaintenanceKind(units,new Set([1])),'factory');
 assert.equal(selectedMaintenanceKind(units,new Set([2])),'airfield');
 assert.equal(selectedMaintenanceKind(units,new Set([3])),null);
 assert.equal(selectedMaintenanceKind(units,new Set([1,2])),null);
 const garage={kind:'factory',x:400,y:500,facing:0};
 const airfield={kind:'airfield',x:800,y:900,facing:2};
 assert.equal(serviceFootprintContains(garage,{x:476,y:672}),true);
 assert.equal(serviceFootprintContains(garage,{x:400,y:950}),false);
 assert.equal(serviceFootprintContains(airfield,{x:975,y:900}),true);
 assert.equal(serviceFootprintContains(airfield,{x:1400,y:900}),false);
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/this\.maintenanceFacilityAtPointer\(event,serviceKind\)/);
 assert.match(source,/this\.game\.requestAirfieldRepair\(ids,facility\.id\)/);
 assert.match(source,/this\.game\.requestFactoryRepair\(ids,facility\.id\)/);
 assert.match(readFileSync('scripts/build.mjs','utf8'),/webgl-maintenance-input\.js/);
});

test('damaged vehicles display a distinct service cross and animated welding sparks',()=>{
 const yard=createFactoryServiceYard();
 const base={id:910,kind:'factory',x:1200,y:1200,facing:0};
 const entry={factoryServiceYard:yard};
 const state=yard.userData.bay0;
 assert.ok(yard.getObjectByName('FactoryRepairIcon_0'));
 assert.ok(yard.getObjectByName('FactoryRepairCircle_0'));
 assert.ok(yard.getObjectByName('FactoryWeldingSparks_0'));
 assert.equal(state.icon.visible,false);
 assert.equal(state.sparks.visible,false);
 const vehicle={id:8,hp:500,factoryService:{baseId:910,bay:0,phase:'repair'}};
 updateFactoryServiceYard(entry,base,[vehicle],1.8);
 assert.equal(state.icon.visible,true);
 assert.equal(state.sparks.visible,true);
 assert.equal(state.indicator.visible,true);
 const before=state.sparks.rotation.y;
 updateFactoryServiceYard(entry,base,[vehicle],2.2);
 assert.notEqual(state.sparks.rotation.y,before);
 vehicle.factoryService.phase='ready';
 updateFactoryServiceYard(entry,base,[vehicle],3);
 assert.equal(state.icon.visible,true);
 assert.equal(state.sparks.visible,false);
 updateFactoryServiceYard(entry,base,[],4);
 assert.equal(state.icon.visible,false);
 assert.equal(state.sparks.visible,false);
 disposeFactoryServiceYard(entry);
});

test('factory and airfield use real PBR camouflage/data textures, roof details and weathering',async()=>{
 const {servicePaint}=await import('../scripts/webgl-service-materials.js');
 const material=servicePaint(['#727a5e','#a79976','#bdac88'],{seed:7});
 assert.ok(material.map?.isDataTexture);
 assert.equal(material.map.image.data.length,96*96*4);
 assert.equal(material.map.colorSpace,'srgb');
 material.map.dispose();material.dispose();
 const yard=createFactoryServiceYard(),hangar=createAirfieldServiceYard();
 for(const name of ['FactoryFacadeRivet_1','FactorySideVentLouvre_1',
   'FactoryRoofAirDuct_1','FactoryToolChest_0'])
  assert.ok(yard.getObjectByName(name),name);
 for(const name of ['HangarRoofVent_0','HangarDoorCorrugation_0_0',
   'HangarRearVent_0','AirfieldTouchdownRubber'])
  assert.ok(hangar.getObjectByName(name),name);
 for(const root of [yard,hangar]){
  let textureCount=0;
  root.traverse(mesh=>{if(mesh.isMesh&&mesh.material.map?.isDataTexture)textureCount++;});
  assert.ok(textureCount>10,'camouflage and steel surfaces must be textured');
 }
 disposeFactoryServiceYard({factoryServiceYard:yard});
 disposeAirfieldServiceYard({airfieldServiceYard:hangar});
});
