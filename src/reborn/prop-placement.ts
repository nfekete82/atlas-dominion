import {BUILDINGS,unitSpec} from './catalog.js';
import {buildingArtWidth} from './visual-scale.js';
import type {Simulation} from './simulation.js';
import type {GroundDetail} from './battlefield-atmosphere.js';

/** Read-only presentation check. Occupied decorations disappear, never obstruct.
 * Test the visual facade as well as the collider, including unfinished sites. */
export function propSiteClear(point:{x:number;y:number},size:number,game:Simulation,host?:{base:number}|{territory:number}):boolean {
 const pad=size*.55;
 if(point.x-pad<0||point.y-pad<0||point.x+pad>game.world.size||point.y+pad>game.world.size)return false;
 if(game.world.blocked[game.world.index(point)])return false;
 for(const b of game.bases){
  if(host&&'base' in host&&b.id===host.base)continue;
  const spec=BUILDINGS[b.kind],w=buildingArtWidth(b.kind,spec.width);
  if(Math.abs(point.x-b.x)<w*.55+pad&&point.y>b.y-w*.95-pad&&point.y<b.y+spec.radius*.7+pad)return false;
 }
 for(const t of game.territories)if(!(host&&'territory' in host&&t.id===host.territory)&&Math.hypot(point.x-t.point.x,point.y-t.point.y)<105+pad)return false;
 for(const u of game.units)if(u.hp>0&&!u.carrier&&!unitSpec(u).flying&&Math.hypot(point.x-u.x,point.y-u.y)<unitSpec(u).radius+pad+12)return false;
 return true;
}
export function environmentPropVisible(detail:GroundDetail,game:Simulation):boolean {
 // Palms include the canopy; skulls use a discreet, hand-sized ground footprint.
 return propSiteClear(detail,detail.kind==='palm'?detail.radius*3.3:detail.radius*2.5,game);
}
