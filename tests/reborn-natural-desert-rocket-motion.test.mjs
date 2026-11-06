import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rocketChassisMotion} from '../dist/src/reborn/unit-presentation.js';
import {unitArtScale} from '../dist/src/reborn/visual-scale.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {SpriteAnimator} from '../dist/src/reborn/sprite-animator.js';

const text=path=>readFileSync(path,'utf8');
test('desert: no artificial bastion-to-bastion road painter in world or minimap; real track renderer stays intact',()=>{
 const renderer=text('src/reborn/renderer.ts');
 assert.doesNotMatch(renderer,/paintDesertInfrastructure|createDesertInfrastructure|from '.\/desert-infrastructure/);
 assert.match(renderer,/this\.prepareTerrain\(\)/);
 assert.match(renderer,/this\.groundDetails=createGroundDetails/);
 assert.match(renderer,/paintGroundDetails\(/);
 assert.match(renderer,/this\.battlefield\.drawTracks\(/,'real vehicle tracks still drawn');
 assert.match(renderer,/this\.battlefield\.drawMarks\(/,'combat marks still drawn');
 assert.match(renderer,/this\.miniTerrain\.getContext/,'minimap still generated from clean terrain');
});
test('rocket: larger on screen without altering hitbox, vehicle combat, price or armor',()=>{
 assert.equal(unitArtScale('artillery'),1.22);
 assert.deepEqual([UNITS.artillery.width,UNITS.artillery.hp,UNITS.artillery.cost,UNITS.artillery.damage],[94,340,600,120]);
});
test('rocket: suspension is subtle, deterministic, finite and stops perfectly at rest',()=>{
 for(const d of [-10,0,3,25,57,780,10000,Infinity,NaN]){
  assert.deepEqual(rocketChassisMotion(d,false),{heave:0,roll:0});
  const a=rocketChassisMotion(d,true),b=rocketChassisMotion(d,true);
  assert.deepEqual(a,b);
  assert.ok(Math.abs(a.heave)<=1.2&&Math.abs(a.roll)<=.007);
 }
 assert.notDeepEqual(rocketChassisMotion(24,true),rocketChassisMotion(36,true));
});
test('rocket: game sprite atlas has real distinct rolling wheel phases and distance-based locomotion',()=>{
 const metadata=JSON.parse(text('src/assets/reborn/animation/artillery-0.json'));
 for(const tag of ['walk','turnLeft','turnRight'])assert.ok(metadata.clips[tag].uniquePhases.every(n=>n>=4));
 const view={...metadata,stride:78};
 const animator=new SpriteAnimator(view);
 const basic={moving:true,distance:0,angle:0,attack:false,hit:false,dead:false};
 const first=animator.update(0,basic);
 const next=animator.update(.05,{...basic,distance:22});
 assert.notDeepEqual(next,first,'six wheels advance their actual baked animation frames while driving');
 const stopped=animator.update(.05,{...basic,moving:false});
 assert.equal(animator.state,'idle');
 assert.deepEqual(stopped,animator.update(.05,{...basic,moving:false}),'standing wheels do not spin');
});
test('endgame: tactical pause inert is restricted to live games',()=>{
 const main=text('src/reborn/main.ts');
 assert.match(main,/showTacticalPause\(paused&&game\.status==='playing'&&/);
});
