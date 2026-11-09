import type {Faction,Point} from './config.js';

/** Original three-power commander progression. Experience comes from real
 * hits and territory capture, never wall-clock income or fabricated units. */
export type GeneralAbility='recon'|'repair'|'artillery';
export interface GeneralAbilitySpec{
 name:string;cost:number;cooldown:number;radius:number;description:string;
}
export const GENERAL_ABILITIES:Readonly<Record<GeneralAbility,GeneralAbilitySpec>>=Object.freeze({
 recon:{
  name:'Aufklärungsdrohne',cost:1,cooldown:100,radius:560,
  description:'30 Sekunden lang einen Bereich aufklären; Gegner bleiben im Kriegsnebel versteckt, bis die Drohne dort Sicht hat.'
 },
 repair:{
  name:'Reparaturabwurf',cost:2,cooldown:140,radius:250,
  description:'Repariert eigene Truppen und Gebäude um bis zu 25 % ihrer maximalen Lebenspunkte.'
 },
 artillery:{
  name:'Artillerieschlag',cost:3,cooldown:175,radius:205,
  description:'Sechs zeitversetzte Artilleriegranaten treffen die Zielzone. Geschützte Stellungen nehmen geringeren Flächenschaden.'
 }
});
export const GENERAL_ABILITY_KINDS=Object.keys(GENERAL_ABILITIES) as GeneralAbility[];
export const GENERAL_XP_PER_POINT=240;
export const MAX_COMMAND_POINTS=6;
export interface GeneralState{
 xp:number;points:number;earned:number;
 cooldowns:Record<GeneralAbility,number>;
}
export interface GeneralBeacon extends Point {
 id:number;owner:Faction;until:number;
}
export interface GeneralEvent extends Point {
 id:number;owner:Faction;kind:GeneralAbility;at:number;
}
export function newGeneralState():GeneralState{
 return {xp:0,points:0,earned:0,cooldowns:{recon:0,repair:0,artillery:0}};
}
export function earnGeneralExperience(s:GeneralState,damage:number,killed=false):number{
 if(!Number.isFinite(damage)||damage<=0||s.points>=MAX_COMMAND_POINTS)return 0;
 s.xp=Math.max(0,Math.min(GENERAL_XP_PER_POINT*5,s.xp+damage*.22+(killed?24:0)));
 let gained=0;
 while(s.xp>=GENERAL_XP_PER_POINT&&s.points<MAX_COMMAND_POINTS){
  s.xp-=GENERAL_XP_PER_POINT;s.points++;s.earned++;gained++;
 }
 if(s.points>=MAX_COMMAND_POINTS)s.xp=Math.min(s.xp,GENERAL_XP_PER_POINT-.01);
 return gained;
}
export function canUseGeneralPower(s:GeneralState,kind:GeneralAbility,now:number):boolean{
 const spec=GENERAL_ABILITIES[kind];
 return Boolean(spec)&&Number.isFinite(now)&&now>=0&&
  s.points>=spec.cost&&now>=s.cooldowns[kind];
}
export function spendGeneralPower(s:GeneralState,kind:GeneralAbility,now:number):boolean{
 if(!canUseGeneralPower(s,kind,now))return false;
 const spec=GENERAL_ABILITIES[kind];
 s.points-=spec.cost;s.cooldowns[kind]=now+spec.cooldown;
 return true;
}
export function validGeneralState(x:unknown,time:number):x is GeneralState{
 if(!x||typeof x!=='object')return false;
 const s=x as GeneralState;
 return Number.isFinite(s.xp)&&s.xp>=0&&s.xp<GENERAL_XP_PER_POINT&&
  Number.isInteger(s.points)&&s.points>=0&&s.points<=MAX_COMMAND_POINTS&&
  Number.isInteger(s.earned)&&s.earned>=0&&s.earned<=1_000_000&&
  s.cooldowns&&typeof s.cooldowns==='object'&&
  GENERAL_ABILITY_KINDS.every(k=>Number.isFinite(s.cooldowns[k])&&s.cooldowns[k]>=0&&
   s.cooldowns[k]<=time+GENERAL_ABILITIES[k].cooldown+1);
}
export function validGeneralBeacon(x:unknown,size:number,time:number):x is GeneralBeacon{
 if(!x||typeof x!=='object')return false;
 const b=x as GeneralBeacon;
 return Number.isInteger(b.id)&&b.id>=0&&(b.owner===0||b.owner===1)&&
  Number.isFinite(b.x)&&Number.isFinite(b.y)&&
  b.x>=0&&b.y>=0&&b.x<=size&&b.y<=size&&
  Number.isFinite(b.until)&&b.until>time&&b.until<=time+30.01;
}
/** Deterministic six-shell pattern for reproducible saves, hit zones and AI. */
export function generalArtilleryOffsets(seed:number,serial:number):Readonly<{x:number;y:number}>[]{
 const offsets: {x:number;y:number}[]=[];
 let n=(seed^Math.imul(serial,0x9e3779b1))>>>0;
 for(let i=0;i<6;i++){
  n=(Math.imul(n,1664525)+1013904223)>>>0;
  const phase=i*Math.PI*2/6+(n/4294967296-.5)*.35;
  n=(Math.imul(n,1664525)+1013904223)>>>0;
  const r=23+(n/4294967296)*110;
  offsets.push({x:Math.cos(phase)*r,y:Math.sin(phase)*r});
 }
 return offsets;
}
