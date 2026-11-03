/** Fully paid and deterministic BLUE opponents for RED headless qualification.
 * They know public sector ownership and own units only, never hidden RED units.
 * Construction and recruitment are delegated to the existing blueDefense
 * baseline and go through the game's actual priced APIs. */
import {blueDefense} from './benchmark-ai-opponent.mjs';

export const OPPONENTS=['guarded','rush','expansion'];
export function scriptedOpponent(profile){
 if(!OPPONENTS.includes(profile))throw Error('invalid opponent: '+profile);
 if(profile==='guarded')return blueDefense;
 return g=>{
  blueDefense(g);
  if(g.status!=='playing')return;
  const home=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
  if(!home)return;
  const army=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
    ['infantry','heavy','tank','rover'].includes(u.kind))
    .sort((a,b)=>a.id-b.id);
  const min=profile==='rush'?2:3,earliest=profile==='rush'?30:65;
  if(g.time<earliest||army.length<min)return;
  // The defending soldier stays near home. BLUE cannot use or direct
  // opponents it cannot see, including the enemy HQ's exact coordinates.
  const active=army.slice(1);
  const targets=g.territories.filter(t=>t.owner!==0);
  if(!targets.length)return;
  const other=targets.filter(t=>t.owner===1);
  const score=t=>{
   const distance=Math.hypot(t.point.x-home.x,t.point.y-home.y);
   return profile==='rush'?distance+(t.owner===1?-100:100):
     distance-t.income*14+(t.owner===-1?-280:0);
  };
  const goal=targets.sort((a,b)=>score(a)-score(b)||a.id-b.id)[0];
  // Reissuing only on changed objective avoids synthetic order spam.
  const move=active.filter(u=>!u.orders.some(o=>o.kind==='attackMove'&&
    Math.hypot(o.x-goal.point.x,o.y-goal.point.y)<100));
  if(move.length)g.command(move.map(u=>u.id),{...goal.point,kind:'attackMove'});
  void other;
 };
}
