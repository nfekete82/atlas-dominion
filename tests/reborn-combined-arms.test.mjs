import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS,canAttack} from '../dist/src/reborn/catalog.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
const advance=(g,s,dt=.05)=>{for(let i=0;i<Math.round(s/dt);i++)g.step(dt);};
const peaceful=()=>{const g=new Simulation();g.aiClock=-1e8;g.units=[];return g;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('combined: heavy infantry defeats four simultaneous riflemen with more than half health remaining',()=>{
 for(const owner of [0,1]){
  const g=peaceful(),heavy=g.spawn(owner,{x:1900,y:2100},'heavy');for(let i=0;i<4;i++)g.spawn(1-owner,{x:2040+i*5,y:2060+i*28});g.updateVision();advance(g,12);
  assert.equal(g.units.filter(u=>u.owner!==owner).length,0);assert.ok(heavy.hp>UNITS.heavy.hp*.5);assert.equal(UNITS.heavy.cost,250);
 }
});

test('combined: rocket launcher outranges a turret, creates travelling saved missiles, damages only on impact and keeps ground targeting',()=>{
 const g=peaceful(),u=g.spawn(0,{x:1900,y:2100},'artillery'),b={...g.bases[1],id:1400,x:2550,y:2100,kind:'turret',hp:650,radius:30,queue:[],queueTypes:[],cooldown:0};g.bases.push(b);g.updateVision();
 assert.ok(UNITS.artillery.range>RULES.turret.range);assert.ok(UNITS.artillery.sight>RULES.turret.sight);assert.equal(g.canSee(0,b),true);g.command([u.id],{x:b.x,y:b.y,kind:'attack',target:b.id});g.step();assert.equal(g.missiles.length,1);assert.equal(b.hp,650);assert.equal(g.shots.at(-1).weapon,'rocket');
 const loaded=Simulation.load(g.save());loaded.aiClock=-1e8;g.paused=true;advance(g,2);assert.equal(b.hp,650);g.paused=false;
 advance(g,1.8);advance(loaded,1.8);near(b.hp,530);near(loaded.bases.find(v=>v.id===b.id).hp,530);assert.equal(g.missiles.length,0);advance(g,23);assert.ok(b.hp<=0);assert.equal(u.hp,UNITS.artillery.hp);
 assert.equal(canAttack(u,{kind:'bomber'}),false);assert.equal(canAttack({kind:'heavy'},{kind:'bomber'}),true);
});

function passengers(g,h,count=10){return Array.from({length:count},(_,i)=>g.spawn(h.owner,{x:h.x-60+(i%3)*25,y:h.y-30+Math.floor(i/3)*24},['infantry','medic','engineer','heavy'][i%4]));}
test('transport: ten real passengers board only after landing, preserve HP, capacity and identity, then unload on real ground and take off',()=>{
 const g=peaceful(),h=g.spawn(0,{x:1900,y:2100},'scout'),troops=passengers(g,h),hp=troops.map(u=>u.hp);const count=g.count(0);
 assert.equal(g.transports.board(h.id,troops.map(u=>u.id)),10);g.step();assert.equal(h.transport.cargo.length,0);assert.ok(h.flightHeight<1&&h.flightHeight>0);advance(g,10);assert.equal(h.transport.phase,'cruise');assert.equal(h.flightHeight,1);assert.equal(h.transport.cargo.length,10);assert.equal(g.count(0),count);assert.ok(troops.every(u=>u.carrier===h.id));
 const extra=g.spawn(0,{x:1830,y:2100});assert.equal(g.transports.board(h.id,[extra.id]),0);assert.equal(g.command([troops[0].id],{kind:'move',x:2400,y:2100}),0);
 const raw=g.save(),loaded=Simulation.load(raw);loaded.aiClock=-1e8;assert.deepEqual(loaded.units.find(u=>u.id===h.id).transport,h.transport);assert.ok(raw.units.find(u=>u.id===h.id).transport.site.transport===undefined,'no nested carrier snapshots');
 assert.ok(g.transports.unload(h.id,{x:2200,y:2100}));advance(g,10);assert.equal(h.transport.phase,'cruise');assert.equal(h.transport.cargo.length,0);assert.equal(h.flightHeight,1);assert.ok(troops.every(u=>!u.carrier&&g.world.walkable(u,g.obstacles())&&distance(u,h)<90));assert.deepEqual(troops.map(u=>u.hp),hp);assert.equal(g.count(0),count+1);
});

test('transport: boarding rejects enemies, vehicles and a second carrier; stop interrupts boarding and saved landing resumes',()=>{
 const g=peaceful(),h=g.spawn(0,{x:1900,y:2100},'scout'),own=passengers(g,h,2),enemy=g.spawn(1,{x:1870,y:2100}),tank=g.spawn(0,{x:1870,y:2140},'tank'),other=g.spawn(0,{x:2000,y:2100},'scout');
 assert.equal(g.transports.board(h.id,[enemy.id,tank.id,other.id]),0);assert.equal(g.transports.board(h.id,own.map(u=>u.id)),2);advance(g,.4);const loaded=Simulation.load(g.save());loaded.aiClock=-1e8;advance(loaded,6);assert.equal(loaded.units.find(u=>u.id===h.id).transport.cargo.length,2);
 g.stop([h.id]);advance(g,3);assert.equal(h.transport.phase,'cruise');assert.equal(h.transport.cargo.length,0);assert.ok(own.every(u=>!u.carrier&&!u.orders.length));
});

test('transport: passengers do not fight or enter spatial capture/vision queries; carrier destruction removes them exactly once',()=>{
 const g=peaceful(),h=g.spawn(0,{x:1900,y:2100},'scout'),troops=passengers(g,h,4);g.transports.board(h.id,troops.map(u=>u.id));advance(g,7);
 assert.ok(troops.every(u=>!g.spatial.query(h,200).includes(u)),'carried soldiers are absent from combat and capture queries');
 const enemy=g.spawn(1,{x:h.x+100,y:h.y});enemy.cooldown=100;const before=enemy.hp;g.updateVision();advance(g,1);assert.equal(enemy.hp,before,'no offensive passenger or transporter shooting');
 h.hp=0;g.step();assert.ok(troops.every(u=>u.hp<=0));assert.ok(!g.units.some(u=>u.carrier));assert.equal(g.count(0),0);g.step();assert.equal(g.count(0),0);
});

test('transport: invalid cargo duplication and malformed missile states are rejected; old scout/heavy health migrates once',()=>{
 const g=peaceful(),h=g.spawn(0,{x:1900,y:2100},'scout'),u=g.spawn(0,{x:1860,y:2100},'heavy');g.transports.board(h.id,[u.id]);advance(g,5);const bad=g.save();bad.units.find(v=>v.id===h.id).transport.cargo.push(u.id);assert.throws(()=>Simulation.load(bad));
 const malformed=g.save();malformed.missiles=[{id:5000,source:h.id,owner:0,from:{x:1900,y:2100},to:{x:2200,y:2100},at:g.time,impactAt:g.time-1,damage:120,angle:0}];assert.throws(()=>Simulation.load(malformed));
 const legacy=peaceful();legacy.spawn(0,{x:1900,y:2100},'heavy');legacy.spawn(0,{x:2000,y:2100},'scout');const old=legacy.save();delete old.rosterVersion;old.units[0].hp=190;old.units[1].hp=160;const migrated=Simulation.load(old);assert.equal(migrated.units[0].hp,420);assert.equal(migrated.units[1].hp,360);assert.equal(Simulation.load(migrated.save()).units[0].hp,420);
});

test('assets: both factions have a twelve-tube rocket vehicle and ten-seat tandem-rotor transport with registered MG sockets',()=>{
 for(const owner of [0,1]){
  const rocket=JSON.parse(fs.readFileSync(`src/assets/reborn/animation/artillery-${owner}.json`)),heli=JSON.parse(fs.readFileSync(`src/assets/reborn/animation/scout-${owner}.json`));assert.equal(rocket.design.tubes,12);assert.equal(heli.design.seats,10);assert.ok(heli.rotor);assert.ok(heli.frames.every(f=>f.muzzle?.every(Number.isFinite)));assert.ok(rocket.clips.barrel.frames.every(row=>rocket.frames[row[0]].muzzle));
 }
});

function monitor(g,seconds){
 const ledger={units:[],orders:[],births:[],destroyedBuildings:[],buildings:[],spent:0,earned:0,healing:0,rocketDistances:[]},knownUnits=new Set(g.units.map(u=>u.id)),enemyBuildings=g.bases.filter(b=>b.owner===0&&b.hp>0),recruit=g.recruit.bind(g),build=g.build.bind(g);g.recruit=(id,k='infantry')=>{const before=g.credits[1],ok=recruit(id,k);if(ok&&g.bases.find(b=>b.id===id)?.owner===1){ledger.units.push(k);ledger.orders.push({kind:k,time:g.time,visibleAir:g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&UNITS[u.kind].flying&&g.canSee(1,u)).length});ledger.spent+=UNITS[k].cost;near(before-g.credits[1],UNITS[k].cost);}return ok;};
 g.build=(owner,k,p,workers)=>{const before=g.credits[owner],b=build(owner,k,p,workers);if(b&&owner===1){assert.ok(workers?.length);ledger.buildings.push(k);ledger.spent+=BUILDINGS[k].cost;near(before-g.credits[1],BUILDINGS[k].cost);}return b;};
 for(let i=0;i<seconds/.1&&g.status==='playing';i++){const clock=g.incomeClock,income=g.income(1);g.step(.1);for(const u of g.units)if(!knownUnits.has(u.id)){knownUnits.add(u.id);if(u.owner===1)ledger.births.push({id:u.id,kind:u.kind,time:g.time});}for(const b of enemyBuildings)if(b.hp<=0&&g.canSee(1,b)&&!ledger.destroyedBuildings.some(dead=>dead.id===b.id))ledger.destroyedBuildings.push({id:b.id,kind:b.kind,time:g.time});if(clock+.1+1e-8>=10)ledger.earned+=income;if(g.workEffects.some(e=>e.kind==='heal'))ledger.healing++;for(const shot of g.shots.filter(s=>s.weapon==='rocket'&&s.at===g.time))ledger.rocketDistances.push(distance(shot.groundFrom,shot.groundTo));}
 return ledger;
}
for(const version of [0,2])test(`combined economy: deterministic v${version} midgame physically builds all three facilities and pays for a mixed army`,()=>{
 const g=new Simulation(2026,version);g.credits[1]=4000;const initial=g.credits[1],ledger=monitor(g,220),produced=new Set(ledger.units.filter(k=>!['engineer','medic','scout'].includes(k)));
 assert.ok(produced.size>=3);for(const kind of ['barracks','factory','airfield']){assert.ok(ledger.buildings.includes(kind));assert.ok(g.bases.some(b=>b.owner===1&&b.kind===kind&&b.buildRemaining===0));}
 assert.ok(ledger.units.includes('engineer'));assert.ok(ledger.units.includes('medic'));assert.ok(ledger.units.includes('tank'));near(g.credits[1],initial+ledger.earned-ledger.spent);assert.ok(g.credits[1]>=0);
 const loaded=Simulation.load(g.save());assert.deepEqual(loaded.tactical.state.economy,g.tactical.state.economy);assert.equal(loaded.world.mapVersion,version);
});


