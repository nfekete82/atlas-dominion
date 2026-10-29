import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AttackAlerts,ATTACK_BLINK_SECONDS,ATTACK_RADIO_COOLDOWN,attackBlinkAlpha} from '../dist/src/reborn/attack-alerts.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {readFileSync} from 'node:fs';

test('attack notices fire once on actual damage and keep red position markers without leaking enemy coordinates',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;
 const blue=g.spawn(0,{x:1700,y:1800},'infantry'),red=g.spawn(1,{x:1850,y:1800},'infantry');
 const initial=g.save();
 g.strike(red,blue,12);
 assert.equal(blue.hp,initial.units.find(u=>u.id===blue.id).hp-12);
 assert.equal(g.attackAlerts.sequence,1);
 assert.equal(g.attackAlerts.lastAlert.x,blue.x);
 assert.equal(g.attackAlerts.lastAlert.y,blue.y);
 assert.notEqual(g.attackAlerts.lastAlert.x,red.x);
 assert.equal(g.attackAlerts.visible(g.time).length,1);
 g.strike(red,blue,12);
 assert.equal(g.attackAlerts.sequence,1,'rapid hits do not repeat a voice call');
 assert.equal(g.attackAlerts.visible(g.time).length,1,'same area has one marker');
 g.time+=4;
 g.strike(red,blue,1);
 assert.equal(g.attackAlerts.sequence,1,'marker may refresh without radio spam');
 assert.equal(g.attackAlerts.visible(g.time).length,1);
 g.time+=ATTACK_RADIO_COOLDOWN;
 g.strike(red,blue,1);
 assert.equal(g.attackAlerts.sequence,2,'a later independent assault can alert again');
 assert.equal(g.attackAlerts.visible(g.time).length,1);
 assert.equal(Object.hasOwn(g.save(),'attackAlerts'),false,'never serialized in savegames');
});
test('friendly fire, enemy losses, zero damage and fake IDs must not raise alarms',()=>{
 const g=new Simulation(2026,11),blue=g.spawn(0,{x:1720,y:1770},'infantry'),
  other=g.spawn(0,{x:1740,y:1780},'infantry'),red=g.spawn(1,{x:1800,y:1800},'infantry');
 g.strike(blue,other,7);g.strike(blue,red,10);g.strike(red,blue,0);
 g.strike(999999,blue,10);
 assert.equal(g.attackAlerts.sequence,0);
 assert.equal(g.attackAlerts.visible(g.time).length,0);
 g.strike(red,g.bases.find(b=>b.owner===0),10);
 assert.equal(g.attackAlerts.sequence,1,'HQ damage triggers alarm');
});
test('attack beacons are capped, fade and respect reduced motion',()=>{
 const events=new AttackAlerts();
 for(let i=0;i<24;i++)events.record({x:30+i*300,y:40},i*.2);
 assert.ok(events.visible(5).length<=events.maxMarkers);
 const pulse=attackBlinkAlpha(1,0);
 assert.ok(pulse>0&&pulse<=1);
 assert.equal(attackBlinkAlpha(1,0,true),.70);
 assert.equal(attackBlinkAlpha(ATTACK_BLINK_SECONDS,0),0);
 assert.equal(attackBlinkAlpha(-1,0),0);
 assert.equal(events.visible(20).length,0);
 assert.equal(events.record({x:NaN,y:2},1),false);
});
test('alerts are presentation-only and a new match and restored save clear all transient warnings',()=>{
 const g=new Simulation(2026,14),blue=g.spawn(0,{x:1900,y:2100},'infantry'),
  red=g.spawn(1,{x:1940,y:2100},'infantry');
 g.strike(red,blue,5);
 const snapshot=g.save();
 const restored=Simulation.load(snapshot);
 assert.equal(restored.attackAlerts.sequence,0);
 assert.equal(restored.attackAlerts.visible(restored.time).length,0);
 assert.deepEqual(restored.save(),snapshot);
 const clean=new Simulation(2026,14);
 assert.equal(clean.attackAlerts.sequence,0);
});
test('HUD and minimap show the exact warning, with voice respecting the player audio options',()=>{
 const main=readFileSync('src/reborn/main.ts','utf8');
 const renderer=readFileSync('src/reborn/renderer.ts','utf8');
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 assert.match(main,/Captain, wir werden angegriffen!/);
 assert.match(main,/audio\.announceAttack\(\)/);
 assert.match(renderer,/g\.attackAlerts\.visible\(g\.time\)/);
 assert.match(renderer,/attackBlinkAlpha\(/);
 assert.match(renderer,/#ff3d35|#ff3f3f/);
 assert.match(audio,/this\.radio\.enabled/);
 assert.match(audio,/this\.volume<=0/);
 assert.match(audio,/speechSynthesis/);
 assert.match(audio,/Captain, wir werden angegriffen!/);
});
