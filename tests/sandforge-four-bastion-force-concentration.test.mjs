import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {isCompactBattle,sectorDefenseAnchor,fourBastionPlanningDelay,neutralExpansionPreference,considerEarlyBorderFortification} from '../dist/src/reborn/four-bastion-front-doctrine.js';
import {RULES} from '../dist/src/reborn/config.js';

test('focus front policy is only opt-in for exactly four campaign bastions',()=>{
 assert.equal(isCompactBattle(11,4,'concentrated'),true);
 assert.equal(isCompactBattle(11,4,'sector-defense'),true);
 assert.equal(isCompactBattle(11,4,'classic'),false);
 assert.equal(isCompactBattle(11,4,'tempo-only'),false);
 for(const [version,sectors] of [[11,8],[11,12],[12,4],[3,4]])
  assert.equal(isCompactBattle(version,sectors,'sector-defense'),false);
});

test('remote sector threat detection requires real visible enemy, spare forces and no active main assault',()=>{
 const sectors=[{id:0,owner:1,x:100,y:100},{id:1,owner:1,x:540,y:400},
  {id:2,owner:0,x:850,y:850},{id:3,owner:-1,x:900,y:350}];
 const home={x:100,y:100},enemy={id:92,kind:'heavy',x:560,y:415};
 const base={territories:sectors,visibleEnemies:[enemy],home,minFighters:5,engagedAttack:false};
 assert.deepEqual(sectorDefenseAnchor(base),sectors[1]);
 assert.equal(sectorDefenseAnchor({...base,visibleEnemies:[]}),undefined);
 assert.equal(sectorDefenseAnchor({...base,minFighters:3}),undefined);
 assert.equal(sectorDefenseAnchor({...base,engagedAttack:true}),undefined);
 assert.equal(sectorDefenseAnchor({...base,visibleEnemies:[{...enemy,x:880,y:870}]}),undefined);
 assert.equal(sectorDefenseAnchor({...base,territories:sectors.map(t=>({...t,owner:t.id===1?0:t.owner}))}),undefined);
});

test('no change in initial units, fog, credits, sector income or savegame with experimental modes',()=>{
 const a=new Simulation(2026,11),b=new Simulation(2026,11);
 b.tactical.frontDoctrine='sector-defense';
 assert.equal(a.tactical.frontDoctrine,'classic');
 assert.deepEqual(a.units,b.units);
 assert.deepEqual(a.bases,b.bases);
 assert.deepEqual(a.credits,b.credits);
 assert.deepEqual(a.territories,b.territories);
 assert.deepEqual(a.explored,b.explored);
 assert.equal(a.income(1),b.income(1));
 const save=b.save();
 assert.equal(save?.ai?.frontDoctrine,undefined);
 assert.equal(Simulation.load(save).tactical.frontDoctrine,'classic');
});

test('four-bastion experimental plans do not reserve fake units or create free money',()=>{
 const g=new Simulation(2026,11);
 g.tactical.frontDoctrine='concentrated';
 const credits=g.credits[1],initial=g.units.length;
 for(let i=0;i<Math.ceil(28/RULES.tick);i++)g.step(RULES.tick);
 assert.ok(g.tactical.state.lastPlan>=25);
 assert.ok(g.units.length>=initial);
 assert.ok(g.credits[1]<=credits+g.income(1)*3);
});

test('six-second planning changes only the isolated tempo-only small-map policy',()=>{
 assert.equal(fourBastionPlanningDelay(11,4,'tempo-only',25),6);
 for(const policy of ['classic','concentrated','sector-defense'])
  assert.equal(fourBastionPlanningDelay(11,4,policy,25),25);
 assert.equal(fourBastionPlanningDelay(11,8,'tempo-only',25),25);
 const faster=new Simulation(2026,11);faster.tactical.frontDoctrine='tempo-only';
 for(let i=0;i<Math.ceil(12/RULES.tick);i++)faster.step(RULES.tick);
 assert.ok(faster.tactical.state.lastPlan>=6);
 assert.ok(faster.bases.some(b=>b.owner===1&&b.kind==='generator'),
  'tempo-only must keep original first-generator economy');
});

test('safe neutral sector priority is scoped, observed and no privileged information',()=>{
 const base={mode:'sector-priority',mapVersion:11,sectors:4,neutral:true,
 observedDefender:false,observedTurret:false,endgame:false};
 assert.equal(neutralExpansionPreference(base),-1900);
 assert.equal(neutralExpansionPreference({...base,mode:'tempo-sector'}),-1900);
 assert.equal(neutralExpansionPreference({...base,observedDefender:true}),0);
 assert.equal(neutralExpansionPreference({...base,observedTurret:true}),0);
 assert.equal(neutralExpansionPreference({...base,neutral:false}),0);
 assert.equal(neutralExpansionPreference({...base,endgame:true}),0);
 assert.equal(neutralExpansionPreference({...base,sectors:8}),0);
 assert.equal(neutralExpansionPreference({...base,mode:'classic'}),0);
 assert.equal(fourBastionPlanningDelay(11,4,'tempo-sector',25),6);
});

test('paid forward fortification only after taking a frontier with surviving soldiers',()=>{
 const base={mode:'fortify-early',mapVersion:11,sectors:4,time:80,
  ownedForwardBastions:1,fighters:4,barracksReady:true};
 assert.equal(considerEarlyBorderFortification(base),true);
 assert.equal(considerEarlyBorderFortification({...base,ownedForwardBastions:0}),false);
 assert.equal(considerEarlyBorderFortification({...base,time:40}),false);
 assert.equal(considerEarlyBorderFortification({...base,fighters:2}),false);
 assert.equal(considerEarlyBorderFortification({...base,mode:'classic'}),false);
 assert.equal(considerEarlyBorderFortification({...base,sectors:8}),false);
});

test('fair-start removes artificial 25 second delay but changes no starting resources',()=>{
 const normal=new Simulation(2026,11),equal=new Simulation(2026,11);
 equal.tactical.frontDoctrine='fair-start';
 assert.equal(fourBastionPlanningDelay(11,4,'fair-start',25),0);
 assert.equal(fourBastionPlanningDelay(11,8,'fair-start',25),25);
 assert.deepEqual(normal.bases,equal.bases);
 assert.deepEqual(normal.units,equal.units);
 assert.deepEqual(normal.credits,equal.credits);
 assert.deepEqual(normal.territories,equal.territories);
 for(let i=0;i<Math.ceil(12/RULES.tick);i++){normal.step(RULES.tick);equal.step(RULES.tick);}
 assert.equal(normal.tactical.state.lastPlan,-3);
 assert.ok(equal.tactical.state.lastPlan>0,'equal-start policy must begin planning promptly');
});
