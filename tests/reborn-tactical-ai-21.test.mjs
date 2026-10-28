import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assignScreen,assignFlank} from '../dist/src/reborn/battle-squads.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {distance} from '../dist/src/reborn/config.js';

const soldier=(id,kind,x,y,hp=100)=>({id,kind,x,y,hp});
test('AI 2.1: the screen intercepts a visible threat with at most two mobile frontline fighters',()=>{
 const force=[soldier(1,'infantry',100,100),soldier(2,'heavy',105,100,420),
  soldier(3,'tank',115,100,620),soldier(4,'rover',125,100,295),
  soldier(5,'artillery',110,100,340),soldier(6,'medic',100,100),
  soldier(7,'engineer',130,100)];
 const threat=soldier(90,'infantry',180,100);
 const a=assignScreen(force,threat);
 assert.ok(a.length>0&&a.length<=2);
 assert.ok(!a.includes(5)&&!a.includes(6)&&!a.includes(7),'support and rockets must not chase');
 assert.deepEqual(assignScreen(structuredClone(force),structuredClone(threat)),a);
 const flank=assignFlank(force,a);
 assert.ok(flank.length>=1&&flank.every(id=>!a.includes(id)));
 assert.ok(flank.every(id=>[2,3,4].includes(id)));
});
test('AI 2.1: only living mobile units can flank; air threats do not trick ground-only artillery',()=>{
 const force=[soldier(1,'infantry',0,0),soldier(2,'tank',20,0,620),soldier(3,'rover',25,0,295)];
 const air=soldier(90,'bomber',80,0,700);
 assert.ok(assignScreen(force,air).every(id=>[1,2,3].includes(id)));
 assert.deepEqual(assignFlank([soldier(3,'rover',0,0,50),soldier(2,'tank',10,0,100)],[]),[]);
});
test('AI 2.1: runtime diagnostics do not mutate authoritative game saves',()=>{
 const g=new Simulation(2026,4),save=g.save();
 g.tactical.diagnostics.evaluated=12;
 g.tactical.diagnostics.screenOrders=4;
 assert.deepEqual(g.save(),save);
 g.tactical.restore(g.tactical.state);
 assert.equal(g.tactical.diagnostics.evaluated,0);
});
test('AI 2.1: visible contact creates truly different issued orders with identical rosters',()=>{
 const setup=mode=>{
  const g=new Simulation(2026,4);
  g.tactical.planningMode=mode;g.aiClock=1e6;g.time=90;
  g.units=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
  const target=g.territories.find(t=>t.owner===0);
  assert.ok(target);
  const red=[...Array.from({length:4},(_,i)=>g.spawn(1,{x:target.point.x-160+i*8,y:target.point.y+35+i*5},'infantry')),
    ...Array.from({length:2},(_,i)=>g.spawn(1,{x:target.point.x-145+i*16,y:target.point.y-35-i*7},'tank'))];
  const defenders=[];
  for(let i=0;i<3;i++){
    const enemy=g.spawn(0,{x:target.point.x+8+i*16,y:target.point.y+3+i*8},'infantry');
    defenders.push(enemy.id);enemy.cooldown=100;
  }
  const state=g.tactical.state,origin={x:target.point.x-200,y:target.point.y};
  state.commander={version:1,phase:'offensive',phaseSince:80,recon:[],survey:[],intel:[],aborted:0,
    mission:{kind:'capture',sector:target.id,objective:null,x:target.point.x,y:target.point.y,since:89,progressAt:89,
      distance:distance(origin,target.point)}};
  state.group=red.map(u=>u.id);state.launchSize=red.length;state.groupId=3;
  state.phase='attack';state.phaseAt=80;state.target=target.id;state.objective=null;
  state.rally=origin;state.progressAt=89;state.lastProgress=distance(origin,target.point);
  g.updateVision();
  const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
  g.tactical.campaign(g.units.filter(u=>u.owner===1),red,[],home);
  return {g,red,defenders};
 };
 const old=setup('classic'),modern=setup('tactical');
 assert.equal(modern.g.tactical.diagnostics.evaluated,1,'forecast must actually run with visible defenders');
 assert.ok(modern.g.tactical.diagnostics.screenOrders>0,'new director must issue screen orders');
 assert.deepEqual(old.red.map(u=>u.id),modern.red.map(u=>u.id),'same starting roster');
 const oldEnemyIds=new Set(old.defenders),newEnemyIds=new Set(modern.defenders);
 const oldTargets=old.red.filter(u=>u.orders[0]?.kind==='attack'&&oldEnemyIds.has(u.orders[0].target)).length;
 const newTargets=modern.red.filter(u=>u.orders[0]?.kind==='attack'&&newEnemyIds.has(u.orders[0].target)).length;
 assert.ok(oldTargets>0,'classic director must actually focus a visible defender');
 assert.ok(newTargets<oldTargets,'new director should commit fewer fighters to a single defender: '+newTargets+' vs '+oldTargets);
 assert.ok(modern.red.some(u=>u.orders[0]&&
   (u.orders[0].kind==='attackMove'||u.orders[0].kind==='attack'&&!newEnemyIds.has(u.orders[0].target))),
   'unscreened fighters must retain a distinct mission order, including structure attacks');
 assert.equal(Object.values(modern.g.tactical.diagnostics.choices).reduce((a,b)=>a+b,0),1);
});
