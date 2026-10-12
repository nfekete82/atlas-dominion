import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/src/engine/game.js';
import {cityLevelStyle} from '../dist/src/render/building-markers.js';

test('level styling changes from bronze through silver to gold',()=>{
  assert.equal(cityLevelStyle(0).fill,cityLevelStyle(2).fill);
  assert.notEqual(cityLevelStyle(2).fill,cityLevelStyle(3).fill);
  assert.notEqual(cityLevelStyle(4).fill,cityLevelStyle(5).fill);
});

test('AI develops separated towns and upgrades at least one existing town',()=>{
  const g=new Game(816,1,'DE','balanced');
  // Give AI adequate real funds to develop repeatedly.
  g.factions[1].money=30000;
  for(let i=0;i<850 && g.status==='playing';i++)g.step();
  const sites=[];
  for(let i=0;i<g.buildings.length;i++)if(g.owner[i]===1&&g.buildings[i]===1)sites.push(i);
  assert.ok(sites.length>0,'AI should build a settlement');
  assert.ok(sites.some(i=>g.cityUpgrades[i]>0),'AI should upgrade built cities');
  for(let a=0;a<sites.length;a++)for(let b=a+1;b<sites.length;b++){
    const dx=sites[a]%480-sites[b]%480;
    const dy=Math.floor(sites[a]/480)-Math.floor(sites[b]/480);
    assert.ok(dx*dx+dy*dy>=100,'AI settlements must not form crowded city grids');
  }
});
