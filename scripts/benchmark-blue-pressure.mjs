/** Offensive BLUE benchmark opponent. Never reads invisible RED units, uses
 * only public sector ownership and normal paid build/recruit/command actions.
 * Retains one defending infantry if possible and advances with a group.
 * This is a synthetic opponent, not a proxy for a human's game sense. */
import {blueDefense} from './benchmark-ai-opponent.mjs';
export function bluePressure(g){
 blueDefense(g);
 if(g.status!=='playing'||g.time<55)return;
 const owned=g.territories.filter(t=>t.owner===0);
 const candidates=g.territories.filter(t=>t.owner!==0&&t.owner>=-1);
 const home=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 if(!home||!candidates.length)return;
 const army=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
    (u.kind==='infantry'||u.kind==='heavy'));
 if(army.length<3)return;
 const target=candidates.sort((a,b)=>
    (a.owner===1?0:240)+Math.hypot(a.point.x-home.x,a.point.y-home.y)-
    ((b.owner===1?0:240)+Math.hypot(b.point.x-home.x,b.point.y-home.y))||a.id-b.id)[0];
 const attackers=army.slice().sort((a,b)=>a.id-b.id).slice(1);
 const need=attackers.filter(u=>!u.orders.some(o=>o.kind==='attackMove'&&
    Math.hypot(o.x-target.point.x,o.y-target.point.y)<95));
 if(need.length)g.command(need.map(u=>u.id),{...target.point,kind:'attackMove'});
}
