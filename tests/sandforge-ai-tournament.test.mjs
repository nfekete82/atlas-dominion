import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {OPPONENTS,scriptedBlueTurn} from '../scripts/ai-tournament-opponents.mjs';
import {CONTENDERS,configureContender,tournamentOptions,summarizeTournament} from '../scripts/ai-strategy-tournament.mjs';
import {selectiveRaidAllowed} from '../dist/src/reborn/selective-raids.js';
import {deferOpeningInvestment} from '../dist/src/reborn/army-economy.js';
import {contactReinforcement,guardedContactReinforcement} from '../dist/src/reborn/director-production.js';

test('tournament: exactly four reproducible, legal BLUE opponents',()=>{
 assert.deepEqual(OPPONENTS,['guarded','pressure','expansion','armored']);
 assert.equal(new Set(OPPONENTS).size,4);
 assert.equal(new Set(CONTENDERS).size,16);
 assert.throws(()=>scriptedBlueTurn(new Simulation(2026,11),'omniscient'));
});
test('tournament: flags validate seeds, complete A/B and real time horizon',()=>{
 const opts=tournamentOptions(['--seeds','2026,2027','--seconds','360',
  '--opponents','guarded,pressure','--contenders','current,legacy-wave']);
 assert.deepEqual(opts.seeds,[2026,2027]);
 assert.deepEqual(opts.contenders,['current','legacy-wave']);
 for(const args of [
  ['--seeds','2026,2026'],
  ['--seconds','20'],
  ['--opponents','unknown'],
  ['--contenders','legacy-wave,baseline'],
  ['--other','123'],
  ['--seeds','bad']])assert.throws(()=>tournamentOptions(args));
});
test('tournament: A/B controllers start with precisely equal playable state',()=>{
 const baseline=new Simulation(2026,11);
 for(const name of CONTENDERS){
  const g=new Simulation(2026,11);configureContender(g.tactical,name);
  assert.deepEqual(g.units,baseline.units);
  assert.deepEqual(g.bases,baseline.bases);
  assert.deepEqual(g.credits,baseline.credits);
  assert.deepEqual(g.territories,baseline.territories);
  assert.deepEqual(g.visible,baseline.visible);
  assert.deepEqual(g.explored,baseline.explored);
 }
});
test('tournament: no unearned blue resources or prohibited direct state mutation',()=>{
 const g=new Simulation(2026,11),seedCredits=g.credits[0];
 for(const kind of OPPONENTS){
  // Controllers may issue paid orders, but the engine's actual credits
  // MUST never rise and no spawned units may appear without an engine tick.
  const h=new Simulation(2026,11),oldIds=h.units.map(u=>u.id);
  scriptedBlueTurn(h,kind);
  assert.ok(h.credits[0]<=seedCredits,kind+' granted free credits');
  assert.deepEqual(h.units.map(u=>u.id),oldIds,kind+' spawned a free unit');
  assert.deepEqual(h.territories,g.territories,kind+' changed ownership directly');
  assert.deepEqual(h.visible,g.visible,kind+' altered fog of war');
 }
});
test('tournament: no winner invented when all matches time out',()=>{
 const contenders=['current','legacy-wave'],opponents=['guarded'],seeds=[2026,2027],rows=[];
 for(const strategy of contenders)for(const seed of seeds)rows.push({
  strategy,seed,opponent:'guarded',outcome:'timeout',initialStateHash:'same',
  captures:strategy==='current'?2:3,netCaptures:strategy==='current'?1:2,
  redUnitsLost:strategy==='current'?2:3,blueUnitsLost:1,redSectors:2,enemyHQDamage:0,
  abortedMissions:0});
 const report=summarizeTournament(rows,contenders,opponents,seeds);
 assert.equal(report.decisiveMatches,0);
 assert.equal(report.hasDecisiveEvidence,false);
 assert.equal(report.championApproved,false);
 assert.deepEqual(report.leaderboard.map(x=>x.wins),[0,0]);
 assert.equal(report.comparisons['legacy-wave'].avgCaptureDelta,1);
 assert.equal(report.comparisons['legacy-wave'].avgDeathDelta,1);
 assert.equal(report.leaderboard[0].timeouts,2);
});
test('tournament: unpaired state hashes abort comparison',()=>{
 const rows=[
  {strategy:'current',seed:1,opponent:'guarded',outcome:'timeout',initialStateHash:'A',captures:1},
  {strategy:'baseline',seed:1,opponent:'guarded',outcome:'timeout',initialStateHash:'B',captures:2}
 ];
 assert.throws(()=>summarizeTournament(rows,['current','baseline'],['guarded'],[1]),/initial state/);
});
test('tournament: selectable BLUE attack only issues valid commands when eligible',()=>{
 const g=new Simulation(2026,11);
 for(const opponent of OPPONENTS){
  g.time=80;
  const before=[...g.credits];
  scriptedBlueTurn(g,opponent);
  assert.ok(g.credits[0]<=before[0]);
  assert.equal(g.credits[1],before[1]);
  assert.ok(g.units.every(u=>u.hp>0));
 }
});

