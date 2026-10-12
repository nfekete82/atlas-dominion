/** Original ATLAS front-combat model inspired by continuous-border RTS design.
 * The formulas are independently calibrated for our 480×260 sector map,
 * 50 starting countries, population economy, and real local defense posts.
 * No OpenFront source code or assets are copied.
 */
export interface TileClash {
  attackTroops:number;
  defenderReserve:number;
  defenderPopulation:number;
  defenderTerritory:number;
  postedTroops:number;
  defenseStrength:number;
  /** Number of actual orthogonally adjacent attacker-owned land cells. */
  friendlySides:number;
  /** Number of nearby live contested border cells in this attack. */
  borderSize:number;
  relativePower:number;
  neutral:boolean;
  capital:boolean;
  doctrine?:'expand'|'blitz'|'fortify';
}

export interface TileOutcome {
  /** Fraction of simulation tick spent conquering this tile. */
  time:number;
  /** Soldiers killed in the attacking committed army. */
  attackerLoss:number;
  /** Actual living troops killed in the defending nation. */
  defenderLoss:number;
  /** How many stationed defenders are lost before reservists. */
  postedLoss:number;
}

function clamp(v:number,lo:number,hi:number):number {
  return Math.min(hi,Math.max(lo,Number.isFinite(v)?v:lo));
}

export function frontTileOutcome(input:TileClash):TileOutcome {
  const army=Math.max(.001,input.attackTroops);
  const contact=clamp(input.friendlySides,1,4);
  const border=clamp(input.borderSize,1,100);
  const widthBonus=Math.sqrt(border)*(.78+.22*Math.sqrt(contact));
  if(input.neutral){
    // A neutral expansion costs some real soldiers and becomes faster with
    // larger armies and a wider front. Never allow unlimited per-tick jumps.
    const time=clamp(7/(Math.sqrt(army)*widthBonus),.06,1.25);
    const attackerLoss=clamp(.40+1.3/Math.sqrt(army),.25,2.2);
    return {time,attackerLoss:Math.min(army,attackerLoss),
      defenderLoss:0,postedLoss:0};
  }
  const density=Math.max(0,input.defenderPopulation)/
    Math.max(1,input.defenderTerritory);
  const relative=Math.max(.6,Math.min(1.4,input.relativePower));
  const ratio=clamp(input.defenderPopulation/army,.35,8);
  const fort=1+Math.max(0,input.defenseStrength-11)*.018+
    (input.capital?.35:0)+(input.doctrine==='fortify'?.20:0);
  const defenses=Math.max(0,input.postedTroops);
  // A smaller attacking army pays an increasingly high price for each cell;
  // extra soldiers reduce casualties but not to zero.
  const attrition=clamp(ratio,.52,2.6);
  const attackerLoss=clamp((.45+density*.24)*attrition*fort/relative,.18,
    army*.75);
  // Defenders lose a proportional slice of their army per captured tile.
  // Real posted troops die first, otherwise the living mobile reserve pays.
  const expectedLoss=clamp(density*(input.capital?1.25:1)+
    Math.min(defenses,.6),.12,Math.max(.12,input.defenderPopulation));
  const postedLoss=Math.min(defenses,expectedLoss);
  const defenderLoss=Math.min(expectedLoss,
    Math.max(0,input.defenderReserve)+defenses);
  const time=clamp((.16+ratio*.045)*fort/(Math.max(.70,relative)*widthBonus),
    .045,2.4);
  return {time,attackerLoss,defenderLoss,postedLoss};
}

/** Cancellation on two armies striking each other. Returns survivors without
 * creating or duplicating soldiers; national casualties account for both.
 */
export function opposingArmies(a:number,b:number):{
  a:number;b:number;lossA:number;lossB:number;
} {
  const killed=Math.min(Math.max(0,a),Math.max(0,b));
  return {a:Math.max(0,a-killed),b:Math.max(0,b-killed),
    lossA:killed,lossB:killed};
}
