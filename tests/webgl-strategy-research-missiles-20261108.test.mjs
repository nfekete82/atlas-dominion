import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {UPGRADES,UPGRADE_KINDS,canResearchUpgrade,researchModifiers,
  strategicBlastDamage,SILO_CHARGE_SECONDS,STRATEGIC_WARNING_SECONDS,
  INTERCEPTOR_MAX_AMMO,INTERCEPTOR_REARM_COST,newResearchState}
 from '../dist/src/reborn/strategic-tech.js';

function game(){
 const g=Simulation.campaign(2074,23,'dunes');
 g.credits=[50000,50000];
 g.tactical.plan=()=>{};
 g.planStrategicAi=()=>{};
 g.explored[0].fill(1);g.explored[1].fill(1);
 return g;
}
function base(g,kind,owner=0,p){
 const spec=BUILDINGS[kind],site=p??g.startRegions[owner].center;
 const b={id:7000+g.bases.length,owner,kind,x:site.x,y:site.y,
  hp:spec.hp,territory:0,radius:spec.radius,queue:[],queueTypes:[],
  production:0,buildRemaining:0,cooldown:0,rally:null,
  ...(kind==='silo'?{siloCharge:SILO_CHARGE_SECONDS}:{}),
  ...(kind==='interceptor'?{interceptorAmmo:INTERCEPTOR_MAX_AMMO}:{})
 };
 g.bases.push(b);
 return b;
}
function tick(g,seconds=.05){g.step(seconds);}

test('research requires a living completed lab, real credits and one active project',()=>{
 const g=game();
 assert.equal(g.startResearch(0,'armor1'),false);
 const lab=base(g,'research');
 lab.buildRemaining=10;
 assert.equal(g.startResearch(0,'armor1'),false);
 lab.buildRemaining=0;
 const money=g.credits[0];
 assert.equal(g.startResearch(0,'armor2'),false,'requires prior level');
 assert.equal(g.startResearch(0,'armor1'),true);
 assert.equal(g.credits[0],money-800);
 assert.equal(g.startResearch(0,'precision'),false,'one active project');
 assert.equal(g.research[0].active,'armor1');
 assert.equal(g.research[0].remaining,40);
 g.research[0].remaining=.05;
 tick(g);
 assert.deepEqual(g.research[0].completed,['armor1']);
 assert.equal(g.research[0].active,null);
 assert.equal(g.startResearch(0,'armor1'),false,'cannot buy an upgrade twice');
 assert.equal(g.startResearch(0,'armor2'),true);
});

test('existing vehicles gain max HP without erasing prior damage, new tanks also inherit upgrades',()=>{
 const g=game();
 const tank=g.spawn(0,g.startRegions[0].center,'tank');
 tank.hp=800;
 base(g,'research');
 g.research[0].completed=['armor1'];
 assert.equal(g.maxUnitHp(tank),1100);
 assert.equal(tank.hp,800,'upgrades are applied on completion, not instant edits');
 g.research[0].completed=[];
 assert.equal(g.startResearch(0,'armor1'),true);
 g.research[0].remaining=.05;
 tick(g);
 assert.equal(tank.hp,900);
 assert.equal(g.maxUnitHp(tank),1100);
 const second=g.spawn(0,g.startRegions[0].center,'tank');
 assert.equal(second.hp,1100);
 const saved=Simulation.load(g.save());
 const restored=saved.units.find(u=>u.id===tank.id);
 assert.equal(saved.maxUnitHp(restored),1100);
 assert.equal(restored.hp,900);
});

test('mutually exclusive tank tech paths and precise multiplication of existing bonuses',()=>{
 const state=newResearchState();
 state.completed=['armor1','armor2','precision','engines','radar','rocketDevelopment','tankArmor'];
 assert.equal(canResearchUpgrade(state,'tankMobility'),false);
 assert.ok(Math.abs(researchModifiers(state,'tank').hp-1.35)<1e-9);
 assert.equal(researchModifiers(state,'tank').damage,1.15);
 assert.equal(researchModifiers(state,'tank').range,1.2);
 assert.equal(researchModifiers(state,'tank').sight,1.2);
 assert.ok(Math.abs(researchModifiers(state,'tank').speed-1.12)<1e-9);
 assert.equal(researchModifiers(state,'infantry').hp,1);
 assert.equal(UPGRADE_KINDS.length,9);
 assert.equal(Object.values(UPGRADES).every(u=>u.seconds>=30&&u.seconds<=90),true);
});

test('silo needs a completed paid building, fires once, warns for 25s and recharges 600s',()=>{
 const g=game();
 const silo=base(g,'silo');
 const target=g.startRegions[1].center;
 assert.equal(g.launchStrategicMissile(0,target),false,'charging is authoritative');
 silo.siloCharge=0;
 const before=g.nextId;
 assert.equal(g.launchStrategicMissile(0,target),true);
 assert.equal(g.strategicMissiles.length,1);
 assert.equal(g.strategicMissiles[0].id,before);
 assert.equal(g.strategicMissiles[0].impactAt-g.time,STRATEGIC_WARNING_SECONDS);
 assert.equal(silo.siloCharge,SILO_CHARGE_SECONDS);
 assert.equal(g.launchStrategicMissile(0,target),false,'one launch each charge');
 const state=Simulation.load(g.save());
 assert.equal(state.strategicMissiles.length,1);
 assert.equal(state.bases.find(b=>b.id===silo.id).siloCharge,SILO_CHARGE_SECONDS);
 assert.ok(g.notices.some(n=>n.includes('Rakete gestartet')||n.includes('Langstreckenrakete gestartet')));
});

