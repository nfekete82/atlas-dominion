import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {productionSnapshot,classifyShortage,StarvationObserver,
 auditOptions,STRATEGIES} from '../scripts/ai-paid-production-starvation.mjs';
const shortage=(p={})=>({
 fighters:2,queuedFighters:0,barracksReady:1,productionBlock:'saving-unit',
 savingFor:'tank',activeBuildGoal:null,artilleryQueued:0,...p
});
test('paid shortage attribution separates queue, vehicle, siege and construction',()=>{
 for(const [patch,expected] of [
  [{fighters:4},'field-sufficient'],
  [{queuedFighters:2},'replacement-in-pipeline'],
  [{barracksReady:0},'no-barracks'],
  [{productionBlock:'queue-full'},'queue-already-producing'],
  [{savingFor:'artillery'},'siege-commitment'],
  [{artilleryQueued:1,savingFor:'tank'},'siege-commitment'],
  [{savingFor:'tank'},'vehicle-saving'],
  [{savingFor:'rover'},'vehicle-saving'],
  [{savingFor:null,activeBuildGoal:'factory'},'construction-saving'],
  [{savingFor:null,productionBlock:'insufficient-credits'},'insufficient-credits'],
  [{savingFor:null,productionBlock:'composition-complete'},'composition-complete'],
  [{savingFor:null,productionBlock:'no-recent-barracks-decision'},'planner-not-reporting'],
 ])assert.equal(classifyShortage(shortage(patch)),expected,JSON.stringify(patch));
});
test('paid shortage observer is read-only and never sees hidden BLUE positions',()=>{
 const g=new Simulation(2032,11),o=new StarvationObserver();
 const before=g.save();
 const s=productionSnapshot(g);
 assert.ok(!('hiddenEnemy' in s));
 assert.ok(!('blueUnits' in s));
 assert.deepEqual(before,g.save());
 for(let i=0;i<100;i++){g.step(.05);o.observe(g);}
 const snap=o.finish();
 assert.equal(Object.values(snap.allReasons).reduce((n,v)=>n+v,0),snap.samples);
 assert.ok(snap.samples>=4&&snap.samples<=6);
 const after=g.save();
 productionSnapshot(g);o.observe(g);
 assert.deepEqual(g.save(),after);
});
test('paid shortage A/B options and all-four BLUE strategies are strictly bounded',()=>{
 assert.deepEqual(STRATEGIES,['current','early-barracks']);
 assert.deepEqual(auditOptions(['--opponent','armored','--seeds','2026,2032']).seeds,[2026,2032]);
 for(const argv of [['--opponent','invalid'],['--seeds','1,1'],
  ['--seeds','x'],['--seconds','3'],['--foo','bar']])
  assert.throws(()=>auditOptions(argv));
});
