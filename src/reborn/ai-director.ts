/**
 * Pure RTS battle doctrine. Deterministic: no hidden world access, random
 * numbers, web calls, or language-model decisions.
 * Kept separate from the simulation so the commander can be regression-tested.
 */
export interface AssaultContext {
  defended: boolean;
  observedTowers: number;
  hasArtillery: boolean;
  visibleDefenderStrength: number;
  readyUnits: number;
  readyStrength: number;
  phaseSeconds: number;
  inRegroup: boolean;
  clusteredRecentLosses: boolean;
  scoutingOpening: boolean;
}

export interface AssaultDecision {
  launch: boolean;
  requiredUnits: number;
  requiredStrength: number;
  reason: 'ready'|'assembling'|'recovering'|'reconnaissance';
}

/** Commit smaller, paid squads quickly to undefended ground; concentrate for fortifications. */
export function assaultDecision(ctx: AssaultContext): AssaultDecision {
  const requiredUnits = ctx.defended
    ? (ctx.observedTowers && ctx.hasArtillery ? 4 : 5)
    : ctx.phaseSeconds >= 12 ? 2 : 3;
  const requiredStrength = ctx.defended
    ? Math.max(4.5, ctx.observedTowers*3.5 + ctx.visibleDefenderStrength*.85)
    : 2;
  if(ctx.inRegroup && ctx.phaseSeconds < 6)
    return {launch:false,requiredUnits,requiredStrength,reason:'recovering'};
  if(ctx.readyUnits>=requiredUnits && ctx.readyStrength>=requiredStrength)
    return {launch:true,requiredUnits,requiredStrength,reason:'ready'};
  if(ctx.scoutingOpening && !ctx.defended && !ctx.clusteredRecentLosses && ctx.readyUnits>=1)
    return {launch:true,requiredUnits,requiredStrength,reason:'reconnaissance'};
  return {launch:false,requiredUnits,requiredStrength,reason:'assembling'};
}

export interface AssaultHealth {
  launchSize: number;
  survivors: number;
  recentLosses: number;
  stalledSeconds: number;
  knownUncoveredTurret: boolean;
  hasSiegeWeapon: boolean;
  destinationStillContested: boolean;
}
export type AbortReason='captured'|'annihilated'|'crippled'|'stalled'|'uncovered-turret'|null;

/** Two casualties do not magically cancel a healthy 10-unit armored assault. */
export function abortAssault(x:AssaultHealth):AbortReason {
  if(!x.destinationStillContested)return 'captured';
  if(x.survivors<=0)return 'annihilated';
  const starting=Math.max(1,x.launchSize);
  const fraction=x.survivors/starting;
  if(fraction<.38 || (fraction<.52 && x.recentLosses>=Math.max(3,Math.ceil(starting*.4))))return 'crippled';
  if(x.stalledSeconds>95)return 'stalled';
  if(x.knownUncoveredTurret&&!x.hasSiegeWeapon)return 'uncovered-turret';
  return null;
}

/** A production building may work in parallel, but never spend unearned credits. */
export function preferredRole(kind:string,counts:Readonly<Record<string,number>>,
  knownTurrets:number,enemyAir:number):readonly string[] {
  switch(kind){
    case 'headquarters': return counts.engineer<1?['engineer']:[];
    case 'barracks':
      return counts.infantry<3?['infantry','heavy','medic']:
        counts.heavy<2?['heavy','infantry','medic']:
        counts.medic<Math.min(2,Math.ceil((counts.infantry+counts.heavy)/5))?
          ['medic','heavy','infantry']:['heavy','infantry','medic'];
    case 'factory':
      return knownTurrets>0&&counts.artillery<Math.min(3,knownTurrets+1)?
        ['artillery','tank','rover']:
        counts.tank<2?['tank','rover','artillery']:
        counts.rover<1?['rover','tank','artillery']:['tank','artillery','rover'];
    case 'airfield':
      return enemyAir>0?['gunship','scout','bomber']:
        counts.gunship<1?['gunship','scout','bomber']:
        counts.scout<1?['scout','gunship','bomber']:['gunship','bomber','scout'];
    default: return [];
  }
}
