import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNITS,weaponDamage,canAttack} from '../dist/src/reborn/catalog.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {createRocketInfantry} from '../scripts/webgl-rocket-infantry.js';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';

test('barracks rocket soldier has specialist anti-vehicle/air role and clear MG counter',()=>{
 const spec=UNITS.rocket;
 assert.equal(spec.group,'Infanterie');
 assert.ok(spec.producers.includes('barracks'));
 assert.equal(spec.targetsAir,true);
 assert.ok(spec.hp<=100,'MG should defeat a rocket soldier quickly');
 const targetTank={kind:'tank'},targetFlyer={kind:'scout'};
 assert.equal(canAttack({kind:'rocket'},targetFlyer),true);
 assert.equal(weaponDamage({kind:'rocket'},targetTank),145);
 assert.equal(weaponDamage({kind:'rocket'},targetFlyer),174);
 assert.ok(weaponDamage({kind:'rocket'},{kind:'infantry'})<=25);
 assert.ok(weaponDamage({kind:'rocket'},{kind:'infantry'})<
  weaponDamage({kind:'rocket'},targetTank)*.13);
 assert.ok(spec.cooldown>=4,'launch weapon requires an actual reload');
 assert.ok(spec.range<=365,'single shoulder rockets must not dominate the battlefield');
 assert.ok(spec.cost>=375,'a squad of rockets must require meaningful investment');
});

test('the 3D shoulder soldier has PBR camouflage, a physical launcher and batched geometry',()=>{
 for(const owner of [0,1]){
  const model=createRocketInfantry(owner);
  assert.equal(model.name,'RocketInfantry');
  assert.ok(model.getObjectByName('RocketMuzzle_0'));
  assert.ok(model.getObjectByName('RocketInfantryBatch_RocketInfantry_uniform'));
  let meshes=0;
  model.traverse(o=>{if(o.isMesh)meshes++;});
  assert.ok(meshes<=10,'shared PBR patches must not cause excessive draw calls');
  const vest=model.getObjectByName('RocketInfantryBatch_RocketInfantry_vest');
  assert.ok(vest?.material?.isMeshStandardMaterial);
 }
 const files=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(files,/kind==='rocket'\)return createRocketInfantry\(owner\)/);
 assert.match(files,/entry\.kind==='rocket'/,'authored-GLB loading uses the current actor entry when attaching the physical launcher');
});

test('shoulder rocket launches a real guided missile that follows a moving air target',()=>{
 const g=new Simulation(2074,11);g.units=[];g.tactical.plan=()=>{};
 const x=g.world.size*.32,y=g.world.size*.39;
 const soldier=g.spawn(0,{x,y},'rocket');
 const aircraft=g.spawn(1,{x:x+190,y:y+30},'scout');
 assert.ok(soldier&&aircraft);
 g.launch(soldier,aircraft);
 const shot=g.missiles.find(m=>m.source===soldier.id);
 assert.ok(shot);
 assert.equal(shot.type,'antiArmor');
 assert.equal(shot.target,aircraft.id);
 assert.equal(shot.damage,174);
 aircraft.x+=37;aircraft.y+=24;
 g.step(.05);
 const live=g.missiles.find(m=>m.id===shot.id);
 assert.ok(live);
 assert.equal(live.to.x,aircraft.x);
 assert.equal(live.to.y,aircraft.y);
 assert.equal(g.save().missiles.find(m=>m.id===shot.id)?.target,aircraft.id,
  'projectile tracking survives save/load format');
});

test('redesigned lab and silo maintain a recognisable radar and layered missile silhouette',()=>{
 for(const kind of ['research','silo']){
  const model=createStrategicBuilding(kind,0);
  assert.ok(model);
  assert.ok(model.children.some(c=>c.name.startsWith('SF_StaticBatch_'+kind+'_')));
  if(kind==='research')assert.ok(model.getObjectByName('Research_Radar'));
  if(kind==='silo'){
   assert.ok(model.getObjectByName('Silo_RocketBody'));
   assert.ok(model.getObjectByName('Silo_RocketNose'));
   assert.ok(model.getObjectByName('Silo_RocketStageSeam'));
  }
 }
});


test('older saved matches load without an explicit rocket deployment counter',()=>{
 const original=new Simulation(2074,11);
 const prior=original.save();
 for(const faction of prior.stats.factions)delete faction.deployedUnits.rocket;
 const loaded=Simulation.load(prior);
 assert.equal(loaded.stats.factions[0].deployedUnits.rocket,0);
 assert.equal(loaded.stats.factions[1].deployedUnits.rocket,0);
 assert.equal(loaded.save().stats.factions[0].deployedUnits.rocket,0);
});

