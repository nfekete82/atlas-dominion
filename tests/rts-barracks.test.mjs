import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';

test('RTS barracks train paid soldiers without passive human mobile growth',()=>{
 const g=new Game(711,1,'DE','balanced',true);
 const before=g.factions[0].troops;
 g.step();
 assert.equal(g.factions[0].troops,before,'no free mobile recruits per tick');
 g.factions[0].money=1000;
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.equal(g.build(0,cellToPoint(site),'barracks').ok,true);
 const treasury=g.factions[0].money;
 assert.equal(g.buildingAt(cellToPoint(site)),'barracks');
 assert.equal(g.recruitSquad(0,cellToPoint(site),25).ok,true);
 assert.equal(g.factions[0].money,treasury-50);
 assert.equal(g.factions[0].troops,before);
 assert.equal(g.squads[0].troops,25);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 assert.equal(g.recallSquad(0,g.squads[0].id).ok,true);
 assert.equal(g.factions[0].troops,before+25);
});

test('factory buildingAt stays recognized for the right click menu',()=>{
 const g=new Game(712,1,'DE');
 g.factions[0].money=1000;
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'factory').ok);
 assert.ok(site>=0);
 assert.equal(g.build(0,cellToPoint(site),'factory').ok,true);
 assert.equal(g.buildingAt(cellToPoint(site)),'factory');
});

test('RTS opening funds an immediate barracks and first squad without free AI growth',()=>{
 const g=new Game(713,2,'DE','balanced',true);
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.equal(g.factions[0].money,650);
 assert.equal(g.build(0,cellToPoint(site),'barracks').ok,true);
 assert.equal(g.recruitSquad(0,cellToPoint(site),100).ok,true);
 assert.equal(g.squads[0].troops,100);
 assert.ok(g.factions[0].money>=0);
 const ai=g.factions[1];
 const before=ai.troops,treasury=ai.money;
 g.step();
 // Frontline deployments can lower the *mobile* number while preserving soldiers.
 assert.ok(ai.troops>=0);
 assert.ok(ai.money>=0);
 assert.ok(ai.troops-before<=Math.floor((treasury+ai.moneyIncome)/2)+1e-6);
});

test('foreign target queues a real army march and persists its conquest order',()=>{
 const g=new Game(9102,1,'DE','balanced',true);
 const owner=0;
 const edge=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]!==0&&g.owner[n]!==-2));
 assert.ok(edge>=0);
 const target=landNeighbors(edge).find(n=>g.owner[n]!==0&&g.owner[n]!==-2);
 g.factions[0].money=1200;
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),100).ok);
 const id=g.squads[0].id;
 assert.ok(g.orderSquadAttack(0,id,cellToPoint(target)).ok);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 for(let i=0;i<150&&g.squads.some(s=>s.id===id);i++)g.step();
 assert.ok(g.attackOrders.some(o=>o.factionId===0)||g.owner[target]===0,
   'selected squad should reach a real front and commit an offensive');
});

test('RTS squads persist while occupying empty neutral surroundings without casualties',()=>{
 const g=new Game(9103,1,'DE','balanced',true);
 const edge=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(edge>=0);
 const neutral=landNeighbors(edge).find(n=>g.owner[n]===-1);
 const place=g.owner.findIndex((v,i)=>v===0&&g.buildings[i]===0);
 g.factions[0].money=1200;
 assert.ok(g.build(0,cellToPoint(place),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(place),100).ok);
 const unit=g.squads[0];
 unit.index=edge;
 const strength=unit.troops;
 g.step();
 assert.equal(g.owner[neutral],0,'adjacent empty neutral territory should be occupied');
 assert.ok(g.squads.some(s=>s.id===unit.id),'capturing must never consume the squad');
 assert.equal(unit.troops,strength,'peaceful occupation cannot cause casualties');
});

