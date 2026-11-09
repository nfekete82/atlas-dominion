import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {
 UPGRADES,UPGRADE_KINDS,newResearchState,canResearchUpgrade,researchModifiers,
 validResearchState,strategicBlastDamage,SILO_CHARGE_SECONDS,
 STRATEGIC_WARNING_SECONDS,STRATEGIC_BLAST_RADIUS,INTERCEPTOR_MAX_AMMO,
 INTERCEPTOR_REARM_COST
} from '../dist/src/reborn/strategic-tech.js';

const safeStep=g=>{g.tactical.plan=()=>{};g.step(.05);};
function facility(g,owner,kind,overrides={}){
 const spec=BUILDINGS[kind],hq=g.bases.find(v=>v.owner===owner&&v.kind==='headquarters');
 const b={
  id:3000+g.bases.length,owner,kind,hp:spec.hp,
  x:(hq?.x??800)+200,y:(hq?.y??800)+190,territory:hq?.territory??0,
  radius:spec.radius,queue:[],queueTypes:[],production:0,
  buildRemaining:0,cooldown:0,rally:null,
  ...(kind==='silo'?{siloCharge:SILO_CHARGE_SECONDS}:{}),
  ...(kind==='interceptor'?{interceptorAmmo:INTERCEPTOR_MAX_AMMO}:{}),
  ...overrides
 };
 g.bases.push(b);return b;
}
function match(){
 const g=new Simulation(2074,0,false,false);
 g.tactical.plan=()=>{};
 g.credits[0]=50_000;g.credits[1]=50_000;
 return g;
}
function finish(g,owner,key){
 assert.equal(g.startResearch(owner,key),true,key+' should start');
 const state=g.research[owner];
 state.remaining=.05;
 safeStep(g);
 assert.equal(state.completed.includes(key),true,key+' should finish');
 assert.equal(state.active,null);
 assert.equal(state.remaining,0);
}

test('nine intentional upgrades, correct cost/time/exclusivity/prerequisites',()=>{
 assert.equal(UPGRADE_KINDS.length,9);
 assert.equal(UPGRADES.armor1.cost,800);
 assert.equal(UPGRADES.armor2.cost,1500);
 assert.equal(UPGRADES.precision.cost,1200);
 assert.equal(UPGRADES.engines.cost,900);
 assert.equal(UPGRADES.infantryTraining.cost,700);
 assert.equal(UPGRADES.rocketDevelopment.cost,1800);
 assert.equal(UPGRADES.radar.cost,1000);
 for(const key of UPGRADE_KINDS){
  assert.ok(UPGRADES[key].seconds>=30&&UPGRADES[key].seconds<=90);
 }
 const s=newResearchState();
 assert.equal(canResearchUpgrade(s,'armor2'),false);
 assert.equal(canResearchUpgrade(s,'armor1'),true);
 s.active='armor1';s.remaining=40;
 assert.equal(canResearchUpgrade(s,'precision'),false,'only one project at once');
 s.active=null;s.remaining=0;s.completed.push('armor1','tankArmor');
 assert.equal(canResearchUpgrade(s,'armor2'),true);
 assert.equal(canResearchUpgrade(s,'tankMobility'),false,'no both tank paths');
 assert.equal(validResearchState(s),true);
 assert.equal(validResearchState({...s,completed:['tankArmor','tankMobility']}),false);
 assert.equal(validResearchState({...s,active:'bad'}),false);
});

test('research is real economy: paid, requires completed lab, limits queues',()=>{
 const g=match();
 assert.equal(g.startResearch(0,'armor1'),false,'no laboratory');
 const lab=facility(g,0,'research',{buildRemaining:10});
 assert.equal(g.startResearch(0,'armor1'),false,'unfinished lab');
 lab.buildRemaining=0;
 const before=g.credits[0];
 assert.equal(g.startResearch(0,'armor1'),true);
 assert.equal(g.credits[0],before-UPGRADES.armor1.cost);
 assert.equal(g.startResearch(0,'precision'),false,'concurrent research forbidden');
 assert.equal(g.startResearch(0,'armor1'),false,'cannot buy same in-progress research twice');
 g.research[0].remaining=.05;
 safeStep(g);
 assert.equal(g.research[0].active,null);
 assert.equal(g.research[0].completed.includes('armor1'),true);
 assert.equal(g.startResearch(0,'armor1'),false,'no repurchase after completion');
 lab.hp=0;
 assert.equal(g.startResearch(0,'precision'),false,'no living completed laboratory');
});

