import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {maintenanceClickAllowed,serviceFootprintContains} from '../scripts/webgl-maintenance-input.js';
import {releaseBastionRevision} from '../scripts/webgl-bastion-lifecycle.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('scripts/webgl-battlefield.js');
const build=read('scripts/build.mjs');

test('right-click on visible enemy OVER a friendly airfield prioritizes attacking, not landing',()=>{
 const p=source.indexOf(' pointerUp(event){');
 const q=source.indexOf('\n attachInput(){',p);
 assert.ok(p>0&&q>p,'actual pointerUp method found');
 const action=source.slice(p,q);
 assert.ok(action.indexOf('this.enemyAtPointer(event)')<
  action.indexOf('this.maintenanceFacilityAtPointer(event,serviceKind)'),
  'enemy must be picked before any service-yard hitbox check');
 const Fake=new Function('pointerGestureIntent','selectedInfantryForTransport',
  'selectedMaintenanceKind','maintenanceClickAllowed','UNITS','BUILDINGS',
  'return class FakePointer { '+action+' }')(
   ()=> 'click',()=>[],()=> 'airfield',maintenanceClickAllowed,
   {bomber:{name:'Bomber'}},{airfield:{name:'Flugfeld'}}
  );
 const unit={id:12,kind:'bomber',owner:0,hp:40,x:100,y:100,orders:[]};
 const enemy={id:99,kind:'tank',owner:1,hp:400,x:230,y:230};
 const site={id:500,kind:'airfield',owner:0,hp:1000,buildRemaining:0,x:235,y:245,facing:0};
 assert.equal(serviceFootprintContains(site,enemy),true,'enemy stands ON the service apron');
 const u=new Fake();
 u.game={units:[unit],bases:[site],maxUnitHp:()=>100,
  command(ids,order){orders.push({ids,order});return 1;},
  requestAirfieldRepair(ids,id){repairs.push({ids,id});return 1;}};
 u.selected=new Set([unit.id]);u.selectedBase=null;
 u.attackMode=false;u.rallyMode=false;u.strategicTargetMode=false;u.buildKind=null;
 u.selectionBox={style:{display:'block'}};
 u.sound={command(){},acknowledge(){}};
 u.message=()=>{};u.showCommandPulse=()=>{};u.drawInterface=()=>{};
 u.transportAtPointer=()=>null;u.maintenanceFacilityAtPointer=()=>site;
 u.enemyAtPointer=()=>enemy;u.terrainPoint=()=>({x:240,y:245});
 let orders=[],repairs=[];
 const rightClick=()=>{
  u.clickStart={x:100,y:100,button:2};
  u.pointerUp({button:2,clientX:100,clientY:100,shiftKey:false});
 };
 rightClick();
 assert.equal(orders.length,1);
 assert.equal(orders[0].order.kind,'attack');
 assert.equal(orders[0].order.target,enemy.id);
 assert.equal(repairs.length,0,'enemy must not be converted into hangar landing');
 // Empty part of the same runway still routes to repair as before.
 u.enemyAtPointer=()=>null;
 rightClick();
 assert.equal(repairs.length,1);
 assert.equal(repairs[0].id,site.id);
 assert.equal(orders.length,1);
});

test('maintenance routing never hides combat targets or removes explicit attack mode',()=>{
 for(const kind of ['airfield','factory']){
  assert.equal(maintenanceClickAllowed({enemy:{id:99},hasSelectedUnits:true}),false);
  assert.equal(maintenanceClickAllowed({attackMode:true,hasSelectedUnits:true}),false);
  assert.equal(maintenanceClickAllowed({strategicTargetMode:true,hasSelectedUnits:true}),false);
  assert.equal(maintenanceClickAllowed({rallyMode:true,hasSelectedUnits:true}),false);
  assert.equal(maintenanceClickAllowed({building:true,hasSelectedUnits:true}),false);
  assert.equal(maintenanceClickAllowed({hasSelectedBase:true,hasSelectedUnits:true}),false);
  assert.equal(maintenanceClickAllowed({hasSelectedUnits:true}),true);
 }
});

test('sector capture timer must not rebuild complete 3D unit/building portrait catalog',()=>{
 const start=source.indexOf('  const tiles=this.game.territories.map');
 const end=source.indexOf('  const upgrades=UPGRADE_KINDS.map',start);
 assert.ok(start>0&&end>start);
 const markup=source.slice(start,end);
 assert.ok(!markup.includes('t.progress'),'static markup cannot depend on changing capture progress');
 assert.ok(!markup.includes('t.owner'),'static markup cannot depend on changing sector owner');
 assert.match(source,/if\(this\.previousActionsMarkup!==markup\)/);
 const after=source.slice(source.indexOf('  if(this.previousActionsMarkup!==markup){'),
  source.indexOf('  const techState=g.research[0];'));
 assert.match(after,/for\(const tile of actions\.querySelectorAll\('\[data-territory\]'\)\)/);
 assert.match(after,/tile\.querySelector\('small'\)\.textContent=caption/);
 assert.ok(after.indexOf('actions.innerHTML=markup')<
  after.indexOf('for(const tile of actions.querySelectorAll'),
  'sector labels are patched after unchanged-markup check');
});

test('hundreds of late-match bastion recaptures release owned materials and fallback rotors',()=>{
 assert.match(source,/releaseBastionRevision\(entry\)/);
 assert.match(build,/webgl-bastion-lifecycle\.js/);
 const node=new THREE.Group();
 const sharedGeometry=new THREE.BoxGeometry();
 let sharedDisposed=0;sharedGeometry.addEventListener('dispose',()=>sharedDisposed++);
 const entry={node,detail:null,motion:null};
 let ownedDisposed=0,rotorDisposed=0;
 for(let i=0;i<900;i++){
  const glb=new THREE.Group(),material=new THREE.MeshStandardMaterial();
  material.userData.sandforgeBuildingFill=true;
  material.addEventListener('dispose',()=>ownedDisposed++);
  glb.add(new THREE.Mesh(sharedGeometry,material));
  node.add(glb);entry.detail=glb;
  if(i%2===0){
   const rotor=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
   rotor.geometry.addEventListener('dispose',()=>rotorDisposed++);
   node.add(rotor);entry.motion={rotor};
  }else entry.motion=null;
  const result=releaseBastionRevision(entry);
  assert.equal(result.materials,1,'each new owner creates exactly one owned material');
  assert.equal(node.children.length,0,'no discarded meshes survive in scene');
  assert.equal(entry.detail,null);
  assert.equal(entry.motion,null);
 }
 assert.equal(ownedDisposed,900);
 assert.equal(rotorDisposed,450);
 assert.equal(sharedDisposed,0,'global glTF geometry must NEVER be disposed by actor cleanup');
 sharedGeometry.dispose();
});

test('long-match performance diagnostic remains available for post-830s verification',()=>{
 const preview=read('scripts/webgl-preview.js');
 const watcher=read('scripts/webgl-perf-watch.js');
 assert.match(preview,/event\.shiftKey&&event\.code==='KeyP'/);
 assert.match(watcher,/maxPathCallMs/);
 assert.match(watcher,/sceneChildren:/);
 assert.match(watcher,/hitchCount:/);
 assert.match(watcher,/textures:/);
});