test('ablation: each strategy modifies ONLY its intended doctrine switch',()=>{
 const classic=new Simulation(2026,11);
 assert.equal(classic.tactical.missionPlannerMode,'inherit');
 assert.equal(classic.tactical.raidDetachmentMode,'inherit');
 assert.equal(classic.tactical.siegeEvaluationMode,'inherit');
 const cases=[
  ['legacy-mission','missionPlannerMode','legacy'],
  ['no-side-raids','raidDetachmentMode','off'],
  ['legacy-siege','siegeEvaluationMode','legacy']
 ];
 for(const [strategy,key,value] of cases){
  const g=new Simulation(2026,11);
  configureContender(g.tactical,strategy);
  assert.equal(g.tactical[key],value);
  assert.equal(g.tactical.doctrineMode,'intelligent');
  assert.equal(g.tactical.mode,'director');
  for(const other of ['missionPlannerMode','raidDetachmentMode','siegeEvaluationMode'])
   if(other!==key)assert.equal(g.tactical[other],'inherit');
 }
 const both=new Simulation(2026,11);
 configureContender(both.tactical,'legacy-mission-no-raids');
 assert.equal(both.tactical.missionPlannerMode,'legacy');
 assert.equal(both.tactical.raidDetachmentMode,'off');
 assert.equal(both.tactical.siegeEvaluationMode,'inherit');
 const legacy=new Simulation(2026,11);
 configureContender(legacy.tactical,'legacy-doctrine');
 assert.equal(legacy.tactical.doctrineMode,'legacy');
 assert.equal(legacy.tactical.missionPlannerMode,'inherit');
 // These are benchmark-only toggles, never persisted to user saves.
 const saved=both.save(),restored=Simulation.load(saved);
 assert.equal(saved.ai?.missionPlannerMode,undefined);
 assert.equal(restored.tactical.missionPlannerMode,'inherit');
 assert.deepEqual(both.credits,classic.credits);
 assert.deepEqual(both.visible,classic.visible);
 assert.deepEqual(both.units,classic.units);
});