test('armor affects both existing and future vehicles; infantry and specialist paths are distinct',()=>{
 const g=match();facility(g,0,'research');
 const tank=g.spawn(0,{x:700,y:700},'tank');
 const rover=g.spawn(0,{x:745,y:700},'rover');
 const soldier=g.spawn(0,{x:760,y:745},'infantry');
 assert.equal(tank.hp,1000);assert.equal(rover.hp,295);
 tank.hp=600;
 finish(g,0,'armor1');
 assert.equal(g.maxUnitHp(tank),1100);
 assert.equal(tank.hp,700,'upgrade adds absolute capacity but does not heal old damage');
 assert.equal(rover.hp,295*1.1);
 assert.equal(g.spawn(0,{x:680,y:800},'tank').hp,1100);
 assert.equal(soldier.hp,UNITS.infantry.hp);
 finish(g,0,'armor2');
 assert.equal(g.maxUnitHp(tank),1200);
 finish(g,0,'tankArmor');
 assert.equal(g.maxUnitHp(tank),1350);
 assert.equal(researchModifiers(g.research[0],'tank').hp,1.35);
 assert.equal(researchModifiers(g.research[0],'rover').hp,1.2);
 assert.equal(g.startResearch(0,'tankMobility'),false,'mutually exclusive tank upgrade');
 finish(g,0,'infantryTraining');
 assert.equal(g.maxUnitHp(soldier),UNITS.infantry.hp*1.15);
 assert.equal(g.maxUnitHp(tank),1350);
});

test('precision, motors, optics and rockets modify actual Simulation stat reads',()=>{
 const g=match();facility(g,0,'research');
 const tank=g.spawn(0,{x:700,y:700},'tank');
 const rocket=g.spawn(0,{x:800,y:700},'artillery');
 const enemy=g.units.find(u=>u.owner===1&&u.hp>0);
 assert.ok(enemy);
 const first=enemy.hp;
 g.strike(tank,enemy,10);
 assert.equal(enemy.hp,first-10);
 finish(g,0,'precision');
 const next=enemy.hp;
 g.strike(tank,enemy,10);
 assert.ok(Math.abs((next-enemy.hp)-11.5)<1e-7);
 finish(g,0,'engines');
 assert.ok(Math.abs(g.speed(tank)-UNITS.tank.speed*1.12)<1e-7);
 finish(g,0,'radar');
 assert.ok(Math.abs(g.sight(tank)-UNITS.tank.sight*1.20)<1e-7);
 finish(g,0,'rocketDevelopment');
 assert.ok(Math.abs(g.range(tank)-UNITS.tank.range*1.20)<1e-7);
 assert.ok(Math.abs(g.range(rocket)-UNITS.artillery.range*1.20)<1e-7);
 assert.equal(g.range(g.units.find(u=>u.owner===0&&u.kind==='infantry')),
  UNITS.infantry.range);
});

test('a full superweapon costs 5000, charges ten minutes, and provides a real 25s warning',()=>{
 const g=match();
 assert.equal(BUILDINGS.silo.cost,5000);
 assert.equal(SILO_CHARGE_SECONDS,600);
 assert.equal(STRATEGIC_WARNING_SECONDS,25);
 assert.equal(STRATEGIC_BLAST_RADIUS,350);
 const silo=facility(g,0,'silo',{siloCharge:0});
 g.explored[0].fill(1);
 const p={x:1000,y:1000};
 const old=g.nextId;
 assert.equal(g.launchStrategicMissile(0,p),true);
 assert.equal(g.strategicMissiles.length,1);
 assert.equal(g.strategicMissiles[0].id,old);
 assert.equal(g.strategicMissiles[0].impactAt,g.time+25);
 assert.equal(silo.siloCharge,600);
 assert.equal(g.launchStrategicMissile(0,p),false,'cannot spam launched missile');
 const save=g.save();
 assert.equal(save.strategicMissiles.length,1);
 assert.equal(Simulation.load(save).strategicMissiles.length,1);
});

