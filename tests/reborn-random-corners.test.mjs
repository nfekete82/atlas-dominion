import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {campaignLayout,CAMPAIGN_SIZES,mapWorldSize} from '../dist/src/reborn/config.js';
test('randomized campaigns offer exactly 4, 8, 12, 16 bastions with spacious small maps',()=>{
 assert.deepEqual(Object.values(CAMPAIGN_SIZES),[11,12,13,14]);
 for(const [count,version] of [[4,11],[8,12],[12,13],[16,14]]){
  const g=new Simulation(2026,version);
  assert.equal(g.territories.length,count);
  assert.ok(mapWorldSize(version)>=3000);
 }
});
test('four diagonal player corners appear across deterministic campaign seeds',()=>{
 for(const version of [3,4,5,6,7,8,9,10,11,12,13,14]){
  const results=new Set();
  for(let seed=0;seed<32;seed++){
   const layout=campaignLayout(version,seed);
   const blue=layout.headquarters[0],red=layout.headquarters[1],last=layout.columns*layout.rows-1;
   assert.equal(blue+red,last);
   assert.equal(layout.starts[0][0],blue);
   assert.equal(layout.starts[1][0],red);
   results.add(blue);
  }
  assert.equal(results.size,4);
 }
});
test('spawn, ownership and saved reload agree with seeded diagonal starts',()=>{
 for(const version of [3,4,5,6,7,8,9,10,11,12,13,14])for(const seed of [2026,42,1234567,9876543]){
  const g=new Simulation(seed,version),layout=campaignLayout(version,seed);
  for(const owner of [0,1]){
   assert.equal(g.bases.find(b=>b.owner===owner&&b.kind==='headquarters').territory,layout.headquarters[owner]);
   assert.equal(g.territories[layout.headquarters[owner]].owner,owner);
  }
  assert.equal(g.territories.length,layout.columns*layout.rows);
  const restored=Simulation.load(g.save());
  assert.equal(restored.seed,seed);
  assert.deepEqual(restored.territories.map(t=>t.owner),g.territories.map(t=>t.owner));
 }
});
