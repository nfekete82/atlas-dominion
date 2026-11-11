import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {availableEngineers,chooseConstructionCrew,nearestEngineer,submitConstruction}
 from '../scripts/webgl-builder-input.js';

/** Reproduce the actual click path:
 * create the full building with a real pioneer, advance its construction
 * through 20 Hz ticks, then request a second building with the same crew.
 * Previous tests only inserted a pre-completed base into game.bases!
 */
const candidates=(game,kind,anchor)=>{
 const points=[];
 for(let r=270;r<=1050;r+=100)
  for(let i=0;i<32;i++){
   const angle=2*Math.PI*i/32;
   const p={x:Math.round(anchor.x+r*Math.cos(angle)),
    y:Math.round(anchor.y+r*Math.sin(angle))};
   if(!game.buildError(0,kind,p,0))points.push(p);
  }
 return points;
};
for(const kind of ['airfield','factory']){
 test('REAL consecutive build: '+kind+' then generator with same pioneer',()=>{
  const g=new Simulation(2074,19);
  g.aiClock=1e9;g.tactical.plan=()=>{};
  g.credits[0]=25000;g.explored[0].fill(1);
  const pioneer=g.units.find(u=>u.owner===0&&u.kind==='engineer');
  const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
  assert.ok(pioneer&&hq);
  let site=null;
  for(const p of candidates(g,kind,hq)){
   const b=g.build(0,kind,p,[pioneer.id],0,false);
   if(b){site=b;break;}
  }
  assert.ok(site,'initial '+kind+' build must succeed with real pioneer: '+g.notices.slice(-3));
  for(let tick=0;site.buildRemaining>0&&tick<3200&&g.status==='playing';tick++)
   g.step(.05);
  assert.equal(site.buildRemaining,0,
   kind+' must actually finish; pioneer='+JSON.stringify({
    x:pioneer.x,y:pioneer.y,orders:pioneer.orders,workingTarget:pioneer.workingTarget,
    hp:pioneer.hp,status:g.status,buildRemaining:site.buildRemaining
   }));
  assert.ok(pioneer.hp>0);
  // The second order must ACTUALLY CREATE A NEW SITE; buildError==null
  // alone does not test supportApproach or command()/append behaviour.
  const selection=new Set([pioneer.id]);
  let valid=0,started=null,failures=[];
  for(const p of candidates(g,'generator',hq)){
   const crew=chooseConstructionCrew(availableEngineers(g.units,selection),false);
   const before=g.buildError(0,'generator',p,0);
   if(before)continue;
   valid++;
   const second=g.build(0,'generator',p,crew.workers.map(u=>u.id),0,crew.append);
   if(second){started=second;break;}
   failures.push({p,crew:crew.workers.map(u=>({id:u.id,orders:u.orders})),
    notices:g.notices.slice(-2)});
  }
  assert.ok(started,
   'generator after '+kind+' must ACTUALLY be constructible: '+JSON.stringify({
    validSites:valid,failed:failures.slice(0,4),
    pioneer:{x:pioneer.x,y:pioneer.y,orders:pioneer.orders},site:{x:site.x,y:site.y},
    credits:g.credits[0],status:g.status
   }));
  assert.equal(started.kind,'generator');
  assert.ok(started.buildRemaining>0);
  assert.ok(pioneer.orders.some(o=>o.kind==='build'&&o.target===started.id),
   'second real construction must be assigned to the same pioneer');
  // Assigning an order alone is insufficient. A pioneer left beside the
  // airfield must actually MOVE to the new foundation and FINISH it.
  for(let tick=0;started.buildRemaining>0&&tick<3200&&g.status==='playing';tick++)
   g.step(.05);
  assert.equal(started.buildRemaining,0,
   'second building must really COMPLETE after '+kind+': '+JSON.stringify({
    status:g.status,remain:started.buildRemaining,pioneer:{
     x:pioneer.x,y:pioneer.y,orders:pioneer.orders,workingTarget:pioneer.workingTarget,
     pathLength:pioneer.path?.length,repath:pioneer.repath,hold:pioneer.hold},
    from:{x:site.x,y:site.y},to:{x:started.x,y:started.y},
    notices:g.notices.slice(-4)
   }));
 });
}

