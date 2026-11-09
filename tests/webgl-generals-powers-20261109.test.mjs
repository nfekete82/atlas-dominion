import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {
 GENERAL_ABILITIES,GENERAL_ABILITY_KINDS,GENERAL_XP_PER_POINT,
 MAX_COMMAND_POINTS,newGeneralState,validGeneralState,
 canUseGeneralPower,spendGeneralPower,earnGeneralExperience,
 generalArtilleryOffsets,validGeneralBeacon
} from '../dist/src/reborn/general-powers.js';

const game=()=>{
 const g=new Simulation(3074,0,false,false);
 g.tactical.plan=()=>{};
 g.credits=[20_000,20_000];
 return g;
};

test('original commander powers cost points, enforce cooldowns, never create free resources',()=>{
 assert.deepEqual(GENERAL_ABILITY_KINDS,['recon','repair','artillery']);
 assert.equal(GENERAL_ABILITIES.recon.cost,1);
 assert.equal(GENERAL_ABILITIES.repair.cost,2);
 assert.equal(GENERAL_ABILITIES.artillery.cost,3);
 const s=newGeneralState();
 assert.equal(s.points,0);
 assert.equal(canUseGeneralPower(s,'recon',0),false);
 s.points=6;
 assert.equal(canUseGeneralPower(s,'artillery',0),true);
 assert.equal(spendGeneralPower(s,'artillery',0),true);
 assert.equal(s.points,3);
 assert.equal(s.cooldowns.artillery,GENERAL_ABILITIES.artillery.cooldown);
 assert.equal(canUseGeneralPower(s,'artillery',0),false);
 assert.equal(canUseGeneralPower(s,'artillery',174.99),false);
 assert.equal(canUseGeneralPower(s,'artillery',175),true);
 assert.equal(validGeneralState(s,0),true);
 assert.equal(validGeneralState({...s,points:7},0),false);
 assert.equal(validGeneralState({...s,xp:999},0),false);
});

test('only actual combat XP earns points; cap prevents snowballing',()=>{
 const s=newGeneralState();
 assert.equal(earnGeneralExperience(s,1080),0);
 assert.equal(earnGeneralExperience(s,20),1);
 assert.equal(s.points,1);
 assert.equal(s.earned,1);
 assert.ok(s.xp<GENERAL_XP_PER_POINT);
 assert.equal(earnGeneralExperience(s,NaN),0);
 assert.equal(earnGeneralExperience(s,-90),0);
 assert.equal(earnGeneralExperience(s,25_000),5,'maximum six banked points');
 assert.equal(s.points,MAX_COMMAND_POINTS);
 assert.equal(earnGeneralExperience(s,100000),0,'full meter cannot overflow');
});

test('scout drone reveals a real local region for 30s, even if previously unexplored',()=>{
 const g=game();
 g.generals[0].points=6;
 const p={x:g.world.size*.74,y:g.world.size*.76};
 assert.equal(g.useGeneralPower(0,'recon',p),true);
 assert.equal(g.generals[0].points,5);
 assert.equal(g.generalBeacons.length,1);
 assert.equal(g.generalBeacons[0].until,30);
 assert.equal(g.canSee(0,p),true);
 assert.equal(validGeneralBeacon(g.generalBeacons[0],g.world.size,g.time),true);
 assert.equal(g.useGeneralPower(0,'recon',p),false,'scouting cooldown');
 g.generalBeacons[0].until=g.time+.05;
 g.step(.05);
 g.updateVision();
 assert.equal(g.generalBeacons.length,0);
 assert.ok(g.generalEvents.every(e=>g.time-e.at<2));
});

test('repair drop respects ownership, damage and upgraded max HP',()=>{
 const g=game(),p={x:g.world.size*.32,y:g.world.size*.3};
 const tank=g.spawn(0,p,'tank');
 const enemy=g.spawn(1,{x:p.x+80,y:p.y},'tank');
 tank.hp=400;enemy.hp=400;
 g.explored[0].fill(1);
 g.generals[0].points=6;
 assert.equal(g.useGeneralPower(0,'repair',p),true);
 assert.equal(tank.hp,650);
 assert.equal(enemy.hp,400,'repair only allies');
 assert.equal(g.generals[0].points,4);
 assert.equal(g.useGeneralPower(0,'repair',p),false,'cooldown');
 const state=g.generals[0];
 assert.equal(state.cooldowns.repair,GENERAL_ABILITIES.repair.cooldown);
});