test('selective raiding: no two-unit split from a five-unit army under comeback pressure',()=>{
 const base={fighters:5,mainScreen:3,eligibleRaiders:2,
  normalDoctrine:false,behindByTwoSectors:true,observedHomeThreat:false};
 assert.equal(selectiveRaidAllowed(base),false);
 assert.equal(selectiveRaidAllowed({...base,fighters:8,mainScreen:5}),true);
 assert.equal(selectiveRaidAllowed({...base,fighters:10,mainScreen:7,normalDoctrine:true,behindByTwoSectors:false}),true);
 assert.equal(selectiveRaidAllowed({...base,fighters:12,mainScreen:9,normalDoctrine:true,observedHomeThreat:true}),false);
 assert.equal(selectiveRaidAllowed({...base,fighters:12,mainScreen:9,normalDoctrine:true,eligibleRaiders:1}),false);
 assert.equal(selectiveRaidAllowed({...base,fighters:8,mainScreen:4}),false);
 const current=new Simulation(2026,11),variant=new Simulation(2026,11);
 configureContender(variant.tactical,'selective-raids');
 assert.equal(variant.tactical.raidDetachmentMode,'selective');
 assert.equal(current.tactical.raidDetachmentMode,'inherit');
 assert.equal(variant.tactical.doctrineMode,current.tactical.doctrineMode);
 assert.deepEqual(variant.units,current.units);
 assert.deepEqual(variant.credits,current.credits);
 assert.deepEqual(variant.visible,current.visible);
 assert.equal(variant.save().ai?.raidDetachmentMode,undefined);
});

