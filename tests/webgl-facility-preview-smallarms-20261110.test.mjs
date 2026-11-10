import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNITS,TANK_MG,weaponDamage,combatDpsAgainst} from '../dist/src/reborn/catalog.js';
import {createAirfieldServiceYard,disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';
import {createFactoryServiceYard,disposeFactoryServiceYard} from '../scripts/webgl-factory-service.js';
import {serviceFootprintContains} from '../scripts/webgl-maintenance-input.js';

const unit=kind=>({kind});
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('small arms remain lethal to infantry but weak against vehicles and airframes',()=>{
 for(const gun of ['infantry','medic','engineer','heavy','rover','scout']){
  const infantryDamage=weaponDamage(unit(gun),unit('infantry'));
  for(const armor of ['rover','tank','artillery']){
   const hit=weaponDamage(unit(gun),unit(armor));
   assert.ok(hit<=UNITS[gun].damage*.20+1e-8,gun+' too strong versus '+armor);
   assert.ok(hit<infantryDamage,gun+' must favor infantry');
  }
  for(const aircraft of ['scout','bomber']){
   const hit=weaponDamage(unit(gun),unit(aircraft));
   assert.ok(hit<=UNITS[gun].damage*.12+1e-8,gun+' too strong versus '+aircraft);
   assert.ok(hit<infantryDamage,gun+' must favor infantry');
  }
 }
 assert.equal(weaponDamage(unit('rocket'),unit('bomber')),UNITS.rocket.damage*1.2);
 assert.equal(weaponDamage(unit('rocket'),unit('scout')),UNITS.rocket.damage*1.2);
 assert.equal(combatDpsAgainst(unit('tank'),unit('infantry')),TANK_MG.damage/TANK_MG.cooldown);
 assert.equal(weaponDamage(unit('heavy'),{kind:'factory',queue:[]}),UNITS.heavy.damage*.45,
  'retain pre-existing building balance');
});

test('runway is significantly longer than hangars and landing positions stay unchanged',()=>{
 const airport=createAirfieldServiceYard();
 const runway=airport.getObjectByName('AirfieldExtendedRunway');
 const hangar=airport.getObjectByName('HangarBayFloor_0');
 assert.ok(runway&&hangar);
 assert.ok(runway.geometry.parameters.depth>=hangar.geometry.parameters.depth*2.5);
 assert.ok(runway.position.z+runway.geometry.parameters.depth/2>340);
 assert.ok(airport.getObjectByName('HangarRoofSpine_0'));
 assert.ok(airport.getObjectByName('HangarAngledRoofPlate_1'));
 assert.ok(serviceFootprintContains({kind:'airfield',facing:0,x:1200,y:1400},{x:1330,y:1740}));
 disposeAirfieldServiceYard({airfieldServiceYard:airport});
});

test('factory architecture is compact and the repair gantry does not block approach',()=>{
 const factory=createFactoryServiceYard();
 const wing=factory.getObjectByName('FactoryServiceWing');
 const crane=factory.getObjectByName('RepairGantryCrossbeam_0');
 const dock=factory.getObjectByName('VehicleLiftPlatform_0');
 assert.ok(wing.geometry.parameters.height<50);
 assert.ok(crane.position.z<dock.position.z-45);
 assert.ok(factory.getObjectByName('VehicleDriveOnRamp_1'));
 disposeFactoryServiceYard({factoryServiceYard:factory});
});

test('build ghost and completed buildings use identical 3D asset and site generators',()=>{
 const battlefield=source('scripts/webgl-battlefield.js');
 const begin=battlefield.slice(battlefield.indexOf(' beginPlacement(kind){'),battlefield.indexOf(' clearPlacement(){'));
 assert.ok(begin.includes("this.getModel(this.asset(kind,0,'building'))"));
 assert.ok(begin.includes('createBuildingYard(kind,spec.width)'));
 assert.ok(begin.includes('createAirfieldServiceYard()'));
 assert.ok(begin.includes('createFactoryServiceYard()'));
 assert.ok(begin.includes("hideOldAirfieldHangar({detail:model})"));
 assert.ok(begin.includes('calibratedScale('));
 assert.ok(battlefield.includes('disposeServicePaint(preview.userData.previewService)'));
});
