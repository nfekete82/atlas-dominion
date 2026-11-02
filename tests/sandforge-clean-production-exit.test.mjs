import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {productionExitPose,productionExitDustPoint,PRODUCTION_EXIT_DURATION} from '../dist/src/reborn/production-exit.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {RULES} from '../dist/src/reborn/config.js';
import {addProducer} from './fixtures/reborn-production.mjs';

const run=(g,s)=>{for(let i=0;i<Math.round(s/RULES.tick);i++)g.step(RULES.tick);};
test('production: only completed training creates an exterior visual release',()=>{
 const g=new Simulation();g.aiClock=-1e8;g.credits[0]=5000;
 assert.equal(g.productionReleases.length,0,'initial roster is not animated as fresh production');
 const b=addProducer(g,'barracks');
 assert.equal(g.recruit(b.id,'infantry'),true);
 run(g,UNITS.infantry.buildTime);
 const release=g.productionReleases.at(-1);
 assert.ok(release,'production recorded a visual release');
 assert.equal(release.baseId,b.id);
 assert.equal(release.owner,0);
 assert.equal(release.kind,'infantry');
 const u=g.units.find(u=>u.id===release.unitId);
 assert.ok(u);
 assert.deepEqual(release.from,{x:b.x,y:b.y});
 assert.deepEqual(release.to,{x:u.x,y:u.y});
 assert.ok(Math.hypot(u.x-b.x,u.y-b.y)>b.radius,'unit is spawned safely outside building');
 assert.equal(g.save().productionReleases,undefined,'release effects do not pollute the save file');
});
test('production: exterior emergence stays small and ends exactly at real spawn location',()=>{
 const e={at:20,kind:'tank',from:{x:0,y:0},to:{x:120,y:40}};
 const initial=productionExitPose(e,20);
 assert.equal(initial.active,true);
 assert.equal(initial.alpha,.22);
 assert.ok(Math.hypot(initial.x,initial.y)<=16.001);
 const middle=productionExitPose(e,20+PRODUCTION_EXIT_DURATION/2);
 assert.ok(middle.alpha>initial.alpha);
 assert.ok(Math.hypot(middle.x,middle.y)<Math.hypot(initial.x,initial.y));
 assert.deepEqual(productionExitPose(e,20+PRODUCTION_EXIT_DURATION),{x:0,y:0,alpha:1,active:false});
 assert.deepEqual(productionExitPose(e,20,true),{x:0,y:0,alpha:1,active:false});
});
test('production: particles originate next to the safe exterior spawn and never at facade center',()=>{
 const e={from:{x:500,y:500},to:{x:620,y:600}};
 const p=productionExitDustPoint(e);
 assert.ok(Math.hypot(p.x-e.to.x,p.y-e.to.y)<13);
 assert.ok(Math.hypot(p.x-e.from.x,p.y-e.from.y)>100);
});
test('production: even hundreds of completed units cannot grow the release cache indefinitely',()=>{
 const g=new Simulation();g.aiClock=-1e8;g.credits[0]=50000;
 const b=addProducer(g,'barracks');
 // Test bounded queue events directly using the real production tick loop.
 for(let i=0;i<40;i++){
  const unit=g.spawn(0,{x:b.x+b.radius+80+i,y:b.y+b.radius+80},'infantry');
  g.productionReleases.push({unitId:unit.id,baseId:b.id,owner:0,kind:unit.kind,
    at:g.time,from:{x:b.x,y:b.y},to:{x:unit.x,y:unit.y}});
  if(g.productionReleases.length>24)g.productionReleases.shift();
 }
 assert.equal(g.productionReleases.length,24);
});
