import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,landNeighbors} from '../dist/src/engine/game.js';

test('larger real RTS formations occupy more connected neutral territory per tick',()=>{
  const setup=()=>new Game(10641,1,'DE','balanced',true);
  const small=setup(),large=setup();
  // Select a real frontier with room for a four-ring advance.
  const potential=(g,start)=>{
    const seen=new Set([start]),queue=[[start,0]];
    for(let head=0;head<queue.length;head++){
      const [cell,depth]=queue[head];
      if(depth>=4)continue;
      for(const tile of landNeighbors(cell)){
        if(seen.has(tile)||g.owner[tile]!==-1)continue;
        seen.add(tile);queue.push([tile,depth+1]);
      }
    }
    return seen.size-1;
  };
  let start=-1;
  for(let i=0;i<small.owner.length;i++){
    if(small.owner[i]===0&&potential(small,i)>=15){start=i;break;}
  }
  assert.ok(potential(small,start)>=15,'test needs accessible neutral territory');
  small.squads.push({id:106410,owner:0,index:start,troops:24,destination:null,attackTarget:null});
  large.squads.push({id:106410,owner:0,index:start,troops:360,destination:null,attackTarget:null});
  const initial=small.owner.filter(id=>id===0).length;
  small.step();large.step();
  const smallGain=small.owner.filter(id=>id===0).length-initial;
  const largeGain=large.owner.filter(id=>id===0).length-initial;
  assert.ok(largeGain>smallGain,`larger formation should gain more land: ${largeGain} vs ${smallGain}`);
  assert.ok(largeGain<=30,'large squads still obey the occupation budget');
  assert.ok(large.squads.every(u=>large.owner[u.index]===u.owner));
});
