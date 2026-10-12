/** Four OpenFront-inspired but independently balanced AI difficulties.
 * Values apply to computer-controlled countries ONLY. The human player's
 * initial army, taxes, construction prices and damage stay identical.
 */
export type Difficulty = 'relaxed'|'balanced'|'intense'|'impossible';
export interface DifficultySettings {
  readonly label:string;
  readonly description:string;
  readonly aiStartingTroops:number;
  readonly growthMultiplier:number;
  readonly activityMultiplier:number;
  readonly marchMultiplier:number;
  readonly defenseMultiplier:number;
  readonly riskBonus:number;
  readonly cityInterval:number;
}

export const DIFFICULTY_SETTINGS:Readonly<Record<Difficulty,DifficultySettings>>={
  relaxed:{
    label:'Entspannt',description:'Weniger KI-Truppen, langsamere Angriffe und zurückhaltende Verteidigung.',
    aiStartingTroops:65,growthMultiplier:.85,activityMultiplier:.65,
    marchMultiplier:.7,defenseMultiplier:.75,riskBonus:-.05,cityInterval:180,
  },
  balanced:{
    label:'Ausgeglichen',description:'Die bewährte v1.4-KI mit fairen, aktiven Gegnern.',
    aiStartingTroops:90,growthMultiplier:1,activityMultiplier:1,
    marchMultiplier:1,defenseMultiplier:1,riskBonus:0,cityInterval:100,
  },
  intense:{
    label:'Intensiv',description:'Stärkere KI, schnellere Expansion und mehr Druck an deinen Grenzen.',
    aiStartingTroops:120,growthMultiplier:1.14,activityMultiplier:1.2,
    marchMultiplier:1.2,defenseMultiplier:1.2,riskBonus:.025,cityInterval:75,
  },
  impossible:{
    label:'Unmöglich',description:'Sehr starke, aggressive KI mit schnellem Städtebau und robuster Verteidigung.',
    aiStartingTroops:165,growthMultiplier:1.28,activityMultiplier:1.4,
    marchMultiplier:1.4,defenseMultiplier:1.4,riskBonus:.04,cityInterval:55,
  },
};

export const DIFFICULTIES:readonly Difficulty[]=['relaxed','balanced','intense','impossible'];
export function isDifficulty(value:unknown):value is Difficulty {
  return typeof value==='string' && Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS,value);
}
/** Computer tactical activity cannot become unbounded regardless of level. */
export function difficultyAttempts(base:number,difficulty:Difficulty):number {
  return Math.max(1,Math.min(25,Math.round(base*DIFFICULTY_SETTINGS[difficulty].activityMultiplier)));
}
export function difficultyDefenseBudget(available:number,base:number,difficulty:Difficulty):number {
  return Math.min(Math.max(0,available-30),Math.max(0,base)*DIFFICULTY_SETTINGS[difficulty].defenseMultiplier);
}
export function difficultyRisk(base:number,difficulty:Difficulty):number {
  return Math.max(0,Math.min(.22,base+DIFFICULTY_SETTINGS[difficulty].riskBonus));
}