test('reselect an idle engineer when selected builder is still assigned to completed factory',()=>{
 const chosen={id:17,owner:0,kind:'engineer',hp:110,orders:[{kind:'build',target:5}]};
 const idle={id:18,owner:0,kind:'engineer',hp:110,orders:[]};
 const selection=new Set([chosen.id]);
 assert.deepEqual(chooseConstructionCrew(availableEngineers([chosen,idle],selection)),
  {workers:[chosen],append:true});
 assert.equal(nearestEngineer([chosen,idle],{x:0,y:0}).id,17);
});

test('after a completed airfield: stale pioneer order is replaced, not queued',()=>{
 const previous={id:67,kind:'airfield',owner:0,hp:1200,buildRemaining:0};
 const pioneer={id:9,owner:0,kind:'engineer',hp:110,x:100,y:100,
  orders:[{kind:'build',target:previous.id}]};
 const calls=[];
 const game={units:[pioneer],bases:[previous],build(owner,kind,p,ids,facing,append){
  calls.push({kind,ids,append});
  return {id:68,kind,owner,x:p.x,y:p.y,buildRemaining:9};
 }};
 const result=submitConstruction(game,'generator',{x:450,y:400},
  new Set([pioneer.id]),0);
 assert.ok(result.base);
 assert.equal(result.append,false,'old completed build order must be interrupted');
 assert.deepEqual(calls,[{kind:'generator',ids:[9],append:false}]);
});

test('after airfield the fallback uses a free pioneer even when a busy one is selected',()=>{
 const active={id:69,kind:'airfield',owner:0,hp:1200,buildRemaining:4};
 const busy={id:9,owner:0,kind:'engineer',hp:110,x:0,y:0,
  orders:[{kind:'build',target:active.id}]};
 const free={id:10,owner:0,kind:'engineer',hp:110,x:400,y:400,orders:[]};
 const calls=[];
 const game={units:[busy,free],bases:[active],
  build(owner,kind,p,ids,facing,append){
   calls.push({ids,append});
   return ids.includes(free.id)?{id:70,kind,owner,buildRemaining:9}:null;
  }
 };
 const result=submitConstruction(game,'generator',{x:430,y:420},new Set([busy.id]));
 assert.ok(result.base);
 assert.deepEqual(result.workers.map(u=>u.id),[free.id]);
 assert.deepEqual(calls,[{ids:[10],append:false}]);
});

test('if the selected pioneer is trapped behind a factory, retry another reachable builder',()=>{
 const selected={id:19,owner:0,kind:'engineer',hp:110,x:250,y:150,orders:[]};
 const alternative={id:22,owner:0,kind:'engineer',hp:110,x:550,y:400,orders:[]};
 const calls=[];
 const game={units:[selected,alternative],bases:[],
  build(owner,kind,p,ids,facing,append){
   calls.push({ids,append});
   // The approach to the entire grouped crew may be rejected too;
   // always try each actual individual worker as fallback.
   return ids.length===1&&ids[0]===alternative.id
    ?{id:71,kind,owner,buildRemaining:10}:null;
  }
 };
 const result=submitConstruction(game,'generator',{x:500,y:500},new Set([selected.id]));
 assert.ok(result.base);
 assert.equal(result.append,false);
 assert.deepEqual(calls.map(t=>t.ids),[[19,22],[19],[22]],
  'shared crew tries first, then individual paths when the group is blocked');
});

test('shift explicitly preserves selected pioneer queue rather than stealing another worker',()=>{
 const busy={id:31,owner:0,kind:'engineer',hp:100,x:25,y:25,orders:[]};
 const free={id:32,owner:0,kind:'engineer',hp:100,x:26,y:26,orders:[]};
 const calls=[];
 const game={units:[busy,free],bases:[],build(owner,kind,p,ids,facing,append){
  calls.push({ids,append});return {id:80,kind,buildRemaining:10};
 }};
 const result=submitConstruction(game,'generator',{x:600,y:600},
  new Set([busy.id]),0,true);
 assert.ok(result.base);
 assert.deepEqual(calls,[{ids:[31],append:true}]);
});

test('missing pioneers yields actionable explanation without constructing phantom bases',()=>{
 const game={units:[],bases:[],build(){throw Error('should not build')}};
 const result=submitConstruction(game,'generator',{x:1,y:1},new Set());
 assert.equal(result.base,null);
 assert.match(result.reason,/Kein lebender Pionier/);
});