function counterFixture(air=false){
 const g=new Simulation(2026,air?4:0);g.world.blocked.fill(0);g.world.opaque.fill(0);g.units=[];g.aiClock=3;g.time=30;g.credits[1]=8000;
 Object.assign(g.bases[1],{x:900,y:2100});Object.assign(g.bases[0],{x:3000,y:3000});
 for(const t of g.territories){t.owner=1;t.neighbors=[];}g.territories[1].owner=-1;g.territories[1].point={x:2000,y:2200};g.territories[1].neighbors=[0];g.territories[0].point={x:900,y:2100};g.territories[0].neighbors=[1];
 for(const [i,kind] of ['barracks','factory','airfield'].entries())g.bases.push({...g.bases[1],id:1500+i,kind,x:650+i*260,y:2450,radius:BUILDINGS[kind].radius,hp:BUILDINGS[kind].hp,queue:[],queueTypes:[]});
 for(let i=0;i<6;i++)g.spawn(1,{x:1100+(i%3)*30,y:2050+Math.floor(i/3)*30},i<2?'heavy':'infantry');
 if(air){for(let i=0;i<5;i++){const enemy=g.spawn(0,{x:2100+i*10,y:2200},'bomber');enemy.cooldown=10000;g.stop([enemy.id],true);}const observer=g.spawn(1,{x:1900,y:2200});observer.cooldown=10000;g.stop([observer.id],true);}
 else {
  const tower={...g.bases[0],id:1700,kind:'turret',x:2000,y:2200,radius:30,hp:650,queue:[],queueTypes:[],cooldown:0};g.bases.push(tower);
  const observer=g.spawn(1,{x:1800,y:2150});observer.cooldown=10000;g.stop([observer.id],true);g.updateVision();Object.assign(observer,{x:1100,y:2100});
 }
 g.updateVision();return g;
}

