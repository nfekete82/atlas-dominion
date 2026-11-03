import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {visibleOpeningSignals,openingAuditStats,openingAuditOptions} from '../scripts/ai-opening-signal-audit.mjs';

test('opening audit is a read-only observer and exposes no hidden unit positions',()=>{
 const g=new Simulation(2026,11),before=g.save();
 const row=visibleOpeningSignals(g);
 assert.deepEqual(g.save(),before,'observer must not mutate playable state');
 assert.equal(row.time,0);
 assert.equal(row.enemySectorLead,0);
 assert.equal(row.barracksBuilt,false);
 assert.equal(row.generators,0);
 assert.equal(row.credits,950);
 assert.equal(Object.hasOwn(row,'blueUnits'),false);
 assert.equal(Object.hasOwn(row,'bluePositions'),false);
 assert.equal(Object.hasOwn(row,'unseenUnits'),false);
});
test('opening audit distinguishes eligible gate from observed trigger',()=>{
 const normal={time:30,barracksReady:true,fighters:2,
  barracksBuilt:true,generators:0,factoryBuilt:false,
  visibleAttackers:0,visibleArmor:0,enemySectorLead:0};
 const samples=[{...normal,time:20,barracksReady:false},
  normal,{...normal,time:33,visibleAttackers:2},
  {...normal,time:45,enemySectorLead:1},
  {...normal,time:48,fighters:4},
  {...normal,time:90,visibleArmor:1}];
 const m=openingAuditStats(samples);
 assert.equal(m.eligibleSamples,3);
 assert.equal(m.activeHoldSamples,2);
 assert.equal(m.firstEligibleHold,33);
 assert.equal(m.firstThreat,33);
 assert.equal(m.firstSectorDeficit,45);
 assert.equal(m.firstFourFighters,48);
});
test('opening audit validates opponents and seed list',()=>{
 assert.deepEqual(openingAuditOptions(['--opponent','pressure','--seeds','2026,2038']).seeds,[2026,2038]);
 for(const args of [['--opponent','unknown'],['--seeds','5,5'],['--seeds','oops'],['--why','yes']])
  assert.throws(()=>openingAuditOptions(args));
});