test('REAL default 8-bastion WebGL v24: HQ -> airfield -> generator all finish',()=>{
 const g=Simulation.campaign(2074,24);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 g.credits[0]=25000;g.explored[0].fill(1);
 const pioneer=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 assert.ok(pioneer,'campaign starts with a real pioneer');
 const selection=new Set([pioneer.id]);
 const start={x:pioneer.x,y:pioneer.y};
 function findAndPlace(kind,anchor){
  const all=[anchor];
  for(let r=45;r<=1050;r+=75)for(let i=0;i<32;i++){
   const a=2*Math.PI*i/32;
   all.push({x:Math.round(anchor.x+r*Math.cos(a)),
    y:Math.round(anchor.y+r*Math.sin(a))});
  }
  let valid=0,last=null;
  for(const p of all){
   const error=g.buildError(0,kind,p,0);
   if(error){last=error;continue;}
   valid++;
   const order=submitConstruction(g,kind,p,selection,0,false);
   if(order.base){
    selection.clear();for(const u of order.workers)selection.add(u.id);
    return order.base;
   }
   last=order.reason;
  }
  assert.fail('could not place '+kind+' in real v24 campaign, valid '+valid+
   ', last error: '+last+', pioneer '+JSON.stringify({x:pioneer.x,y:pioneer.y,
    orders:pioneer.orders,status:g.status,credits:g.credits[0]}));
 }
 const finish=site=>{
  for(let n=0;site.buildRemaining>0&&n<3600&&g.status==='playing';n++)g.step(.05);
  assert.equal(site.buildRemaining,0,
   site.kind+' must finish in v24: '+JSON.stringify({
    pos:{x:site.x,y:site.y},pioneer:{
     x:pioneer.x,y:pioneer.y,orders:pioneer.orders,workingTarget:pioneer.workingTarget
    },status:g.status,rem:site.buildRemaining
   }));
 };
 const hq=findAndPlace('headquarters',start);finish(hq);
 assert.equal(g.needsHeadquarters(0),false);
 const airfield=findAndPlace('airfield',hq);finish(airfield);
 const generator=findAndPlace('generator',hq);finish(generator);
 assert.ok(g.bases.includes(generator));
 assert.equal(generator.buildRemaining,0);
});

test('click outside the sector cannot throw or permanently break later builds',()=>{
 const g=new Simulation(2074,19);
 g.credits[0]=5000;g.explored[0].fill(1);
 const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer');
 const old=g.territories;
 g.territories=[];
 const p={x:worker.x,y:worker.y};
 const reason=g.buildError(0,'generator',p);
 assert.match(reason,/Sektor/);
 assert.equal(g.build(0,'generator',p,[worker.id]),null);
 g.territories=old;
 assert.equal(g.status,'playing');
});

test('two idle pioneers collaborate first, then split automatically across two parallel sites',()=>{
 const original={id:41,owner:0,kind:'engineer',hp:110,x:100,y:100,orders:[]};
 const other={id:42,owner:0,kind:'engineer',hp:110,x:160,y:120,orders:[]};
 const bases=[];
 const game={units:[original,other],bases,
  build(owner,kind,p,ids,facing,append){
   const site={id:200+bases.length,kind,owner,x:p.x,y:p.y,hp:100,
    buildRemaining:12};
   bases.push(site);
   for(const u of this.units.filter(u=>ids.includes(u.id))){
    const order={kind:'build',target:site.id,x:p.x,y:p.y};
    if(append)u.orders.push(order);else u.orders=[order];
   }
   return site;
  }
 };
 const selected=new Set([41,42]);
 const first=submitConstruction(game,'barracks',{x:200,y:200},selected);
 assert.ok(first.base);
 assert.deepEqual(first.workers.map(u=>u.id).sort(),[41,42],
  'both free pioneers must receive the same first construction order');
 assert.equal(original.orders[0].target,first.base.id);
 assert.equal(other.orders[0].target,first.base.id);
 const second=submitConstruction(game,'generator',{x:550,y:550},
  new Set([first.workers[0].id]));
 assert.ok(second.base);
 assert.equal(second.workers.length,1,
  'one pioneer transfers to new site, rather than both abandoning the old');
 assert.equal(second.append,false,'new site must begin immediately');
 assert.deepEqual(game.units.map(u=>u.orders[0].target).sort(),
  [first.base.id,second.base.id].sort(),
  'one active engineer must remain at EACH foundation');
 assert.equal(bases.length,2);
});

