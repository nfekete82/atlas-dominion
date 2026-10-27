import {test} from 'node:test';
import assert from 'node:assert/strict';
import {revealVisibleRockSurface} from '../dist/src/reborn/cliff-fog.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const visual=(visible,explored)=>{
 const rgba=new Uint8ClampedArray(visible.length*4);
 for(let i=0;i<visible.length;i++)rgba[i*4+3]=visible[i]?0:explored[i]?177:255;
 return rgba;
};
const alphas=rgba=>Array.from({length:rgba.length/4},(_,i)=>rgba[i*4+3]);

test('rock fog: a seen front face exposes the same explored cliff, not ground behind it',()=>{
 const seen=Uint8Array.from([0,1,0,0,0,0,0,0]);
 const known=Uint8Array.from([1,1,1,1,1,1,0,0]);
 const ids=Int16Array.from([-1,0,0,0,-1,1,-1,-1]);
 const cells=[[1,2,3],[5]];
 const rgba=visual(seen,known);
 const oldSeen=seen.slice(),oldKnown=known.slice();
 revealVisibleRockSurface(rgba,seen,known,ids,cells);
 assert.deepEqual(alphas(rgba),[177,0,24,24,177,177,255,255],
  'brighten only visible rock object, never nearby terrain or a different rock');
 assert.deepEqual(seen,oldSeen,'do not grant line-of-sight or reveal enemy units');
 assert.deepEqual(known,oldKnown,'do not explore unknown terrain');
});

test('rock fog: unexplored rock silhouette never gets revealed from a neighbouring visible cell',()=>{
 const seen=Uint8Array.from([1,0,0,0]);
 const known=Uint8Array.from([1,1,0,1]);
 const ids=Int16Array.from([0,0,0,-1]);
 const rgba=visual(seen,known);
 revealVisibleRockSurface(rgba,seen,known,ids,[[0,1,2]]);
 assert.deepEqual(alphas(rgba),[0,24,255,177]);
});

test('rock fog: previously explored cliffs darken again when no face is currently visible',()=>{
 const seen=new Uint8Array(5),known=Uint8Array.from([1,1,1,1,1]);
 const ids=Int16Array.from([0,0,1,1,-1]);
 const rgba=visual(seen,known);
 revealVisibleRockSurface(rgba,seen,known,ids,[[0,1],[2,3]]);
 assert.deepEqual(alphas(rgba),[177,177,177,177,177]);
});

test('rock fog: untouched game visibility still blocks the terrain beyond a live cliff',()=>{
 const g=new Simulation(2026,3),world=g.world;
 assert.ok(world.generated?.mesas.length,'campaign contains sandstone mesas');
 const id=world.cliffCells.findIndex(c=>c.length>0);
 assert.ok(id>=0);
 const cells=world.cliffCells[id];
 const visualFog=visual(g.visible[0],g.explored[0]);
 const visibilityBefore=g.visible[0].slice(),exploredBefore=g.explored[0].slice();
 // A test spotlight knows one surveyed face; never touch the simulation's mask.
 const seen=visibilityBefore.slice(),known=exploredBefore.slice();
 seen[cells[0]]=1;
 for(const cell of cells)known[cell]=1;
 revealVisibleRockSurface(visualFog,seen,known,world.cliffIds,world.cliffCells);
 assert.deepEqual(g.visible[0],visibilityBefore);
 assert.deepEqual(g.explored[0],exploredBefore);
 for(let i=0;i<world.cliffIds.length;i++)
  if(world.cliffIds[i]!==id&&visibilityBefore[i]===0)
   assert.equal(visualFog[i*4+3],exploredBefore[i]?177:255,
    'no unrelated terrain outside the rock is made visible');
});
