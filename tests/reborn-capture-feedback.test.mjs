import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES,distance} from '../dist/src/reborn/config.js';

test('capture feedback distinguishes distance, enemy contest, disconnected sector and HQ defense',()=>{
 const g=new Simulation(2026,1);g.aiClock=-1e8;g.units=[];
 const connected=g.territories[20],isolated=g.territories[16];
 assert.equal(g.captureReadiness(connected,0),'no-unit');
 const unit=g.spawn(0,{x:connected.point.x+RULES.captureRadius+25,y:connected.point.y});
 assert.equal(g.captureReadiness(connected,0),'out-of-range');
 Object.assign(unit,{x:connected.point.x+RULES.captureRadius-5,y:connected.point.y});
 assert.equal(g.captureReadiness(connected,0),'capturing');
 const opponent=g.spawn(1,{...connected.point});
 assert.equal(g.captureReadiness(connected,0),'contested');
 opponent.hp=0;
 assert.equal(g.captureReadiness(connected,0),'capturing');
 Object.assign(unit,isolated.point);
 assert.equal(g.captureReadiness(isolated,0),'disconnected');
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const sector=g.territories[hq.territory];
 g.territories[sector.neighbors[0]].owner=0;
 Object.assign(unit,sector.point);
 assert.equal(g.captureReadiness(sector,0),'enemy-hq');
 hq.hp=0;
 assert.equal(g.captureReadiness(sector,0),'capturing');
 sector.owner=0;
 assert.equal(g.captureReadiness(sector,0),'owned');
});

test('a 48-unit right-click capture order keeps formation destinations inside the control circle',()=>{
 const g=new Simulation(2026,1);g.aiClock=-1e8;g.units=[];
 const t=g.territories[20];
 for(let i=0;i<48;i++)g.spawn(0,{x:t.point.x+(i%8)*3,y:t.point.y+140+Math.floor(i/8)*3});
 const count=g.command(g.units.map(u=>u.id),{...t.point,kind:'move'});
 assert.equal(count,48);
 for(const u of g.units){
  assert.ok(u.orders.length,'unit '+u.id+' missing order');
  assert.ok(distance(u.orders[0],t.point)<RULES.captureRadius,'unit '+u.id+' assigned outside capture area');
 }
});
