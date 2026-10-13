import { Game, cellToPoint, landNeighbors } from '../dist/src/engine/game.js';

const TOWER = 2, BARRACKS = 4;
function snapshot(g, defender=1) {
  const tiles = g.owner;
  let towers=0, barracks=0, border=0, defendedBorder=0;
  for (let i=0;i<tiles.length;i++) {
    if(tiles[i]!==defender) continue;
    if(g.buildings[i]===TOWER)towers++;
    if(g.buildings[i]===BARRACKS)barracks++;
    if(landNeighbors(i).some(j=>tiles[j]>=0&&tiles[j]!==defender)) {
      border++;
      if(g.squads.some(s=>s.owner===defender&&
        (s.index===i||landNeighbors(i).includes(s.index))))defendedBorder++;
    }
  }
  return {tick:g.tick,territory:g.factions[defender].territory,
    towers,barracks,defenderSquads:g.squads.filter(s=>s.owner===defender).length,
    defenderTroops:Math.round(g.squads.filter(s=>s.owner===defender)
      .reduce((total,s)=>total+s.troops,0)),
    borderSectors:border,guardedBorderSectors:defendedBorder,
    defensiveCoverage:border?+(100*defendedBorder/border).toFixed(1):null,
    defenderCasualties:+g.factions[defender].defenseSpent.toFixed(1),
    treasury:Math.round(g.factions[defender].money)};
}
function siege(strength) {
  const g=new Game(20261013,1,'DE','balanced',true);
  // Start at an owned AI border sector next to neutral terrain; turn only
  // the adjacent neutral staging tile into player land.
  const position=g.owner.findIndex((owner,index)=>owner===1&&
    landNeighbors(index).some(other=>g.owner[other]===-1));
  if(position<0)throw Error('No defender border found');
  const staging=landNeighbors(position).find(index=>g.owner[index]===-1);
  g.owner[staging]=0;
  g.squads.push({id:950000+strength,owner:0,index:staging,troops:strength,
    destination:null,attackTarget:null,campaignTarget:null,campaignOwner:null});
  g.factions[1].money=Math.max(g.factions[1].money,1200);
  const target=cellToPoint(position);
  const order=g.orderSquadAttack(0,950000+strength,target);
  if(!order.ok)throw Error(order.reason);
  const checkpoints=[0,8,24,48,96];
  const samples=[snapshot(g)];
  for(let t=1;t<=96;t++){
    g.step();
    if(checkpoints.includes(t))samples.push(snapshot(g));
    if(g.squads.some(s=>s.troops<=0||g.owner[s.index]!==s.owner))
      throw Error('Physical troop integrity violation at tick '+t);
  }
  return {scenario:'siege',attackerStrength:strength,samples};
}
function continent() {
  const g=new Game(20261013,49,'DE','balanced',true);
  const ticks=[0,100,200,300];
  const samples=[];
  for(let t=0;t<=300;t++){
    if(ticks.includes(t)){
      const ai=g.factions.filter(f=>f.ai);
      samples.push({tick:t,aiTowers:g.buildings.reduce((sum,c,i)=>sum+
        Number(c===TOWER&&g.owner[i]>0),0),
        aiBarracks:g.buildings.reduce((sum,c,i)=>sum+
        Number(c===BARRACKS&&g.owner[i]>0),0),
        activeAiSquads:g.squads.filter(s=>s.owner>0).length,
        countriesWithTowers:ai.filter(f=>g.buildings.some((code,i)=>
          code===TOWER&&g.owner[i]===f.id)).length});
    }
    if(t<300)g.step();
  }
  return {scenario:'50-nations',samples};
}
const results=[siege(100),siege(200),siege(300),continent()];
for(const result of results)console.log(JSON.stringify(result));
