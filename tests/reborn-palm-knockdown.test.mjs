import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {PalmGrove,PALM_ART_SCALE} from '../dist/src/reborn/palm-grove.js';
import {paintGroundDetails} from '../dist/src/reborn/battlefield-atmosphere.js';
const palm=(x,y,variant=.5)=>({kind:'palm',x,y,radius:31,rotation:1.14,variant});
const fakeCanvas=()=>({draws:0,save(){},restore(){},drawImage(){this.draws++;}});
const fakeAtlas={draw(c){c.drawImage();}};
function emptyGame(){const g=new Simulation();g.bases=[];g.units=[];g.territories=[];g.world.blocked.fill(0);return g;}
test('palms: GLB atlas remains separate from static rocks and craters',()=>{
 assert.equal(PALM_ART_SCALE,1.34);
 const c=fakeCanvas();paintGroundDetails(c,[palm(2000,2200),{...palm(2500,2200),kind:'skull'}],{rocks:{},crater:{}});
 assert.equal(c.draws,0);
});
test('palms: all seed variants stay upright, use mesh sprites and respect camera culling',()=>{
 const g=emptyGame(),grove=new PalmGrove(fakeAtlas),details=[palm(2000,2100,.01),palm(2100,2100,.5),palm(2200,2100,.99)];
 const before=g.save();grove.reset(details,g);
 assert.equal(grove.count,3);assert.equal(grove.fallenCount,0);assert.equal(grove.initiallyFallenCount,0);
 const c=fakeCanvas();grove.draw(c,g.time,{left:0,right:100,top:0,bottom:100});assert.equal(c.draws,0);
 grove.draw(c,g.time,{left:1900,right:2300,top:1950,bottom:2250});assert.equal(c.draws,3);
 assert.deepEqual(g.save(),before);
});
test('palms: occupied tree slots hide without collisions, falling silhouettes or movement changes',()=>{
 const g=emptyGame(),grove=new PalmGrove(fakeAtlas),rover=g.spawn(0,{x:2000,y:2100},'rover');
 grove.reset([palm(2000,2100)],g);
 let c=fakeCanvas();grove.draw(c,g.time);assert.equal(c.draws,0,'unit has visual priority');
 rover.x=2200;g.time+=.2;grove.update(g);
 assert.equal(grove.fallenCount,0);c=fakeCanvas();grove.draw(c,g.time);assert.equal(c.draws,1,'upright palm returns after vehicle passes');
 assert.equal(rover.x,2200);
});
