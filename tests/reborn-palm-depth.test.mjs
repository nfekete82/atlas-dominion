import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {PalmGrove} from '../dist/src/reborn/palm-grove.js';

const renderer=readFileSync('src/reborn/renderer.ts','utf8');
const atlas=JSON.parse(readFileSync('src/assets/reborn/props-3d/props.json','utf8'));

test('palm world pivot remains at trunk base, not the crown',()=>{
 const palm=atlas.props['palm-tree'];
 assert.ok(palm.pivot[1]>palm.frames[0].h*.85,'physical palm foot must be near the bottom of the sprite');
 assert.ok(palm.pivot[1]<palm.frames[0].h);
});

test('depth renderer draws visible foliage in the same sorted scene as moving units',()=>{
 const fog=renderer.indexOf('c.drawImage(this.fog,0,0,s,s)');
 const sort=renderer.indexOf('entities.sort((a,b)=>a.y-b.y)');
 const palm=renderer.indexOf('this.palms.drawOne(c,e.palm)');
 const infantry=renderer.indexOf('this.drawUnit(e.unit)',sort);
 assert.ok(fog>=0&&sort>fog&&palm>sort&&infantry>sort,
  'the foreground foliage and infantry must share one post-fog depth pass');
 assert.match(renderer,/entities\.push\(\{y:d\.y\+\.001,palm:d\}\)/);
 assert.match(renderer,/for\(const d of nearbyPalms\)if\(!g\.canSee\(0,d\)\)this\.palms\.drawOne\(c,d\)/,
  'unseen trees must still render under the original fog veil');
 assert.doesNotMatch(renderer,/this\.palms\.draw\(c,g\.time,effectsView/,
  'all visible palms must no longer be flattened into the terrain');
});

test('single-tree depth rendering does not move or hide the physical palm',()=>{
 const game=new Simulation(2026,11);game.bases=[];game.territories=[];game.units=[];game.world.blocked.fill(0);
 const detail={x:1500,y:1700,kind:'palm',radius:30,rotation:0,variant:.25};
 const drawn=[],ctx={save(){},restore(){},translate(){},scale(){}},grove=new PalmGrove({
  draw(_ctx,kind,position,width,variant){drawn.push({kind,x:position.x,y:position.y,width,variant});}
 });
 grove.reset([detail],game);
 const first=grove.visibleTrees({left:1000,right:2000,top:1200,bottom:2100});
 assert.ok(first.length>=1&&first.length<=3,'a seed may generate a single palm or a small group');
 assert.equal(first[0].x,detail.x);assert.equal(first[0].y,detail.y);
 game.spawn(0,{x:1500,y:1600},'infantry');
 assert.deepEqual(grove.visibleTrees().map(p=>({x:p.x,y:p.y})),first.map(p=>({x:p.x,y:p.y})),'troops approaching the crown never remove or shift any group member');
 for(const palm of first)grove.drawOne(ctx,palm);
 assert.deepEqual(drawn,first.map(p=>({kind:'palm-tree',x:p.x,y:p.y,width:p.radius*3.3,variant:Math.floor(p.variant*4)})));
});
