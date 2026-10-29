import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapLayout,mapWorldSize,CAMPAIGN_SIZES} from '../dist/src/reborn/config.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';

const pairs=[
 {old:3,now:7,count:4,oldSize:3000,size:3240},
 {old:4,now:8,count:8,oldSize:3300,size:3564},
 {old:5,now:9,count:12,oldSize:3600,size:3888},
 {old:6,now:10,count:16,oldSize:3762,size:4064}
];

test('maps: each new 4/8/12/16 Bastion variant has at least 8% longer edges and proportionate clearance',()=>{
 assert.deepEqual(Object.values(CAMPAIGN_SIZES),[11,12,13,14]);
 for(const {old,now,count,oldSize,size} of pairs){
  assert.equal(mapWorldSize(old),oldSize,'historic playable map size must be frozen');
  assert.equal(mapWorldSize(now),size);
  assert.ok(size/oldSize>=1.079,'map edge extension must be >= 7.9 percent');
  const oldLayout=mapLayout(old),layout=mapLayout(now);
  assert.equal(layout.rows*layout.columns,count);
  assert.equal(layout.headquarters.length,2);
  assert.ok(layout.spacing/oldLayout.spacing>=1.07,'bastion spacing should grow proportionately');
 }
});

test('maps: all new geometry versions generate stable mirrored bases and keep safe traversable starts',()=>{
 for(const {now,count,size} of pairs){
  for(const seed of [2026,2027,2042]){
   const a=generateMap(seed,now),b=generateMap(seed,now);
   assert.deepEqual(a.sites,b.sites,'same seed creates exact same bastion layout');
   assert.equal(a.sites.length,count);
   for(const p of a.sites)assert.ok(p.x>200&&p.y>200&&p.x<size-200&&p.y<size-200);
   for(let i=0;i<count;i++){
    const peer=a.sites[count-1-i];
    assert.ok(Math.abs(a.sites[i].x+peer.x-size)<.0001);
    assert.ok(Math.abs(a.sites[i].y+peer.y-size)<.0001);
   }
   const game=new Simulation(seed,now);
   assert.equal(game.world.size,size);
   assert.ok(game.bases.every(base=>game.world.walkable(base)));
   const saved=game.save(),reloaded=Simulation.load(saved);
   assert.equal(reloaded.world.size,size);
   assert.deepEqual(reloaded.territories.map(t=>t.point),game.territories.map(t=>t.point));
  }
 }
});

test('maps: saves with positions past historic global world bound validate on extra-large map',()=>{
 const game=new Simulation(2026,10);
 const unit=game.units.find(u=>u.owner===0);
 assert.ok(unit);
 const distant=game.world.nearest({x:3900,y:3900},game.obstacles());
 assert.ok(distant,'new world offers walkable ground past the historic 3762 bound');
 unit.x=distant.x;unit.y=distant.y;
 const loaded=Simulation.load(game.save());
 assert.ok(loaded.units.some(u=>u.id===unit.id&&u.x>3762&&u.y>3762));
});
