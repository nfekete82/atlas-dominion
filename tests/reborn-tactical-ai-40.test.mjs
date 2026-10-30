import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 newExperience,finishExperience,unsupportedSiegeLosses,canOverrun,
 portableExperience,readPortableExperience,validExperience
} from '../dist/src/reborn/battle-learning.js';
import {rankBastionDefenses} from '../dist/src/reborn/bastion-defense.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

const assault=(siegeWeapons)=>({
 sector:2,tactic:'overrun',guns:2,force:9,at:20,initialUnits:9,
 initialHP:900,progress:0,...(siegeWeapons===undefined?{}:{siegeWeapons})
});

test('4.0: a lost assault without artillery changes the next overrun decision',()=>{
 const experience=newExperience();
 assert.equal(canOverrun(500,200,9,2,experience),true);
 experience.active=assault(0);
 finishExperience(experience,false,180);
 assert.equal(unsupportedSiegeLosses(experience),1);
 assert.equal(canOverrun(500,200,9,2,experience),false);
 assert.equal(canOverrun(900,200,9,2,experience),true,
   'truly overwhelming strength remains a valid alternative');
});

test('4.0: unknown historical artillery does not invent a failure cause',()=>{
 const experience=newExperience();
 experience.active=assault(undefined);
 finishExperience(experience,false,0);
 assert.equal(unsupportedSiegeLosses(experience),0);
 const unfortified=newExperience();
 unfortified.active={...assault(0),guns:0};
 finishExperience(unfortified,false,0);
 assert.equal(unsupportedSiegeLosses(unfortified),0);
});

test('4.0: tactical learning persists across campaigns and rejects forged counts',()=>{
 const experience=newExperience();
 experience.active=assault(0);
 finishExperience(experience,false,200);
 assert.equal(validExperience(experience,30,16),true);
 const portable=portableExperience(experience);
 assert.deepEqual(readPortableExperience(portable),portable);
 assert.equal(unsupportedSiegeLosses(readPortableExperience(portable)),1);
 const forged=structuredClone(portable);
 forged.records[0].unsupportedSiegeLosses=999;
 assert.equal(readPortableExperience(forged),undefined);
 const invalidActive={...experience,active:{...assault(65)}};
 assert.equal(validExperience(invalidActive,30,16),false);
});

function battlefield(){
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;g.time=200;g.credits=[0,1500];
 g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.world.components.fill(0);g.world.cliffIds.fill(-1);
 g.explored[1].fill(1);
 const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const owned=g.territories.find(t=>t.owner!==1&&t.neighbors.includes(hq.territory));
 assert.ok(owned);
 owned.owner=1;
 const enemySector=g.territories.find(t=>t.owner!==1&&t.neighbors.includes(owned.id));
 assert.ok(enemySector);
 enemySector.owner=0;
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 assert.ok(worker);
 worker.x=owned.point.x-110;worker.y=owned.point.y-100;worker.orders=[];
 for(const [i,kind] of ['barracks','factory'].entries()){
  const spec=BUILDINGS[kind];
  g.bases.push({...hq,id:1900+i,kind,hp:spec.hp,radius:spec.radius,
   x:hq.x+(i+1)*300,y:hq.y,territory:hq.territory,
   queue:[],queueTypes:[],buildRemaining:0,production:0});
 }
 for(let i=0;i<5;i++)g.spawn(1,{x:worker.x+i*22,y:worker.y+140},'heavy');
 g.visible[1].fill(0);
 return {g,hq,owned,enemySector,worker};
}

test('4.0: observed attack or actual neighboring loss raises bastion urgency',()=>{
 const {g,owned,enemySector}=battlefield();
 const baseline=rankBastionDefenses(g).find(c=>c.sector===owned.id);
 assert.ok(baseline);
 assert.equal(baseline.urgent,false);
 const enemy=g.spawn(0,{x:owned.point.x+50,y:owned.point.y+50},'heavy');
 g.visible[1][g.world.index(enemy)]=1;
 const threatened=rankBastionDefenses(g).find(c=>c.sector===owned.id);
 assert.equal(threatened.urgent,true);
 assert.ok(threatened.score>baseline.score);
 g.visible[1].fill(0);
 assert.equal(rankBastionDefenses(g).find(c=>c.sector===owned.id).urgent,false);
 g.tactical.state.experience={...newExperience(),lastLostSector:enemySector.id};
 assert.equal(rankBastionDefenses(g).find(c=>c.sector===owned.id).urgent,true);
});

test('4.0: urgent threatened bastion can be fortified with a smaller cash buffer',()=>{
 const {g,owned,enemySector}=battlefield();
 // Visible approaching force, but far enough away for a safe rear turret site.
 const dx=enemySector.point.x-owned.point.x,dy=enemySector.point.y-owned.point.y;
 const length=Math.hypot(dx,dy);
 const enemy=g.spawn(0,{x:owned.point.x+dx/length*620,y:owned.point.y+dy/length*620},'heavy');
 g.visible[1][g.world.index(enemy)]=1;
 g.credits[1]=BUILDINGS.turret.cost+200;
 g.tactical.plan();
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='turret').length,1);
 assert.equal(g.tactical.state.economy.built.turret,1);
});

test('4.0: busy builder triggers a second paid engineer, without cancelling work',()=>{
 const {g,hq,worker}=battlefield();
 worker.orders=[{kind:'move',x:worker.x+30,y:worker.y}];
 g.credits[1]=BUILDINGS.turret.cost+600;
 const originalOrder=worker.orders[0];
 g.tactical.plan();
 assert.deepEqual(hq.queueTypes,['engineer']);
 assert.equal(worker.orders[0],originalOrder);
 assert.equal(g.tactical.state.economy.produced.engineer,1);
});
