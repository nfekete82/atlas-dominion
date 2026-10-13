import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,landNeighbors} from '../dist/src/engine/game.js';

test('opening RTS commanders prefer neutral frontier over hostile war objectives',()=>{
  const g=new Game(20261013,6,'DE','balanced',true);
  for(let tick=0;tick<40;tick++){
    g.step();
    for(const faction of g.factions){
      if(!faction.ai||!faction.alive)continue;
      const neutralFront=g.owner.some((owner,index)=>
        owner===faction.id&&landNeighbors(index).some(n=>g.owner[n]===-1));
      if(!neutralFront)continue;
      for(const squad of g.squads.filter(u=>u.owner===faction.id)){
        if(squad.campaignTarget==null)continue;
        assert.ok(squad.campaignOwner===-1||g.owner[squad.campaignTarget]===-1,
          'initial offensives should not deliberately target a foreign nation with neutral land accessible');
      }
    }
  }
});
