import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {classifyTempo,compareTempo,parseOptions,STRATEGIES} from '../scripts/ai-attack-tempo-audit.mjs';

test('tempo: late genuine win and equal win-time remain different',()=>{
 assert.equal(compareTempo({outcome:'timeout'},{outcome:'win'}),'late-win-vs-baseline-timeout');
 assert.equal(compareTempo({outcome:'win'},{outcome:'timeout'}),'baseline-wins-candidate-timeout');
 assert.equal(compareTempo({outcome:'win',played:900},{outcome:'win',played:600}),'both-win-candidate-faster');
 assert.equal(compareTempo({outcome:'win',played:500},{outcome:'win',played:650}),'both-win-baseline-faster');
 assert.equal(compareTempo({outcome:'timeout'},{outcome:'timeout'}),'same-outcome');
});
test('tempo: metrics follow real observed events, never convert timeout to victory',()=>{
 const a=classifyTempo({outcome:'timeout',elapsedSeconds:900,
  firstOrganizedAttack:100,firstEnemyHQDamage:550,
  firstArtillery:440,commanderSeconds:{buildup:250,siege:200,expansion:450},
  missionEvents:[{started:200,ended:370,outcome:'aborted',target:2}],
  missionCount:2,timeline:[{at:30,phase:'gather',commander:'buildup',
   mission:'capture',group:0,redUnits:4,sectors:1,enemyHQHp:1200,enemyHQDamage:0}]});
 assert.equal(a.outcome,'timeout');
 assert.equal(a.timeToFirstHQHitAfterOrganizedAttack,450);
 assert.equal(a.siegeBuildupSeconds,450);
 assert.equal(a.stalls.length,1);
 assert.equal(a.timeline.length,1);
 assert.equal(a.missionEvents[0].duration,170);
});
test('tempo: no mutation of simulator and baseline/early comparisons',()=>{
 const g=new Simulation(2026,11),snapshot=g.save();
 const a=classifyTempo({outcome:'timeout',elapsedSeconds:360,commanderSeconds:{},
  missionEvents:[],timeline:[]});
 assert.equal(a.outcome,'timeout');assert.equal(a.firstOrganizedAttack,undefined);
 assert.deepEqual(g.save(),snapshot);
 assert.deepEqual(STRATEGIES,['current','early-barracks']);
});
test('tempo: bounded options',()=>{
 const parsed=parseOptions(['--opponent','armored','--seeds','2026,2074','--seconds','900']);
 assert.equal(parsed.seconds,900);assert.deepEqual(parsed.seeds,[2026,2074]);
 for(const flags of [['--opponent','invalid'],['--seeds','-1'],['--seeds','1,1'],
  ['--seconds','360'],['--seconds','1300'],['--bad','yes']])
 assert.throws(()=>parseOptions(flags));
});
