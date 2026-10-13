import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRTSCampaignStep} from '../dist/src/engine/rts-path.js';

function grid(width,height){
  return Array.from({length:width*height},(_,tile)=>[
    ...(tile%width>0?[tile-1]:[]),...(tile%width<width-1?[tile+1]:[]),
    ...(tile>=width?[tile-width]:[]),...(tile<(height-1)*width?[tile+width]:[])
  ]);
}
function shortest(start,goal,neighbors,open){
  const distance=new Map([[start,0]]),queue=[start];
  for(let head=0;head<queue.length;head++){
    const tile=queue[head];
    if(tile===goal)return distance.get(tile);
    for(const next of neighbors[tile])if(open(next)&&!distance.has(next)){
      distance.set(next,distance.get(tile)+1);queue.push(next);
    }
  }
  return Infinity;
}

test('campaign routing matches shortest legal paths across deterministic obstacle fields',()=>{
  const width=13,neighbors=grid(width,11),goal=neighbors.length-1;
  for(let seed=1;seed<=40;seed++){
    let rng=seed;
    const blocked=neighbors.map(()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%5===0;});
    blocked[0]=false;blocked[goal]=false;
    const open=tile=>!blocked[tile];
    const expected=shortest(0,goal,neighbors,open);
    let current=0,steps=0;
    while(current!==goal){
      const next=nextRTSCampaignStep(current,goal,width,neighbors,open);
      assert.equal(next,nextRTSCampaignStep(current,goal,width,neighbors,open));
      if(next===null){assert.equal(expected,Infinity);break;}
      assert.ok(neighbors[current].includes(next)&&open(next));
      const remaining=shortest(current,goal,neighbors,open);
      assert.equal(next,neighbors[current].find(tile=>open(tile)&&
        shortest(tile,goal,neighbors,open)===remaining-1),
      'equally short routes must retain the existing breadth-first neighbor preference');
      current=next;
      assert.ok(++steps<neighbors.length,'routing must never oscillate');
    }
    if(current===goal)assert.equal(steps,expected);
  }
});

test('campaign search explores toward the goal instead of flooding a whole open map',()=>{
  const width=160,neighbors=grid(width,100);
  let inspected=0;
  const start=0,goal=neighbors.length-1;
  const next=nextRTSCampaignStep(start,goal,width,neighbors,()=>{inspected++;return true;});
  assert.ok(neighbors[start].includes(next));
  assert.ok(inspected<1500,`expected a narrow search, inspected ${inspected} cells`);
  assert.equal(nextRTSCampaignStep(start,start,width,neighbors,()=>true),start);
  assert.equal(nextRTSCampaignStep(start,goal,width,neighbors,()=>false),null);
});
