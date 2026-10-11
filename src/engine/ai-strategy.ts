/** Deterministic front priorities give different AI countries different goals.
 * No magic omniscience: only local reserves, exposure and adjacent positions.
 */
export type AIStyle = 'expansion'|'aggressive'|'defensive'|'opportunist';
export const AI_STYLES:readonly AIStyle[] = ['expansion','aggressive','defensive','opportunist'];
export function aiStyle(id:number):AIStyle {return AI_STYLES[Math.abs(id)%AI_STYLES.length];}
export interface FrontFactors {
  neutral:boolean;
  advantage:number;
  friendlySides:number;
  capital:boolean;
  city:boolean;
  distance:number;
  opponentCommitted:number;
  opponentReserve:number;
  threatenedBorders:number;
  focus:boolean;
}
export function scoreAIFront(f:FrontFactors,style:AIStyle):number {
  const strategic=f.neutral?22:10+Math.min(50,Math.max(0,f.advantage-1)*29);
  const defensivePressure=f.threatenedBorders>8?Math.min(9,f.threatenedBorders/8):0;
  const targetWeakness=f.neutral?0:Math.max(0,Math.min(13,(f.opponentCommitted-f.opponentReserve)*.09));
  const tuning=style==='expansion'?(f.neutral?13:-5):
    style==='aggressive'?(!f.neutral?13:0):
    style==='defensive'?(f.neutral?3:-7-defensivePressure):
    (!f.neutral?targetWeakness*1.4:5);
  return strategic+tuning+f.friendlySides*2.1+(f.capital?9:0)+(f.city?7:0)
    +targetWeakness+(f.focus?8:0)-Math.max(0,f.distance)*.19;
}
