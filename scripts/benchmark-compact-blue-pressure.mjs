/** Budget-constrained offensive opponent. Only uses public sector control,
 * normal paid production and ordinary move/attack orders. */
import {blueDefense} from './benchmark-ai-opponent.mjs';
export function bluePressure(g){
 blueDefense(g);
 if(g.status!=='playing'||g.time<55)return;
 const home=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 if(!home)return;
 const army=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&['infantry','heavy'].includes(u.kind));
 if(army.length<3)return;
 const fronts=g.territories.filter(t=>t.owner!==0);
 if(!fronts.length)return;
 fronts.sort((a,b)=>{const rank=t=>Math.hypot(t.point.x-home.x,t.point.y-home.y)+(t.owner===1?0:240);
  return rank(a)-rank(b)||a.id-b.id;});
 const target=fronts[0].point;
 const fighters=army.slice().sort((a,b)=>a.id-b.id).slice(1);
 const need=fighters.filter(u=>!u.orders.some(o=>o.kind==='attackMove'&&Math.hypot(o.x-target.x,o.y-target.y)<95));
 if(need.length)g.command(need.map(u=>u.id),{...target,kind:'attackMove'});
}
