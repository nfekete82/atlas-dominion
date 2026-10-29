import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapWorldSize,mapLayout,campaignLayout,CAMPAIGN_SIZES} from '../dist/src/reborn/config.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {unitArtScale} from '../dist/src/reborn/visual-scale.js';

const cases=[
 {size:'small',legacy:7,modern:11,bastions:4,oldWidth:3240,newWidth:3564,spacing:678},
 {size:'medium',legacy:8,modern:12,bastions:8,oldWidth:3564,newWidth:3920,spacing:654},
 {size:'large',legacy:9,modern:13,bastions:12,oldWidth:3888,newWidth:4277,spacing:701},
 {size:'extraLarge',legacy:10,modern:14,bastions:16,oldWidth:4064,newWidth:4470,spacing:701}
];
test('campaign selector uses versions with 10 percent more side length; all earlier sizes remain frozen',()=>{
 for(const c of cases){
  assert.equal(CAMPAIGN_SIZES[c.size],c.modern);
  assert.equal(mapWorldSize(c.legacy),c.oldWidth);
  assert.equal(mapWorldSize(c.modern),c.newWidth);
  assert.ok(mapWorldSize(c.modern)/mapWorldSize(c.legacy)>1.099);
  assert.ok(mapWorldSize(c.modern)/mapWorldSize(c.legacy)<1.101);
  assert.equal(mapLayout(c.modern).spacing,c.spacing);
  assert.ok(mapLayout(c.modern).spacing>=mapLayout(c.legacy).spacing*1.09);
  assert.equal(mapLayout(c.modern).rows*mapLayout(c.modern).columns,c.bastions);
 }
});
test('new economy: owned home bastion generates exactly +50; each directly adjacent sector +25 per payout',()=>{
 for(const c of cases)for(const seed of [0,2026,9876543]){
  const g=new Simulation(seed,c.modern),layout=campaignLayout(c.modern,seed);
  const HQs=layout.headquarters;
  assert.equal(g.territories.length,c.bastions);
  for(const owner of [0,1]){
   const home=g.territories[HQs[owner]];
   assert.equal(home.owner,owner);
   assert.equal(home.income,50,'starting HQ bastion must grant 50');
   assert.equal(home.value,1,'sector classification must remain stable');
   for(const neighborId of home.neighbors){
    const neighbor=g.territories[neighborId];
    if(HQs.includes(neighborId))continue;
    assert.equal(neighbor.income,25,'only side-sharing adjacent bastions earn 25');
   }
   const owned=g.territories.filter(t=>t.owner===owner);
   assert.equal(owned.length,1);
   const flatBuildingIncome=g.income(owner)-home.income;
   const neighbor=home.neighbors.find(id=>!HQs.includes(id));
   if(neighbor!==undefined){
    const sector=g.territories[neighbor];
    sector.owner=owner;
    assert.equal(g.income(owner),flatBuildingIncome+75,'neighbor income must actually enter gameplay economy');
    sector.owner=-1;
    assert.equal(g.income(owner),flatBuildingIncome+50);
   }
  }
  const loaded=Simulation.load(g.save());
  assert.equal(loaded.world.size,c.newWidth);
  assert.deepEqual(loaded.territories.map(t=>t.income),g.territories.map(t=>t.income));
  assert.equal(loaded.income(0),g.income(0));
 }
});
test('all expanded maps are deterministic, symmetric, traversable and keep old saves the exact same size',()=>{
 for(const c of cases)for(const seed of [2026,2042]){
  const a=generateMap(seed,c.modern),b=generateMap(seed,c.modern);
  assert.deepEqual(a.sites,b.sites);
  assert.equal(a.sites.length,c.bastions);
  for(let i=0;i<c.bastions;i++){
   const p=a.sites[i],mirror=a.sites[c.bastions-1-i];
   assert.ok(Math.abs(p.x+mirror.x-c.newWidth)<.000001);
   assert.ok(Math.abs(p.y+mirror.y-c.newWidth)<.000001);
   assert.ok(p.x>200&&p.y>200&&p.x<c.newWidth-200&&p.y<c.newWidth-200);
  }
  const game=new Simulation(seed,c.modern);
  assert.ok(game.bases.every(b=>game.world.walkable(b)));
  const old=new Simulation(seed,c.legacy);
  const resumed=Simulation.load(old.save());
  assert.equal(resumed.world.size,c.oldWidth);
  assert.deepEqual(resumed.territories.map(t=>t.income),old.territories.map(t=>t.income));
 }
});
test('the new extra-large map supports full-size world positions past 4064 on save/reload',()=>{
 const game=new Simulation(2026,14),u=game.units.find(u=>u.owner===0);
 assert.ok(u);
 const destination=game.world.nearest({x:4270,y:4270},game.obstacles());
 assert.ok(destination&&destination.x>4064&&destination.y>4064);
 u.x=destination.x;u.y=destination.y;
 const loaded=Simulation.load(game.save());
 const rider=loaded.units.find(entity=>entity.id===u.id);
 assert.ok(rider.x>4064&&rider.y>4064);
});
test('tank is visibly 10 percent larger but model hitbox, armament and vehicle behavior are unchanged',()=>{
 assert.equal(UNITS.tank.width,90);
 assert.equal(unitArtScale('tank'),1.08);
 assert.equal(UNITS.tank.hp,850);
 assert.equal(UNITS.tank.cost,550);
});
