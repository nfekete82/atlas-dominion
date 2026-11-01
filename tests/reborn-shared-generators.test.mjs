import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,MAX_GENERATORS_PER_FACTION} from '../dist/src/reborn/catalog.js';
import {developArmy,generatorBuildPriority} from '../dist/src/reborn/army-economy.js';
import {chooseMission,newCampaign} from '../dist/src/reborn/campaign-commander.js';
import {comebackPressure} from '../dist/src/reborn/territory-warfare.js';

const makeGenerator=(g,owner,id,buildRemaining=0)=>{
 const base=g.bases.find(b=>b.owner===owner&&b.kind==='headquarters');
 return {...base,id,kind:'generator',hp:BUILDINGS.generator.hp,radius:BUILDINGS.generator.radius,
  buildRemaining,queue:[],queueTypes:[],queueCosts:[],production:0};
};

test('shared generators: UI offers the real building and its cost',()=>{
 const html=readFileSync('index.html','utf8');
 assert.match(html,/data-build="generator"[^>]*>Energiekern · 150 ◆<\/button>/);
 assert.equal(BUILDINGS.generator.cost,150);
 assert.equal(BUILDINGS.generator.buildTime,9);
 assert.equal(BUILDINGS.generator.income,10);
 assert.equal(MAX_GENERATORS_PER_FACTION,3);
});

test('shared generators: blue and red have identical hard limits including unfinished sites',()=>{
 for(const owner of [0,1]){
  const g=new Simulation(2026,14),initial=g.credits[owner];
  const home=g.bases.find(b=>b.owner===owner&&b.kind==='headquarters');
  for(let n=0;n<MAX_GENERATORS_PER_FACTION;n++){
   g.bases.push(makeGenerator(g,owner,6100+owner*10+n,n===2?4:0));
  }
  const error=g.buildError(owner,'generator',{x:home.x+220,y:home.y+80});
  assert.match(error,/Maximal 3 Energiekerne pro Fraktion/);
  assert.equal(g.build(owner,'generator',{x:home.x+220,y:home.y+80}),null);
  assert.equal(g.credits[owner],initial,'an unavailable fourth generator never costs credits');
  assert.doesNotMatch(g.buildError(1-owner,'generator',{x:home.x+220,y:home.y+80})??'',/Maximal 3/,
   'the other faction has an independent allowance');
  g.bases.at(-1).hp=0;
  assert.doesNotMatch(g.buildError(owner,'generator',{x:home.x+220,y:home.y+80})??'',/Maximal 3/,
   'destroyed generators no longer count towards cap');
 }
});

test('shared generators: each finished generator pays exactly ten income each ten seconds, regardless of faction',()=>{
 for(const owner of [0,1]){
  const g=new Simulation(2026,14);g.aiClock=-1e8;
  const before=g.income(owner);
  g.bases.push(makeGenerator(g,owner,6200+owner));
  assert.equal(g.income(owner),before+10);
  g.incomeClock=0;g.credits[owner]=250;
  for(let n=0;n<200;n++)g.step(.05);
  assert.equal(g.credits[owner],250+g.income(owner),'no extra lump-sum credit or invisible multiplier');
 }
});

test('shared generators: unfinished generators do not pay income and saves keep existing generators',()=>{
 const g=new Simulation(2026,14),before=g.income(0);
 const site=makeGenerator(g,0,6300,4);g.bases.push(site);
 assert.equal(g.income(0),before);
 site.buildRemaining=0;
 assert.equal(g.income(0),before+10);
 const restored=Simulation.load(g.save());
 assert.equal(restored.income(0),g.income(0));
 assert.equal(restored.bases.find(b=>b.id===6300)?.kind,'generator');
});

test('shared generators: underdog AI can invest before an airfield with paid workers, maintaining the main army',()=>{
 const g=new Simulation(2026,14);
 g.aiClock=-1e8;g.time=112;g.credits[1]=1200;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 // Completed infrastructure at remote sites: the HQ must remain unblocked
 // so that the AI can find a valid real construction site near home.
 for(const [i,kind] of ['barracks','factory'].entries()){
  g.bases.push({...home,id:6400+i,kind,x:home.x+(home.x>g.world.size/2?-900:900),
   y:home.y+(i===0?150:350),hp:BUILDINGS[kind].hp,
   radius:BUILDINGS[kind].radius,buildRemaining:0,queue:[],queueTypes:[],queueCosts:[],production:0});
 }
 const others=g.territories.filter(t=>t.owner===-1).slice(0,3);
 for(const t of others)t.owner=0;
 assert.equal(comebackPressure(g.territories,1),true);
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 assert.ok(worker,'a paid engineer is required');
 const army=g.units.filter(u=>u.owner===1);
 for(let i=0;i<4;i++){
  const p=g.world.nearest({x:home.x+(home.x>g.world.size/2?-210:210)+(i%2)*32,
   y:home.y+(i<2?-120:120)},g.obstacles())??{x:home.x,y:home.y};
  army.push(g.spawn(1,p,'infantry'));
 }
 g.updateVision();
 const priorCredits=g.credits[1];
 developArmy(g,g.tactical.state,army,()=>0);
 const generator=g.bases.find(b=>b.owner===1&&b.kind==='generator');
 assert.ok(generator,'underdog AI should commission a generator ahead of an airfield');
 assert.equal(generator.buildRemaining,9);
 const paidUnitQueues=g.bases.filter(b=>b.owner===1)
  .reduce((sum,b)=>sum+(b.queueCosts??[]).reduce((n,c)=>n+c,0),0);
 assert.equal(g.credits[1],priorCredits-BUILDINGS.generator.cost-paidUnitQueues,
  'generator and simultaneously paid army orders must both be accounted for');
 assert.ok(g.credits[1]>=0,'AI never receives borrowed or hidden Credits');
 assert.equal(g.bases.some(b=>b.owner===1&&b.kind==='airfield'),false);
 assert.ok(worker.orders.some(o=>o.kind==='build'&&o.target===generator.id));
});


