import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES,mapLayout,distance} from '../dist/src/reborn/config.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {inside} from '../dist/src/reborn/world.js';
import {angleDifference} from '../dist/src/reborn/sprite-animator.js';
import {turretMuzzles} from '../dist/src/reborn/turret.js';
const advance=(g,s,dt=.05)=>{for(let i=0;i<Math.round(s/dt);i++)g.step(dt);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const fixture=()=>{const g=new Simulation();g.aiClock=-1e8;g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);return g;};
const turret=(g,owner,p={x:1600,y:1800})=>{const b={...g.bases[owner],...p,owner,id:1300+owner,kind:'turret',hp:650,radius:30,queue:[],queueTypes:[],turretAngle:Math.PI,cooldown:1.2};g.bases.push(b);return b;};
const opponent=(g,owner,p,kind='infantry')=>{const u=g.spawn(1-owner,p,kind);u.cooldown=1000;g.stop([u.id],true);return u;};

for(const owner of [0,1])for(const kind of ['infantry','tank','scout'])test(`defense: faction ${owner} tracks ${kind} at 500, rotates during reload, fires aligned from both muzzles`,()=>{
 const g=fixture(),b=turret(g,owner),u=opponent(g,owner,{x:2100,y:1800},kind);g.updateVision();assert.equal(g.canSee(owner,u),true);g.visible[owner].fill(0);
 const hp=u.hp;g.step();assert.equal(b.turretTarget,u.id);assert.equal(u.hp,hp);near(Math.abs(angleDifference(Math.PI,b.turretAngle)),Math.PI*.05);assert.ok(b.cooldown>0);
 for(let i=0;i<40&&!g.shots.some(s=>s.source===b.id);i++)g.step();assert.equal(u.hp,hp-6);advance(g,.25);assert.equal(u.hp,hp-24);const shots=g.shots.filter(s=>s.source===b.id);assert.equal(shots.length,4);assert.deepEqual(shots.map(s=>s.barrel),[0,1,0,1]);for(const shot of shots)assert.deepEqual(shot.from,turretMuzzles(b,b.turretAngle)[shot.barrel]);
 const angle=b.turretAngle;g.paused=true;advance(g,1);near(b.turretAngle,angle);g.paused=false;Object.assign(u,{x:1600,y:2300});g.step(.1);assert.ok(Math.abs(angleDifference(angle,b.turretAngle))<=Math.PI*.1+1e-9);
});

test('defense: a bastion is not a combat target; nearby enemy units are acquired at 500 and locks remain stable',()=>{
 const g=fixture(),t=g.territories[14],p={x:t.point.x,y:t.point.y+20},b=turret(g,0,{x:p.x-500,y:p.y}),a=opponent(g,0,p),c=opponent(g,0,{x:p.x+50,y:p.y});
 const snapshot=structuredClone(t);g.updateVision();g.step();assert.equal(b.turretTarget,a.id);Object.assign(c,{x:b.x+100,y:b.y+70});g.step();assert.equal(b.turretTarget,a.id);a.hp=0;g.step();assert.equal(b.turretTarget,c.id);assert.deepEqual(t,snapshot);
});

test('defense: sight extends to 750 but weapon range ends at exactly 600',()=>{
 const g=fixture(),b=turret(g,0),u=opponent(g,0,{x:b.x+700,y:b.y});g.updateVision();assert.equal(BUILDINGS.turret.sight,750);assert.equal(RULES.turret.range,600);assert.equal(g.canSee(0,u),true);advance(g,2);assert.equal(b.turretTarget,null);assert.equal(u.hp,100);
 Object.assign(u,{x:b.x+600,y:b.y});g.updateVision();g.step();assert.equal(b.turretTarget,u.id);Object.assign(u,{x:b.x+600.01,y:b.y});g.step();assert.equal(b.turretTarget,null);
});

for(const kind of ['infantry','scout'])test(`defense: shared faction vision cannot shoot ${kind} through massive rocks or buildings`,()=>{
 const g=fixture(),b=turret(g,0),u=opponent(g,0,{x:b.x+500,y:b.y},kind);const observer=g.spawn(0,{x:u.x,y:u.y+100},'scout');observer.cooldown=1000;g.stop([observer.id],true);
 const index=g.world.index({x:b.x+250,y:b.y});g.world.blocked[index]=g.world.opaque[index]=1;g.updateVision();assert.equal(g.canSee(0,u),true);advance(g,2);assert.equal(b.turretTarget,null);assert.equal(u.hp,UNITS[kind].hp);
 g.world.blocked[index]=g.world.opaque[index]=0;g.bases.push({...g.bases[0],id:1400,kind:'factory',x:b.x+250,y:b.y,radius:70,queue:[],queueTypes:[]});g.updateVision();advance(g,2);assert.equal(b.turretTarget,null);assert.equal(u.hp,UNITS[kind].hp);
});

