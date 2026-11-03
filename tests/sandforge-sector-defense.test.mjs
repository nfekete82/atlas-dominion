import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {threatenedOwnedSectors,sectorThreatScore} from '../dist/src/reborn/sector-defense.js';

test('income sectors: visible intruder threatening owned sector without a building triggers response',()=>{
 const g=new Simulation(2026,11);
 const owned=g.territories.find(t=>t.owner===-1);
 assert.ok(owned,'fixture has a neutral outpost to simulate capture');
 owned.owner=1; // A legally captured outpost with no building on it.
 const blue={id:88,x:owned.point.x+85,y:owned.point.y,hp:100};
 const threats=threatenedOwnedSectors(g.territories,[blue],1);
 assert.ok(threats.some(t=>t.sector===owned.id&&t.enemy===blue.id));
 assert.equal(threatenedOwnedSectors(g.territories,[{...blue,hp:0}],1).length,0);
 assert.equal(threatenedOwnedSectors(g.territories,[{...blue,x:blue.x+1500}],1).length,0);
});
test('capture urgency and home emergency are deterministic',()=>{
 const home={x:500,y:500},outpost={x:1000,y:1500};
 const enemy={id:1,x:outpost.x+50,y:outpost.y,hp:100};
 const far={id:2,x:home.x+250,y:home.y,hp:100};
 const threats=[{sector:2,enemy:1,at:outpost,income:25,distance:50}];
 assert.ok(sectorThreatScore(enemy,threats,home)<sectorThreatScore({id:3,x:1500,y:1500,hp:100},threats,home));
 assert.ok(sectorThreatScore(far,threats,home)<sectorThreatScore(enemy,threats,home),
  'an enemy near HQ remains the top priority');
});
test('unobserved enemies cannot affect sector-defense decision',()=>{
 const g=new Simulation(2026,11);
 g.tactical.sectorDefenseMode='responsive';
 const enemies=g.units.filter(u=>u.owner===0&&g.canSee(1,u));
 const threats=threatenedOwnedSectors(g.territories,enemies,1);
 assert.ok(threats.every(t=>enemies.some(e=>e.id===t.enemy)));
});
test('classic policy is default and is never serialized into a saved match',()=>{
 const g=new Simulation(2026,11);
 assert.equal(g.tactical.sectorDefenseMode,'classic');
 g.tactical.sectorDefenseMode='responsive';
 assert.equal(g.save().ai?.sectorDefenseMode,undefined);
 assert.equal(Simulation.load(g.save()).tactical.sectorDefenseMode,'classic');
});