test('60% building HP at epicenter and smooth damage falloff; only enemy damaged',()=>{
 assert.equal(strategicBlastDamage(0,1000,true),600);
 assert.equal(strategicBlastDamage(0,1000,false),1280);
 assert.equal(strategicBlastDamage(350,1000,true),0);
 assert.equal(strategicBlastDamage(351,1000,true),0);
 assert.ok(strategicBlastDamage(175,1000,true)<300);
 const g=match(),silo=facility(g,0,'silo',{siloCharge:0});
 const enemy=facility(g,1,'research',{x:1200,y:1200});
 const friendly=facility(g,0,'research',{x:1200,y:1200});
 g.explored[0].fill(1);
 assert.equal(g.launchStrategicMissile(0,enemy),true);
 const m=g.strategicMissiles[0];
 m.impactAt=g.time+.05;
 const beforeEnemy=enemy.hp,beforeFriendly=friendly.hp;
 safeStep(g);
 assert.ok(enemy.hp<beforeEnemy&&enemy.hp>0,'one hit cannot destroy full lab');
 assert.equal(friendly.hp,beforeFriendly,'no friendly fire');
 assert.equal(g.strategicMissiles.length,0,'resolved missile discarded');
 assert.ok(g.strategicEvents.some(e=>e.kind==='impact'));
});

test('automatic missile defense consumes finite ammo, rearm costs credits',()=>{
 const g=match();
 const silo=facility(g,1,'silo',{siloCharge:0});
 const playerHq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const defense=facility(g,0,'interceptor',{
  x:playerHq.x+140,y:playerHq.y+70,interceptorAmmo:3
 });
 g.explored[1].fill(1);
 assert.equal(g.launchStrategicMissile(1,playerHq),true);
 const m=g.strategicMissiles[0];
 m.impactAt=g.time+.05;
 const before=playerHq.hp;
 safeStep(g);
 assert.equal(playerHq.hp,before);
 assert.equal(defense.interceptorAmmo,2);
 assert.ok(g.strategicEvents.some(e=>e.kind==='intercept'));
 const credits=g.credits[0];
 assert.equal(g.rearmInterceptor(defense.id),true);
 assert.equal(defense.interceptorAmmo,3);
 assert.equal(g.credits[0],credits-INTERCEPTOR_REARM_COST);
 assert.equal(g.rearmInterceptor(defense.id),false,'full magazine');
});

test('saved research in-progress and missile charge restore; legacy saves remain compatible',()=>{
 const g=match();
 const lab=facility(g,0,'research'),silo=facility(g,0,'silo',{siloCharge:130});
 finish(g,0,'armor1');
 assert.equal(g.startResearch(0,'precision'),true);
 g.research[0].remaining=27.5;
 const saved=g.save();
 const restored=Simulation.load(saved);
 assert.deepEqual(restored.research[0],g.research[0]);
 assert.equal(restored.bases.find(b=>b.id===silo.id).siloCharge,130);
 assert.equal(restored.research[1].completed.length,0);
 assert.equal(restored.startResearch(0,'engines'),false,'in-progress project restored');
 const legacy=structuredClone(saved);
 delete legacy.research;delete legacy.strategicMissiles;
 const old=Simulation.load(legacy);
 assert.deepEqual(old.research[0],newResearchState());
 assert.equal(old.strategicMissiles.length,0);
});

test('new strategy HUD, original 3D buildings and missile visuals all ship in WebGL build',()=>{
 const field=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const icons=readFileSync('scripts/webgl-portraits.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const model=readFileSync('scripts/webgl-strategic-buildings.js','utf8');
 const animation=readFileSync('scripts/webgl-strategic-effects.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(field,/this\.game\.startResearch\(0,upgrade\)/);
 assert.match(field,/this\.game\.launchStrategicMissile\(0,p\)/);
 assert.match(field,/this\.game\.rearmInterceptor\(this\.selectedBase\)/);
 assert.match(field,/canResearchUpgrade\(techState,kind\)/);
 assert.match(field,/createStrategicBuilding\(kind,owner\)/);
 assert.match(hud,/data-tab="research"/);
 assert.match(hud,/data-action="missile-target"/);
 assert.match(hud,/data-action="interceptor-rearm"/);
 assert.match(icons,/strategicBuildingIcon/);
 assert.match(model,/root\.name='Strategic_'\+kind/);
 assert.match(animation,/Strategic_Missile_/);
 assert.match(animation,/Strategic_Scorched_Ground/);
 assert.match(animation,/this\.sound\?\.announceStrategicLaunch/);
 assert.match(preview,/new SandforgeStrategicEffects/);
 for(const name of ['webgl-strategic-buildings','webgl-strategic-effects']){
  assert.ok(build.includes("scripts/"+name+".js"));
  assert.ok(existsSync('dist/'+name+'.js'));
 }
});