test('artillery strike is a six-shell delayed deterministic barrage with limited damage',()=>{
 const g=game();
 g.generals[0].points=6;
 g.explored[0].fill(1);
 const p={x:g.world.size*.50,y:g.world.size*.51};
 const before=g.missiles.length;
 assert.equal(g.useGeneralPower(0,'artillery',p),true);
 assert.equal(g.missiles.length-before,6);
 assert.equal(g.generals[0].points,3);
 for(const m of g.missiles){
  assert.equal(m.owner,0);
  assert.equal(m.type,'bomb');
  assert.equal(m.source,-1);
  assert.equal(m.damage,160);
  assert.ok(m.impactAt>=g.time+1&&m.impactAt<=g.time+4.5);
  assert.ok(m.to.x>=0&&m.to.x<=g.world.size);
  assert.ok(m.to.y>=0&&m.to.y<=g.world.size);
 }
 const cloned=g.save();
 assert.equal(Simulation.load(cloned).missiles.length,6,
  'all 6 artillery rounds survive a saved match');
 assert.deepEqual(generalArtilleryOffsets(3074,88),generalArtilleryOffsets(3074,88));
 assert.notDeepEqual(generalArtilleryOffsets(3074,88),generalArtilleryOffsets(3074,89));
});

test('real damage and kills award commander experience, never enemy from own attacks',()=>{
 const g=game();
 const blue=g.spawn(0,{x:600,y:600},'tank');
 const red=g.spawn(1,{x:650,y:650},'tank');
 const playerBefore=g.generals[0].xp,enemyBefore=g.generals[1].xp;
 g.strike(blue,red,600);
 assert.ok(g.generals[0].xp>playerBefore||g.generals[0].points>0);
 assert.equal(g.generals[1].xp,enemyBefore);
 assert.equal(g.generals[1].points,0);
});

test('power states, cooldowns and active drone survive saves, classic version 2 loads cleanly',()=>{
 const g=game();
 g.generals[0].points=6;
 const p={x:g.world.size*.58,y:g.world.size*.62};
 assert.equal(g.useGeneralPower(0,'recon',p),true);
 const saved=g.save();
 const restored=Simulation.load(saved);
 assert.deepEqual(restored.generals,g.generals);
 assert.deepEqual(restored.generalBeacons,g.generalBeacons);
 assert.equal(restored.useGeneralPower(0,'recon',p),false,'cooldown still holds');
 const old=structuredClone(saved);
 delete old.generals;delete old.generalBeacons;
 const legacy=Simulation.load(old);
 assert.deepEqual(legacy.generals[0],newGeneralState());
 assert.equal(legacy.generalBeacons.length,0);
});

test('global power catalogue and distinct terrain VFX ship with actual WebGL game',()=>{
 const field=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const effects=readFileSync('scripts/webgl-generals-effects.js','utf8');
 const sim=readFileSync('src/reborn/simulation.ts','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(field,/this\.game\.useGeneralPower\(0,ability,p\)/);
 assert.match(field,/canUseGeneralPower\(general,kind,g\.time\)/);
 assert.match(hud,/data-tab="powers"/);
 assert.match(hud,/id="sf-general-points"/);
 assert.match(sim,/this\.generalBeacons\.filter\(b=>b\.owner===owner/);
 assert.match(sim,/earnGeneralExperience\(this\.generals\[hostile\.owner\]/);
 assert.match(preview,/new SandforgeGeneralPowerEffects/);
 assert.match(effects,/General_Recon_Drone_/);
 assert.match(effects,/GeneralPower_/);
 assert.match(build,/cpSync\('scripts\/webgl-generals-effects\.js','dist\/webgl-generals-effects\.js'\)/);
 assert.ok(existsSync('dist/webgl-generals-effects.js'));
});