test('combined counters: observed towers lead to paid artillery, actual support healing and tower destruction',()=>{
 const g=counterFixture();for(const u of g.units.filter(u=>u.kind==='heavy'))u.hp=100;const initial=g.credits[1],ledger=monitor(g,100);
 assert.ok(ledger.units.includes('artillery'));assert.ok(ledger.births.some(u=>u.kind==='artillery'),'the paid artillery order must finish and create a real unit');assert.ok(g.units.some(u=>u.owner===1&&u.kind==='artillery'));assert.ok(ledger.units.includes('medic'));assert.ok(ledger.healing>0,'paid medic must actually heal wounded troops');
 // Combined arms may destroy the tower before the slower artillery gets a shot; the separate rocket test proves standoff range and impact damage.
 assert.ok(ledger.destroyedBuildings.some(b=>b.id===1700&&b.kind==='turret'),'the army must actually destroy the observed tower in sight');assert.ok(g.bases.every(b=>b.id!==1700||b.hp<=0));
 const rocket=g.units.find(u=>u.owner===1&&u.kind==='artillery');assert.ok(rocket.hp>0);near(g.credits[1],initial+ledger.earned-ledger.spent);
});

test('combined air response: a known air attacker produces actual heavy infantry and does not select ground rockets as air defense',()=>{
 const g=counterFixture(true),ledger=monitor(g,75),responses=ledger.orders.filter(o=>o.visibleAir>0);
 assert.ok(responses.some(o=>o.kind==='heavy'),'a paid heavy infantry must be ordered while the air threat is actually visible');
 assert.ok(responses.every(o=>!['artillery','bomber'].includes(o.kind)),'ground-only weapons must not be purchased as the response to a visible air threat');
 assert.ok(ledger.births.some(u=>u.kind==='heavy'),'a paid heavy infantry order must finish and create a real unit');
 assert.ok(g.units.some(u=>u.owner===1&&u.kind==='heavy'));
});