test('paid four-bastion opening: one barracks before 12s without early soldier assault',()=>{
 const now=new Simulation(2026,11),early=new Simulation(2026,11);
 configureContender(early.tactical,'early-barracks');
 for(let i=0;i<240;i++){now.step(.05);early.step(.05);}
 assert.equal(early.tactical.earlyEconomyMode,'barracks-first');
 assert.equal(now.tactical.earlyEconomyMode,'classic');
 assert.equal(early.tactical.state.lastPlan,-3,'no full AI plan before 25 seconds');
 assert.equal(now.tactical.state.lastPlan,-3);
 assert.ok(early.bases.some(b=>b.owner===1&&b.kind==='barracks'),'barracks is funded before first military plan');
 assert.ok(!now.bases.some(b=>b.owner===1&&b.kind==='barracks'),'original AI still waits');
 assert.ok(early.credits[1]<now.credits[1],'RED pays for its actual barracks');
 assert.ok(early.units.find(u=>u.owner===1&&u.kind==='infantry')?.orders.length===0,
  'initial infantry should not be sent out before the original attack-planning clock');
 assert.deepEqual(early.territories,now.territories);
 assert.equal(early.credits[0],now.credits[0],'BLUE resources untouched');
 assert.equal(early.save().ai?.earlyEconomyMode,undefined,'experimental flag not serialized');
});
test('screened opening waits for four real field fighters, never hidden units',()=>{
 const input={mapVersion:11,mode:'barracks-screen',time:45,
  fighters:2,barracksReady:true};
 assert.equal(deferOpeningInvestment(input),true);
 for(const variation of [
  {...input,fighters:4},
  {...input,time:90},
  {...input,mapVersion:12},
  {...input,mode:'barracks-first'},
  {...input,barracksReady:false}
 ])assert.equal(deferOpeningInvestment(variation),false);
 const reference=new Simulation(2026,11),screen=new Simulation(2026,11);
 configureContender(reference.tactical,'early-barracks');
 configureContender(screen.tactical,'screened-opening');
 assert.equal(screen.tactical.earlyEconomyMode,'barracks-screen');
 for(let i=0;i<240;i++){reference.step(.05);screen.step(.05);}
 assert.deepEqual(screen.bases,reference.bases,'first 12s build must be identical');
 assert.deepEqual(screen.credits,reference.credits,'all opening purchases are paid');
 assert.equal(screen.tactical.state.lastPlan,-3,'no premature tactical attack');
 assert.equal(screen.save().ai?.earlyEconomyMode,undefined,'experiment is not serialized');
 const otherMap=new Simulation(2026,12);
 configureContender(otherMap.tactical,'screened-opening');
 for(let i=0;i<240;i++)otherMap.step(.05);
 assert.equal(otherMap.bases.some(b=>b.owner===1&&b.kind==='barracks'),false);
});
test('adaptive opening only responds to visible and public threats',()=>{
 const input={mapVersion:11,mode:'adaptive-screen',time:45,
  fighters:2,barracksReady:true,visibleAttackers:0,visibleArmor:0,enemySectorLead:0};
 assert.equal(deferOpeningInvestment(input),false,'do not delay economy on imagined enemy');
 assert.equal(deferOpeningInvestment({...input,visibleAttackers:1}),false,'one distant scout is not a rush');
 assert.equal(deferOpeningInvestment({...input,visibleAttackers:2}),true,'observed enemy infantry pressure');
 assert.equal(deferOpeningInvestment({...input,visibleArmor:1}),true,'observed enemy armor threat');
 assert.equal(deferOpeningInvestment({...input,enemySectorLead:1}),true,'public enemy sector advantage');
 for(const mutation of [
  {time:90},{fighters:4},{barracksReady:false},{mapVersion:12}
 ]){
  assert.equal(deferOpeningInvestment({...input,visibleAttackers:3,...mutation}),false);
 }
 const base=new Simulation(2026,11),candidate=new Simulation(2026,11);
 configureContender(base.tactical,'early-barracks');
 configureContender(candidate.tactical,'adaptive-opening');
 assert.equal(candidate.tactical.earlyEconomyMode,'adaptive-screen');
 assert.deepEqual(candidate.credits,base.credits);
 assert.deepEqual(candidate.visible,base.visible);
 for(let i=0;i<240;i++){base.step(.05);candidate.step(.05);}
 assert.deepEqual(candidate.bases,base.bases,'first paid barracks unaffected by policy');
 assert.deepEqual(candidate.credits,base.credits,'no unearned credits');
 assert.equal(candidate.tactical.state.lastPlan,-3,'no early attack planned');
 assert.equal(candidate.save().ai?.earlyEconomyMode,undefined,'runtime experiment stays out of save files');
 const otherMap=new Simulation(2026,12);
 configureContender(otherMap.tactical,'adaptive-opening');
 for(let i=0;i<240;i++)otherMap.step(.05);
 assert.equal(otherMap.bases.some(b=>b.owner===1&&b.kind==='barracks'),false);
});
test('post-contact policy buys only paid visible counters, with strict guards',()=>{
 const x={mode:'adaptive-contact',mapVersion:11,time:105,finishing:false,
  underAttack:false,visibleInfantry:0,visibleArmor:0,visibleAir:0,enemySectorLead:0,
  livingLine:3,orderedLine:4,infantry:3,heavy:1,tank:0,factoryReady:false};
 assert.equal(contactReinforcement(x),null,'no phantom opponent');
 assert.equal(contactReinforcement({...x,visibleInfantry:2}),'infantry');
 assert.equal(contactReinforcement({...x,visibleInfantry:2,heavy:0}),'heavy');
 assert.equal(contactReinforcement({...x,underAttack:true,visibleInfantry:1}),'infantry');
 assert.equal(contactReinforcement({...x,enemySectorLead:1}),'infantry');
 assert.equal(contactReinforcement({...x,visibleArmor:1}),null,'no magical factory');
 assert.equal(contactReinforcement({...x,visibleArmor:1,factoryReady:true}),'tank');
 assert.equal(contactReinforcement({...x,visibleArmor:1,factoryReady:true,tank:1}),null);
 for(const alt of [
  {mode:'barracks-first'},{time:54},{time:211},{mapVersion:12},
  {visibleAir:1},{livingLine:6},{orderedLine:7},{finishing:true}
 ]){
  assert.equal(contactReinforcement({...x,visibleInfantry:2,...alt}),null,
   'must not override protected match states: '+JSON.stringify(alt));
 }
 const standard=new Simulation(2038,11),candidate=new Simulation(2038,11);
 configureContender(standard.tactical,'early-barracks');
 configureContender(candidate.tactical,'adaptive-contact');
 for(let i=0;i<240;i++){standard.step(.05);candidate.step(.05);}
 assert.deepEqual(candidate.bases,standard.bases,'early paid barracks remains untouched');
 assert.deepEqual(candidate.credits,standard.credits,'no credit cheats');
 assert.deepEqual(candidate.visible,standard.visible,'no modified fog');
 assert.equal(candidate.tactical.state.lastPlan,-3,'no early military plan');
 assert.equal(candidate.save().ai?.earlyEconomyMode,undefined);
});
test('threat-guard: only nearby observed attacks trigger a paid response',()=>{
 const x={mode:'threat-guard',mapVersion:11,time:110,
  finishing:false,visibleAir:0,nearbyInfantry:0,nearbyArmor:0,
  homeThreat:false,imminentHQThreat:false,activeAssault:false,
  committedSiege:false,livingLine:3,orderedLine:3,
  infantry:3,heavy:0,tank:0,factoryReady:false};
 const decide=patch=>guardedContactReinforcement({...x,...patch});
 assert.equal(decide({}),null,'public sector deficit alone is insufficient');
 assert.equal(decide({nearbyInfantry:2}),null,'distant or off-front observations must not count');
 assert.equal(decide({homeThreat:true,nearbyInfantry:2}),'heavy','a real local rush needs one heavy escort');
 assert.equal(decide({homeThreat:true,nearbyInfantry:2,heavy:1}),'infantry','cheap replacement after heavy');
 assert.equal(decide({homeThreat:true,nearbyInfantry:1}),null,'one infantry does not imply a rush');
 assert.equal(decide({homeThreat:true,nearbyArmor:1}),null,'no imaginary factory');
 assert.equal(decide({homeThreat:true,nearbyArmor:1,factoryReady:true}),'tank','one real paid armor counter');
 assert.equal(decide({homeThreat:true,nearbyArmor:1,factoryReady:true,tank:1}),null,'no repeated tanks');
 assert.equal(decide({homeThreat:true,nearbyInfantry:2,livingLine:5}),null,'screen is capped');
 assert.equal(decide({homeThreat:true,nearbyInfantry:2,orderedLine:6}),null,'queue counts');
 assert.equal(decide({homeThreat:true,nearbyInfantry:2,activeAssault:true}),null,'no raid diversion');
 assert.equal(decide({homeThreat:true,nearbyInfantry:2,activeAssault:true,
  imminentHQThreat:true}),'heavy','visible emergency can override active assault');
 assert.equal(decide({homeThreat:true,nearbyInfantry:2,committedSiege:true}),null,
  'protect funded artillery and siege roles');
 for(const patch of [{mode:'adaptive-contact'},{mapVersion:12},{time:54},
  {time:211},{visibleAir:1},{finishing:true}])
  assert.equal(decide({...patch,homeThreat:true,nearbyInfantry:3}),null,
   JSON.stringify(patch));
 const old=new Simulation(2042,11),changed=new Simulation(2042,11);
 configureContender(old.tactical,'early-barracks');
 configureContender(changed.tactical,'threat-guard');
 assert.equal(changed.tactical.earlyEconomyMode,'threat-guard');
 for(let i=0;i<240;i++){old.step(.05);changed.step(.05);}
 assert.deepEqual(changed.bases,old.bases);
 assert.deepEqual(changed.credits,old.credits,'first paid opening unchanged');
 assert.deepEqual(changed.visible,old.visible,'same fog');
 assert.equal(changed.tactical.state.lastPlan,-3,'no early solo attack');
 assert.equal(changed.save().ai?.earlyEconomyMode,undefined,'experiment never persisted');
});
test('paid opening is map-scoped and keeps ordinary 25s strategic timing',()=>{
 const larger=new Simulation(2026,12);
 configureContender(larger.tactical,'early-barracks');
 for(let i=0;i<240;i++)larger.step(.05);
 assert.equal(larger.bases.some(b=>b.owner===1&&b.kind==='barracks'),false,
  'eight-bastion version remains original');
 const small=new Simulation(2026,11);configureContender(small.tactical,'early-barracks');
 for(let i=0;i<600;i++)small.step(.05);
 assert.ok(small.tactical.state.lastPlan>=25,'normal planning starts after 25s');
});
