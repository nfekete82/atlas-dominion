import {TurnGame,type Province} from './turn-game.js';

/** Deterministic AI: uses the same public, paid commands as the human. */
export interface AiTurnSummary {faction:number;reinforced:number;upgraded:boolean;battles:number;conquered:number;}
const frontier=(g:TurnGame,p:Province):Province[] =>
  p.neighbors.map(i=>g.provinces[i]).filter(n=>n.owner!==p.owner);

/** Executes one faction's entire turn and advances to the next faction.
 * Never changes another faction's phase or grants free armies.
 */
export function playAiTurn(g:TurnGame):AiTurnSummary {
  const id=g.active;
  if(id===0)throw new Error('Human turn must be played by the user');
  if(g.phase!=='reinforce')throw new Error('AI must begin during reinforcement');
  const holdings=g.provinces.filter(p=>p.owner===id);
  const summary:AiTurnSummary={faction:id,reinforced:0,upgraded:false,battles:0,conquered:0};
  if(!holdings.length){
    for(let i=0;i<4;i++)g.nextPhase();
    return summary;
  }
  const pick=():Province => holdings.slice().sort((a,b)=>{
    const dangerA=frontier(g,a).length,dangerB=frontier(g,b).length;
    return dangerB-dangerA || b.cityLevel-a.cityLevel || a.id-b.id;
  })[0];
  const recipient=pick();
  const reinforcement=g.factions[id].reserve;
  if(reinforcement>0 && g.deploy(recipient.id,reinforcement).ok)summary.reinforced=reinforcement;
  g.nextPhase(); // develop
  const affordable=holdings.filter(p=>p.cityLevel<5).sort((a,b)=>b.cityLevel-a.cityLevel||a.id-b.id);
  for(const p of affordable){
    if(g.upgrade(p.id).ok){summary.upgraded=true;break;}
  }
  g.nextPhase(); // attack
  // Prefer unclaimed land; fight defended provinces only with a substantial advantage.
  const candidates=holdings.flatMap(p=>frontier(g,p).map(n=>({from:p,to:n,priority:
    (n.owner===-1?100:0)+p.troops-n.troops*2})))
    .filter(x=>x.from.troops>=4)
    .sort((a,b)=>b.priority-a.priority || a.to.id-b.to.id || a.from.id-b.from.id);
  const target=candidates.find(x=>x.to.owner===-1 || (x.from.troops>=x.to.troops*2+7 && x.from.troops>=12));
  if(target){
    for(let attempt=0;attempt<8;attempt++){
      if(target.to.owner===id || target.from.troops<=3)break;
      const result=g.attack(target.from.id,target.to.id,Math.min(3,target.from.troops-1));
      if(!result.ok)break;
      summary.battles++;
      if(result.captured){summary.conquered++;break;}
      if(target.from.troops<=target.to.troops+2)break;
    }
  }
  g.nextPhase(); // fortify
  // Armies keep their positions at first; no free movement.
  g.nextPhase(); // next faction
  return summary;
}

/** Complete all 49 computer factions, stopping when human planning resumes. */
export function playComputerRound(g:TurnGame):AiTurnSummary[]{
  const summaries:AiTurnSummary[]=[];
  for(let guard=0;guard<g.factions.length-1 && g.active!==0;guard++){
    summaries.push(playAiTurn(g));
  }
  if(g.active!==0)throw new Error('AI round did not return control to player');
  return summaries;
}