test('when both pioneers are constructing, a third site is queued without interrupting either job',()=>{
 const sites=[{id:201,kind:'barracks',hp:800,buildRemaining:9},
  {id:202,kind:'factory',hp:800,buildRemaining:6}];
 const original={id:41,owner:0,kind:'engineer',hp:110,x:100,y:100,
  orders:[{kind:'build',target:201}]};
 const other={id:42,owner:0,kind:'engineer',hp:110,x:200,y:200,
  orders:[{kind:'build',target:202}]};
 const game={units:[original,other],bases:sites,
  build(owner,kind,p,ids,facing,append){
   assert.equal(append,true,'active builders must not be interrupted');
   for(const u of this.units.filter(u=>ids.includes(u.id)))
    u.orders.push({kind:'build',target:203});
   return {id:203,kind,buildRemaining:10};
  }
 };
 const result=submitConstruction(game,'generator',{x:400,y:400},
  new Set([41]));
 assert.ok(result.base);
 assert.equal(result.append,true);
 assert.equal(result.workers.length,1);
 assert.equal(original.orders[0].target,201);
 assert.equal(other.orders[0].target,202);
 assert.equal(original.orders.length+other.orders.length,3);
});

test('REAL v24 campaign: two living engineers make simultaneous construction progress',()=>{
 const g=Simulation.campaign(20261111,24);
 g.aiClock=1e9;g.tactical.plan=()=>{};
 g.credits[0]=25000;g.explored[0].fill(1);
 const first=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 assert.ok(first,'real v24 game must start with a pioneer');
 // v24 starts WITHOUT an HQ. Construct it before attempting other bases.
 let hq=null;
 for(const p of candidates(g,'headquarters',first)){
  hq=g.build(0,'headquarters',p,[first.id]);
  if(hq)break;
 }
 assert.ok(hq,'the pioneer can place initial field headquarters');
 for(let n=0;hq.buildRemaining>0&&n<3600&&g.status==='playing';n++)
  g.step(.05);
 assert.equal(hq.buildRemaining,0,'HQ must be truly built before parallel jobs');
 const spawnAt=g.world.nearest({x:first.x+190,y:first.y+90},g.obstacles())??
  {x:first.x+190,y:first.y+90};
 const second=g.spawn(0,spawnAt,'engineer');
 const selected=new Set([first.id,second.id]);
 const tryBuild=(kind)=>{
  for(let r=290;r<=970;r+=95)for(let j=0;j<32;j++){
   const theta=j*Math.PI/16;
   const p={x:Math.round(hq.x+r*Math.cos(theta)),
    y:Math.round(hq.y+r*Math.sin(theta))};
   if(g.buildError(0,kind,p)!==null)continue;
   const order=submitConstruction(g,kind,p,selected);
   if(order.base){
    selected.clear();for(const u of order.workers)selected.add(u.id);
    return order;
   }
  }
  assert.fail('no actual accessible place for '+kind);
 };
 const one=tryBuild('barracks');
 assert.ok(one.workers.length>=1);
 assert.equal(one.base.buildRemaining>0,true);
 // Give a second pionier time to reach and join when he was unable to
 // accept the grouped approach on the original click.
 for(let n=0;n<24&&g.status==='playing';n++)g.step(.05);
 const two=tryBuild('generator');
 assert.equal(two.workers.length,1,'new building needs one pioneer');
 assert.equal(two.append,false,'parallel building must not be queued');
 assert.equal(one.base.buildRemaining>0,true);
 assert.equal(two.base.buildRemaining>0,true);
 const firstCrew=[first,second].filter(u=>u.orders[0]?.target===one.base.id);
 const secondCrew=[first,second].filter(u=>u.orders[0]?.target===two.base.id);
 assert.equal(firstCrew.length,1,'one pioneer keeps constructing the barracks');
 assert.equal(secondCrew.length,1,'the other immediately builds the generator');
 const before=[one.base.buildRemaining,two.base.buildRemaining];
 for(let n=0;n<1000&&g.status==='playing'&&
  (one.base.buildRemaining>=before[0]||two.base.buildRemaining>=before[1]);n++)
  g.step(.05);
 assert.ok(one.base.buildRemaining<before[0],
  'first pioneer should progress on his first site');
 assert.ok(two.base.buildRemaining<before[1],
  'second free pioneer should reach and build the parallel site');
});
