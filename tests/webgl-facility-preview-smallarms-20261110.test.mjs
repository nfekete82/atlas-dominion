import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNITS,TANK_MG,weaponDamage,combatDpsAgainst} from '../dist/src/reborn/catalog.js';
import {createAirfieldServiceYard,disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';
import {createFactoryServiceYard,updateFactoryServiceYard,disposeFactoryServiceYard} from '../scripts/webgl-factory-service.js';
import {serviceFootprintContains} from '../scripts/webgl-maintenance-input.js';
import {airfieldPoint} from '../dist/src/reborn/airfield-maintenance.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

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
 assert.ok(runway.geometry.parameters.depth>=550&&runway.geometry.parameters.depth<=650,
  'runway must be long enough for the bomber but fit the actual map');
 assert.equal(airport.getObjectByName('AirfieldCrossTaxiLane'),undefined,
  'remove the old short cross runway');
 assert.ok(airport.getObjectByName('AirfieldAircraftParkingPad_0'));
 assert.ok(airport.getObjectByName('AirfieldAircraftParkingPad_1'));
 const tower=airport.getObjectByName('AirfieldLeftControlTowerShaft');
 const fuel=airport.getObjectByName('AirfieldFuelServiceContainer');
 assert.ok(tower&&fuel);
 assert.ok(tower.position.x<-250&&fuel.position.x<-250,
  'tower and gas infrastructure must be outside the left hangar, not by the right entrance');
 assert.ok(airport.getObjectByName('AirfieldLeftControlTowerGlazing'));
 assert.ok(!airport.getObjectByName('AirfieldRightControlTowerShaft'));

 const base={x:2000,y:2000,facing:0};
 assert.ok(airfieldPoint(base,'approach').y>2250);
 assert.ok(airfieldPoint(base,'touchdown').y>2100);
 assert.ok(serviceFootprintContains({kind:'airfield',facing:0,x:1200,y:1400},
  {x:1330,y:1775}),'runway right-click extends to far end');
 assert.ok(airport.getObjectByName('HangarRoofSpine_0'));
 assert.ok(airport.getObjectByName('HangarAngledRoofPlate_1'));
 assert.ok(serviceFootprintContains({kind:'airfield',facing:0,x:1200,y:1400},{x:1330,y:1740}));
 disposeAirfieldServiceYard({airfieldServiceYard:airport});
});

test('factory restores original main building with ONE compact side garage',()=>{
 const factory=createFactoryServiceYard(),deck=factory.getObjectByName('VehicleLiftPlatform_0');
 const roof=factory.getObjectByName('FactoryRepairGarageRoof_0');
 const left=factory.getObjectByName('FactorySideWorkshopWallLeft');
 assert.ok(deck&&roof&&left);
 assert.ok(deck.position.x > 140,'repair bay sits right of main factory');
 assert.ok(roof.geometry.parameters.width<145,'side garage stays compact');
 assert.ok(roof.geometry.parameters.depth<140,'no extended front double garages');
 assert.equal(factory.getObjectByName('VehicleLiftPlatform_1'),undefined);
 assert.equal(factory.getObjectByName('FactoryServiceWing'),undefined);
 assert.ok(factory.getObjectByName('VehicleDriveOnRamp_0'));
 const entry={factoryServiceYard:factory};
 const vehicle={id:901,hp:700,factoryService:{baseId:1,bay:0,phase:'parking'}};
 updateFactoryServiceYard(entry,{id:1},[vehicle],1);
 const opened=factory.userData.bay0.doorOpen;
 assert.ok(opened>.85);
 assert.ok(factory.getObjectByName('FactoryServiceDoorLeft_0').position.y>30);
 vehicle.factoryService.phase='repair';
 updateFactoryServiceYard(entry,{id:1},[vehicle],1.2);
 assert.ok(factory.userData.bay0.doorOpen<opened);
 assert.equal(deck.position.y+deck.geometry.parameters.height/2,9.5);
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
 assert.ok(begin.includes('placeholder.visible=false'));
 assert.ok(begin.includes('model.visible=false'));
 assert.ok(begin.includes('ConstructionPlacementGuides'));
 assert.match(begin,/opacity:\.43,depthWrite:false,depthTest:false/,
  'solid scaffold posts must be visible even at tactical camera zoom');
 assert.ok(begin.includes('beam(t,h,t,'),'blueprint contains real vertical scaffold poles');
 assert.ok(begin.includes('guidePad(141,600,132,105)'),
  'airport preview shows the compact full runway footprint');
 assert.ok(begin.includes("if(kind==='factory')guideBox(118,54,125,192,45)"),
  'factory preview shows the compact one-bay service annex');
 assert.ok(begin.includes('group.userData.previewGuideMaterials='),
  'blueprints can show invalid location in amber/red');
 assert.match(begin,/opacity:\.46,depthWrite:false,depthTest:false/,
  'guide wireframe is now readable on sandy terrain');
 assert.match(begin,/opacity:\.15,depthWrite:false,depthTest:false/,
  'construction footprint stays translucent but visible');
 assert.ok(begin.includes('if(mesh.isMesh&&'));
 assert.ok(!begin.includes('placeholder.visible=true'));

 assert.ok(begin.includes('conformAirfieldSurface')===false,
  'runway terrain fitting runs from updatePlacementPreview, not from loading');
 assert.ok(battlefield.includes('conformAirfieldSurface(ghost.userData.previewService'));
 assert.ok(battlefield.includes('conformAirfieldSurface(entry.airfieldServiceYard'));
 assert.ok(battlefield.includes("if(b.kind==='airfield'){"),'full airfield exists while being built');

 assert.ok(begin.includes('calibratedScale('));
 assert.ok(battlefield.includes('disposeServicePaint(preview.userData.previewService)'));
 assert.match(begin,/const tint=\(root,ownSource=false,opacity=\.0585\)/,'buildings are faint holograms');
 assert.match(begin,/m\.opacity=Math\.min\(mat\.opacity\?\?1,opacity\)/);
 assert.match(begin,/tint\(yard,false,\.052\)/,'fences and courtyard props remain faint');
 assert.match(begin,/tint\(service,true,\.0585\)/,'runway and service stations remain faint');
 assert.match(begin,/opacity:\.21,depthTest:false/,'placement circle does not dominate ghost');
});

