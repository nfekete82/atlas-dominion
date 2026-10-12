import test from 'node:test';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {Game} from '../dist/src/engine/game.js';import {validSeaRoute} from '../dist/src/engine/navigation.js';
for(const seed of [20261012,20261013,20261014])for(const ticks of [500,1000])test(`${ticks} ticks, seed ${seed}: full naval AI simulation and deterministic mid-voyage replay`,()=>{
 const g=new Game(seed,49,'DE','balanced');let restored,navalStarts=0,peak=0,maxInvaders=0;const ids=new Set(),times=[];
 for(let n=0;n<ticks;n++){
   const t=performance.now();g.step();times.push(performance.now()-t);if(restored)restored.step();
   const fleets=g.attackOrders.filter(o=>o.landing&&o.seaRoute);peak=Math.max(peak,fleets.length);
   for(const o of fleets){assert.ok(validSeaRoute(o.seaRoute));if(!ids.has(o.id)){ids.add(o.id);navalStarts++;}}
   for(const f of g.factions){assert.ok(Number.isFinite(f.troops)&&f.troops>=0);assert.ok(Math.abs(f.population-g.populationOf(f.id))<1e-5);assert.ok(fleets.filter(o=>o.factionId===f.id).length<=1);}
   for(const target of new Set(g.attackOrders.filter(o=>o.targetOwner>=0).map(o=>o.targetOwner))){const invaders=new Set(g.attackOrders.filter(o=>o.targetOwner===target).map(o=>o.factionId));maxInvaders=Math.max(maxInvaders,invaders.size);}
   if(n===Math.floor(ticks/2))restored=Game.fromSave(JSON.parse(JSON.stringify(g.exportSave())));
 }
 assert.equal(g.tick,ticks,'simulation must actually complete the requested ticks');assert.ok(navalStarts>0,'AI must actually use naval warfare');assert.ok(maxInvaders<=2,'no third AI nation may dogpile an existing target');assert.deepEqual(restored.exportSave(),g.exportSave());
 times.sort((a,b)=>a-b);console.log('NAVAL SIM',JSON.stringify({seed,ticks,navalStarts,peakFleets:peak,maxConcurrentInvaders:maxInvaders,medianTickMs:times[Math.floor(times.length*.5)],p95TickMs:times[Math.floor(times.length*.95)],status:g.status}));
});
