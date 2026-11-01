import {RULES,distance,type Point,type Owner,type MapVersion} from './config.js';
import type {Territory} from './world.js';

/** Rules are symmetric for BLUE and RED. The older saved map generations keep
 * their original fixed eight-second, adjacent-only territory mechanics. */
export const dynamicTerritoryWarfare=(version:MapVersion):boolean=>version>=11;

/** A tactical leap may reach an ENEMY-held sector exactly one territory beyond
 * the ordinary front. Neutral sectors still require a connected capture. */
export function canCaptureSector(territories:readonly Territory[],sector:Territory,owner:Owner,version:MapVersion):boolean{
 if(owner!==0&&owner!==1||sector.owner===owner)return false;
 if(sector.neighbors.some(id=>territories[id]?.owner===owner))return true;
 return dynamicTerritoryWarfare(version)&&sector.owner===1-owner&&
  sector.neighbors.some(id=>territories[id]?.neighbors.some(next=>territories[next]?.owner===owner));
}

export interface TerritoryGuard extends Point {owner:Owner;hp:number;carrier?:number|null}
export interface TerritoryBattery extends Point {owner:Owner;hp:number;kind:string;buildRemaining?:number}
/** Only a truly exposed ENEMY sector is recaptured quickly. Nearby defenders
 * or a live turret in firing range preserve the full capture duration.
 * This authoritative physical rule does not feed enemy locations into AI. */
export function captureSeconds(input:{
 version:MapVersion;territory:Territory;attacker:Owner;units:readonly TerritoryGuard[];bases:readonly TerritoryBattery[];
}):number{
 const {version,territory:t,attacker,units,bases}=input;
 if(!dynamicTerritoryWarfare(version)||t.owner!==1-attacker)return RULES.captureTime;
 const defended=units.some(u=>u.owner===t.owner&&u.hp>0&&!u.carrier&&distance(u,t.point)<260)
  ||bases.some(b=>b.owner===t.owner&&b.hp>0&&b.kind==='turret'
    &&(b.buildRemaining??0)<=0&&distance(b,t.point)<=RULES.turret.range+30);
 return defended?RULES.captureTime:5;
}

/** Observable sector counts, not hidden units/economy: the same two-sector
 * deficit threshold applies regardless of which faction is losing. */
export function comebackPressure(territories:readonly Territory[],owner:Owner):boolean{
 if(owner!==0&&owner!==1)return false;
 return territories.filter(t=>t.owner===1-owner).length-territories.filter(t=>t.owner===owner).length>=2;
}

export interface RaidOpportunity extends Point {id:number;owner:number;income:number;routeLength:number;routeRisk:number;protected:boolean;recentlyLost:boolean}
/** Objective ranking is public-income based, risk-first, and reproducible.
 * Dangerous towers and unseen threats never become attractive via income. */
export function chooseComebackOpportunity(fronts:readonly RaidOpportunity[]):RaidOpportunity|undefined{
 return fronts.filter(t=>t.owner===0&&!t.protected&&Number.isFinite(t.routeLength)
   &&t.routeLength>0&&Number.isFinite(t.routeRisk)&&t.routeRisk<8)
  .slice().sort((a,b)=>{
   const score=(t:RaidOpportunity)=>t.routeLength+t.routeRisk*125-t.income*18-(t.recentlyLost?300:0);
   return score(a)-score(b)||a.id-b.id;
  })[0];
}