test('maps: 16 connected sectors give each faction two fair starts, equal income, spaced headquarters and open construction ground',()=>{
 for(const seed of [0,2026,4294967295]){
  const g=Simulation.campaign(seed),layout=mapLayout(g.world.mapVersion);assert.equal(g.world.mapVersion,2);assert.equal(g.territories.length,16);assert.deepEqual([0,1,-1].map(owner=>g.territories.filter(t=>t.owner===owner).length),[2,2,12]);assert.equal(g.income(0),35);assert.equal(g.income(1),35);
  const visited=new Set([0]),queue=[0];for(const id of queue)for(const n of g.territories[id].neighbors)if(!visited.has(n)){visited.add(n);queue.push(n);}assert.equal(visited.size,16);
  g.explored[0].fill(1);g.credits[0]=10000;
  for(const t of g.territories){
   const mirror=g.territories[15-t.id];near(t.point.x+mirror.point.x,RULES.worldSize);near(t.point.y+mirror.point.y,RULES.worldSize);assert.equal(t.income,mirror.income);assert.ok(inside(t.point,t.polygon));
   for(const n of t.neighbors)assert.ok(g.territories[n].neighbors.includes(t.id));
   assert.ok(g.bases.every(b=>distance(b,t.point)>300));
   const minX=Math.min(...t.polygon.map(p=>p.x)),maxX=Math.max(...t.polygon.map(p=>p.x)),minY=Math.min(...t.polygon.map(p=>p.y)),maxY=Math.max(...t.polygon.map(p=>p.y));let free=0;
   for(let y=minY+70;y<maxY-70;y+=100)for(let x=minX+70;x<maxX-70;x+=100)if(inside({x,y},t.polygon)&&!g.buildError(0,'barracks',{x,y}))free++;
   assert.ok(free>=8,`insufficient building room: ${seed}/${t.id}/${free}`);
  }
  assert.equal(layout.columns,4);assert.equal(layout.rows,4);near(g.bases[0].x+g.bases[1].x,RULES.worldSize);near(g.bases[0].y+g.bases[1].y,RULES.worldSize);
 }
});

test('maps: new capture, income, AI expansion and two-start-sector victory all work',()=>{
 const g=Simulation.campaign(2026);g.aiClock=-1e8;const t=g.territories.find(t=>t.owner===-1&&t.neighbors.some(i=>g.territories[i].owner===0));
 g.command([g.units[0].id],{...t.point,kind:'move'});advance(g,30);assert.equal(t.owner,0);assert.equal(g.income(0),35+t.income);
 const ai=Simulation.campaign(2026);advance(ai,150);assert.ok(ai.territories.filter(t=>t.owner===1).length>2);assert.ok(ai.count(1)>1);
 const victory=Simulation.campaign(123);victory.aiClock=-1e8;for(const b of victory.bases)b.owner=0;victory.territories[2].owner=0;victory.step();assert.equal(victory.status,'playing');victory.territories[3].owner=0;victory.step();assert.equal(victory.status,'victory');
});

test('maps: original geometry fingerprints for both 30-sector versions stay identical',()=>{
 const baselines=JSON.parse(readFileSync(new URL('./fixtures/reborn-legacy-maps.json',import.meta.url)));
 // Retain the terrain, structures and original soldiers in the reference hash;
 // the new starting builders are independently verified by the progression tests.
 for(const {version,seed,hash} of baselines){const g=new Simulation(seed,version),geometry={generated:g.world.generated,blocked:Array.from(g.world.blocked),territories:g.territories,bases:g.bases,units:g.units.filter(u=>u.kind==='infantry')};assert.equal(createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),hash,`${version}/${seed}`);assert.equal(g.territories.length,30);}
});

test('maps: 0/1/2 saves preserve map size, production, money, healing, construction and version-specific victory rules',()=>{
 for(const version of [0,1,2]){
  const g=new Simulation(2026,version);g.aiClock=-1e8;g.credits[0]=5000;const b=g.bases[0],soldier=g.units[0];soldier.hp=20;
  const medic=g.spawn(0,g.world.nearest({x:soldier.x+35,y:soldier.y},g.obstacles()),'medic');g.command([medic.id],{x:soldier.x,y:soldier.y,kind:'heal',target:soldier.id});
  const worker=g.spawn(0,g.world.nearest({x:b.x+130,y:b.y+140},g.obstacles()),'engineer');let site;
  for(let radius=190;radius<=450&&!site;radius+=35)for(let i=0;i<24;i++){const p={x:b.x+Math.cos(i*Math.PI/12)*radius,y:b.y+Math.sin(i*Math.PI/12)*radius};if(!g.buildError(0,'barracks',p)){site=p;break;}}
  assert.ok(site);const construction=g.build(0,'barracks',site,[worker.id]);assert.ok(construction);g.recruit(b.id,'engineer');advance(g,.5);
  const saved=g.save();if(version===0)delete saved.mapVersion;const loaded=Simulation.load(saved);assert.equal(loaded.world.mapVersion,version);assert.equal(loaded.territories.length,version===2?16:30);assert.deepEqual(loaded.territories,g.territories);assert.deepEqual(loaded.credits,g.credits);assert.deepEqual(loaded.bases,g.bases);
  assert.deepEqual(loaded.units.find(u=>u.id===medic.id).orders,medic.orders);assert.equal(loaded.units.find(u=>u.id===worker.id).orders[0].kind,'build');assert.equal(loaded.bases.find(b=>b.id===construction.id).buildRemaining,construction.buildRemaining);
  const bad=g.save();bad.territories=bad.territories.slice(1);assert.throws(()=>Simulation.load(bad));
  const goals=mapLayout(version).starts[1];for(const base of loaded.bases.filter(b=>b.kind==='headquarters'))base.owner=0;for(const id of goals)loaded.territories[id].owner=0;loaded.step();assert.equal(loaded.status,'victory');
 }
});

test('maps: new headquarters have mirrored safe production exits while legacy maps retain their original rules',()=>{
 const g=Simulation.campaign(2026);g.aiClock=-1e8;g.units=[];for(const b of g.bases)assert.ok(g.recruit(b.id));advance(g,7);assert.equal(g.units.length,2);
 const a=g.units.find(u=>u.owner===0),b=g.units.find(u=>u.owner===1);near(a.x+b.x,RULES.worldSize);near(a.y+b.y,RULES.worldSize);for(const u of g.units)assert.ok(g.world.walkable(u,g.obstacles()));
});