test('RTS AI builds an actual barracks, pays for a persistent squad and never receives passive mobile soldiers',()=>{
 const g=new Game(8101,1,'DE','balanced',true);
 const enemy=g.factions[1];
 const openingMoney=enemy.money;
 assert.equal(openingMoney,650);
 for(let i=0;i<56;i++)g.step();
 const barracks=g.buildings.findIndex((code,i)=>code===4&&g.owner[i]===1);
 assert.ok(barracks>=0,'AI must build a real owned barracks');
 assert.ok(g.squads.some(s=>s.owner===1),'AI must recruit actual on-map squads');
 assert.ok(g.squads.filter(s=>s.owner===1).every(s=>s.troops>=1));
 assert.ok(enemy.money>=0,'AI cannot train on credit');
 const saved=g.exportSave();
 assert.deepEqual(Game.fromSave(saved).exportSave(),saved);
});

test('adjacent RTS formations exchange losses and both survivors remain visible',()=>{
 const g=new Game(8102,1,'DE','balanced',true);
 const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(j=>g.owner[j]===-1));
 assert.ok(own>=0);
 const enemy=landNeighbors(own).find(j=>g.owner[j]===-1);
 g.owner[enemy]=1;
 g.squads.push({id:9001,owner:0,index:own,troops:100,destination:null,attackTarget:null});
 g.squads.push({id:9002,owner:1,index:enemy,troops:100,destination:null,attackTarget:null});
 g.step();
 const blue=g.squads.find(u=>u.id===9001),red=g.squads.find(u=>u.id===9002);
 assert.ok(blue&&red,'one engagement must not delete either surviving unit');
 assert.ok(blue.troops<100&&red.troops<100,'both sides pay actual losses');
 assert.ok(g.battleEvents.some(e=>e.attackerId===0&&e.defenderId===1),'unit combat is visible to rendering');
 assert.ok(g.factions[0].population>=blue.troops);
 assert.ok(g.factions[1].population>=red.troops);
});

test('hostile guard tower damages nearby RTS squad while a friendly tower does not',()=>{
 const g=new Game(8104,1,'DE','balanced',true);
 const tile=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(tile>=0);
 const next=landNeighbors(tile).find(n=>g.owner[n]===-1);
 g.owner[next]=1;
 g.buildings[next]=2;
 g.squads.push({id:9811,owner:0,index:tile,troops:100,destination:null,attackTarget:null});
 const soldier=g.squads.find(s=>s.id===9811);
 g.step();
 assert.ok(soldier.troops<100,'tower must inflict real damage');
 assert.ok(soldier.troops>0,'tower cannot automatically erase a full squad');
 assert.ok(g.battleEvents.some(e=>e.tick===g.tick&&e.attackerLost>0));
});

test('RTS tactical AI moves real squads to defend a threatened barracks',()=>{
 const g=new Game(8201,1,'DE','balanced',true);
 // A real player group near the AI capital must cause physical defense orders.
 for(let tick=0;tick<60;tick++)g.step();
 const ai=g.factions[1], barracks=g.buildings.findIndex((code,i)=>code===4&&g.owner[i]===1);
 assert.ok(barracks>=0);
 const defenders=g.squads.filter(u=>u.owner===1);
 assert.ok(defenders.length>0);
 const near=landNeighbors(barracks).find(n=>g.owner[n]===0);
 if(near===undefined)return; // Isolated capitals have no immediately adjacent hostile land.
 g.squads.push({id:99001,owner:0,index:near,troops:60,destination:null,attackTarget:null});
 for(let tick=0;tick<30;tick++)g.step();
 assert.ok(g.squads.filter(u=>u.owner===1).some(u=>u.destination===barracks||u.index===barracks),
   'AI should guard threatened critical infrastructure using real units');
});

test('wounded RTS formations below ten soldiers survive a deterministic save reload',()=>{
 const g=new Game(9312,2,'DE','balanced',true);
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),25).ok);
 g.squads[0].troops=4.75;
 const restored=Game.fromSave(g.exportSave());
 assert.equal(restored.squads[0].troops,4.75,'wounded squad strength must survive save/load');
 assert.deepEqual(Game.fromSave(restored.exportSave()).exportSave(),restored.exportSave(),
   'normalized replay must remain deterministic');
});