test('combined strategic air: a rich army with a known military target eventually fields a paid bomber',()=>{
 const g=counterFixture();g.credits[1]=15000;const observer=g.spawn(1,{x:2700,y:2700},'scout');g.updateVision();Object.assign(observer,{x:900,y:2300});
 const ledger=monitor(g,100);assert.ok(ledger.units.includes('bomber'));assert.ok(g.units.some(u=>u.owner===1&&u.kind==='bomber'));
});


test('transport: defensive machine-gun bursts answer a real attack, without autonomous hunting',()=>{
 const g=peaceful(),h=g.spawn(0,{x:1900,y:2100},'scout'),enemy=g.spawn(1,{x:2060,y:2100});g.updateVision();g.stop([enemy.id],true);enemy.cooldown=100;advance(g,1);assert.equal(enemy.hp,100);
 enemy.cooldown=0;advance(g,.3);assert.ok(h.hp<UNITS.scout.hp);assert.equal(enemy.hp,100-UNITS.scout.damage);const shots=g.shots.filter(s=>s.source===h.id);assert.equal(shots.length,3);assert.ok(shots.every(s=>s.weapon==='rifle'));
});

test('combined recovery: wounded infantry physically retreat, save their recovery state, heal and become available again',()=>{
 const g=counterFixture();g.aiClock=-1e8;g.credits[1]=0;g.units=[];g.bases.find(b=>b.id===1700).cooldown=10000;
 for(let i=0;i<5;i++)g.spawn(1,{x:1100+i*25,y:2050});const wounded=g.spawn(1,{x:1300,y:2100},'heavy');wounded.hp=80;const medic=g.spawn(1,{x:1000,y:2250},'medic');g.updateVision();g.tactical.plan();
 assert.ok(g.tactical.state.recovering.includes(wounded.id));assert.ok(!g.tactical.state.group.includes(wounded.id));assert.ok(wounded.orders[0].x<wounded.x);assert.deepEqual(Simulation.load(g.save()).tactical.state.recovering,[wounded.id]);
 let healed=false;for(let i=0;i<400;i++){g.step(.1);if(g.workEffects.some(e=>e.source===medic.id&&e.target===wounded.id&&e.kind==='heal'))healed=true;if(i%30===0)g.tactical.plan();}
 assert.ok(healed);assert.ok(wounded.hp>=UNITS.heavy.hp*.8);assert.ok(!g.tactical.state.recovering.includes(wounded.id));
});

