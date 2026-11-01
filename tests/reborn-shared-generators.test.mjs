import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,MAX_GENERATORS_PER_FACTION} from '../dist/src/reborn/catalog.js';
import {developArmy} from '../dist/src/reborn/army-economy.js';
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
 assert.equal(g.credits[1],priorCredits-BUILDINGS.generator.cost);
 assert.equal(g.bases.some(b=>b.owner===1&&b.kind==='airfield'),false);
 assert.ok(worker.orders.some(o=>o.kind==='build'&&o.target===generator.id));
});