test('rocket specialist receives infantry training and rocket range research',async()=>{
 const {researchModifiers}=await import('../dist/src/reborn/strategic-tech.js');
 const research={completed:['rocketDevelopment','infantryTraining'],active:null,remaining:0};
 const modifiers=researchModifiers(research,'rocket');
 assert.equal(modifiers.hp,1.15);
 assert.equal(modifiers.range,1.2);
});


test('rocket specialist reuses animated Atlas infantry and the real launcher in its catalog portrait',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const weapon=readFileSync('scripts/webgl-rocket-infantry.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 const infantryMeta=JSON.parse(readFileSync('src/assets/reborn/prototype/infantry-0.json','utf8'));
 assert.ok(infantryMeta.clips.walk.frames.length===8);
 assert.ok(infantryMeta.clips.walk.duration>0);
 assert.match(battlefield,/kind==='rocket'\)return prefix\+'prototype\/infantry-'\+owner\+'\.glb'/);
 assert.match(battlefield,/attachRocketLauncherToInfantry\(model,entry\.owner\)/);
 assert.match(battlefield,/entity\.kind!=='medic'&&entity\.kind!=='rocket'/,
  'rocket infantry must animate even with lite-mode enabled');
 assert.doesNotMatch(battlefield,/\(type==='unit'&&entity\.kind==='rocket'\)\|\|entry\.requested/,
  'old forced-static rocket exception must not return');
 assert.match(weapon,/export function attachRocketLauncherToInfantry\(model,owner=0\)/);
 assert.match(weapon,/getObjectByName\('Atlas_Rifle'\)/);
 assert.match(weapon,/muzzle\.name='RocketMuzzle_0'/);
 assert.match(portraits,/cloneSkeleton\(data\.scene\)/);
 assert.match(portraits,/attachRocketLauncherToInfantry\(model,0\)/);
 assert.match(portraits,/renderModelPortrait\(model,renderer,\{width:192,height:132,infantryCard:true\}\)/);
 assert.match(portraits,/if\(infantryCard\)model\.rotation\.y\+=Math\.PI\/4/);
 assert.match(portraits,/infantryCard\?105\/h/);
 assert.match(portraits,/getObjectByName\('Atlas_Breastplate'\)/);
 assert.match(portraits,/infantryCard\?119-dh/);
});

test('rocket soldier cannot one-volley tanks and has sharply reduced splash against nearby armor',()=>{
 const g=new Simulation(2074,11);g.units=[];g.tactical.plan=()=>{};g.aiClock=1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 const x=1500,y=1550;
 const soldier=g.spawn(0,{x,y},'rocket');
 const primary=g.spawn(1,{x:x+160,y},'tank');
 const adjacent=g.spawn(1,{x:x+178,y},'tank');
 const outside=g.spawn(1,{x:x+201,y},'tank');
 for(const u of [soldier,primary,adjacent,outside]){u.cooldown=1e6;u.hold=true;}
 const hp0=primary.hp,hp1=adjacent.hp,hp2=outside.hp;
 g.launch(soldier,primary);
 for(let i=0;i<12;i++)g.step(.05);
 const direct=hp0-primary.hp,secondary=hp1-adjacent.hp;
 assert.ok(direct>=130&&direct<=175,'tracked tank must take substantial direct damage');
 assert.ok(secondary>0&&secondary<direct*.35,'adjacent tank must take only minor splash');
 assert.equal(outside.hp,hp2,'armor outside small rocket blast is unharmed');
 assert.equal(g.missiles.length,0,'rocket resolves exactly once');
});
test('rocket damage per credit and time to defeat armor allow counterplay',()=>{
 const rocket=UNITS.rocket,tank=UNITS.tank,humvee=UNITS.rover,helicopter=UNITS.scout;
 assert.ok(Math.ceil(tank.hp/weaponDamage({kind:'rocket'},{kind:'tank'}))>=7);
 assert.ok(Math.ceil(humvee.hp/weaponDamage({kind:'rocket'},{kind:'rover'}))>=3);
 assert.ok(Math.ceil(helicopter.hp/weaponDamage({kind:'rocket'},{kind:'scout'}))>=3);
 assert.ok(rocket.cooldown>tank.cooldown);
 assert.ok(rocket.range>tank.range,'still outranges tank main gun');
 assert.ok(rocket.hp<humvee.hp/3,'light infantry stays vulnerable to vehicle MG');
});
