import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {sitesVisuallyOverlap,siteNearBastion,siteExceedsMap} from '../dist/src/reborn/construction-spacing.js';
import {chooseConstructionCrew} from '../scripts/webgl-builder-input.js';
import {createAirfieldServiceYard,conformAirfieldSurface,hideOldAirfieldHangar,disposeAirfieldServiceYard} from '../scripts/webgl-airfield-service.js';

const point=(x,y)=>({x,y});

test('new and finished airfield footprints cannot overlap neighbors or bastions',()=>{
 const p=point(2000,2000);
 assert.ok(sitesVisuallyOverlap('airfield',p,0,'generator',point(2132,2355),0),
  'an object on the far runway must be rejected');
 assert.ok(sitesVisuallyOverlap('factory',p,0,'barracks',point(1850,2130),0),
  'roofed repair garages count as factory footprint');
 assert.ok(siteNearBastion('airfield',p,0,point(2132,2360)),
  'a control point cannot be hidden below the strip');
 assert.ok(siteNearBastion('airfield',p,2,point(2350,1868)),
  'rotating the runway changes its clearance');
 assert.equal(siteNearBastion('airfield',p,0,point(2800,2800)),false);
 assert.equal(sitesVisuallyOverlap('airfield',p,0,'factory',point(3100,3100),0),false);
 assert.ok(siteExceedsMap('airfield',point(200,200),0,3500));
 assert.equal(siteExceedsMap('airfield',point(1900,1800),2,3500),false);
});

test('authoritative building validation blocks factories and runways for both owners',()=>{
 const game=new Simulation(2074,19);
 game.world.blocked.fill(0);
 game.world.opaque.fill(0);
 game.explored[0].fill(1);game.explored[1].fill(1);
 game.credits[0]=100000;game.credits[1]=100000;
 const factory={id:391010,kind:'factory',owner:1,x:2000,y:2000,hp:1100,
  radius:70,buildRemaining:0,territory:0,queue:[],queueTypes:[],production:0,cooldown:0,rally:null};
 game.bases.push(factory);
 assert.match(game.buildError(0,'generator',point(2000,2200)),/Zu nah/,
  'the human may not build on the enemy roofed garage');
 assert.match(game.buildError(1,'generator',point(2000,2200)),/Zu nah/,
  'the AI must follow identical clearance');
});

test('two pioneers build in parallel instead of queuing behind a busy builder',()=>{
 const busy={id:2,kind:'engineer',orders:[{kind:'build',target:42}]};
 const idle={id:3,kind:'engineer',orders:[]};
 assert.deepEqual(chooseConstructionCrew([busy,idle]),{workers:[idle],append:false});
 assert.deepEqual(chooseConstructionCrew([busy,idle],true),
  {workers:[busy,idle],append:true});
 const alsoBusy={id:4,kind:'engineer',orders:[{kind:'build',target:43},{kind:'move',x:7,y:8}]};
 assert.deepEqual(chooseConstructionCrew([alsoBusy,busy]),
  {workers:[busy],append:true});
 const src=readFileSync(new URL('../scripts/webgl-battlefield.js',import.meta.url),'utf8');
 assert.match(src,/chooseConstructionCrew\(workers,event\.shiftKey\)/);
 assert.match(src,/this\.game\.buildError\(0,this\.buildKind,p,this\.placementFacing\)/);
});

test('long runway conforms over desert hills in preview and final and stays visible',()=>{
 const group=createAirfieldServiceYard(),runway=group.getObjectByName('AirfieldExtendedRunway');
 assert.ok(runway);
 const dunes=(x,z)=>25*Math.cos(x/280)+32*Math.sin(z/145)+5*Math.sin((x+z)/46);
 const origin={x:1500,y:1400,facing:0};
 const initialGeometry=runway.geometry;
 assert.ok(conformAirfieldSurface(group,origin,dunes)>40);
 assert.notStrictEqual(runway.geometry,initialGeometry);
 const attrib=runway.geometry.getAttribute('position'),y=[];
 for(let i=0;i<attrib.count;i++)y.push(attrib.getY(i));
 assert.ok(Math.max(...y)-Math.min(...y)>35,
  'runway vertex heights follow dunes instead of remaining a sunken rectangle');
 assert.equal(conformAirfieldSurface(group,origin,dunes),0,
  'unchanged placement tile should not resample the entire landing strip');
 assert.ok(conformAirfieldSurface(group,{...origin,facing:2},dunes)>0);
 disposeAirfieldServiceYard({airfieldServiceYard:group});
});

test('Atlas-prefixed old GLB tower and taxiway are hidden in both build modes',()=>{
 const model=new THREE.Group(),names=[
  'Atlas_ControlTowerMainShaft_120','Atlas_TowerPanoramicWindows_124',
  'Atlas_AirfieldRunway_22','Atlas_TaxiwayFromHangar_42',
  'Atlas_FuelStorageTank_156','Atlas_AntennaStem_182',
  'Atlas_HangarCurvedRoofPanel_98','Atlas_GroundPlinth_5',
  'Atlas_RoofReactor_22'
 ];
 const parts=names.map(name=>{
  const o=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());
  o.name=name;model.add(o);return o;
 });
 const entry={detail:model};hideOldAirfieldHangar(entry);
 for(const child of parts.slice(0,-1))assert.equal(child.visible,false,child.name);
 assert.equal(parts.at(-1).visible,true,'unrelated meshes remain visible');
 assert.equal(entry.airfieldOldHidden,true);
 for(const part of parts){part.geometry.dispose();part.material.dispose();}
});

test('building remains possible after a vehicle factory or airfield is completed',()=>{
 // Same constructor/map generation as the modern WebGL match. Previously an
 // outsize front garage or 980-unit runway invalidated virtually every site.
 for(const kind of ['factory','airfield']){
  const g=new Simulation(2074,19);
  g.world.blocked.fill(0);g.world.opaque.fill(0);
  g.world.buildable=()=>true;g.explored[0].fill(1);g.credits[0]=25000;
  const find=(type)=>{
   for(let x=800;x<g.world.size-550;x+=185)
    for(let y=800;y<g.world.size-550;y+=185){
     const p={x,y};
     if(g.buildError(0,type,p)===null)return p;
    }
   return null;
  };
  const first=find(kind);
  assert.ok(first,'must be able to place '+kind);
  g.bases.push({id:310012,kind,owner:0,...first,hp:1200,
   radius:kind==='airfield'?116:70,buildRemaining:0,territory:0,
   queue:[],queueTypes:[],production:0,cooldown:0,rally:null});
  const second=find('generator');
  assert.ok(second,'generator must remain buildable after '+kind);
  assert.equal(g.buildError(0,'generator',second),null);
 }
 const ui=readFileSync(new URL('../scripts/webgl-battlefield.js',import.meta.url),'utf8');
 assert.match(ui,/Preserve the player's tab until it is genuinely unavailable/);
 assert.match(ui,/this\.catalogSelectionKey=selectionKey/);
 assert.match(ui,/if\(!workers\.length\)/,'must recover an unselected pioneer');
});
