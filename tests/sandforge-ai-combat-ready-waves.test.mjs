import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assaultWaveDecision} from '../dist/src/reborn/assault-wave.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const strong={defended:true,selectedGround:9,readyGround:4,elapsed:12,
 selectedStrength:45,readyStrength:40,siegeSupported:true};

test('AI: ready armored firepower launches early, never bypassing observed siege safety',()=>{
 assert.deepEqual(assaultWaveDecision(strong),{ready:true,required:7,reason:'combat-ready'});
 assert.equal(assaultWaveDecision({...strong,siegeSupported:false}).ready,false);
 assert.equal(assaultWaveDecision({...strong,readyGround:3}).ready,false);
 assert.equal(assaultWaveDecision({...strong,readyStrength:30}).ready,false);
 assert.equal(assaultWaveDecision({...strong,selectedStrength:Infinity}).ready,false);
 assert.equal(assaultWaveDecision({...strong,readyStrength:NaN}).ready,false);
 assert.equal(assaultWaveDecision({...strong,elapsed:42,siegeSupported:false}).reason,'bounded-wait');
 assert.equal(assaultWaveDecision({...strong,readyGround:7,siegeSupported:false}).reason,'assembled');
});

test('AI: defended sector launches four ready tanks, rather than waiting for distant infantry',()=>{
 const g=new Simulation(2027,4);
 g.units=[];g.aiClock=-1e8;g.time=60;g.credits=[0,0];
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);g.world.cliffIds.fill(-1);
 Object.assign(g.bases.find(b=>b.owner===1&&b.kind==='headquarters'),{x:900,y:1900});
 Object.assign(g.bases.find(b=>b.owner===0&&b.kind==='headquarters'),{x:3300,y:3300});
 for(const t of g.territories){t.owner=-1;t.neighbors=[];}
 const home=g.territories[0],target=g.territories[1];
 home.owner=1;home.point={x:900,y:1900};home.neighbors=[target.id];
 target.owner=0;target.point={x:3100,y:1900};target.neighbors=[home.id];
 for(let i=0;i<4;i++)g.spawn(1,{x:1120+i*13,y:1900},'tank');
 for(let i=0;i<5;i++)g.spawn(1,{x:900+i*15,y:2750},'infantry');
 g.spawn(1,{x:900,y:1850},'infantry');
 g.tactical.state.phase='gather';g.tactical.state.phaseAt=60;
 g.tactical.state.rally={x:1120,y:1900};
 g.tactical.state.commander={version:1,phase:'buildup',phaseSince:60,recon:[],survey:[],intel:[],aborted:0,
  mission:{kind:'capture',x:target.point.x,y:target.point.y,sector:target.id,objective:null,since:60,progressAt:60,distance:1980}};
 g.tactical.route=(_from,to)=>[to];g.updateVision();
 g.tactical.plan();
 assert.equal(g.tactical.state.phase,'attack','armored vanguard must not stall until 42 seconds');
 const members=g.units.filter(u=>g.tactical.state.group.includes(u.id));
 assert.ok(members.filter(u=>u.kind==='tank').length>=4);
 assert.ok(members.every(u=>u.orders[0]?.tactical?.mode==='assault'));
 assert.ok(g.tactical.diagnostics.waveLaunches>0);
});
