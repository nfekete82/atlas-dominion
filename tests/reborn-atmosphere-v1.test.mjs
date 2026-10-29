import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {palmCrownSway,PALM_ART_SCALE,PalmGrove} from '../dist/src/reborn/palm-grove.js';
import {DesertAtmosphere,ambientDust,bastionFlagPhase} from '../dist/src/reborn/desert-atmosphere.js';
import {ambientActivity} from '../dist/src/reborn/audio.js';
import {readFileSync} from 'node:fs';
import {BattlefieldEffects} from '../dist/src/reborn/battlefield-atmosphere.js';

test('Atmosphere 1.0: palm crowns sway slowly, trunks never gain gameplay state and reduced-motion freezes them',()=>{
 assert.equal(PALM_ART_SCALE,1.34);
 for(const t of [0,1,4,25,180,3600]){
  const a=palmCrownSway(t,500,700,.34);
  assert.equal(a,palmCrownSway(t,500,700,.34));
  assert.ok(Math.abs(a)<.035);
  assert.equal(palmCrownSway(t,500,700,.34,true),0);
 }
 assert.equal(palmCrownSway(NaN,500,700),0);
 assert.notEqual(palmCrownSway(10,500,700),palmCrownSway(16,500,700));
 const p=new PalmGrove();
 assert.equal(p.fallenCount,0);
 assert.equal(p.initiallyFallenCount,0);
});
test('Atmosphere 1.0: dust whirls and flags are deterministic, reduced-motion safe, never alter a save',()=>{
 const g=new Simulation(2026,14),save=g.save();
 for(const t of [0,1,18,44,900]){
  const a=ambientDust(400,800,t,g.seed);
  assert.deepEqual(a,ambientDust(400,800,t,g.seed));
  if(a){assert.ok(a.radius>0&&a.radius<=24);assert.ok(a.opacity>0&&a.opacity<=.19);}
  assert.equal(ambientDust(400,800,t,g.seed,true),null);
  assert.equal(bastionFlagPhase(t,3,true),0);
 }
 const fx=new DesertAtmosphere();
 const view={left:0,right:900,top:0,bottom:900};
 const paint=[];const c={
  save(){},restore(){},translate(){},rotate(){},beginPath(){},ellipse(){paint.push(1);},
  fill(){},stroke(){},moveTo(){},bezierCurveTo(){},quadraticCurveTo(){},
  lineTo(){},closePath(){},createLinearGradient(){return {addColorStop(){}};}
 };
 fx.drawSand(c,g,view,true);fx.drawHeat(c,g,view,true);
 assert.equal(paint.length,0,'reduced motion adds no moving decorations');
 const owned=g.territories.find(t=>t.owner===0);
 fx.drawBastion(c,owned,g.time,true);
 assert.ok(paint.length>0,'owned bastion has a flag and a status light');
 assert.deepEqual(g.save(),save,'ambient rendering cannot change authoritative simulation');
});
test('Atmosphere 1.0: sound proximity honors visible vehicles only, never hidden enemies',()=>{
 const vehicle=(owner,x,y,moving)=>({owner,x,y,moving,hp:280,kind:'rover'});
 const generator=(owner,x,y)=>({owner,x,y,hp:600,kind:'generator',buildRemaining:0});
 const g={units:[vehicle(0,100,100,true),vehicle(1,120,100,true),vehicle(0,4000,4000,true)],
  bases:[generator(0,150,100),generator(1,3000,3000)]};
 const viewer={x:100,y:100};
 const onlyFriend=p=>p.owner===0;
 const a=ambientActivity(g,viewer,onlyFriend);
 const b=ambientActivity(g,viewer,onlyFriend);
 assert.deepEqual(a,b);
 assert.ok(a.motors>.9&&a.motors<1.1);
 assert.ok(a.generator>.8);
 const hidden=ambientActivity(g,viewer,()=>false);
 assert.deepEqual(hidden,{motors:0,generator:0});
 assert.deepEqual(ambientActivity({...g,units:[],bases:[]},viewer,()=>true),{motors:0,generator:0});
});
test('Atmosphere 1.0: renderer hooks coexist with built-in sweep, dynamic tracks and no sandstorms',()=>{
 const renderer=readFileSync('src/reborn/renderer.ts','utf8');
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(renderer,/this\.atmosphere\.drawSand/);
 assert.match(renderer,/this\.atmosphere\.drawHeat/);
 assert.match(renderer,/this\.atmosphere\.drawBastion/);
 assert.match(renderer,/this\.battlefield\.drawTracks/);
 assert.match(renderer,/this\.structures\.drawActivity/);
 assert.doesNotMatch(renderer,/paintDesertInfrastructure/);
 assert.match(audio,/this\.motorGain.*setTargetAtTime/);
 assert.match(audio,/this\.generatorGain.*setTargetAtTime/);
 const game=new Simulation(2026,14);
 assert.equal(game.weather.enabled,false);
});

test('Atmosphere 1.0: destroyed visible vehicles leave capped battlefield scars without save changes',()=>{
 const g=new Simulation(2026,11),rover=g.spawn(0,{x:1900,y:2100},'rover'),fx=new BattlefieldEffects();
 fx.reset(g);
 g.units=g.units.filter(u=>u.id!==rover.id);
 const before=g.save();g.time+=.05;
 fx.update(g,()=>true);
 assert.ok(fx.markCount>=1,'vehicle wreck leaves a permanent scorch on the sand');
 assert.ok(fx.smokeCount>=1);
 assert.deepEqual(g.save(),{...before,time:g.time},'visual wreck logic does not change campaign state');
 fx.reset(g);
 assert.equal(fx.markCount,0,'new match never inherits old wreck marks');
});