test('interceptor uses finite ammo, handles attack and is not magic infinite defense',()=>{
 const g=game();
 const from=base(g,'silo',1);
 const target=g.startRegions[0].center;
 const shield=base(g,'interceptor',0,target);
 from.siloCharge=0;
 assert.equal(g.launchStrategicMissile(1,target),true);
 const hp=g.units.find(u=>u.owner===0).hp;
 g.strategicMissiles[0].impactAt=g.time+.05;
 tick(g);
 assert.equal(shield.interceptorAmmo,INTERCEPTOR_MAX_AMMO-1);
 assert.equal(g.units.find(u=>u.owner===0).hp,hp,'interception prevents damage');
 assert.equal(g.strategicMissiles.length,0);
 assert.ok(g.strategicEvents.some(e=>e.kind==='intercept'));
 shield.interceptorAmmo=0;
 const cash=g.credits[0];
 assert.equal(g.rearmInterceptor(shield.id),true);
 assert.equal(shield.interceptorAmmo,INTERCEPTOR_MAX_AMMO);
 assert.equal(g.credits[0],cash-INTERCEPTOR_REARM_COST);
 assert.equal(g.rearmInterceptor(shield.id),false);
});

test('real impact is finite area damage and cannot wipe a whole base',()=>{
 assert.equal(strategicBlastDamage(0,1000,true),600);
 assert.equal(strategicBlastDamage(350,1000,true),0);
 assert.ok(strategicBlastDamage(175,1000,true)<300);
 assert.ok(strategicBlastDamage(0,1000,false)>=1000);
 assert.equal(strategicBlastDamage(500,1000,false),0);
 const g=game();
 const from=base(g,'silo',1);
 const target=g.startRegions[0].center;
 const shield=base(g,'research',0,target);
 from.siloCharge=0;
 assert.equal(g.launchStrategicMissile(1,target),true);
 g.strategicMissiles[0].impactAt=g.time+.05;
 const before=shield.hp;
 tick(g);
 assert.ok(shield.hp<before&&shield.hp>0);
 assert.ok(g.strategicEvents.some(e=>e.kind==='impact'));
});

test('old saves remain loadable and invalid research records rejected',()=>{
 const g=game();
 const old=g.save();
 delete old.research;delete old.strategicMissiles;
 const restored=Simulation.load(old);
 assert.deepEqual(restored.research.map(x=>x.completed),[[],[]]);
 assert.deepEqual(restored.strategicMissiles,[]);
 const corrupt=g.save();corrupt.research[0].completed=['tankArmor','tankMobility'];
 assert.throws(()=>Simulation.load(corrupt),/Forschungsstand|beschädigt/);
});

test('3D HUD, real missile renderer and AI integration are present',()=>{
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 const vfx=readFileSync('scripts/webgl-strategic-effects.js','utf8');
 const game=readFileSync('src/reborn/simulation.ts','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(ui,/data-upgrade=/);
 assert.match(ui,/action==='missile-target'/);
 assert.match(ui,/this\.game\.launchStrategicMissile\(0,p\)/);
 assert.match(ui,/action==='interceptor-rearm'/);
 assert.match(vfx,/strategicMissiles/);
 assert.match(vfx,/intercept/);
 assert.match(game,/private planStrategicAi\(\)/);
 assert.match(build,/webgl-strategic-effects/);
 const actor=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 assert.match(actor,/this\.game\.maxUnitHp\(entity\)/);
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(audio,/new SpeechSynthesisUtterance\('Feindlicher Raketenstart erkannt!'\)/);
});


test('new strategic buildings have deterministic service props and one rocket announcer',async()=>{
 const {buildingProps,DECOR_PROP_COUNTS}=await import('../dist/src/reborn/building-decor.js');
 for(const kind of ['research','silo','interceptor']){
  assert.ok(DECOR_PROP_COUNTS[kind]>=1,kind+' must have a complete decor layout');
  const props=buildingProps(kind,{x:500,y:500},BUILDINGS[kind].radius,51,2074);
  assert.equal(props.length,DECOR_PROP_COUNTS[kind]);
  assert.deepEqual(props,buildingProps(kind,{x:500,y:500},BUILDINGS[kind].radius,51,2074));
  assert.ok(props.every(prop=>prop.layer==='behind'),kind+' has a clear front entrance');
 }
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.equal(audio.split('announceStrategicLaunch():void').length-1,1,
  'TypeScript must have one rocket-warning implementation');
 assert.match(audio,/lastStrategicWarning<12/);
});
