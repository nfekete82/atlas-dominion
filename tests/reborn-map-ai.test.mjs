import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapLayout,mapWorldSize} from '../dist/src/reborn/config.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step(.05);};

for(const [version,sectors,size] of [[3,4,2200],[4,8,3000],[5,12,3762]]){
 test(`maps: layout v${version} has ${sectors} sectors, valid HQs and stable save/reload`,()=>{
  const g=new Simulation(2026,version),layout=mapLayout(version);
  assert.equal(layout.columns*layout.rows,sectors);
  assert.equal(g.territories.length,sectors);
  assert.equal(g.world.size,size);
  assert.equal(mapWorldSize(version),size);
  assert.equal(g.credits[0],950);assert.equal(g.credits[1],950);
  for(const owner of [0,1]) {
   const b=g.bases.find(b=>b.owner===owner&&b.kind==='headquarters');
   assert.ok(b&&g.world.walkable(b),'each HQ needs walkable terrain');
   assert.equal(b.territory,layout.headquarters[owner]);
  }
  const restored=Simulation.load(g.save());
  assert.equal(restored.territories.length,sectors);
  assert.equal(restored.world.size,size);
  assert.deepEqual(restored.territories.map(t=>t.owner),g.territories.map(t=>t.owner));
 });
}

test('maps: old 16 and 30 sector saves remain supported',()=>{
 for(const version of [0,1,2]){
  const g=new Simulation(2026,version),snapshot=Simulation.load(g.save());
  assert.equal(snapshot.territories.length,version===2?16:30);
  assert.equal(snapshot.world.mapVersion,version);
 }
});

test('economy: one barracks, factory and airfield per faction, even while construction is underway',()=>{
 const g=new Simulation(2026,4);
 for(const owner of [0,1]){
  for(const kind of ['barracks','factory','airfield']){
   const b={...g.bases.find(b=>b.owner===owner),id:1800+g.bases.length,kind,hp:BUILDINGS[kind].hp,buildRemaining:BUILDINGS[kind].buildTime,radius:BUILDINGS[kind].radius};
   g.bases.push(b);
   const credits=g.credits[owner];
   const problem=g.buildError(owner,kind,b);
   assert.match(problem,/existiert bereits/);
   assert.equal(g.build(owner,kind,b),null);
   assert.equal(g.credits[owner],credits);
   b.hp=0;
   assert.notEqual(g.buildError(owner,kind,b),'Dieses Produktionsgebäude existiert bereits.');
  }
 }
});

test('economy: new mid-sized match builds a paid vehicle factory and fields vehicles',()=>{
 const g=new Simulation(2026,4);
 g.credits[1]=7500;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 for(let i=0;i<5;i++)g.spawn(1,g.world.nearest({x:home.x-180+(i%3)*35,y:home.y+150+Math.floor(i/3)*35},g.obstacles()),'infantry');
 step(g,110);
 const buildings=g.bases.filter(b=>b.owner===1&&b.hp>0);
 assert.ok(buildings.some(b=>b.kind==='barracks'&&b.buildRemaining===0),'barracks must be completed');
 assert.ok(buildings.some(b=>b.kind==='factory'&&b.buildRemaining===0),'factory must be completed');
 assert.ok(g.units.some(u=>u.owner===1&&['rover','tank','artillery'].includes(u.kind))
  || buildings.some(b=>b.kind==='factory'&&b.queueTypes.some(k=>['rover','tank','artillery'].includes(k))),
 'red AI must spend money on combat vehicles');
});

test('supply: a transport helicopter accepts real infantry for a forward airlift',()=>{
 const g=new Simulation(2026,5),home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 g.aiClock=-1e8;g.time=90;g.credits[1]=0;
 g.territories[8].owner=1;
 const h=g.spawn(1,{x:home.x-120,y:home.y+90},'scout');
 for(let i=0;i<8;i++)g.spawn(1,{x:home.x-190+(i%4)*30,y:home.y+170+Math.floor(i/4)*30},'heavy');
 g.updateVision();
 g.tactical.plan();
 assert.equal(g.tactical.state.airlift?.phase,'pickup');
 g.tactical.plan();
 assert.equal(g.tactical.state.airlift?.phase,'delivery');
 assert.ok(h.transport?.pickup.length>=2,'airlift must board existing paid-sized infantry units');
 step(g,9);
 assert.ok(h.transport?.cargo.length>=2,'troops must actually enter the helicopter');
 g.tactical.plan();
 assert.equal(h.transport?.task,'unload','helicopter must start flying to the forward sector');
 step(g,28);
 assert.equal(h.transport?.cargo.length,0,'the transport must unload its actual passengers');
 assert.ok(g.units.some(u=>u.owner===1&&u.kind==='heavy'&&!u.carrier
  &&Math.hypot(u.x-g.territories[8].point.x,u.y-g.territories[8].point.y)<420),
 'at least one passenger must arrive at the captured forward sector');
});

test('supply: a short direct infantry march keeps the helicopter on recon instead of paying loading delays',()=>{
 const g=new Simulation(2026,4),home=g.bases.find(b=>b.owner===1),enemy=g.bases.find(b=>b.owner===0);
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.time=90;g.credits[1]=0;g.territories[7].owner=1;
 g.memories[1].push({id:enemy.id,owner:0,kind:enemy.kind,hp:enemy.hp,x:enemy.x,y:enemy.y,territory:enemy.territory});
 const heli=g.spawn(1,{x:home.x-120,y:home.y+90},'scout');
 for(let i=0;i<8;i++)g.spawn(1,{x:home.x-190+i*12,y:home.y+170},'infantry');g.updateVision();g.tactical.plan();
 assert.equal(g.tactical.state.airlift,undefined);assert.equal(heli.transport,undefined);
 assert.ok(!g.units.some(u=>u.orders[0]?.kind==='board'));
});
