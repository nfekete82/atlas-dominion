import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assaultWaveDecision,reinforcementStagingPoint} from '../dist/src/reborn/assault-wave.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('2.4: a fortified target waits for 70% of existing troops, not for imaginary reinforcements',()=>{
 const x={defended:true,selectedGround:8,readyGround:3,elapsed:14};
 assert.deepEqual(assaultWaveDecision(x),{ready:false,required:6,reason:'assembling'});
 assert.deepEqual(assaultWaveDecision({...x,readyGround:6}),{ready:true,required:6,reason:'assembled'});
 assert.deepEqual(assaultWaveDecision({...x,readyGround:5,elapsed:43}),{ready:true,required:6,reason:'bounded-wait'});
 assert.equal(assaultWaveDecision({...x,readyGround:3,elapsed:41}).ready,false);
});
test('2.4: neutral capture and small armies retain the fast 2.3 opening',()=>{
 for(const n of [1,2,3,4]){
  assert.equal(assaultWaveDecision({defended:true,selectedGround:n,readyGround:2,elapsed:0}).ready,true);
 }
 assert.deepEqual(assaultWaveDecision({defended:false,selectedGround:12,readyGround:2,elapsed:0}),
  {ready:true,required:0,reason:'open-front'});
 assert.equal(assaultWaveDecision({defended:true,selectedGround:5,readyGround:4,elapsed:2}).ready,true);
});
test('2.4: reinforcements stage behind the real moving front, never beyond the objective',()=>{
 const home={x:100,y:500},front={x:600,y:500},target={x:1200,y:500};
 const p=reinforcementStagingPoint(front,target,home);
 assert.deepEqual(p,{x:430,y:500});
 assert.ok(p.x>home.x&&p.x<front.x);
 assert.deepEqual(reinforcementStagingPoint(front,{x:680,y:500},home),front,
  'close combat joins the established formation without a pointless detour');
 assert.deepEqual(reinforcementStagingPoint({x:110,y:500},target,home),{x:110,y:500},
  'fresh recruits are not rerouted behind the headquarters');
});
test('2.4: wave selection is deterministic and changes no credits, fog, orders or saves',()=>{
 const g=new Simulation(2026,4),snapshot=g.save(),wave=g.tactical;
 const decisions=Array.from({length:8},()=>assaultWaveDecision({
  defended:true,selectedGround:9,readyGround:4,elapsed:20}));
 assert.ok(decisions.every(x=>JSON.stringify(x)===JSON.stringify(decisions[0])));
 assert.equal(wave.waveMode,'coordinated');
 wave.waveMode='legacy';
 assert.deepEqual(g.save(),snapshot,'the benchmark toggle must not be serialized');
 wave.waveMode='coordinated';
 assert.deepEqual(g.save(),snapshot,'wave scoring cannot alter saved simulation or RNG');
});
test('2.4: scenario with 3 ready tanks and 3 distant soldiers waits for a coordinated push',()=>{
 const g=new Simulation(2026,4);
 g.units=[];g.aiClock=-1e8;g.time=60;
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 Object.assign(g.bases.find(b=>b.owner===1&&b.kind==='headquarters'),{x:900,y:1900});
 Object.assign(g.bases.find(b=>b.owner===0&&b.kind==='headquarters'),{x:3300,y:3300});
 for(const t of g.territories){t.owner=-1;t.neighbors=[];}
 const home=g.territories[0],target=g.territories[1];
 home.owner=1;home.point={x:900,y:1900};home.neighbors=[target.id];
 target.owner=0;target.point={x:3100,y:1900};target.neighbors=[home.id];
 for(let i=0;i<3;i++)g.spawn(1,{x:1120+i*10,y:1900},'tank');
 for(let i=0;i<3;i++)g.spawn(1,{x:900+i*15,y:2750},'infantry');
 g.spawn(1,{x:900,y:1850},'infantry'); // home reserve
 g.tactical.state.phase='gather';
 g.tactical.state.phaseAt=60;
 g.tactical.state.rally={x:1120,y:1900};
 g.updateVision();
 g.tactical.plan();
 assert.equal(g.tactical.state.phase,'gather','three ready tanks cannot drag six assigned fighters into a fragmented assault');
 assert.ok(g.tactical.diagnostics.waveWaits>0);
 g.time=104;
 g.tactical.plan();
 assert.equal(g.tactical.state.phase,'attack','finite rally timeout prevents a permanent siege deadlock');
 assert.ok(g.tactical.diagnostics.waveLaunches>0);
});
