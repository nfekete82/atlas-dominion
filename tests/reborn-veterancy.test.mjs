import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {getVeterancyLevel,getVeterancyModifiers,gainUnitXp,sanitizeXp,XP_RULES} from '../dist/src/reborn/veterancy.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const advance=(g,n)=>{for(let i=0;i<Math.round(n/.05);i++)g.step(.05);};
const fixture=()=>{const g=new Simulation();g.aiClock=-1e8;g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);return g;};

test('veterancy: exact thresholds, invalid XP, cumulative cap and bounded role modifiers',()=>{
 for(const [xp,level] of [[0,0],[99.99,0],[100,1],[249.99,1],[250,2],[499.99,2],[500,3],[1e8,3],[-1,0],[NaN,0],[Infinity,0],['500',0],[null,0]])assert.equal(getVeterancyLevel(xp),level);
 for(const kind of Object.keys(UNITS)){
  assert.ok(Object.values(getVeterancyModifiers({kind,xp:0})).every(v=>v===1));
  const u={kind,xp:490};gainUnitXp(u,20,'kill');assert.equal(u.xp,510);assert.equal(getVeterancyLevel(u.xp),3);gainUnitXp(u,Infinity,'damage');assert.equal(u.xp,510);gainUnitXp(u,1e20,'damage');assert.equal(u.xp,XP_RULES.max);
  assert.ok(Object.values(getVeterancyModifiers(u)).every(v=>v>=1&&v<=1.2));assert.deepEqual(getVeterancyModifiers(u),getVeterancyModifiers({kind,xp:500}));
 }
 assert.equal(sanitizeXp({valueOf:()=>500}),0);
 assert.deepEqual([100,250,500].map(xp=>getVeterancyModifiers({kind:'infantry',xp}).fireRate),[1.08,1.12,1.16]);
 assert.deepEqual([100,250,500].map(xp=>getVeterancyModifiers({kind:'medic',xp}).healRate),[1.1,1.15,1.2]);
 assert.deepEqual([100,250,500].map(xp=>getVeterancyModifiers({kind:'engineer',xp}).buildRate),[1,1.1,1.15]);
});
for(const owner of [0,1])test(`veterancy: faction ${owner} earns only applied damage and one kill bonus, including overkill and dead targets`,()=>{
 const g=fixture(),u=g.spawn(owner,{x:1900,y:2100}),target=g.spawn(1-owner,{x:1950,y:2100},'tank');target.hp=7;
 g.strike(u,target,5);near(u.xp,.5);assert.equal(target.hp,2);g.strike(u,target,200);near(u.xp,.7+20);assert.equal(target.hp,0);
 g.strike(u,target,200);near(u.xp,20.7);g.strike(u,u,1);near(u.xp,20.7);
});
test('veterancy: real burst hits award XP, cooldown and damage use role bonuses once',()=>{
 for(const xp of [0,100,250,500]){
  const g=fixture(),u=g.spawn(0,{x:1900,y:2100}),t=g.spawn(1,{x:1980,y:2100},'tank');u.xp=xp;u.hold=true;t.cooldown=1e8;t.hold=true;g.updateVision();g.step();
  const m=getVeterancyModifiers({kind:'infantry',xp}),applied=17*m.damage/3;near(t.hp,620-applied);near(u.xp,xp+applied*.1);near(u.cooldown,.85/m.fireRate);advance(g,.2);near(t.hp,620-17*m.damage);
 }
 const g=fixture(),u=g.spawn(0,{x:1900,y:2100});advance(g,1);assert.equal(u.xp,0,'no shots/no hits give no XP');
});
test('veterancy: rockets and AoE credit actual source for each real hit, never decorative work',()=>{
 const g=fixture(),u=g.spawn(0,{x:1900,y:2100},'artillery'),a=g.spawn(1,{x:2300,y:2100},'tank'),b=g.spawn(1,{x:2320,y:2100},'tank');a.hp=5;b.hp=10;u.cooldown=a.cooldown=b.cooldown=1e8;
 g.launch(u,a);g.missiles[0].impactAt=.05;g.step();near(u.xp,41.5);assert.equal(a.hp,0);assert.equal(b.hp,0);g.step();near(u.xp,41.5);
 g.work('build',u.id,g.bases[0].id,1000);near(u.xp,41.5);
});
for(const owner of [0,1])test(`veterancy: faction ${owner} healing and repair award applied HP; self-care and full-health actions give none`,()=>{
 const g=fixture(),m=g.spawn(owner,{x:1900,y:2100},'medic'),t=g.spawn(owner,{x:1940,y:2100});t.hp=20;g.step();near(t.hp,20.6);near(m.xp,.15);
 m.hp=50;t.hp=100;g.step();assert.ok(m.hp>50);near(m.xp,.15);
 m.hp=100;g.step();near(m.xp,.15);
 const e=g.spawn(owner,{x:2100,y:2100},'engineer'),v=g.spawn(owner,{x:2150,y:2100},'tank');v.hp=619.7;g.step();near(v.hp,620);near(e.xp,.06);g.step();near(e.xp,.06);
 const h=g.bases[owner];e.x=h.x+h.radius+32;e.y=h.y;h.hp-=.3;g.command([e.id],{...h,kind:'repair',target:h.id});g.step();near(e.xp,.12);g.step();near(e.xp,.12);
});
test('veterancy: elite medic has increased healing radius and rate; engineer repair and build rates remain capped',()=>{
 const g=fixture(),m=g.spawn(0,{x:1900,y:2100},'medic'),t=g.spawn(0,{x:1975,y:2100});m.xp=250;t.hp=10;g.step();near(t.hp,10+12*1.15*.05);near(g.healRadius(m),77);
 const e=g.spawn(0,{x:2100,y:2100},'engineer'),v=g.spawn(0,{x:2150,y:2100},'tank');e.xp=500;v.hp=10;g.step();near(v.hp,10+18*1.2*.05);
});
test('veterancy: construction XP is proportional to applied work, completion shared once; pause/cancel give none',()=>{
 const g=fixture();g.explored[0].fill(1);g.credits[0]=5000;
 let p;for(let y=2100;y<3400&&!p;y+=40)for(let x=300;x<1700;x+=40)if(!g.buildError(0,'barracks',{x,y})){p={x,y};break;}
 const e=g.spawn(0,{x:p.x+85,y:p.y},'engineer'),b=g.build(0,'barracks',p,[e.id]);assert.ok(b);g.step();near(e.xp,.1);near(b.buildRemaining,11.95);
 g.paused=true;advance(g,1);near(e.xp,.1);g.paused=false;
 b.buildRemaining=.025;g.step();near(e.xp,.15+20);const xp=e.xp;g.step();near(e.xp,xp);
 const other={...b,id:1900,kind:'generator',buildRemaining:5,hp:125,x:b.x+400};g.bases.push(other);e.workingTarget=null;g.cancelConstruction(other.id);near(e.xp,xp);
 // Rank bonuses affect real construction, with the pre-existing team cap retained.
 const engineers=[e,g.spawn(0,{x:b.x-85,y:b.y},'engineer')];b.buildRemaining=5;for(const u of engineers){u.xp=500;g.command([u.id],{...b,kind:'build',target:b.id});}g.step();near(b.buildRemaining,5-.05*1.5);
});
test('veterancy: old/corrupt saves sanitize XP without changing HP, transports retain passenger XP',()=>{
 const g=fixture(),u=g.spawn(0,{x:1900,y:2100}),heli=g.spawn(0,{x:1900,y:2100},'scout');u.xp=278.75;u.hp=57;u.carrier=heli.id;heli.transport={phase:'cruise',cargo:[u.id],pickup:[],resume:[],transfer:0,clock:0,task:'load',site:{x:1900,y:2100}};
 const s=g.save(),loaded=Simulation.load(s),passenger=loaded.units.find(v=>v.id===u.id);assert.equal(passenger.xp,278.75);assert.equal(passenger.hp,57);assert.equal(passenger.carrier,heli.id);assert.equal(Simulation.load(loaded.save()).units.find(v=>v.id===u.id).xp,278.75);
 for(const bad of [undefined,NaN,Infinity,-10,'500',{}]){const s=g.save();s.units[0].xp=bad;const a=Simulation.load(s).units[0];assert.equal(a.xp,0);assert.equal(a.hp,57);}
});
test('veterancy: same seeds, orders and XP produce identical authoritative results',()=>{
 const a=fixture(),b=fixture();for(const g of [a,b]){const u=g.spawn(0,{x:1900,y:2100}),t=g.spawn(1,{x:2000,y:2100},'heavy');u.xp=250;t.xp=100;g.updateVision();advance(g,4);}assert.deepEqual(a.save(),b.save());
});
test('veterancy: active Humvee bursts survive save/load and retain earned experience without duplicate hits',()=>{
 const g=fixture(),u=g.spawn(0,{x:1900,y:2100},'rover'),t=g.spawn(1,{x:1980,y:2100},'tank');u.xp=250;u.hold=t.hold=true;t.cooldown=1e8;g.updateVision();g.step();assert.ok(u.burst);const restored=Simulation.load(g.save());restored.aiClock=-1e8;restored.world.blocked.fill(0);restored.world.opaque.fill(0);
 advance(g,.2);advance(restored,.2);near(restored.units.find(v=>v.id===t.id).hp,t.hp);near(restored.units.find(v=>v.id===u.id).xp,u.xp);
});
