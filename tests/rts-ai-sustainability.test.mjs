import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,cellToPoint,landNeighbors} from '../dist/src/engine/game.js';
import {BUILDINGS,BUILDING_CODES} from '../dist/src/engine/economy.js';

function scenario(){
  const g=new Game(20261013,1,'DE','balanced',true);
  const site=g.owner.findIndex((owner,tile)=>owner===1&&
    g.canBuild(1,cellToPoint(tile),'barracks').ok);
  assert.ok(site>=0);
  g.buildings[site]=BUILDING_CODES.barracks;
  g.factions[1].money=0;
  g.tick=1;
  return {g,site};
}
function unit(id,index,troops,owner=1){
  return {id,owner,index,troops,destination:null,attackTarget:null,
    campaignTarget:null,campaignOwner:null};
}

test('AI waits for an operational paid army rather than filling slots with tiny groups',()=>{
  const {g}=scenario();
  const reserve=BUILDINGS.find(b=>b.type==='tower').cost;
  g.factions[1].money=reserve+198;
  g.commandRTSAI();
  assert.equal(g.squads.length,0);
  assert.equal(g.factions[1].money,reserve+198);
  g.factions[1].money+=2;
  g.commandRTSAI();
  assert.equal(g.squads.length,1);
  assert.equal(g.squads[0].troops,100);
  assert.equal(g.factions[1].money,reserve);
});

test('depleted armies reform only at their physical barracks and conserve every soldier',()=>{
  const {g,site}=scenario();
  const remote=landNeighbors(site).find(tile=>g.owner[tile]===1);
  assert.ok(remote!==undefined);
  const a=unit(100,site,16.5),b=unit(101,site,17.25);
  const marching=unit(102,site,12),away=unit(103,remote,11);
  marching.destination=remote;
  g.squads.push(a,b,marching,away);
  const reserve=g.factions[1].troops;
  const strength=g.squads.reduce((sum,s)=>sum+s.troops,0);
  g.commandRTSAI();
  assert.equal(g.squads.reduce((sum,s)=>sum+s.troops,0),strength);
  assert.equal(g.factions[1].troops,reserve);
  assert.equal(a.troops,33.75);
  assert.ok(!g.squads.includes(b));
  assert.ok(g.squads.includes(marching)&&g.squads.includes(away));
  assert.equal(marching.destination,remote);
});

test('a repeated alert preserves an existing defensive march',()=>{
  const {g,site}=scenario();
  const border=g.owner.findIndex((holder,tile)=>holder===1&&
    landNeighbors(tile).some(next=>g.owner[next]===-1));
  const enemy=landNeighbors(border).find(tile=>g.owner[tile]===-1);
  const destination=g.owner.findIndex((holder,tile)=>holder===1&&tile!==site&&tile!==border);
  assert.ok(enemy!==undefined&&destination>=0);
  g.owner[enemy]=0;
  const defender=unit(100,site,100);
  defender.destination=destination;
  g.squads.push(defender,unit(101,enemy,130,0));
  for(let pulse=0;pulse<3;pulse++){
    g.commandRTSAI();
    assert.equal(defender.destination,destination);
  }
});

test('nearby neutral expansion remains preferable after the opening cutoff',()=>{
  const {g,site}=scenario();
  const border=g.owner.findIndex((holder,tile)=>holder===1&&
    landNeighbors(tile).some(next=>g.owner[next]===-1));
  const tempting=landNeighbors(border).find(tile=>g.owner[tile]===-1);
  assert.ok(tempting!==undefined);
  g.owner[tempting]=0;
  g.capitalSites.add(tempting);
  const army=unit(100,site,100);
  g.squads.push(army);
  g.tick=241;
  g.commandRTSAI();
  assert.ok(army.campaignTarget!=null);
  assert.equal(army.campaignOwner,-1);
  assert.equal(g.owner[army.campaignTarget],-1);
});

test('peaceful expansion does not divert armies to empty remote ground, but protects infrastructure',()=>{
  const {g,site}=scenario();
  const home=g.cities.find(city=>city.original===1).index;
  const remote=g.owner.findIndex((holder,tile)=>holder===-1&&
    Math.abs(tile%480-home%480)+Math.abs(Math.floor(tile/480)-Math.floor(home/480))>25&&
    landNeighbors(tile).every(next=>g.owner[next]===-1));
  assert.ok(remote>=0);
  g.owner[remote]=1;
  const enemy=landNeighbors(remote)[0];
  g.owner[enemy]=0;
  const army=unit(100,site,100);
  g.squads.push(army,unit(101,enemy,130,0));
  g.commandRTSAI();
  assert.equal(army.destination,null,'an empty remote border must not pin the national army');
  assert.equal(army.campaignOwner,-1);
  army.campaignTarget=null;army.campaignOwner=null;
  g.buildings[remote]=BUILDING_CODES.city;
  g.commandRTSAI();
  assert.equal(army.destination,remote,'actual remote infrastructure still needs an immediate defense');
});

test('simultaneous contact fatalities cannot exceed the soldiers that actually exist',()=>{
  const {g}=scenario();
  const start=g.owner.findIndex((holder,tile)=>holder===0&&
    landNeighbors(tile).filter(next=>g.owner[next]===0).length>=2);
  const neighbors=landNeighbors(start).filter(tile=>g.owner[tile]===0).slice(0,2);
  assert.equal(neighbors.length,2);
  for(const tile of neighbors)g.owner[tile]=1;
  g.squads.push(unit(100,start,1,0),...neighbors.map((tile,i)=>unit(101+i,tile,100)));
  const before=g.squads.reduce((sum,s)=>sum+s.troops,0);
  g.resolveSquadContacts();
  const after=g.squads.reduce((sum,s)=>sum+s.troops,0);
  const fatalities=g.factions.reduce((sum,f)=>sum+f.attackFallen+f.defenseSpent,0);
  assert.equal(g.factions[0].attackFallen,1);
  assert.ok(Math.abs(before-after-fatalities)<1e-9);
});

test('an AI neutral campaign takes a legal detour instead of invading unrelated land',()=>{
  const {g}=scenario();
  const start=g.owner.findIndex((holder,tile)=>holder===1&&
    [tile+1,tile+2,tile+480,tile+481,tile+482].every(next=>g.owner[next]===1));
  assert.ok(start>=0);
  const blocker=start+1,target=start+2;
  // A narrow two-row fixture makes the hostile shortcut unambiguous.
  g.owner.fill(-2);
  for(const tile of [start,start+480,start+481,start+482])g.owner[tile]=1;
  g.owner[blocker]=0;
  g.owner[target]=-1;
  const army=unit(100,start,100);
  g.squads.push(army);
  assert.ok(g.orderSquadAttack(1,army.id,cellToPoint(target)).ok);
  g.moveSquads();
  assert.equal(g.owner[blocker],0,'peaceful occupation must leave the hostile shortcut alone');
  assert.equal(army.index,start+480,'the physical formation must use the legal friendly detour');
  assert.equal(g.factions[1].attackFallen,.55,
    'only the existing adjacent-border attrition applies, with no hostile occupation losses');
});

test('RTS campaign decisions continue identically after a save/load boundary',()=>{
  const a=new Game(221041,8,'DE','balanced',true);
  for(let i=0;i<500;i++)a.step();
  const b=Game.fromSave(a.exportSave());
  for(let i=0;i<100;i++){a.step();b.step();}
  assert.deepEqual(a.exportSave(),b.exportSave());
  assert.ok(a.squads.every(s=>s.troops>0&&a.owner[s.index]===s.owner));
});
