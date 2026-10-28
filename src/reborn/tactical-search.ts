import {RULES,clamp,type Point} from './config.js';
import {unitSpec,weaponDamage,canAttack,type UnitKind} from './catalog.js';
import {getVeterancyModifiers} from './veterancy.js';

/**
 * Bounded deterministic tactical look-ahead. The caller passes ONLY observed
 * enemy units and previously observed gun emplacements; this module cannot
 * inspect the Simulation, fog, map, or hidden enemies.
 *
 * These are expected losses, not an exact copy of the physics simulation.
 * Use the baseline director's safety gates before issuing any actual orders.
 */
export interface Combatant {
  id:number;
  kind:UnitKind;
  hp:number;
  xp?:number;
}
export interface KnownGun {
  id:number;
  hp:number;
  range:number;
}
export type Maneuver='assault'|'flank'|'siege'|'regroup';
export interface TacticalForecast {
  mode:Maneuver;
  score:number;
  ownLoss:number;
  enemyLoss:number;
  ownLossFraction:number;
  enemyLossFraction:number;
  seconds:number;
  projectedVictory:boolean;
}
export interface TacticalContext {
  allies:readonly Combatant[];
  observedEnemies:readonly Combatant[];
  knownGuns:readonly KnownGun[];
  storm:boolean;
  /** No influence from hidden units; tactical decision cannot see the world. */
}
const HORIZON=24;
const STEP=3;
const MAX_COMBATANTS=24;
const alive=(units:readonly Combatant[])=>units.filter(u=>u.hp>0&&u.kind!=='engineer'&&u.kind!=='medic').slice(0,MAX_COMBATANTS);
const totalHp=(units:readonly Combatant[])=>units.reduce((n,u)=>n+Math.max(0,u.hp),0);
function effectiveDps(unit:Combatant,targets:readonly Combatant[],fortified=false):number {
  const spec=unitSpec(unit),v=getVeterancyModifiers(unit);
  if(fortified){
    if(!canAttack(unit,{kind:'turret',queue:[]}))return 0;
    return Math.max(0,weaponDamage(unit,{kind:'turret',queue:[]})*v.damage*v.fireRate/spec.cooldown);
  }
  if(!targets.length)return 0;
  let weightedDamage=0,totalWeight=0;
  for(const target of targets){
    const weight=Math.max(1,Math.min(500,target.hp));
    if(canAttack(unit,target))weightedDamage+=weaponDamage(unit,target)*weight;
    totalWeight+=weight;
  }
  return totalWeight>0?Math.max(0,weightedDamage/totalWeight*v.damage*v.fireRate/spec.cooldown):0;
}
/** Existing healing roles absorb only applied damage. They never invent HP. */
function healing(allies:readonly Combatant[]):number {
  return allies.filter(u=>u.kind==='medic'&&u.hp>0).reduce((rate,u)=>rate+12*getVeterancyModifiers(u).healRate,0);
}
export function forecastManeuver(context:TacticalContext,mode:Exclude<Maneuver,'regroup'>):TacticalForecast {
  const allies=alive(context.allies),foes=alive(context.observedEnemies),guns=context.knownGuns.filter(g=>g.hp>0).slice(0,12);
  const allyHP=totalHp(allies),enemyHP=totalHp(foes)+guns.reduce((n,g)=>n+g.hp,0);
  const ownDps=allies.reduce((n,u)=>n+effectiveDps(u,foes),0),antiGunDps=allies.reduce((n,u)=>n+effectiveDps(u,[],true),0);
  const foeDps=foes.reduce((n,u)=>n+effectiveDps(u,allies),0);
  const gunDps=guns.length*RULES.turret.damage/RULES.turret.cooldown;
  const artillery=allies.filter(u=>u.kind==='artillery').length;
  const mobiles=allies.filter(u=>['rover','tank','heavy'].includes(u.kind)).length;
  const viableFlank=mobiles>=2&&foes.length>=3&&guns.length===0&&allies.length>=6;
  const viableSiege=artillery>0&&guns.length>0;
  // Impossible variants should never be selected by a score tie.
  if(mode==='flank'&&!viableFlank||mode==='siege'&&!viableSiege)return {
    mode,score:-1e9,ownLoss:0,enemyLoss:0,ownLossFraction:0,enemyLossFraction:0,seconds:HORIZON,projectedVictory:false
  };
  let own=allyHP,foe=totalHp(foes),gun=guns.reduce((n,g)=>n+g.hp,0),elapsed=0;
  const heal=healing(context.allies);
  for(let t=0;t<HORIZON&&own>0&&foe+gun>0;t+=STEP){
    const penetration=t/(HORIZON-STEP);
    const assaultRate=mode==='flank'&&t<6?.48:mode==='siege'&&t<3?.7:1;
    const flankBenefit=mode==='flank'&&t>=6?1.17:1;
    const siegeBenefit=mode==='siege'?1.25:1;
    const exposure=mode==='flank'?(t<6?.55:.69):mode==='siege'?.8:1;
    const suppression=context.storm?.93:1;
    // An artillery screen may stand outside a known turret's gun range.
    const gunExposure=mode==='siege'?.30:mode==='flank'?.7:1;
    const friendlyFirePower=clamp(own/Math.max(1,allyHP),.16,1);
    const enemyFirePower=clamp((foe+gun)/Math.max(1,enemyHP),.12,1);
    const antiInfantry=ownDps*friendlyFirePower*assaultRate*flankBenefit*suppression;
    const antiTower=antiGunDps*friendlyFirePower*assaultRate*siegeBenefit*(context.storm?.85:1);
    // Resolve a bounded expected exchange, not random simulated projectiles.
    const fightFoe=Math.min(foe,antiInfantry*STEP*(gun>0&&mode==='siege'?.3:1));
    const fightGun=Math.min(gun,antiTower*STEP*(gun>0&&(mode==='siege'||foe===0)?1:.35));
    const rawIncoming=(foeDps*(foe/Math.max(1,totalHp(foes)))+
      gunDps*(gun/Math.max(1,guns.reduce((n,g)=>n+g.hp,0))))*enemyFirePower*exposure*gunExposure;
    const actualIncoming=Math.min(own,Math.max(0,rawIncoming-(!foes.length?0:Math.min(heal,rawIncoming*.6)))*STEP);
    own-=actualIncoming;foe-=fightFoe;gun-=fightGun;elapsed+=STEP;
    void penetration;
  }
  const ownLoss=Math.max(0,allyHP-own),enemyLoss=Math.max(0,enemyHP-foe-gun);
  const ownLossFraction=ownLoss/Math.max(1,allyHP);
  const enemyLossFraction=enemyLoss/Math.max(1,enemyHP);
  const victory=foe+gun<=1e-7&&own>1e-7;
  // Favors progress and preservation, penalizes never arriving at the objective.
  const timeCost=mode==='flank'?55:mode==='siege'?18:0;
  const score=enemyLoss/Math.max(1,enemyHP)*600-ownLossFraction*490-
    (victory?elapsed:HORIZON)*1.2-timeCost+(victory?170:0);
  return {mode,score,ownLoss,enemyLoss,ownLossFraction,enemyLossFraction,seconds:elapsed,projectedVictory:victory};
}
export interface TacticalChoice {mode:Maneuver;forecasts:TacticalForecast[];reason:string}
export function chooseTacticalManeuver(context:TacticalContext):TacticalChoice {
  const allies=alive(context.allies),enemies=alive(context.observedEnemies);
  const guns=context.knownGuns.filter(g=>g.hp>0);
  if(!allies.length)return {mode:'regroup',forecasts:[],reason:'no-combat-force'};
  if(!enemies.length&&!guns.length)return {mode:'assault',forecasts:[],reason:'uncontested'};
  const forecasts=(['assault','flank','siege'] as const).map(mode=>forecastManeuver(context,mode))
    .sort((a,b)=>b.score-a.score||(['assault','siege','flank'].indexOf(a.mode)-['assault','siege','flank'].indexOf(b.mode)));
  const best=forecasts[0];
  if(best.ownLossFraction>.75&&best.enemyLossFraction<.48&&!best.projectedVictory)
    return {mode:'regroup',forecasts,reason:'unfavorable-attrition'};
  if(guns.length>0&&!allies.some(u=>u.kind==='artillery')&&best.ownLossFraction>.6)
    return {mode:'regroup',forecasts,reason:'insufficient-siege'};
  return {mode:best.mode,forecasts,reason:'bounded-lookahead'};
}
/** Candidate side approach; caller checks current path and map legality. */
export function flankCandidate(anchor:Point,goal:Point,side:-1|1):Point {
 const dx=goal.x-anchor.x,dy=goal.y-anchor.y,d=Math.max(1,Math.hypot(dx,dy));
 return {x:goal.x-dy/d*275*side-dx/d*160,y:goal.y+dx/d*275*side-dy/d*160};
}
