import {RULES,distance,type Point} from './config.js';
import {unitSpec,weaponDamage} from './catalog.js';
import type {Unit} from './simulation.js';

/** Original Atlas doctrine: estimates use HP, real damage/cooldown and range.
 * Inputs are deliberately observations, never a Simulation or enemy lookup. */
export interface ObservedTower extends Point {id:number;hp:number;range:number}
export interface BattleAssessment {at:number;own:number;enemy:number;deficit:number;towers:number;neededSiege:number;stance:'attack'|'siege'|'reinforce'|'withdraw'}
export interface Withdrawal extends Point {unit:number;since:number;until:number}
export interface FailedFront extends Point {sector:number;at:number;until:number;power:number;towers:number;failures:number}
export interface BattleSquad {role:'assault'|'defense'|'raid';ids:number[];target:number|null;since:number}
export interface BattleState {version:1;withdrawals:Withdrawal[];fronts:FailedFront[];squads:BattleSquad[];assessment?:BattleAssessment;reactions:number;retreats:number}
export const newBattle=():BattleState=>({version:1,withdrawals:[],fronts:[],squads:[],reactions:0,retreats:0});
const fighting=(u:Unit)=>u.hp>0&&!u.carrier&&!['engineer','medic','scout'].includes(u.kind);
export function fightingPower(units:readonly Unit[],armored=false):number{
 return units.filter(fighting).reduce((n,u)=>{
  const s=unitSpec(u),damage=armored?weaponDamage(u,{kind:'turret',queue:[]}):s.damage;
  return n+Math.sqrt(u.hp*damage/s.cooldown)*(s.range>=RULES.turret.range?1.15:1);
 },0);
}
export function assessBattle(units:readonly Unit[],enemies:readonly Unit[],towers:readonly ObservedTower[],at:number,engaged=false):BattleAssessment{
 const own=fightingPower(units,towers.length>0),mobile=fightingPower(enemies),siege=units.filter(u=>fighting(u)&&u.kind==='artillery').length;
 const fort=towers.reduce((n,t)=>n+Math.sqrt(t.hp*RULES.turret.damage/RULES.turret.cooldown)*1.35,0),enemy=mobile+fort;
 const neededSiege=towers.length?Math.min(3,Math.ceil(towers.length/2)):0;
 // Artillery's genuine range advantage changes the engagement: screens need
 // to contain mobile defenders, rather than absorb every tower simultaneously.
 const screens=fightingPower(units.filter(u=>u.kind!=='artillery'));
 const canSiege=siege>0&&screens>=mobile*.9&&units.filter(fighting).length>=2;
 const required=enemy*1.15,deficit=Math.max(0,required-own);
 const stance=towers.length&&canSiege?'siege':own>=required&&own>0?'attack':engaged&&own<enemy*.8?'withdraw':'reinforce';
 return {at,own,enemy,deficit,towers:towers.length,neededSiege,stance};
}
/** Remember the actual failed front, not a seed or a hard-coded bastion ID. */
export function recordFailure(s:BattleState,sector:number,p:Point,power:number,towers:number,time:number):void{
 const old=s.fronts.find(f=>f.sector===sector&&distance(f,p)<400),failures=(old?.failures??0)+1;
 const value={x:p.x,y:p.y,sector,power,towers,at:time,until:time+Math.min(120,20*failures),failures};
 if(old)Object.assign(old,value);else s.fronts.push(value);s.fronts=s.fronts.slice(-16);
}
export function retryFront(s:BattleState,sector:number,power:number,towers:number,siege:number,time:number):boolean{
 const f=s.fronts.find(f=>f.sector===sector);if(!f)return true;
 // A stronger force or newly available counter may retry before the cooldown.
 return siege>0||towers<f.towers||power>f.power*1.3||time>=f.until;
}
export function validBattle(raw:unknown,time:number,point:(p:Point)=>boolean,sectors:number):boolean{
 if(raw===undefined)return true;const s=raw as BattleState,id=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
 const num=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0,at=(n:unknown)=>num(n)&&(n as number)<=time+.001;
 return !!s&&s.version===1&&id(s.reactions)&&id(s.retreats)
  &&Array.isArray(s.withdrawals)&&s.withdrawals.length<=RULES.capacity&&s.withdrawals.every(w=>point(w)&&id(w.unit)&&at(w.since)&&num(w.until)&&w.until>=w.since&&w.until<=time+120)
  &&Array.isArray(s.fronts)&&s.fronts.length<=16&&s.fronts.every(f=>point(f)&&id(f.sector)&&f.sector<sectors&&at(f.at)&&num(f.until)&&f.until>=f.at&&f.until<=time+120&&num(f.power)&&id(f.towers)&&id(f.failures))
  &&Array.isArray(s.squads)&&s.squads.length<=3&&s.squads.every(q=>['assault','defense','raid'].includes(q.role)&&at(q.since)&&(q.target===null||id(q.target))&&Array.isArray(q.ids)&&q.ids.length<=RULES.capacity&&new Set(q.ids).size===q.ids.length&&q.ids.every(id))
  &&(s.assessment===undefined||(at(s.assessment.at)&&[s.assessment.own,s.assessment.enemy,s.assessment.deficit].every(num)&&id(s.assessment.towers)&&id(s.assessment.neededSiege)&&s.assessment.neededSiege<=3&&['attack','siege','reinforce','withdraw'].includes(s.assessment.stance)));
}
