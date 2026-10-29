import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {PalmGrove,PALM_ART_SCALE} from '../dist/src/reborn/palm-grove.js';
import {paintGroundDetails} from '../dist/src/reborn/battlefield-atmosphere.js';

const palm=(x,y,variant=.5)=>({kind:'palm',x,y,radius:31,rotation:1.14,variant});
const fakeCanvas=()=>({
 draws:0,
 save(){},restore(){},translate(){},rotate(){},
 drawImage(){this.draws++;}
});

test('palms: enlarged high-quality atlas remains a separate rendering layer',()=>{
 assert.ok(PALM_ART_SCALE>=1.3&&PALM_ART_SCALE<=1.5);
 const ctx=fakeCanvas();
 paintGroundDetails(ctx,[palm(2000,2200)],{palm:{},rocks:{},crater:{}});
 assert.equal(ctx.draws,0);
});

test('palms: naturally fallen and knocked-down silhouettes are retired',()=>{
 const game=new Simulation(),grove=new PalmGrove(),details=[
  palm(2000,2100,.01),palm(2100,2100,.5),palm(2200,2100,.99)];
 const before=game.save();grove.reset(details,game);
 assert.equal(grove.count,3);
 assert.equal(grove.fallenCount,0);
 assert.equal(grove.initiallyFallenCount,0);
 const ctx=fakeCanvas(),img={width:640,height:640};
 grove.draw(ctx,img,game.time,{left:0,right:100,top:0,bottom:100});
 assert.equal(ctx.draws,0,'off-camera palms should be culled');
 grove.draw(ctx,img,game.time,{left:1900,right:2300,top:1950,bottom:2250});
 assert.equal(ctx.draws,3,'every palm must remain upright regardless of seed variant');
 assert.deepEqual(game.save(),before,'decorations do not alter saved simulation');
});

test('palms: even vehicles crossing a tree never render fallen crowns',()=>{
 const game=new Simulation(),grove=new PalmGrove();
 game.units=[];const rover=game.spawn(0,{x:1930,y:2100},'rover');
 grove.reset([palm(2000,2100,.5)],game);
 const before=game.save();
 rover.x=2080;game.time+=.2;grove.update(game);
 assert.equal(grove.fallenCount,0);assert.equal(grove.initiallyFallenCount,0);
 const c=fakeCanvas();grove.draw(c,{width:640,height:640},game.time);
 assert.equal(c.draws,1,'standing silhouette only');
 assert.equal(game.save().units[0].x,2080,'vehicle movement remains unchanged');
 assert.equal(before.units.length,game.save().units.length);
});
