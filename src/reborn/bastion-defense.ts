import {distance,type Point} from './config.js';
import {RULES} from './config.js';
import {inside} from './world.js';
import type {Simulation,Unit} from './simulation.js';

/** A few defensive towers protect valuable fronts without replacing a mobile army. */
export const defensiveTowerLimit=(sectors:number):number=>Math.min(4,Math.max(1,Math.floor(sectors/4)));

export interface BastionDefenseCandidate {sector:number;score:number;threat:Point}

/** Rank only public territorial ownership and enemies actually visible to red.
 * Never use hidden enemy positions or future opponent orders. */
export function rankBastionDefenses(g:Simulation):BastionDefenseCandidate[]{
 const towers=g.bases.filter(b=>b.owner===1&&b.kind==='turret'&&b.hp>0);
 const friendlyHq=new Set(g.bases.filter(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0).map(b=>b.territory));
 const visible=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u));
 const ranked:BastionDefenseCandidate[]=[];
 for(const t of g.territories){
  if(t.owner!==1||towers.some(b=>distance(b,t.point)<380))continue;
  const front=t.neighbors.map(id=>g.territories[id]).filter(n=>n.owner!==1);
  if(!front.length)continue;
  const hostile=front.filter(n=>n.owner===0);
  const threats=hostile.length?hostile:front;
  const threat=threats.slice().sort((a,b)=>distance(a.point,t.point)-distance(b.point,t.point)||a.id-b.id)[0];
  const nearby=visible.filter(u=>distance(u,t.point)<RULES.turret.sight);
  const score=hostile.length*1500+(friendlyHq.has(t.id)?0:550)+t.income*8+nearby.length*100;
  ranked.push({sector:t.id,score,threat:nearby[0]??threat.point});
 }
 return ranked.sort((a,b)=>b.score-a.score||a.sector-b.sector);
}

/** Site is behind the observed/front-facing approach, inside *owned* land,
 * outside the capture ring. All terrain, fog and building rules are checked
 * through the same API as player construction. */
export function buildBastionDefense(g:Simulation,workers:Unit[],dangerAt:(p:Point)=>number):number|null{
 const idle=workers.filter(u=>u.owner===1&&u.kind==='engineer'&&u.hp>0&&!u.carrier&&u.defendUntil<=g.time&&!u.orders.length);
 if(!idle.length)return null;
 const offsets=[0,Math.PI/8,-Math.PI/8,Math.PI/4,-Math.PI/4,3*Math.PI/8,-3*Math.PI/8,Math.PI/2,-Math.PI/2,Math.PI];
 for(const candidate of rankBastionDefenses(g)){
  const t=g.territories[candidate.sector];
  const from=candidate.threat,back=Math.atan2(t.point.y-from.y,t.point.x-from.x);
  for(const radius of [145,190,235]){
   for(const offset of offsets){
    const angle=back+offset,p={x:t.point.x+Math.cos(angle)*radius,y:t.point.y+Math.sin(angle)*radius};
    if(!inside(p,t.polygon)||dangerAt(p)>=2||g.buildError(1,'turret',p))continue;
    for(const worker of idle.slice().sort((a,b)=>distance(a,p)-distance(b,p)||a.id-b.id)){
     const built=g.build(1,'turret',p,[worker.id]);
     if(built)return candidate.sector;
    }
   }
  }
 }
 return null;
}
