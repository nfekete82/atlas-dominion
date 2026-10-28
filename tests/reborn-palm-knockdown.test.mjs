import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {PalmGrove,PALM_ART_SCALE} from '../dist/src/reborn/palm-grove.js';
import {paintGroundDetails} from '../dist/src/reborn/battlefield-atmosphere.js';

const palm=(x,y,variant=.5)=>({kind:'palm',x,y,radius:31,rotation:1.14,variant});
const fakeCanvas=()=>({
 draws:0,
 save(){},restore(){},translate(){},rotate(){},beginPath(){},ellipse(){},fill(){},
 stroke(){},moveTo(){},lineTo(){},drawImage(){this.draws++;}
});

test('palms: art is scaled down, separate from permanently baked terrain',()=>{
 assert.equal(PALM_ART_SCALE,.76);
 const ctx=fakeCanvas();
 paintGroundDetails(ctx,[palm(2000,2200)],{palm:{},rocks:{},crater:{}});
 assert.equal(ctx.draws,0,'a fixed terrain canvas can no longer permanently contain upright palms');
});

test('palms: the same map has deterministic standing and pre-fallen trees',()=>{
 const game=new Simulation(),grove=new PalmGrove(),details=[palm(2000,2100,.01),palm(2100,2100,.5)];
 grove.reset(details,game);
 assert.equal(grove.count,2);
 assert.equal(grove.initiallyFallenCount,1);
 assert.equal(grove.fallenCount,1);
 const ctx=fakeCanvas(),img={width:640,height:640};
 grove.draw(ctx,img,game.time,{left:0,right:100,top:0,bottom:100});
 assert.equal(ctx.draws,0,'off-camera decorations must be culled');
 grove.draw(ctx,img,game.time,{left:1950,right:2150,top:2000,bottom:2200});
 assert.equal(ctx.draws,2,'standing and fallen palms must both draw');
 grove.reset(details,game);
 assert.equal(grove.initiallyFallenCount,1,'fallen landscape is deterministic per map seed');
});

test('palms: ground vehicles knock trees over, leaving them on the ground permanently in a match',()=>{
 const game=new Simulation(),grove=new PalmGrove();
 game.units=[];
 const rover=game.spawn(0,{x:1930,y:2100},'rover');
 const tree=palm(2000,2100,.8);
 grove.reset([tree],game);
 const before=game.save();
 assert.equal(grove.fallenCount,0);
 rover.x=2080;game.time+=.20;
 const unchanged=game.save();
 grove.update(game);
 assert.equal(grove.fallenCount,1,'vehicle path must hit a palm even across large simulation steps');
 assert.deepEqual(game.save(),unchanged,'decorative knockdown must not affect the simulation');
 game.time+=1000;grove.update(game);
 assert.equal(grove.fallenCount,1,'knocked down trees must remain on the ground');
 assert.equal(before.units.length,unchanged.units.length);
 const canvas=fakeCanvas();
 grove.draw(canvas,{width:640,height:640},game.time);
 assert.equal(canvas.draws,1,'fallen silhouette must be rendered, not the upright tree');
});

test('palms: walking infantry, flying aircraft and teleports never knock down a tree',()=>{
 const game=new Simulation(),grove=new PalmGrove();
 game.units=[];
 const infantry=game.spawn(0,{x:1930,y:2100},'infantry');
 const scout=game.spawn(0,{x:1930,y:2100},'scout');
 const rover=game.spawn(0,{x:1300,y:1700},'rover');
 grove.reset([palm(2000,2100,.6)],game);
 infantry.x+=150;scout.x+=150;rover.x=2050;rover.y=2100;game.time+=.2;
 grove.update(game);
 assert.equal(grove.fallenCount,0,'only continuous ground vehicle movement can flatten foliage');
});

test('palms: a vehicle parked on a tree does not topple it until it moves',()=>{
 const game=new Simulation(),grove=new PalmGrove();game.units=[];
 const rover=game.spawn(0,{x:2000,y:2100},'rover');
 grove.reset([palm(2000,2100,.6)],game);
 game.time+=.1;grove.update(game);
 assert.equal(grove.fallenCount,0);
 rover.x+=15;game.time+=.1;grove.update(game);
 assert.equal(grove.fallenCount,1);
});