test('shared generators: first core early, then paid infantry and capture goals, later cores with spare money',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;g.credits[1]=1850;
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);g.world.cliffIds.fill(-1);
 g.explored[1].fill(1);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 assert.ok(worker);
 // First 150-credit investment immediately, rather than delaying military.
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 let cores=g.bases.filter(b=>b.owner===1&&b.kind==='generator');
 assert.equal(cores.length,1);
 assert.ok(worker.orders.some(o=>o.kind==='build'&&o.target===cores[0].id));
 assert.equal(g.bases.some(b=>b.owner===1&&b.kind==='barracks'),false);
 // Complete the real work, then prove the NEXT investment is barracks.
 for(let tick=0;tick<1600&&cores[0].buildRemaining>0;tick++)g.step(.05);
 assert.equal(cores[0].buildRemaining,0);
 for(let tick=0;tick<100&&worker.orders.length;tick++)g.step(.05);
 g.time+=12;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 const barracks=g.bases.find(b=>b.owner===1&&b.kind==='barracks');
 assert.ok(barracks,'the second build must establish infantry production');
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,1,
  'the second generator must wait for a real army');
 // Commander still selects frontier captures while the economy expands.
 const mission=chooseMission(g,newCampaign(),home);
 assert.equal(mission?.kind,'capture','territory income remains an active strategic goal');
 assert.ok(g.territories[mission.sector].neighbors.some(id=>g.territories[id].owner===1));
 // A complete barracks and three fighters allow a second core with liquidity.
 barracks.buildRemaining=0;barracks.hp=BUILDINGS.barracks.hp;worker.orders=[];g.time+=12;
 for(let i=0;i<2;i++)g.spawn(1,{x:home.x+220+i*25,y:home.y+140},'infantry');
 g.credits[1]=850;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 cores=g.bases.filter(b=>b.owner===1&&b.kind==='generator');
 assert.equal(cores.length,2,'second core follows a sufficient infantry screen');
 assert.ok(g.credits[1]>=0);
 // Five fighters and renewed cash trigger the third, not a fixed timer.
 cores.at(-1).buildRemaining=0;cores.at(-1).hp=BUILDINGS.generator.hp;worker.orders=[];g.time+=12;
 for(let i=0;i<2;i++)g.spawn(1,{x:home.x+240+i*25,y:home.y+170},'infantry');
 g.credits[1]=1000;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,3);
 assert.equal(g.tactical.state.economy.built.generator,3);
});

test('shared generators: investment rules cannot suppress early force expansion',()=>{
 const choose=(existing,fighters,credits,barracksReady=true,underAttack=false,finishing=false)=>
  generatorBuildPriority({existing,fighters,credits,barracksReady,underAttack,finishing});
 assert.equal(choose(0,2,150,false),true,'first core is a low-cost opening move');
 assert.equal(choose(0,2,149,false),true,'saving for the first core remains the opening priority');
 assert.equal(choose(1,2,1800,true),false,'two initial soldiers are not a viable expansion force');
 assert.equal(choose(1,3,349,true),false,'maintain 200 credits after second core');
 assert.equal(choose(1,3,350,true),true);
 assert.equal(choose(1,5,1500,false),false,'barracks must be ready before investing again');
 assert.equal(choose(2,4,1500,true),false,'third core waits for a stronger army');
 assert.equal(choose(2,5,449,true),false,'retain 300 credits for replacement troops');
 assert.equal(choose(2,5,450,true),true);
 assert.equal(choose(2,9,1000,true,true),false,'direct attack postpones optional construction');
 assert.equal(choose(3,12,1500,true),false,'no fourth generator');
 assert.equal(choose(1,10,1500,true,false,true),false,'endgame must be fought rather than invested away');
});
test('shared generators: underfunded AI never gets a free core and tries again when credits arrive',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;g.credits[1]=75;
 const worker=g.units.find(u=>u.owner===1&&u.kind==='engineer');
 assert.ok(worker);
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,0);
 assert.equal(g.credits[1],75);
 g.credits[1]=150;
 g.time+=3;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,1);
 assert.ok(g.credits[1]>=0,'only actually earned credits are spent');
});

test('shared generators: AI never steals an active pioneer order for a new core',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;g.credits[1]=950;
 const w=g.units.find(u=>u.owner===1&&u.kind==='engineer'),order={kind:'move',x:w.x+25,y:w.y};
 w.orders=[order];
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(w.orders[0],order);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,0);
 w.orders=[];g.time+=12;
 developArmy(g,g.tactical.state,g.units.filter(u=>u.owner===1),()=>0);
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='generator').length,1);
});

test('shared generators: first energy core does not prevent a real AI frontier capture mission',()=>{
 const g=new Simulation(2026,14);g.aiClock=-1e8;g.time=30;g.credits[1]=950;
 g.tactical.plan();
 assert.ok(g.bases.some(b=>b.owner===1&&b.kind==='generator'),
  'early passive income construction must start');
 const mission=g.tactical.state.commander?.mission;
 assert.equal(mission?.kind,'capture','combat controller must keep expanding toward a real bastion');
 assert.ok(g.territories[mission.sector].neighbors.some(i=>g.territories[i].owner===1),
  'target is an accessible frontline capture');
 const combat=g.units.filter(u=>u.owner===1&&['infantry','heavy','rover'].includes(u.kind));
 assert.ok(combat.some(u=>u.orders.length>0),'an early capture must actually dispatch combat units');
});
