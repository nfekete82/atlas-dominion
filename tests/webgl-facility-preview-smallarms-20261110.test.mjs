import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNITS,TANK_MG,weaponDamage,combatDpsAgainst} from '../dist/src/reborn/catalog.js';
import {createAirfieldServiceYard,disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';
import {createFactoryServiceYard,updateFactoryServiceYard,disposeFactoryServiceYard} from '../scripts/webgl-factory-service.js';
import {serviceFootprintContains} from '../scripts/webgl-maintenance-input.js';
import {airfieldPoint} from '../dist/src/reborn/airfield-maintenance.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import * as THREE from 'three';
import {servicePaint,previewServiceMaterial,disposeServicePaint} from '../scripts/webgl-service-materials.js';

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

test('placement ghost displays actual finished building at 50% with visible door and facing marker',()=>{
 const battlefield=source('scripts/webgl-battlefield.js');
 const begin=battlefield.slice(battlefield.indexOf(' beginPlacement(kind){'),
  battlefield.indexOf(' clearPlacement(){'));
 assert.ok(begin.includes("this.getModel(this.asset(kind,0,'building'))"));
 assert.ok(begin.includes('createBuildingYard(kind,spec.width)'));
 assert.ok(begin.includes('createAirfieldServiceYard()'));
 assert.ok(begin.includes('createFactoryServiceYard()'));
 assert.ok(begin.includes("hideOldAirfieldHangar({detail:model})"),
  'legacy overlapping airfield structures are still hidden');
 assert.ok(begin.includes('const tint=(root,ownSource=false,opacity=.50)'),'the actual building ghost uses 50% transparency');
 assert.ok(begin.includes('previewServiceMaterial(mat,{opacity})'));
 const materialHelper=source('scripts/webgl-service-materials.js');
 assert.ok(materialHelper.includes('clone.opacity=Math.min(source.opacity??1,opacity)'));
 assert.ok(materialHelper.includes('clone.depthWrite=false;clone.depthTest=true'));
 assert.ok(begin.includes('placeholder.visible=true'),
  'temporary model is a 50%-opaque ghost until the GLB resolves');
 assert.ok(begin.includes('model.visible=true'),
  'finished GLB shape is visible as ghost, including door and hangar openings');
 assert.ok(!begin.includes('model.visible=false'),
  'the complete building cannot remain hidden after asynchronous load');
 assert.ok(begin.includes('tint(yard,false,.34)'));
 assert.ok(begin.includes('tint(service,true,.38)'));
 assert.ok(!begin.includes('mesh.position.y>5||mesh.geometry?.parameters?.height>7'),
  'the hangar service model is now shown instead of hiding every visible wall');
 assert.ok(begin.includes('BuildingFrontArrow'));
 assert.ok(begin.includes("kind==='barracks'?spec.width*.12:0"),
  'front arrow aligns with offset barracks entrance');
 assert.ok(begin.includes('guides.visible=false'),
  'the old tall scaffold must not obscure the entrance');
 assert.ok(begin.includes('group.userData.previewFrontMarker=frontMarker'));
 assert.ok(battlefield.includes("disposeOwnedMeshes(preview.userData.previewFrontMarker)"));
 assert.ok(battlefield.includes('sandforgePreviewInvalidColor'));
 assert.ok(battlefield.includes('sandforgePreviewValidColor'));
 assert.ok(battlefield.includes("frontArrow.material.color.set(valid?'#9ef5d9':'#ff9a87')"));
 assert.ok(battlefield.includes('conformAirfieldSurface(ghost.userData.previewService'));
 assert.ok(battlefield.includes('conformAirfieldSurface(entry.airfieldServiceYard'));
 assert.ok(battlefield.includes("if(b.kind==='airfield'){"),
  'finished construction still uses the genuine airfield 3D geometry');
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
 assert.match(src,/buildings:true,territories:true/);
 assert.match(src,/Preserve the player's tab until it is genuinely unavailable/);
 assert.ok(src.includes('const available={buildings:true,units:Boolean(this.catalogContext().producer)'));
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


test('fuel drums, loading ramps and desert service paving use modeled geometry and real albedo',()=>{
 const airport=createAirfieldServiceYard();
 const expected=[
  ['AirfieldFuelServiceTank','CylinderGeometry'],
  ['AirfieldFuelTankSteelBand','CylinderGeometry'],
  ['AirfieldFuelValve','CylinderGeometry'],
  ['AirfieldFuelServiceContainer','BoxGeometry'],
  ['AirfieldFuelServicePad','BoxGeometry'],
  ['AirfieldParkingRampGrip_0','BoxGeometry'],
  ['AirfieldParkingRampTread_0','BoxGeometry'],
  ['AirfieldParkingRampGrip_1','BoxGeometry'],
  ['AirfieldAircraftParkingPad_0','BoxGeometry']
 ];
 for(const [name,type] of expected){
  const mesh=airport.getObjectByName(name);
  assert.ok(mesh,'missing textured fuel/apron detail: '+name);
  assert.equal(mesh.geometry.type,type,name+' needs actual modeled geometry');
  assert.ok(mesh.material.map?.isDataTexture,name+' still has placeholder solid paint');
  assert.ok(mesh.material.userData.sandforgeServiceTexture,
   name+' texture must be tracked for GPU cleanup');
 }
 assert.ok(airport.getObjectByName('AirfieldFuelTankEndCap'));
 assert.ok(airport.getObjectByName('AirfieldFuelPumpDisplay'));
 assert.ok(airport.getObjectByName('AirfieldFuelPipeManifold'));
 disposeAirfieldServiceYard({airfieldServiceYard:airport});
});

test('actual HUD factory selection cannot prevent later building card clicks',()=>{
 const src=source('scripts/webgl-battlefield.js');
 const start=src.indexOf(' buildInterface(){'),end=src.indexOf('\n saveGame(){',start);
 assert.ok(start>0&&end>start);
 const listeners=new Map(),actions={scrollTop:40},detail={textContent:''};
 const mini={addEventListener(){}};
 const panel={dataset:{tab:'units'},addEventListener:(name,fn)=>listeners.set(name,fn),
  querySelector(selector){
   if(selector==='#sf-map')return mini;
   if(selector==='#sf-actions')return actions;
   if(selector==='#sf-catalog-detail')return detail;
   throw Error('unexpected HUD selector '+selector);
  }};
 const BUILDINGS={barracks:{name:'Kaserne'},generator:{name:'Energiekern'}};
 const fakeCtor=new Function('installClassicHud','BUILDINGS','INTERCEPTOR_ENABLED',
  'return class TestHUD {'+src.slice(start,end)+'}');
 const Fake=fakeCtor(()=>panel,BUILDINGS,true);
 const ui=new Fake();
 const calls=[];
 ui.sound={enabled:false,select(){}};
 ui.selectedBase=100; // The user has selected the completed factory.
 ui.selected=new Set();
 ui.catalogContext=()=>({engineer:false,canBuild:true,producer:{id:100,kind:'factory'}});
 ui.selectEngineer=()=>{calls.push('engineer');ui.selectedBase=null;return {id:12}};
 ui.beginPlacement=kind=>{calls.push('placement:'+kind);ui.buildKind=kind};
 ui.drawInterface=()=>{calls.push('draw')};
 ui.message=message=>{calls.push('message:'+message)};
 ui.buildInterface();
 assert.ok(listeners.has('sandforge-tabchange'));
 assert.ok(listeners.has('click'));
 panel.dataset.tab='buildings';
 listeners.get('sandforge-tabchange')({detail:{tab:'buildings'}});
 assert.ok(calls.includes('draw'),'tab switch must repaint immediately');
 assert.equal(actions.scrollTop,0);
 const click=kind=>listeners.get('click')({
  target:{closest:()=>({dataset:{build:kind}})}
 });
 click('generator');
 assert.equal(ui.buildKind,'generator');
 assert.equal(panel.dataset.tab,'buildings');
 assert.equal(ui.selectedBase,null);
 assert.ok(calls.includes('engineer'));
 assert.ok(calls.includes('placement:generator'));
 // The second card must replace the first placement, even if a factory was
 // reselected in between. No change to the producer's unit queue.
 ui.selectedBase=100;click('barracks');
 assert.equal(ui.buildKind,'barracks');
 assert.equal(panel.dataset.tab,'buildings');
 assert.ok(calls.includes('placement:barracks'));
 assert.match(src,/const available=\{units:Boolean\(context\.producer\),buildings:true/);
 assert.ok(!src.includes(':!context.canBuild||g.credits[0]<spec.cost'),
  'missing pioneer must never disable every building tile');
});


test('ACTUAL REGRESSION: after factory/airfield preview, next building selection never crashes on map.dispose',()=>{
 for(const site of [createFactoryServiceYard(),createAirfieldServiceYard()]){
  const original=site.getObjectByName(site.name==='FactoryCompactSideRepairShop'
   ?'FactoryRepairGarageRoof_0':'AirfieldExtendedRunway');
  assert.ok(original?.material?.map?.isTexture,'real service material owns DataTexture');
  const ownedTexture=original.material.userData.sandforgeServiceTexture;
  assert.ok(ownedTexture?.isTexture);
  const preview=previewServiceMaterial(original.material,{opacity:.5});
  const view=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),preview);
  view.add(mesh);
  assert.ok(preview.map?.isTexture,'transparent building retains real image texture');
  assert.equal(preview.userData.sandforgeServiceTexture,undefined,
   'ghost materials must NOT inherit serialized DataTexture ownership metadata');
  assert.doesNotThrow(()=>disposeServicePaint(view),
   'the prior browser crash was map.dispose is not a function');
  // Reproduce old, already-cloned material metadata from an existing preview;
  // cleanup must ignore the object, rather than breaking ALL subsequent clicks.
  const obsolete=original.material.clone();
  const legacyPreview=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),obsolete);
  view.add(legacyPreview);
  assert.ok(obsolete.userData.sandforgeServiceTexture);
  assert.equal(typeof obsolete.userData.sandforgeServiceTexture.dispose,'undefined');
  assert.doesNotThrow(()=>disposeServicePaint(view));
  preview.dispose();mesh.geometry.dispose();
  obsolete.dispose();legacyPreview.geometry.dispose();
  if(site.name==='FactoryCompactSideRepairShop')
   disposeFactoryServiceYard({factoryServiceYard:site});
  else disposeAirfieldServiceYard({airfieldServiceYard:site});
 }
});