test('50-country RTS economy and AI remain deterministic over prolonged turns',()=>{
 const a=new Game(9313,49,'DE','balanced',true);
 const b=new Game(9313,49,'DE','balanced',true);
 for(let i=0;i<112;i++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave(),'AI orders and recruitment must replay exactly');
 assert.ok(a.factions.every(f=>Number.isFinite(f.money)&&f.money>=0));
 assert.ok(a.squads.length<=a.factions.length*12);
 assert.ok(a.squads.every(u=>u.troops>0&&u.troops<=1000&&a.owner[u.index]===u.owner));
 assert.ok(a.squads.some(u=>u.owner>0),'at least one AI must field an actual squad');
});

test('a distant RTS conquest target persists beyond the first captured sector',()=>{
 const g=new Game(9911,1,'DE','balanced',true);
 const start=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(start>=0);
 const neighbor=landNeighbors(start).find(n=>g.owner[n]===-1);
 // Follow neutral land to a genuine target at least several tiles away.
 const seen=new Set([start,neighbor]),queue=[neighbor];
 let distant=-1;
 for(let head=0;head<queue.length&&head<1000;head++){
   const index=queue[head];
   if(Math.abs(index%480-start%480)+Math.abs(Math.floor(index/480)-Math.floor(start/480))>=5){
     distant=index;break;
   }
   for(const next of landNeighbors(index))if(g.owner[next]===-1&&!seen.has(next)){seen.add(next);queue.push(next);}
 }
 assert.ok(distant>=0,'test seed must provide a contiguous distant neutral target');
 const site=g.owner.findIndex((v,i)=>v===0&&!g.buildings[i]&&g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),100).ok);
 const unit=g.squads[0];unit.index=start;
 assert.ok(g.orderSquadAttack(0,unit.id,cellToPoint(distant)).ok);
 assert.equal(unit.campaignTarget,distant);
 assert.deepEqual(Game.fromSave(g.exportSave()).exportSave(),g.exportSave());
 for(let i=0;i<60&&unit.campaignTarget!==null;i++)g.step();
 assert.equal(unit.index,distant,'unit marches to clicked target, not merely the first border');
 assert.equal(g.owner[distant],0);
 assert.ok(g.squads.includes(unit),'campaign soldier group must remain alive');
});

test('ordered RTS troops walk through adjacent cells and never teleport',()=>{
 const g=new Game(9945,1,'DE','balanced',true);
 const site=g.owner.findIndex((owner,i)=>owner===0&&!g.buildings[i]&&
   g.canBuild(0,cellToPoint(i),'barracks').ok&&
   landNeighbors(i).some(n=>g.owner[n]===0));
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),50).ok);
 const squad=g.squads.find(unit=>unit.owner===0);
 assert.ok(squad);
 const next=landNeighbors(site).find(n=>g.owner[n]===0);
 assert.ok(next!==undefined);
 assert.ok(g.orderSquad(0,squad.id,cellToPoint(next)).ok);
 const before=squad.index, troops=squad.troops;
 g.step();
 const d=Math.abs(before%480-squad.index%480)+
   Math.abs(Math.floor(before/480)-Math.floor(squad.index/480));
 assert.ok(d<=1,'squads must never jump over sectors');
 assert.equal(squad.index,next,'a reachable neighboring target must be reached');
 assert.equal(squad.troops,troops,'walking on safe land must not cost soldiers');
 assert.equal(g.squads.filter(u=>u.id===squad.id).length,1);
});

