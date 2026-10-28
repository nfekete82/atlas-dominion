import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapLayout,RULES} from '../dist/src/reborn/config.js';

const versions=[3,4,5];
for(const version of versions){
 test('HQ bastions yield +25 for both factions, tiered neutral sectors reach +35 on map '+version,()=>{
  const game=new Simulation(2026,version);
  const layout=mapLayout(version),sectors=game.territories;
  assert.equal(sectors.length,layout.columns*layout.rows);
  for(const owner of [0,1]){
   const home=sectors[layout.headquarters[owner]];
   assert.equal(home.owner,owner);
   assert.equal(home.income,25);
   assert.equal(home.value,1,'tier indicator agrees with actual HQ yield');
   assert.equal(game.bases.find(b=>b.kind==='headquarters'&&b.owner===owner)?.territory,home.id);
   assert.equal(game.income(owner),35,'25 territory plus 10 operational HQ');
  }
  assert.equal(sectors.filter(s=>s.owner===-1&&s.income===35).length,2,
   'paired high-value neutral bastions remain worth 35 each');
  assert.ok(sectors.every(s=>[15,25,35].includes(s.income)));
  assert.ok(sectors.every((s,i)=>s.income===sectors[sectors.length-i-1].income),
   'map income tiers remain mirrored for balanced starts');
 });
 test('income is credited exactly once after ten simulated seconds on map '+version,()=>{
  const game=new Simulation(77,version);
  assert.deepEqual(game.credits,[950,950]);
  for(let t=0;t<200;t++)game.step(.05);
  assert.deepEqual(game.credits,[985,985],'both players receive +25 bastion and +10 HQ');
 });
 test('existing saves regenerate new authoritative bastion tiers on map '+version,()=>{
  const game=new Simulation(2026,version);
  const oldSave=game.save();
  // Previous builds wrote stale tier values into each stored sector.
  for(const territory of oldSave.territories){territory.income=10;territory.value=0;}
  const reloaded=Simulation.load(oldSave);
  assert.deepEqual(reloaded.territories.map(s=>s.income),game.territories.map(s=>s.income));
  assert.deepEqual(reloaded.territories.map(s=>s.value),game.territories.map(s=>s.value));
  assert.deepEqual(reloaded.credits,game.credits,'earned credits remain intact on migration');
 });
}
test('legacy 16-bastion campaign keeps original revenue distribution',()=>{
 const game=new Simulation(2026,2),layout=mapLayout(2),count=game.territories.length;
 for(let id=0;id<count;id++){
  const mirrored=Math.min(id,count-1-id),value=mirrored%7===0?2:mirrored%3===0?1:0;
  assert.equal(game.territories[id].value,value);
  assert.equal(game.territories[id].income,layout.incomes[value]);
 }
 assert.equal(RULES.incomeInterval,10);
});
