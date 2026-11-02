import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {buildingVisualRadius,constructionVisualClearance,aiBuildSiteScore} from '../dist/src/reborn/construction-spacing.js';

function field(){
 const g=new Simulation(2026,4);
 g.units=[];g.aiClock=-1e8;g.world.blocked.fill(0);g.world.opaque.fill(0);
 return g;
}
test('armored vanguard: tanks and Humvees in front, both infantry types behind, rocket and support farther back',()=>{
 const g=field(),at={x:1400,y:1400};
 const kinds=['tank','rover','infantry','heavy','artillery','medic','engineer'];
 const units=kinds.map((kind,i)=>g.spawn(0,{x:at.x+i*22,y:at.y+i*4},kind));
 assert.equal(g.command(units.map(u=>u.id),{kind:'move',x:2050,y:1400}),7);
 const byKind=k=>units.find(u=>u.kind===k);
 const armored=units.filter(u=>['tank','rover'].includes(u.kind)).map(u=>u.id);
 for(const kind of ['infantry','heavy','artillery','medic','engineer']){
  const o=byKind(kind).orders[0];
  assert.deepEqual(o.formation.front,armored,`${kind} follows the vehicles`);
 }
 assert.ok(byKind('infantry').orders[0].formation.rear<byKind('artillery').orders[0].formation.rear);
 assert.ok(byKind('artillery').orders[0].formation.rear<byKind('medic').orders[0].formation.rear);
 assert.ok(byKind('medic').orders[0].formation.rear<=byKind('engineer').orders[0].formation.rear);
 assert.equal(byKind('tank').orders[0].formation,undefined);
 assert.equal(byKind('rover').orders[0].formation,undefined);
});
test('solo infantry and solo vehicles retain full independent march behavior',()=>{
 const g=field();
 for(const kind of ['infantry','tank','rover','artillery']){
  const u=g.spawn(0,{x:1750,y:1100},kind);
  assert.equal(g.command([u.id],{kind:'move',x:2050,y:1100}),1);
  assert.equal(u.orders[0].formation,undefined);
  assert.equal(u.orders[0].march,undefined);
 }
});
test('infantry with medic and no vehicles still protects the medic',()=>{
 const g=field(),a=g.spawn(0,{x:1650,y:1400},'infantry'),m=g.spawn(0,{x:1630,y:1400},'medic');
 assert.equal(g.command([a.id,m.id],{kind:'move',x:2060,y:1400}),2);
 assert.deepEqual(m.orders[0].formation.front,[a.id]);
 assert.equal(a.orders[0].formation,undefined);
});
test('AI construction score favors accessible space over closely stacked buildings',()=>{
 const home={kind:'headquarters',hp:1200,x:1800,y:1700};
 const worker={x:1850,y:1800};
 const near={x:2020,y:1700},spread={x:2160,y:1700};
 assert.ok(buildingVisualRadius('factory')>BUILDINGS.factory.radius);
 assert.ok(constructionVisualClearance('factory','headquarters')>BUILDINGS.factory.radius+BUILDINGS.headquarters.radius+24);
 assert.ok(aiBuildSiteScore(spread,'factory',home,worker,[home])<aiBuildSiteScore(near,'factory',home,worker,[home]));
});
test('new building eligibility disallows overlapping painted building shells',()=>{
 const g=field(),home=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 g.credits[0]=5000;g.visible[0].fill(1);g.explored[0].fill(1);
 const radius=BUILDINGS.factory.radius+home.radius+25;
 const place={x:home.x+radius,y:home.y};
 const error=g.buildError(0,'factory',place);
 assert.equal(error,'Zu nah an einem anderen Gebäude.');
});
