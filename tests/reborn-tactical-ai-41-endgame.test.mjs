import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {
 newCampaign,refreshIntelligence,chooseMission,validCampaign
} from '../dist/src/reborn/campaign-commander.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

const remember=b=>({id:b.id,kind:b.kind,owner:0,x:b.x,y:b.y,hp:b.hp,territory:b.territory});

test('4.1: HQ lost behind fog cannot start cleanup; observed destruction can',()=>{
 const g=new Simulation(2026,4),c=newCampaign();
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 g.visible[1].fill(0);
 g.memories[1].push(remember(hq));
 refreshIntelligence(g,c);
 assert.deepEqual(c.observedEnemyHQ,{id:hq.id,x:hq.x,y:hq.y});
 hq.hp=0;
 g.memories[1]=[];
 g.time=90;
 refreshIntelligence(g,c);
 assert.equal(c.enemyHQEliminatedAt,undefined,'unknown destruction in fog is never actionable');
 g.visible[1][g.world.index(hq)]=1;
 refreshIntelligence(g,c);
 assert.equal(c.enemyHQEliminatedAt,90);
 assert.equal(validCampaign(c,g.time,p=>p.x>=0&&p.y>=0&&p.x<=g.world.size&&p.y<=g.world.size,g.territories.length),true);
 g.tactical.state.commander=c;
 const save=g.save();
 const loaded=Simulation.load(save);
 assert.equal(loaded.tactical.state.commander.enemyHQEliminatedAt,90);
});

test('4.1: stale or missing memory cannot fake a kill while HQ is visibly alive',()=>{
 const g=new Simulation(2026,4),c=newCampaign();
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 g.memories[1].push(remember(hq));
 refreshIntelligence(g,c);
 g.memories[1]=[];
 g.visible[1][g.world.index(hq)]=1;
 g.time=100;
 refreshIntelligence(g,c);
 assert.equal(c.enemyHQEliminatedAt,undefined);
});

test('4.1: cleanup prefers observed production over neutral land and never hunts hidden units',()=>{
 const g=new Simulation(2026,4),c=newCampaign();
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const remembered={...remember(hq),id:9001,kind:'barracks'};
 g.memories[1].push(remembered);
 c.observedEnemyHQ={id:hq.id,x:hq.x,y:hq.y};
 c.enemyHQEliminatedAt=80;g.time=120;
 g.visible[1].fill(0);
 const mission=chooseMission(g,c,home);
 assert.equal(mission.kind,'structure');
 assert.equal(mission.objective,9001);
 c.mission=undefined;g.memories[1]=[];
 const noHidden=chooseMission(g,c,home);
 assert.notEqual(noHidden?.kind,'hunt','hidden surviving enemy units are not targetable');
});

function endgameEconomy(){
 const g=new Simulation(2026,4);
 g.aiClock=-1e8;g.time=200;g.credits=[500,4000];
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const enemy=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const sector=g.territories.find(t=>t.owner!==1&&t.neighbors.includes(home.territory));
 assert.ok(sector);
 sector.owner=1;
 for(const [i,kind] of ['barracks','factory'].entries()){
  const spec=BUILDINGS[kind];
  g.bases.push({...home,id:1900+i,kind,hp:spec.hp,radius:spec.radius,
   x:home.x+(i+1)*310,y:home.y+180,territory:home.territory,
   queue:[],queueTypes:[],queueCosts:[],buildRemaining:0,production:0});
 }
 for(let i=0;i<5;i++)g.spawn(1,{x:home.x+100+i*25,y:home.y+220},'heavy');
 const s=g.tactical.state;
 s.commander={...newCampaign(),observedEnemyHQ:{id:enemy.id,x:enemy.x,y:enemy.y},enemyHQEliminatedAt:170};
 return {g,s,home};
}
test('4.1: cleanup buys ground troops, no speculative towers, tech or second engineer',()=>{
 const {g,s,home}=endgameEconomy();
 const credits=g.credits[1];
 developArmy(g,s,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='turret').length,0);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='airfield').length,0);
 assert.ok(!home.queueTypes.includes('engineer'));
 assert.ok(g.bases.find(b=>b.owner===1&&b.kind==='barracks').queueTypes.includes('infantry'));
 assert.ok(g.credits[1]<=credits-UNITS.infantry.cost);
});
test('4.1: invalid or future cleanup states cannot be loaded',()=>{
 const {g,s}=endgameEconomy();
 assert.equal(validCampaign(s.commander,g.time,p=>p.x>=0&&p.y>=0&&p.x<=g.world.size&&p.y<=g.world.size,g.territories.length),true);
 const save=g.save();
 const missing=structuredClone(save);delete missing.ai.commander.observedEnemyHQ;
 assert.throws(()=>Simulation.load(missing));
 const future=structuredClone(save);future.ai.commander.enemyHQEliminatedAt=g.time+5;
 assert.throws(()=>Simulation.load(future));
});