test('combined reconnaissance: a spare rover and transport helicopter explore outside the main combat group and known turret range',()=>{
 const g=counterFixture();g.aiClock=-1e8;g.credits[1]=0;g.bases.find(b=>b.id===1700).cooldown=10000;const rover=g.spawn(1,{x:1100,y:2250},'rover'),heli=g.spawn(1,{x:1100,y:2300},'scout');g.updateVision();g.tactical.plan();
 for(const u of [rover,heli]){assert.equal(u.orders[0]?.tactical?.mode,'safe');assert.ok(!g.tactical.state.group.includes(u.id));}advance(g,10);
 for(const u of [rover,heli])assert.ok(distance(u,{x:2000,y:2200})>RULES.turret.range);assert.equal(g.canSee(1,{x:2000,y:2200}),true);
});

test('combined knowledge: visible enemy transports reveal no hidden passenger strength, types or targets to the AI',()=>{
 const a=counterFixture(),b=counterFixture();for(const g of [a,b]){g.aiClock=-1e8;g.credits[1]=0;g.spawn(0,{x:1300,y:2100},'scout');g.visible[1].fill(1);}
 const h=b.units.find(u=>u.kind==='scout'),passenger=b.spawn(0,h,'heavy');assert.notEqual(passenger.id,h.id);assert.equal(passenger.kind,'heavy');passenger.carrier=h.id;h.transport={phase:'cruise',task:'load',site:{x:h.x,y:h.y},cargo:[passenger.id],pickup:[],clock:0,transfer:0,resume:[]};
 a.tactical.plan();b.tactical.plan();assert.deepEqual(b.tactical.state,a.tactical.state);assert.deepEqual(b.units.filter(u=>u.owner===1).map(u=>u.orders),a.units.filter(u=>u.owner===1).map(u=>u.orders));
});