test('construction progressively reveals the real building instead of displaying a complete prefab',()=>{
 const construction=source('scripts/webgl-construction.js');
 assert.ok(!construction.includes('if(model)model.visible=true'));
 assert.ok(construction.includes("stageGroup(model,'building')"));
 assert.ok(construction.includes('constructionOriginalVisible'));
 assert.ok(construction.includes("stageGroup(entry.yard,'yard')"));
 assert.ok(construction.includes("stageGroup(entry.airfieldServiceYard??entry.factoryServiceYard,'service')"));
 assert.ok(!construction.includes('model.visible=true'));

 assert.ok(construction.includes("stageGroup(entry.yard,'yard')"));
 assert.ok(construction.includes("stageGroup(entry.airfieldServiceYard??entry.factoryServiceYard,'service')"));
 assert.ok(!construction.includes('model.traverse(obj=>{'),
  'construction must no longer clip authored GLB materials');
 assert.ok(!construction.includes('state.clip.constant='));
 assert.ok(construction.includes('state.roof.visible=progress>=.77'));
 assert.ok(construction.includes("threshold=/roof|antenna"));
});

test('airfield selection no longer hides the building catalogue if a pioneer survives',()=>{
 const src=source('scripts/webgl-battlefield.js');
 assert.match(src,/const canBuild=game\.units\.some\(u=>u\.owner===0&&u\.kind==='engineer'/);
 assert.match(src,/buildings:context\.canBuild/);
 assert.match(src,/Preserve the player's tab until it is genuinely unavailable/);
 assert.match(src,/buildings:this\.catalogContext\(\)\.canBuild/);
 // The compact 600-unit strip has a matching rotated construction footprint.
 const game=new Simulation(2074,4);
 game.aiClock=1e8;game.credits[0]=10000;game.explored[0].fill(1);
 const air={id:31110,kind:'airfield',owner:0,x:2000,y:2000,hp:1200,
  radius:116,buildRemaining:0,territory:0,queue:[],queueTypes:[],production:0,cooldown:0,rally:null};
 game.bases.push(air);
 let spot=null;
 for(let x=900;x<3500&&!spot;x+=220)
  for(let y=900;y<3500&&!spot;y+=220)
   if(game.buildError(0,'generator',{x,y})===null)spot={x,y};
 assert.ok(spot,'a generator remains buildable after constructing an airfield');
});
