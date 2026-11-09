import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {VisionCache} from '../dist/src/reborn/vision-cache.js';
import {RULES,distance} from '../dist/src/reborn/config.js';

test('optimized moving bomber/heli visibility exactly matches original geometric circle at all cells',()=>{
 const g=new Simulation(2074,11);
 const cache=new VisionCache(),world=g.world;
 for(const [k,x,y,sight] of [
  [0,.16,.23,680],[1,.41,.39,680],[2,.46,.45,780],
  [3,.84,.77,680],[4,.85,.775,780],[5,.12,.11,300]
 ]){
  const source={key:'bomber',x:x*world.size,y:y*world.size,sight,close:40,air:true};
  const visible=new Uint8Array(RULES.grid**2);
  cache.update(world,0,[source],visible);
  const expected=new Uint8Array(RULES.grid**2);
  for(let i=0;i<expected.length;i++)
   if(distance(source,world.center(i))<=sight)expected[i]=1;
  const own=world.index(source);
  if(own>=0)expected[own]=1;
  assert.deepEqual(visible,expected,'exact cells for airborne source '+k);
 }
});

test('moving planes can overlap ground and stationary views without changing fog semantics',()=>{
 const g=new Simulation(2074,11),world=g.world,cache=new VisionCache();
 const p={x:world.size*.51,y:world.size*.52};
 const a={key:'flyer',x:p.x,y:p.y,sight:680,close:40,air:true};
 const b={key:'stationary',x:p.x-100,y:p.y+220,sight:370,close:115,air:false};
 const actual=new Uint8Array(RULES.grid**2);
 cache.update(world,0,[a,b],actual);
 const sA=new Uint8Array(RULES.grid**2),sB=new Uint8Array(RULES.grid**2);
 const aCache=new VisionCache(),bCache=new VisionCache();
 aCache.update(world,0,[a],sA);bCache.update(world,0,[b],sB);
 for(let i=0;i<actual.length;i++)
  assert.equal(actual[i],sA[i]|sB[i],'combined views union at '+i);
});