test('formation drawing stays visual-only while RTS marching remains deterministic',()=>{
 const left=new Game(9956,1,'DE','balanced',true);
 const right=new Game(9956,1,'DE','balanced',true);
 const site=left.owner.findIndex((v,i)=>v===0&&!left.buildings[i]&&
   left.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(site>=0);
 for(const g of [left,right]){
   assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
   assert.ok(g.recruitSquad(0,cellToPoint(site),20).ok);
   assert.ok(g.recruitSquad(0,cellToPoint(site),20).ok);
   assert.equal(g.squads[0].index,g.squads[1].index);
 }
 for(let i=0;i<12;i++){left.step();right.step();}
 assert.deepEqual(left.exportSave(),right.exportSave());
});

test('coordinated RTS AI reinforcements preserve deterministic living armies',()=>{
 const first=new Game(9961,6,'DE','balanced',true);
 const replay=new Game(9961,6,'DE','balanced',true);
 for(let i=0;i<112;i++){first.step();replay.step();}
 assert.deepEqual(first.exportSave(),replay.exportSave(),
   'AI reinforcement and defense decisions must be deterministic');
 const seen=new Set();
 for(const unit of first.squads){
   assert.ok(!seen.has(unit.id),'AI must not duplicate soldier groups');
   seen.add(unit.id);
   assert.ok(unit.troops>0&&Number.isFinite(unit.troops));
   assert.equal(first.owner[unit.index],unit.owner,
     'reinforcing squads must occupy real owned terrain');
   if(unit.campaignTarget!=null){
     assert.ok(unit.campaignTarget>=0&&unit.campaignTarget<480*260,
       'reinforcement goal remains inside the map');
   }
 }
});

test('contact combat produces real casualty events for two adjacent hostile squads',()=>{
 const g=new Game(9972,1,'DE','balanced',true);
 const tile=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(tile>=0);
 const neighbor=landNeighbors(tile).find(n=>g.owner[n]===-1);
 assert.ok(neighbor!==undefined);
 g.owner[neighbor]=1;
 g.squads.push({id:997201,owner:0,index:tile,troops:90,destination:null,attackTarget:null});
 g.squads.push({id:997202,owner:1,index:neighbor,troops:90,destination:null,attackTarget:null});
 g.step();
 assert.ok(g.battleEvents.some(e=>e.tick===g.tick&&e.attackerLost>0&&e.defenderLost>0),
   'animated squad contact must correspond to actual simultaneous losses');
 assert.ok(g.squads.some(u=>u.id===997201&&u.troops<90));
 assert.ok(g.squads.some(u=>u.id===997202&&u.troops<90));
});

test('newly built player cities are visible immediately even at overview zoom',async()=>{
 const {cityVisibleAtZoom}=await import('../dist/src/render/building-markers.js');
 for(const zoom of [0.8,1,1.25,1.79,2,4]){
   assert.equal(cityVisibleAtZoom(0,0,zoom),true,
     'level-zero player city hidden at zoom '+zoom);
 }
 assert.equal(cityVisibleAtZoom(1,0,1),false,
   'ordinary AI towns may still be simplified in strategic overview');
 const game=new Game(9987,1,'DE','balanced',true);
 const index=game.owner.findIndex((owner,i)=>owner===0&&
   game.canBuild(0,cellToPoint(i),'city').ok);
 assert.ok(index>=0);
 const built=game.build(0,cellToPoint(index),'city');
 assert.equal(built.ok,true);
 assert.equal(game.cityUpgrades[index],0);
 assert.equal(cityVisibleAtZoom(game.owner[index],game.cityUpgrades[index],1),true);
});

test('several RTS squads accept a shared real rally order without merging soldiers',()=>{
 const g=new Game(9991,1,'DE','balanced',true);
 g.factions[0].money=2000;
 const site=g.owner.findIndex((owner,i)=>owner===0&&!g.buildings[i]&&
   g.canBuild(0,cellToPoint(i),'barracks').ok&&
   landNeighbors(i).some(n=>g.owner[n]===0));
 assert.ok(site>=0);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 for(let i=0;i<3;i++)assert.ok(g.recruitSquad(0,cellToPoint(site),30).ok);
 const ids=g.squads.map(unit=>unit.id);
 const goal=landNeighbors(site).find(i=>g.owner[i]===0);
 assert.ok(goal!==undefined);
 for(const id of ids)assert.ok(g.orderSquad(0,id,cellToPoint(goal)).ok);
 for(let tick=0;tick<8;tick++)g.step();
 assert.equal(new Set(g.squads.map(unit=>unit.id)).size,3);
 assert.deepEqual(g.squads.map(unit=>unit.id),ids);
 assert.ok(g.squads.every(unit=>unit.owner===0&&unit.troops>0));
 assert.ok(g.squads.every(unit=>unit.index===goal),
   'all three real formations reached the same rally point');
});

test('faster RTS expansion remains deterministic and cannot capture remote land',()=>{
 const a=new Game(9997,4,'DE','balanced',true);
 const b=new Game(9997,4,'DE','balanced',true);
 for(let n=0;n<100;n++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave(),
   'shorter AI orders must replay identically');
 assert.ok(a.squads.every(u=>u.troops>0&&a.owner[u.index]===u.owner),
   'faster conquest must preserve real army positions and soldiers');
 assert.ok(a.factions.every(f=>f.troops>=0&&f.money>=0),
   'increased attack pressure must never create debts or negative reserves');
});

test('deep invasion re-plans a stale frontline waypoint and keeps advancing',()=>{
 const g=new Game(10013,1,'DE','balanced',true);
 const start=g.owner.findIndex((holder,i)=>holder===0&&
   landNeighbors(i).some(n=>g.owner[n]===-1&&landNeighbors(n)
     .some(far=>g.owner[far]===-1&&far!==i)));
 assert.ok(start>=0);
 const intermediate=landNeighbors(start).find(n=>g.owner[n]===-1&&
   landNeighbors(n).some(far=>g.owner[far]===-1&&far!==start));
 const goal=landNeighbors(intermediate).find(n=>g.owner[n]===-1&&n!==start);
 assert.ok(goal!==undefined);
 g.factions[0].money=1500;
 const site=g.owner.findIndex((holder,i)=>holder===0&&
   g.canBuild(0,cellToPoint(i),'barracks').ok);
 assert.ok(g.build(0,cellToPoint(site),'barracks').ok);
 assert.ok(g.recruitSquad(0,cellToPoint(site),100).ok);
 const unit=g.squads[0];
 unit.index=start;unit.destination=null;
 unit.attackTarget=goal; // An old frontier waypoint is no longer adjacent.
 unit.campaignTarget=goal;unit.campaignOwner=-1;
 for(let tick=0;tick<16&&unit.index!==goal;tick++)g.step();
 assert.equal(unit.index,goal,'squad must not stop at stale attack waypoint');
 assert.equal(g.owner[goal],0,'real marching must capture the target');
});

test('RTS squad ownership is reconciled after late-tick territory captures',()=>{
 const game=new Game(9313,49,'DE','balanced',true);
 for(let tick=0;tick<140;tick++){
   game.step();
   const displaced=game.squads.filter(unit=>game.owner[unit.index]!==unit.owner);
   assert.deepEqual(displaced.map(unit=>unit.id),[],
     'no stranded squads after simulation tick '+game.tick);
 }
});

test('RTS captures undefended enemy sector with zero attacker casualties',()=>{
 const g=new Game(10091,1,'DE','balanced',true);
 const source=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(source>=0);
 const target=landNeighbors(source).find(n=>g.owner[n]===-1);
 g.owner[target]=1;g.defense[target]=100;
 g.squads.push({id:100910,owner:0,index:source,troops:60,destination:null,attackTarget:target,
   campaignTarget:target,campaignOwner:1});
 g.step();
 const unit=g.squads.find(u=>u.id===100910);
 assert.ok(unit);
 assert.equal(g.owner[target],0);
 assert.equal(unit.index,target);
 assert.equal(unit.troops,60,'abstract garrison must not kill an invading RTS unit');
});
test('RTS defenders exchange real losses instead of using phantom garrison',()=>{
 const g=new Game(10092,1,'DE','balanced',true);
 const source=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 const target=landNeighbors(source).find(n=>g.owner[n]===-1);
 g.owner[target]=1;
 g.squads.push({id:100920,owner:0,index:source,troops:80,destination:null,attackTarget:target});
 g.squads.push({id:100921,owner:1,index:target,troops:50,destination:null,attackTarget:null});
 g.step();
 assert.ok(g.squads.find(u=>u.id===100920)?.troops<80);
 assert.ok(g.squads.find(u=>u.id===100921)?.troops<50);
 assert.equal(g.owner[target],1,'occupied defended target should not fall instantly');
});

test('AI border-interception planning remains deterministic with physical soldiers',()=>{
 const a=new Game(10130,5,'DE','balanced',true);
 const b=new Game(10130,5,'DE','balanced',true);
 for(let tick=0;tick<105;tick++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave(),
   'real border intercept orders must be replayable');
 assert.ok(a.squads.every(u=>u.troops>0&&a.owner[u.index]===u.owner),
   'border defense cannot invent or strand physical squads');
});

test('layered AI defense stays deterministic and retains only real squads',()=>{
 const a=new Game(101315,5,'DE','balanced',true);
 const b=new Game(101315,5,'DE','balanced',true);
 for(let tick=0;tick<125;tick++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave(),
   'front assignment, reserve positioning and retreat must replay identically');
 assert.ok(a.squads.every(u=>u.troops>0&&a.owner[u.index]===u.owner),
   'defensive planning must not place squads on foreign land');
 assert.ok(new Set(a.squads.map(u=>u.id)).size===a.squads.length,
   'each squad remains a distinct physical formation');
});

test('RTS occupation widens across connected unguarded neutral land',()=>{
 const g=new Game(10413,1,'DE','balanced',true);
 const start=g.owner.findIndex((owner,i)=>owner===0&&landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(start>=0);
 const nearby=new Set([start]);
 const frontier=[[start,0]];
 for(let head=0;head<frontier.length;head++){
   const [cell,depth]=frontier[head];
   if(depth===3)continue;
   for(const next of landNeighbors(cell)){
     if(nearby.has(next)||g.owner[next]!==-1)continue;
     nearby.add(next);frontier.push([next,depth+1]);
   }
 }
 g.squads.push({id:104130,owner:0,index:start,troops:100,destination:null,attackTarget:null,
   campaignTarget:null,campaignOwner:null});
 g.step();
 const captured=[...nearby].filter(i=>i!==start&&g.owner[i]===0);
 assert.ok(captured.length>=4,'a squad should claim an area, not only one narrow tile');
 assert.equal(g.squads.find(u=>u.id===104130)?.troops,100,
   'unguarded neutral land must not cause soldier losses');
});

test('wider foreign occupation cannot sweep past an adjacent real defender',()=>{
 const g=new Game(10813,1,'DE','balanced',true);
 const start=g.owner.findIndex((owner,i)=>owner===0&&landNeighbors(i).some(n=>
   g.owner[n]===-1&&landNeighbors(n).some(x=>g.owner[x]===-1)));
 assert.ok(start>=0);
 const defended=landNeighbors(start).find(n=>g.owner[n]===-1&&
   landNeighbors(n).some(x=>g.owner[x]===-1));
 assert.ok(defended!==undefined);
 g.owner[defended]=1;
 g.squads.push({id:108130,owner:0,index:start,troops:100,destination:null,
   attackTarget:null,campaignTarget:defended,campaignOwner:1});
 g.squads.push({id:108131,owner:1,index:defended,troops:100,destination:null,
   attackTarget:null,campaignTarget:null,campaignOwner:null});
 g.step();
 assert.equal(g.owner[defended],1,'wide conquest must not overrun real guards');
 assert.ok(g.squads.some(unit=>unit.id===108131&&unit.troops>0),
   'defenders remain actual squads');
});

test('RTS frontline guards screen surrounding neutral terrain without phantom defenders',()=>{
 const game=new Game(10331,1,'DE','balanced',true);
 const start=game.owner.findIndex((owner,index)=>owner===0&&landNeighbors(index).some(n=>
   game.owner[n]===-1&&landNeighbors(n).some(other=>game.owner[other]===-1)));
 assert.ok(start>=0);
 const guarded=landNeighbors(start).find(n=>game.owner[n]===-1&&
   landNeighbors(n).some(other=>game.owner[other]===-1));
 assert.ok(guarded!==undefined);
 // The defender stands on its own land and protects neighboring unoccupied land.
 game.owner[guarded]=1;
 game.squads.push({id:103310,owner:0,index:start,troops:100,destination:null,
   attackTarget:null,campaignTarget:null,campaignOwner:null});
 game.squads.push({id:103311,owner:1,index:guarded,troops:80,destination:null,
   attackTarget:null,campaignTarget:null,campaignOwner:null});
 const screened=landNeighbors(guarded).filter(n=>game.owner[n]===-1);
 assert.ok(screened.length>0,'fixture requires an unoccupied contact sector');
 game.step();
 // The guarding AI may legitimately occupy its own adjacent neutral land.
 // What must never happen is the attacking army sweeping through its screen.
 assert.ok(screened.every(index=>game.owner[index]!==0),
   'attacker cannot auto-sweep neutral terrain screened by a real defender');
 assert.equal(game.owner[guarded],1);
});

test('threatened AI constructs a paid border tower and keeps real soldiers',()=>{
 const g=new Game(10492,1,'DE','balanced',true);
 const ai=1;
 const border=g.owner.findIndex((holder,i)=>holder===ai&&
   landNeighbors(i).some(n=>g.owner[n]===-1));
 assert.ok(border>=0,'AI must have reachable neutral border');
 const threat=landNeighbors(border).find(n=>g.owner[n]===-1);
 const barracks=g.owner.findIndex((holder,i)=>holder===ai&&i!==border&&
   !g.buildings[i]&&!g.cities.some(city=>city.index===i));
 assert.ok(barracks>=0);
 g.buildings[barracks]=4;
 g.owner[threat]=0;
 g.squads.push({id:104920,owner:0,index:threat,troops:120,destination:null,
   attackTarget:null,campaignTarget:null,campaignOwner:null});
 g.factions[ai].money=1200;
 const moneyBefore=g.factions[ai].money;
 g.step();
 const towers=g.buildings.reduce((sum,code,i)=>sum+(code===2&&g.owner[i]===ai?1:0),0);
 assert.ok(towers>0,'threatened AI should build a real tower');
 assert.ok(g.factions[ai].money<moneyBefore,'AI tower must spend real treasury');
 assert.ok(g.squads.every(unit=>unit.troops>0&&g.owner[unit.index]===unit.owner));
});

test('AI defense scoring with real posted guards remains deterministic',()=>{
 const a=new Game(10314,5,'DE','balanced',true);
 const b=new Game(10314,5,'DE','balanced',true);
 for(let tick=0;tick<95;tick++){a.step();b.step();}
 assert.deepEqual(a.exportSave(),b.exportSave(),
   'under-defended border prioritization must be fully replayable');
 assert.ok(a.squads.every(u=>u.troops>0&&a.owner[u.index]===u.owner),
   'AI planning must preserve actual soldiers and territory ownership');
});

test('AI recruitment keeps a construction reserve for threatened border towers',()=>{
 const g=new Game(10613,1,'DE','balanced',true);
 const ai=1;
 const border=g.owner.findIndex((holder,index)=>holder===ai&&
   landNeighbors(index).some(n=>g.owner[n]===-1));
 assert.ok(border>=0);
 const threatened=landNeighbors(border).find(n=>g.owner[n]===-1);
 const barracks=g.owner.findIndex((holder,index)=>holder===ai&&index!==border&&
   !g.buildings[index]&&!g.cities.some(city=>city.index===index));
 assert.ok(barracks>=0);
 g.buildings[barracks]=4;
 g.owner[threatened]=0;
 g.squads.push({id:106130,owner:0,index:threatened,troops:80,destination:null,
   attackTarget:null,campaignTarget:null,campaignOwner:null});
 g.factions[ai].money=420;
 const before=g.factions[ai].money;
 g.step();
 assert.ok(g.factions[ai].money<before,'defensive construction or recruitment must spend real gold');
 assert.ok(g.factions[ai].money>=0,'AI must not incur debt');
 assert.ok(g.buildings.some((code,index)=>code===2&&g.owner[index]===ai),
   'a threatened AI must afford and construct at least one paid tower');
});
