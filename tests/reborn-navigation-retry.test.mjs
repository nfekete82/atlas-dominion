import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

function fixture(){
 const g=new Simulation(2026,4);g.units=[];g.bases=[];g.aiClock=-1e8;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 const unit=g.spawn(0,{x:1200,y:1200});g.updateVision();return {g,unit};
}
for(const kind of ['attack','attackMove'])test(`navigation: unreachable ${kind} respects retry timing and new commands move immediately`,()=>{
 const {g,unit}=fixture();
 const enemy=g.spawn(1,{x:1450,y:1200});g.stop([enemy.id],true);
 g.command([unit.id],{kind,x:1800,y:1200,...(kind==='attack'?{target:enemy.id}:{})});
 const order=unit.orders[0],path=g.world.path.bind(g.world);let calls=0;
 // A visible target can be unreachable without losing its current mission.
 g.world.path=()=>{calls++;return [];};
 for(let i=0;i<20;i++)g.step();
 assert.ok(calls<=2,`repeated ${calls} searches in one second`);assert.ok(calls>=2,'unreachable commands must retry');
 assert.equal(unit.orders[0],order);assert.equal(unit.x,1200);assert.equal(unit.y,1200);
 // A replacement command is authoritative even if a failed retry is pending.
 unit.repath=.7;g.world.path=path;
 g.command([unit.id],{kind:'move',x:1200,y:1500});assert.equal(unit.repath,0);g.step();assert.ok(unit.y>1200);
});
